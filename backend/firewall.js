const shell = require('shelljs');

// Validation helpers to prevent command injection
const isValidPort = (port) => /^[0-9]+$/.test(String(port)) && parseInt(port) > 0 && parseInt(port) <= 65535;
const isValidIp = (ip) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
const isValidProtocol = (proto) => ['tcp', 'udp'].includes(proto.toLowerCase());

const FirewallManager = {
  // Detect the default internet interface dynamically
  getInterface() {
    const res = shell.exec("ip route get 8.8.8.8 2>/dev/null | grep -oP 'dev \\K\\S+'", { silent: true });
    let iface = res.stdout.trim();
    if (!iface) {
      // Fallback: get the first non-loopback, non-vpn interface
      const fallback = shell.exec("ip -o link show | grep -v 'lo' | grep -v 'wg' | grep -v 'tun' | head -n1 | awk '{print $2}' | cut -d':' -f1", { silent: true });
      iface = fallback.stdout.trim() || 'eth0';
    }
    return iface;
  },

  init(settings = {}, whitelist = []) {
    const iface = this.getInterface();
    const wgSubnet = settings.wg_subnet || '10.8.0.0/24';
    const ovpnSubnet = settings.ovpn_subnet || '10.10.0.0/24';

    console.log(`Initializing hardened firewall on interface: ${iface}`);
    
    // 1. Enable IP forwarding
    shell.exec('echo 1 > /proc/sys/net/ipv4/ip_forward');
    
    // 2. Setup Custom Chains to avoid wiping host rules (like Docker's)
    shell.exec('iptables -N VPN_SERVER 2>/dev/null');
    shell.exec('iptables -F VPN_SERVER');
    
    // Ensure jump rules exist (at the top of INPUT and FORWARD)
    const checkInput = shell.exec('iptables -C INPUT -j VPN_SERVER 2>/dev/null', { silent: true });
    if (checkInput.code !== 0) shell.exec('iptables -I INPUT 1 -j VPN_SERVER');
    
    const checkForward = shell.exec('iptables -C FORWARD -j VPN_SERVER 2>/dev/null', { silent: true });
    if (checkForward.code !== 0) shell.exec('iptables -I FORWARD 1 -j VPN_SERVER');

    // 3. Set default policies (on the main chains, safely)
    shell.exec('iptables -P INPUT ACCEPT'); // Temporarily allow during reload
    shell.exec('iptables -P FORWARD ACCEPT');

    // 4. VPN_SERVER Chain Rules
    
    // A. Stateful inspection
    shell.exec('iptables -A VPN_SERVER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
    
    // B. Loopback
    shell.exec('iptables -A VPN_SERVER -i lo -j ACCEPT');

    // C. Whitelist (Safety net) - These are high priority
    whitelist.forEach(item => {
      if (isValidIp(item.ip_or_subnet.split('/')[0])) {
        shell.exec(`iptables -A VPN_SERVER -s ${item.ip_or_subnet} -j ACCEPT`);
      }
    });

    // D. SSH Protection
    shell.exec('iptables -A VPN_SERVER -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set --name SSH');
    shell.exec('iptables -A VPN_SERVER -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP');
    shell.exec('iptables -A VPN_SERVER -p tcp --dport 22 -j ACCEPT');

    // E. VPN Ports
    const wgPort = settings.wg_port || 13895;
    shell.exec(`iptables -A VPN_SERVER -p udp --dport ${wgPort} -j ACCEPT`);
    const ovpnPort = settings.ovpn_port || 443;
    shell.exec(`iptables -A VPN_SERVER -p udp --dport ${ovpnPort} -j ACCEPT`);

    // F. Dashboard Ports
    const dashPort = settings.dashboard_port || 8877;
    shell.exec(`iptables -A VPN_SERVER -p tcp --dport ${dashPort} -j ACCEPT`);
    shell.exec('iptables -A VPN_SERVER -p tcp --dport 443 -j ACCEPT');

    // G. DNS Access from VPN
    shell.exec(`iptables -A VPN_SERVER -s ${wgSubnet} -p udp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A VPN_SERVER -s ${wgSubnet} -p tcp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A VPN_SERVER -s ${ovpnSubnet} -p udp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A VPN_SERVER -s ${ovpnSubnet} -p tcp --dport 53 -j ACCEPT`);

    // H. VPN Traffic Forwarding
    shell.exec(`iptables -A VPN_SERVER -s ${wgSubnet} -j ACCEPT`);
    shell.exec(`iptables -A VPN_SERVER -s ${ovpnSubnet} -j ACCEPT`);

    // 5. NAT Table Management (Surgical)
    // Remove existing MASQUERADE rules for our VPN subnets to avoid duplicates
    shell.exec(`iptables -t nat -D POSTROUTING -s ${wgSubnet} -o ${iface} -j MASQUERADE 2>/dev/null`);
    shell.exec(`iptables -t nat -D POSTROUTING -s ${ovpnSubnet} -o ${iface} -j MASQUERADE 2>/dev/null`);
    
    // Add them back
    shell.exec(`iptables -t nat -A POSTROUTING -s ${wgSubnet} -o ${iface} -j MASQUERADE`);
    shell.exec(`iptables -t nat -A POSTROUTING -s ${ovpnSubnet} -o ${iface} -j MASQUERADE`);

    // 6. Blocklist Integration
    shell.exec('iptables -I VPN_SERVER 1 -m set --match-set vpn_blocklist src -j DROP 2>/dev/null');

    // 7. Finalize: Set default DROP policies
    shell.exec('iptables -P INPUT DROP');
    shell.exec('iptables -P FORWARD DROP');

    console.log('Firewall hardening complete via VPN_SERVER chain.');
  },

  addPortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    if (!isValidPort(externalPort) || !isValidPort(internalPort) || !isValidIp(internalIp) || !isValidProtocol(protocol)) {
      return false;
    }

    // Check if rule already exists to avoid duplicates
    const checkCmd = `iptables -t nat -C PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort} 2>/dev/null`;
    if (shell.exec(checkCmd, { silent: true }).code === 0) return true;

    const cmd = `iptables -t nat -A PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
    const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
    return true;
  },

  removePortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    if (!isValidPort(externalPort) || !isValidPort(internalPort) || !isValidIp(internalIp) || !isValidProtocol(protocol)) {
      return false;
    }

    const cmd = `iptables -t nat -D PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort} 2>/dev/null`;
    const forwardCmd = `iptables -D FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT 2>/dev/null`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
    return true;
  },

  listRules() {
    return shell.exec('iptables -t nat -L -n -v', { silent: true }).stdout;
  }
};

module.exports = FirewallManager;
