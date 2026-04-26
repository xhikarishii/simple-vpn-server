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

  init(settings = {}) {
    const iface = this.getInterface();
    const wgSubnet = settings.wg_subnet || '10.8.0.0/24';
    const l2tpSubnet = settings.l2tp_subnet || '10.9.0.0/24'; // Usually derived from local_ip/range

    console.log(`Initializing firewall on interface: ${iface}`);
    
    // 1. Enable IP forwarding
    shell.exec('echo 1 > /proc/sys/net/ipv4/ip_forward');
    
    // 2. Clear existing VPN-managed rules to prevent duplicates during sync
    // We target the POSTROUTING NAT and FORWARD filter chains
    shell.exec(`iptables -t nat -D POSTROUTING -o ${iface} -j MASQUERADE 2>/dev/null`);
    shell.exec(`iptables -D FORWARD -s ${wgSubnet} -j ACCEPT 2>/dev/null`);
    shell.exec(`iptables -D FORWARD -s ${l2tpSubnet} -j ACCEPT 2>/dev/null`);

    // 3. Apply dynamic NAT rule
    shell.exec(`iptables -t nat -A POSTROUTING -o ${iface} -j MASQUERADE`);
    
    // 4. Stateful inspection
    shell.exec('iptables -C INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || iptables -A INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
    shell.exec('iptables -C FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');

    // 5. Basic protections (check if exists to avoid duplicates)
    const applyIfMissing = (chain, rule) => {
      if (shell.exec(`iptables -C ${chain} ${rule} 2>/dev/null`, { silent: true }).code !== 0) {
        shell.exec(`iptables -A ${chain} ${rule}`);
      }
    };

    applyIfMissing('INPUT', '-i lo -j ACCEPT');
    applyIfMissing('INPUT', '-m conntrack --ctstate INVALID -j DROP');
    applyIfMissing('INPUT', '-p tcp --tcp-flags ALL NONE -j DROP');
    applyIfMissing('INPUT', '-p tcp --tcp-flags ALL ALL -j DROP');
    applyIfMissing('INPUT', '-p tcp ! --syn -m state --state NEW -j DROP');

    // 6. VPN Ports (Dynamic based on settings if provided)
    const wgPort = settings.wg_port || 13895;
    applyIfMissing('INPUT', `-p udp --dport ${wgPort} -j ACCEPT`);
    applyIfMissing('INPUT', '-p udp --dport 500 -j ACCEPT');
    applyIfMissing('INPUT', '-p udp --dport 4500 -j ACCEPT');
    applyIfMissing('INPUT', '-p udp --dport 1701 -j ACCEPT');

    // 7. Dashboard Port
    const dashPort = settings.dashboard_port || 8877;
    applyIfMissing('INPUT', `-p tcp --dport ${dashPort} -j ACCEPT`);

    // 8. Dynamic Forwarding for Subnets
    shell.exec(`iptables -A FORWARD -s ${wgSubnet} -j ACCEPT`);
    shell.exec(`iptables -A FORWARD -s ${l2tpSubnet} -j ACCEPT`);

    // 11. Logging: Log blocked attempts (with limit to avoid log flooding)
    shell.exec('iptables -C INPUT -m set --match-set vpn_blocklist src -j LOG --log-prefix "VPN_BLOCK: " --log-level 4 2>/dev/null || iptables -I INPUT -m set --match-set vpn_blocklist src -j LOG --log-prefix "VPN_BLOCK: " --log-level 4');
    shell.exec('iptables -C FORWARD -m set --match-set vpn_blocklist src -j LOG --log-prefix "VPN_BLOCK: " --log-level 4 2>/dev/null || iptables -I FORWARD -m set --match-set vpn_blocklist src -j LOG --log-prefix "VPN_BLOCK: " --log-level 4');

    console.log('Firewall sync complete.');
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
