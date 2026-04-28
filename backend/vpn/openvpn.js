const shell = require('shelljs');
const fs = require('fs');
const path = require('path');

const OVPN_PATH = '/etc/openvpn';
const OVPN_CONF = path.join(OVPN_PATH, 'server.conf');
const OVPN_AUTH_SCRIPT = path.join(OVPN_PATH, 'auth-check.js');

const OpenVPNManager = {
  initPKI() {
    if (fs.existsSync(path.join(OVPN_PATH, 'pki-initialized'))) return;

    console.log('Initializing OpenVPN PKI...');
    shell.mkdir('-p', OVPN_PATH);

    // Generate CA
    shell.exec(`openssl genrsa -out ${OVPN_PATH}/ca.key 2048`, { silent: true });
    shell.exec(`openssl req -x509 -new -nodes -key ${OVPN_PATH}/ca.key -sha256 -days 3650 -out ${OVPN_PATH}/ca.crt -subj "/C=US/ST=VPN/L=Server/O=SimpleVPN/CN=SimpleVPN-CA"`, { silent: true });

    // Generate Server Cert
    shell.exec(`openssl genrsa -out ${OVPN_PATH}/server.key 2048`, { silent: true });
    shell.exec(`openssl req -new -key ${OVPN_PATH}/server.key -out ${OVPN_PATH}/server.csr -subj "/C=US/ST=VPN/L=Server/O=SimpleVPN/CN=server"`, { silent: true });
    shell.exec(`openssl x509 -req -in ${OVPN_PATH}/server.csr -CA ${OVPN_PATH}/ca.crt -CAkey ${OVPN_PATH}/ca.key -CAcreateserial -out ${OVPN_PATH}/server.crt -days 3650 -sha256`, { silent: true });

    // Generate DH params
    shell.exec(`openssl dhparam -out ${OVPN_PATH}/dh2048.pem 2048`, { silent: true });

    // Generate TLS-Auth key
    shell.exec(`openvpn --genkey tls-auth ${OVPN_PATH}/ta.key`, { silent: true });

    // Generate a common Client Cert for all users (we use auth-user-pass for differentiation)
    shell.exec(`openssl genrsa -out ${OVPN_PATH}/client.key 2048`, { silent: true });
    shell.exec(`openssl req -new -key ${OVPN_PATH}/client.key -out ${OVPN_PATH}/client.csr -subj "/C=US/ST=VPN/L=Server/O=SimpleVPN/CN=client"`, { silent: true });
    shell.exec(`openssl x509 -req -in ${OVPN_PATH}/client.csr -CA ${OVPN_PATH}/ca.crt -CAkey ${OVPN_PATH}/ca.key -CAcreateserial -out ${OVPN_PATH}/client.crt -days 3650 -sha256`, { silent: true });

    // Secure all keys immediately
    shell.chmod(600, `${OVPN_PATH}/*.key`);
    shell.chmod(644, `${OVPN_PATH}/*.crt`); // CRTs must be world-readable for some clients/configs
    shell.chmod(644, `${OVPN_PATH}/*.pem`);
    shell.chmod(600, `${OVPN_PATH}/ta.key`);

    shell.touch(path.join(OVPN_PATH, 'pki-initialized'));
    console.log('OpenVPN PKI initialized.');
  },

  updateUsers(users) {
    // No longer writing plain-text passwords to disk. 
    // Authentication now happens directly against the database via ovpn-auth.js
  },

  initConfigs(settings = {}) {
    this.initPKI();

    const port = settings.ovpn_port || 1194;
    const protocol = settings.ovpn_proto || 'udp';
    const subnet = settings.ovpn_subnet || '10.10.0.0';
    const netmask = '255.255.255.0';

    const config = `
port ${port}
proto ${protocol}
dev tun
ca ${path.join(OVPN_PATH, 'ca.crt')}
cert ${path.join(OVPN_PATH, 'server.crt')}
key ${path.join(OVPN_PATH, 'server.key')}
dh ${path.join(OVPN_PATH, 'dh2048.pem')}
auth SHA256
tls-auth ${path.join(OVPN_PATH, 'ta.key')} 0
topology subnet
server ${subnet} ${netmask}
ifconfig-pool-persist ipp.txt
push "redirect-gateway def1 bypass-dhcp"
push "dhcp-option DNS 1.1.1.1"
push "dhcp-option DNS 8.8.8.8"
keepalive 10 120

# Security & Performance Tuning
cipher AES-256-GCM
data-ciphers AES-256-GCM:AES-128-GCM:AES-256-CBC
tls-version-min 1.2
tls-cipher TLS-ECDHE-RSA-WITH-AES-256-GCM-SHA384:TLS-ECDHE-RSA-WITH-AES-128-GCM-SHA256

# Throughput Optimizations
fast-io
sndbuf 393216
rcvbuf 393216
push "sndbuf 393216"
push "rcvbuf 393216"

# MTU Stability
tun-mtu 1500
mssfix 1360

user nobody
group nogroup
persist-key
persist-tun
status /etc/openvpn/openvpn-status.log
verb 4
${protocol === 'udp' ? 'explicit-exit-notify 1' : ''}

# Authentication
auth-user-pass-verify ${path.join(OVPN_PATH, 'ovpn-auth.sh')} via-file
script-security 2
verify-client-cert none
username-as-common-name
`;
    fs.writeFileSync(OVPN_CONF, config);

    // Create the auth script wrapper
    const authScript = `#!/bin/bash
# OpenVPN Secure Auth Wrapper
export NODE_PATH=/app/backend/node_modules
node /app/backend/vpn/ovpn-auth.js "$1"
`;
    fs.writeFileSync(path.join(OVPN_PATH, 'ovpn-auth.sh'), authScript);
    shell.chmod('+x', path.join(OVPN_PATH, 'ovpn-auth.sh'));
    shell.chmod(600, OVPN_CONF);

    // Restart OpenVPN
    shell.exec('pkill -9 openvpn', { silent: true });
    shell.exec('sleep 2'); // Increased delay for stability
    shell.exec('openvpn --config /etc/openvpn/server.conf --daemon');
    shell.exec('sleep 1'); // Give it a moment to bind
  },

  getClientConfig(username, password, settings = {}) {
    const endpoint = settings.server_endpoint || 'YOUR_SERVER_IP';
    const port = settings.ovpn_port || 1194;
    const protocol = settings.ovpn_proto || 'udp';

    const ca = fs.readFileSync(path.join(OVPN_PATH, 'ca.crt'), 'utf8');
    const cert = fs.readFileSync(path.join(OVPN_PATH, 'client.crt'), 'utf8');
    const key = fs.readFileSync(path.join(OVPN_PATH, 'client.key'), 'utf8');
    const ta = fs.readFileSync(path.join(OVPN_PATH, 'ta.key'), 'utf8');

    return `
client
dev tun
proto ${protocol}
remote ${endpoint} ${port}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
auth SHA256
cipher AES-256-GCM
verb 3

<ca>
${ca}
</ca>
<cert>
${cert}
</cert>
<key>
${key}
</key>
<tls-auth>
${ta}
</tls-auth>
key-direction 1

auth-user-pass
auth-nocache
`;
  },

  getStatus() {
    if (!fs.existsSync('/etc/openvpn/openvpn-status.log')) return 'OpenVPN status log not found.';
    const status = fs.readFileSync('/etc/openvpn/openvpn-status.log', 'utf8');
    return status;
  }
};

module.exports = OpenVPNManager;
