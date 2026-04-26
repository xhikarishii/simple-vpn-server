const shell = require('shelljs');

const FirewallManager = {
  init() {
    // Enable IP forwarding
    shell.exec('echo 1 > /proc/sys/net/ipv4/ip_forward');
    
    // Default NAT rules
    shell.exec('iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE');
    shell.exec('iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT');
  },

  addPortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    const cmd = `iptables -t nat -A PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
    const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
  },

  removePortForward(externalPort, internalIp, internalPort, protocol = 'tcp') {
    const cmd = `iptables -t nat -D PREROUTING -p ${protocol} --dport ${externalPort} -j DNAT --to-destination ${internalIp}:${internalPort}`;
    const forwardCmd = `iptables -A FORWARD -p ${protocol} -d ${internalIp} --dport ${internalPort} -m conntrack --ctstate NEW,ESTABLISHED,RELATED -j ACCEPT`;
    
    shell.exec(cmd);
    shell.exec(forwardCmd);
  },

  listRules() {
    // This is a helper to see current rules in console
    return shell.exec('iptables -t nat -L -n -v', { silent: true }).stdout;
  }
};

module.exports = FirewallManager;
