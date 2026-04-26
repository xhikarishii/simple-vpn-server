const shell = require('shelljs');
const fs = require('fs');

const L2TPManager = {
  updateUsers(users, psk) {
    // 1. Update ipsec.secrets
    const ipsecSecrets = `: PSK "${psk}"\n`;
    fs.writeFileSync('/etc/ipsec.secrets', ipsecSecrets);

    // 2. Update chap-secrets
    let chapSecrets = '';
    users.forEach(user => {
      chapSecrets += `"${user.username}" l2tpd "${user.password}" *\n`;
    });
    fs.writeFileSync('/etc/ppp/chap-secrets', chapSecrets);

    // Restart services robustly
    shell.exec('ipsec restart', { silent: true });
    shell.exec('pkill xl2tpd', { silent: true });
    shell.exec('/usr/sbin/xl2tpd', { silent: true });
  },

  initConfigs(settings = {}) {
    const localIp = settings.l2tp_local_ip || '10.9.0.1';
    const ipRange = settings.l2tp_ip_range || '10.9.0.2-10.9.0.255';
    
    const ipsecConfig = `
config setup
    uniqueids=no
    charondebug="ike 1, knl 1, cfg 2"

conn L2TP-PSK-NAT
    rightsubnet=0.0.0.0/0
    also=L2TP-PSK-noNAT

conn L2TP-PSK-noNAT
    authby=secret
    pfs=no
    auto=add
    keyexchange=ikev1
    type=transport
    left=%defaultroute
    leftprotoport=17/1701
    right=%any
    rightprotoport=17/%any
`;
    fs.writeFileSync('/etc/ipsec.conf', ipsecConfig);

    const xl2tpdConfig = `
[global]
port = 1701

[lns default]
ip range = ${ipRange}
local ip = ${localIp}
require chap = yes
refuse pap = yes
require authentication = yes
name = l2tpd
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
`;
    if (!fs.existsSync('/etc/xl2tpd')) shell.mkdir('-p', '/etc/xl2tpd');
    fs.writeFileSync('/etc/xl2tpd/xl2tpd.conf', xl2tpdConfig);

    const pppOptions = `
ipcp-accept-local
ipcp-accept-remote
ms-dns 8.8.8.8
ms-dns 8.8.4.4
noccp
auth
crtscts
idle 1800
mtu 1410
mru 1410
nodefaultroute
debug
lock
proxyarp
connect-delay 5000
`;
    if (!fs.existsSync('/etc/ppp')) shell.mkdir('-p', '/etc/ppp');
    fs.writeFileSync('/etc/ppp/options.xl2tpd', pppOptions);
  },

  getStatus() {
    const ipsecStatus = shell.exec('ipsec status', { silent: true }).stdout;
    const xl2tpdStatus = shell.exec('ps aux | grep xl2tpd | grep -v grep', { silent: true }).stdout;
    
    return `--- IPsec Status ---\n${ipsecStatus || 'IPsec not running'}\n\n--- xl2tpd Status ---\n${xl2tpdStatus ? 'xl2tpd process is running' : 'xl2tpd is not running'}`;
  }
};

module.exports = L2TPManager;
