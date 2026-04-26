const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const FirewallManager = require('./firewall');
const WireGuardManager = require('./vpn/wireguard');
const L2TPManager = require('./vpn/l2tp');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const PORT = 3001;

// --- Persistence Helpers ---
const getSettings = () => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {
    server_endpoint: 'your-ip-here',
    wg_subnet: '10.8.0.1/24',
    wg_port: 51821,
    l2tp_local_ip: '10.9.0.1',
    l2tp_ip_range: '10.9.0.2-10.9.0.255',
    l2tp_psk: 'defaultpsk'
  };
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
};

const setSetting = (key, value) => db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);

// --- VPN Sync Logic ---
const syncVPNConfigs = () => {
  console.log('Syncing VPN configurations...');
  const settings = getSettings();
  
  try {
    // 1. Sync L2TP
    const l2tpUsers = db.prepare("SELECT username, password FROM users WHERE vpn_type = 'l2tp'").all();
    L2TPManager.updateUsers(l2tpUsers, settings.l2tp_psk);
    L2TPManager.initConfigs(settings);
    
    // 2. Sync WireGuard
    const wgPeers = db.prepare("SELECT public_key, ip_address FROM users WHERE vpn_type = 'wireguard'").all();
    WireGuardManager.updateConfig(settings.wg_private_key, wgPeers, settings);
  } catch (err) {
    console.error('Error during VPN sync:', err);
  }
};

// --- API Routes ---

app.get('/api/status', (req, res) => {
  res.json({
    vpn: { wireguard: true, l2tp: true },
    uptime: process.uptime()
  });
});

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { username, password, vpn_type } = req.body;
  const settings = getSettings();

  try {
    if (vpn_type === 'wireguard') {
      const { privateKey, publicKey } = WireGuardManager.generateKeys();
      const lastUser = db.prepare("SELECT ip_address FROM users WHERE vpn_type = 'wireguard' ORDER BY id DESC LIMIT 1").get();
      const nextIp = lastUser ? `10.8.0.${parseInt(lastUser.ip_address.split('.')[3]) + 1}` : '10.8.0.2';
      
      db.prepare('INSERT INTO users (username, vpn_type, private_key, public_key, ip_address) VALUES (?, ?, ?, ?, ?)')
        .run(username, vpn_type, privateKey, publicKey, nextIp);
    } else {
      db.prepare('INSERT INTO users (username, password, vpn_type) VALUES (?, ?, ?)')
        .run(username, password, vpn_type);
    }
    
    syncVPNConfigs();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  syncVPNConfigs();
  res.json({ success: true });
});

app.get('/api/users/:id/config', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user || user.vpn_type !== 'wireguard') return res.status(404).send('Not found');

  const settings = getSettings();
  const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint);
  const qr = await QRCode.toDataURL(config);
  
  res.json({ config, qr });
});

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

app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  Object.keys(newSettings).forEach(key => setSetting(key, String(newSettings[key])));
  syncVPNConfigs();
  res.json({ success: true });
});

// --- Catch-all for Frontend ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// --- Initialization ---
const init = () => {
  console.log('Initializing VPN Controller...');
  FirewallManager.init();
  
  const settings = getSettings();
  if (!settings.wg_private_key) {
    console.log('Generating initial WireGuard server keys...');
    const { privateKey, publicKey } = WireGuardManager.generateKeys();
    setSetting('wg_private_key', privateKey);
    setSetting('wg_public_key', publicKey);
  }

  syncVPNConfigs();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VPN Dashboard API running on port ${PORT}`);
  });
};

init();
