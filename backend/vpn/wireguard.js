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
    
    const iface = shell.exec("ip route get 8.8.8.8 | grep -oP 'dev \\K\\S+'", { silent: true }).stdout.trim() || 'eth0';
    
    let config = `
[Interface]
Address = ${address}
ListenPort = ${port}
PrivateKey = ${serverPrivateKey}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o ${iface} -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o ${iface} -j MASQUERADE
`;

    peers.forEach(peer => {
      config += `
[Peer]
PublicKey = ${peer.publicKey}
AllowedIPs = ${peer.ip_address}/32
`;    });

    if (!fs.existsSync(WG_PATH)) {
      shell.mkdir('-p', WG_PATH);
      shell.chmod(700, WG_PATH);
    }
    fs.writeFileSync(WG_CONF, config);
    shell.chmod(600, WG_CONF);
    
    // Restart wg0 robustly
    shell.exec('wg-quick down wg0', { silent: true });
    shell.exec('ip link delete dev wg0', { silent: true }); // Force cleanup if down fails
    shell.exec('sleep 1');
    shell.exec('wg-quick up wg0');
  },

  getClientConfig(clientPrivateKey, clientIp, serverPublicKey, serverEndpoint, serverPort = 13895, options = {}) {
    const allowedIps = options.wg_allowed_ips || '0.0.0.0/0, ::/0';
    const dns = options.wg_subnet ? options.wg_subnet.split('/')[0] : '10.8.0.1';

    return `
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}/24
DNS = ${dns}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}:${serverPort}
AllowedIPs = ${allowedIps}
PersistentKeepalive = 25
`;
  },

  getStatus() {
    const result = shell.exec('wg show wg0', { silent: true });
    return result.stdout || 'WireGuard is not running or no interface wg0 found.';
  }
};

module.exports = WireGuardManager;
