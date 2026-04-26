const shell = require('shelljs');

// Validation helpers to prevent command injection
const isValidPort = (port) => /^[0-9]+$/.test(String(port)) && parseInt(port) > 0 && parseInt(port) <= 65535;
const isValidIp = (ip) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
const isValidProtocol = (proto) => ['tcp', 'udp'].includes(proto.toLowerCase());

const FirewallManager = {
  init() {
    // Enable IP forwarding
    shell.exec('echo 1 > /proc/sys/net/ipv4/ip_forward');
    
    // Default NAT rules
    // Note: We use fixed strings for init to avoid any injection surface
    shell.exec('iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE');
    shell.exec('iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
  },

  addPortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    // Strict validation before execution
    if (!isValidPort(externalPort) || !isValidPort(internalPort) || !isValidIp(internalIp) || !isValidProtocol(protocol)) {
      console.error('Security Alert: Invalid firewall rule parameters detected.');
      return false;
    }

    const cmd = `iptables -t nat -A PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
    const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
    return true;
  },

  removePortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    // Strict validation before execution
    if (!isValidPort(externalPort) || !isValidPort(internalPort) || !isValidIp(internalIp) || !isValidProtocol(protocol)) {
      console.error('Security Alert: Invalid firewall rule parameters detected.');
      return false;
    }

    const cmd = `iptables -t nat -D PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
    const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
    return true;
  },

  listRules() {
    return shell.exec('iptables -t nat -L -n -v', { silent: true }).stdout;
  }
};

module.exports = FirewallManager;
