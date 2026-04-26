const shell = require('shelljs');
const fs = require('fs');
const path = require('path');

const WG_PATH = '/etc/wireguard';
const WG_CONF = path.join(WG_PATH, 'wg0.conf');

const WireGuardManager = {
  generateKeys() {
    const privateKey = shell.exec('wg genkey', { silent: true }).stdout.trim();
    const publicKey = shell.exec(`echo ${privateKey} | wg pubkey`, { silent: true }).stdout.trim();
    return { privateKey, publicKey };
  },

  updateConfig(serverPrivateKey, peers, options = {}) {
    const address = options.wg_subnet || '10.8.0.1/24';
    const port = options.wg_port || 13895;
    
    let config = `
[Interface]
Address = ${address}
ListenPort = ${port}
PrivateKey = ${serverPrivateKey}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
`;

    peers.forEach(peer => {
      config += `
[Peer]
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.ip_address}/32
`;    });

    if (!fs.existsSync(WG_PATH)) {
      shell.mkdir('-p', WG_PATH);
    }
    fs.writeFileSync(WG_CONF, config);
    
    // Restart wg0 if it's already up
    shell.exec('wg-quick down wg0', { silent: true });
    shell.exec('wg-quick up wg0', { silent: true });
  },

  getClientConfig(clientPrivateKey, clientIp, serverPublicKey, serverEndpoint, serverPort = 13895) {
    return `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:${serverPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
  },

  getStatus() {
    const result = shell.exec('wg show wg0', { silent: true });
    return result.stdout || 'WireGuard is not running or no interface wg0 found.';
  }
};

module.exports = WireGuardManager;
