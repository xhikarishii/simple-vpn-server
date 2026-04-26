const express = require('express');
const cors = require('cors');
const db = require('./db');
const FirewallManager = require('./firewall');
const WireGuardManager = require('./vpn/wireguard');
const L2TPManager = require('./vpn/l2tp');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// --- Settings Helper ---
const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
const setSetting = (key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);

// --- Status ---
app.get('/api/status', (req, res) => {
  res.json({
    vpn: {
      wireguard: true, // Should actually check service status
      l2tp: true
    },
    uptime: process.uptime()
  });
});

// --- Users ---
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { username, password, vpn_type } = req.body;
  
  if (vpn_type === 'wireguard') {
    const { privateKey, publicKey } = WireGuardManager.generateKeys();
    const lastUser = db.prepare('SELECT ip_address FROM users WHERE vpn_type = "wireguard" ORDER BY id DESC LIMIT 1').get();
    const nextIp = lastUser ? `10.8.0.${parseInt(lastUser.ip_address.split('.')[3]) + 1}` : '10.8.0.2';
    
    db.prepare('INSERT INTO users (username, vpn_type, private_key, public_key, ip_address) VALUES (?, ?, ?, ?, ?)')
      .run(username, vpn_type, privateKey, publicKey, nextIp);
    
    // Update WG Config
    const serverPrivateKey = getSetting('wg_private_key');
    const peers = db.prepare('SELECT public_key, ip_address FROM users WHERE vpn_type = "wireguard"').all();
    WireGuardManager.updateConfig(serverPrivateKey, peers);
  } else {
    db.prepare('INSERT INTO users (username, password, vpn_type) VALUES (?, ?, ?)')
      .run(username, password, vpn_type);
    
    // Update L2TP Config
    const psk = getSetting('l2tp_psk') || 'defaultpsk';
    const l2tpUsers = db.prepare('SELECT username, password FROM users WHERE vpn_type = "l2tp"').all();
    L2TPManager.updateUsers(l2tpUsers, psk);
  }
  
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  // Re-sync configs here...
  res.json({ success: true });
});

// --- WireGuard QR Code ---
app.get('/api/users/:id/config', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user || user.vpn_type !== 'wireguard') return res.status(404).send('Not found');

  const serverPublicKey = getSetting('wg_public_key');
  const serverEndpoint = getSetting('server_endpoint') || 'your-ip-here';
  
  const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, serverPublicKey, serverEndpoint);
  const qr = await QRCode.toDataURL(config);
  
  res.json({ config, qr });
});

// --- Port Forwarding ---
app.get('/api/rules', (req, res) => {
  const rules = db.prepare('SELECT * FROM firewall_rules').all();
  res.json(rules);
});

app.post('/api/rules', (req, res) => {
  const { external_port, internal_ip, internal_port, protocol, description } = req.body;
  db.prepare('INSERT INTO firewall_rules (external_port, internal_ip, internal_port, protocol, description) VALUES (?, ?, ?, ?, ?)')
    .run(external_port, internal_ip, internal_port, protocol, description);
  
  FirewallManager.addPortForward(external_port, internal_ip, internal_port, protocol);
  res.json({ success: true });
});

app.delete('/api/rules/:id', (req, res) => {
  const rule = db.prepare('SELECT * FROM firewall_rules WHERE id = ?').get(req.params.id);
  if (rule) {
    FirewallManager.removePortForward(rule.external_port, rule.internal_ip, rule.internal_port, rule.protocol);
    db.prepare('DELETE FROM firewall_rules WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  Object.keys(settings).forEach(key => {
    setSetting(key, String(settings[key]));
  });

  // Re-initialize configs with new settings
  const allSettings = {};
  db.prepare('SELECT * FROM settings').all().forEach(r => allSettings[r.key] = r.value);
  
  L2TPManager.initConfigs(allSettings);
  
  const serverPrivateKey = getSetting('wg_private_key');
  const peers = db.prepare('SELECT public_key, ip_address FROM users WHERE vpn_type = "wireguard"').all();
  WireGuardManager.updateConfig(serverPrivateKey, peers, allSettings);
  
  res.json({ success: true });
});

// --- Init Server ---
const init = () => {
  // Initialize Firewall
  FirewallManager.init();
  
  const allSettings = {};
  db.prepare('SELECT * FROM settings').all().forEach(r => allSettings[r.key] = r.value);

  // Initialize WG Keys if not exists
  if (!getSetting('wg_private_key')) {
    const { privateKey, publicKey } = WireGuardManager.generateKeys();
    setSetting('wg_private_key', privateKey);
    setSetting('wg_public_key', publicKey);
    allSettings.wg_private_key = privateKey;
    allSettings.wg_public_key = publicKey;
  }

  // Initialize VPNs
  L2TPManager.initConfigs(allSettings);
  
  const peers = db.prepare('SELECT public_key, ip_address FROM users WHERE vpn_type = "wireguard"').all();
  WireGuardManager.updateConfig(allSettings.wg_private_key, peers, allSettings);
  
  app.listen(PORT, () => {
    console.log(`VPN Dashboard API running on port ${PORT}`);
  });
};

init();
