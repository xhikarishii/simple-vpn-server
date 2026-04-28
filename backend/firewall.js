const shell = require('shelljs');

// Validation helpers to prevent command injection
const isValidPort = (port) => /^[0-9]+$/.test(String(port)) && parseInt(port) > 0 && parseInt(port) <= 65535;
const isValidIp = (ip) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
const isValidProtocol = (proto) => ['tcp', 'udp'].includes(proto.toLowerCase());

const FirewallManager = {
  // Detect the default internet interface dynamically
  getInterface() {
    const res = shell.exec("ip route get 8.8.8.8 | grep -oP 'dev \\K\\S+'", { silent: true });
    return res.stdout.trim() || 'eth0';
  },

  init(settings = {}, whitelist = []) {
    const iface = this.getInterface();
    const wgSubnet = settings.wg_subnet || '10.8.0.0/24';
    const ovpnSubnet = settings.ovpn_subnet || '10.10.0.0/24';

    console.log(`Initializing hardened firewall on interface: ${iface}`);
    
    // 1. Enable IP forwarding
    shell.exec('echo 1 > /proc/sys/net/ipv4/ip_forward');
    
    // 2. Flush existing rules and set default policies
    // WARNING: We do this first to ensure a clean state, but we MUST allow SSH immediately after.
    shell.exec('iptables -F');
    shell.exec('iptables -X');
    shell.exec('iptables -P INPUT DROP');
    shell.exec('iptables -P FORWARD DROP');
    shell.exec('iptables -P OUTPUT ACCEPT');

    // 3. Stateful inspection (Allow established/related)
    shell.exec('iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
    shell.exec('iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');

    // 4. Loopback
    shell.exec('iptables -A INPUT -i lo -j ACCEPT');

    // 5. Whitelist (Safety net - Apply these first!)
    whitelist.forEach(item => {
      if (isValidIp(item.ip_or_subnet.split('/')[0])) {
        shell.exec(`iptables -A INPUT -s ${item.ip_or_subnet} -j ACCEPT`);
        shell.exec(`iptables -A FORWARD -s ${item.ip_or_subnet} -j ACCEPT`);
      }
    });

    // 6. SSH Protection (Rate limiting on port 22)
    // Allow 3 new connections per minute per IP, block subsequent
    shell.exec('iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --set --name SSH');
    shell.exec('iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 --name SSH -j DROP');
    shell.exec('iptables -A INPUT -p tcp --dport 22 -j ACCEPT');

    // 7. VPN Ports
    const wgPort = settings.wg_port || 13895;
    shell.exec(`iptables -A INPUT -p udp --dport ${wgPort} -j ACCEPT`);
    const ovpnPort = settings.ovpn_port || 443;
    shell.exec(`iptables -A INPUT -p udp --dport ${ovpnPort} -j ACCEPT`);

    // 8. Dashboard Ports
    const dashPort = settings.dashboard_port || 8877;
    shell.exec(`iptables -A INPUT -p tcp --dport ${dashPort} -j ACCEPT`);
    shell.exec('iptables -A INPUT -p tcp --dport 443 -j ACCEPT');

    // 9. DNS (from VPN subnets)
    shell.exec(`iptables -A INPUT -s ${wgSubnet} -p udp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A INPUT -s ${wgSubnet} -p tcp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A INPUT -s ${ovpnSubnet} -p udp --dport 53 -j ACCEPT`);
    shell.exec(`iptables -A INPUT -s ${ovpnSubnet} -p tcp --dport 53 -j ACCEPT`);

    // 10. NAT and Forwarding
    shell.exec(`iptables -t nat -A POSTROUTING -o ${iface} -j MASQUERADE`);
    shell.exec(`iptables -A FORWARD -s ${wgSubnet} -j ACCEPT`);
    shell.exec(`iptables -A FORWARD -s ${ovpnSubnet} -j ACCEPT`);

    // 11. Custom Blocklists (if ipset is available)
    shell.exec('iptables -I INPUT -m set --match-set vpn_blocklist src -j DROP 2>/dev/null');
    shell.exec('iptables -I FORWARD -m set --match-set vpn_blocklist src -j DROP 2>/dev/null');

    console.log('Firewall hardening complete.');
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
