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
    shell.rm('-f', '/var/run/xl2tpd/l2tp-control');
    shell.mkdir('-p', '/var/run/xl2tpd');
    shell.exec('/usr/sbin/xl2tpd', { silent: true });
  },

  initConfigs(settings = {}) {
    const localIp = settings.l2tp_local_ip || '10.9.0.1';
    const ipRange = settings.l2tp_ip_range || '10.9.0.2-10.9.0.255';
    
    const ipsecConfig = `
config setup
    uniqueids=no
    charondebug="ike 2, knl 2, cfg 2, net 2, esp 2, dmn 2, mgr 2"

conn L2TP-PSK
    authby=secret
    pfs=no
    auto=add
    keyexchange=ikev1
    type=transport
    left=%any
    leftid=%any
    leftprotoport=17/1701
    right=%any
    rightid=%any
    rightprotoport=17/%any
    ike=aes256-sha256-modp2048,aes128-sha1-modp1024,3des-sha1-modp1024!
    esp=aes256-sha256,aes128-sha1,3des-sha1!
    rekey=no
    fragmentation=yes
`;
    fs.writeFileSync('/etc/ipsec.conf', ipsecConfig);

    const xl2tpdConfig = `
[global]
port = 1701
debug network = yes
debug state = yes
debug tunnel = yes

[lns default]
ip range = ${ipRange}
local ip = ${localIp}
require chap = yes
require pap = yes
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
ms-dns ${localIp}
noccp
auth
+pap
+chap
+ms-chap
+ms-chap-v2
crtscts
idle 1800
mtu 1300
mru 1300
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
