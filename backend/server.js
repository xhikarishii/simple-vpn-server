const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');
const FirewallManager = require('./firewall');
const WireGuardManager = require('./vpn/wireguard');
const L2TPManager = require('./vpn/l2tp');
const QRCode = require('qrcode');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const PORT = 3001;

// --- Middlewares ---

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- Settings Helper ---
const getSettings = () => {
  // Use double quotes for "key" and "value" as they can be reserved words
  const rows = db.prepare('SELECT "key", "value" FROM settings').all();
  const settings = {
    server_endpoint: 'your-ip-here',
    wg_subnet: '10.8.0.1/24',
    wg_port: 13895,
    l2tp_local_ip: '10.9.0.1',
    l2tp_ip_range: '10.9.0.2-10.9.0.255',
    l2tp_psk: 'defaultpsk'
  };
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
};

const setSetting = (key, value) => {
  // Use "key" and "value" in quotes
  db.prepare('INSERT OR REPLACE INTO settings ("key", "value") VALUES (?, ?)').run(key, value);
};

const syncVPNConfigs = () => {
  console.log('Syncing VPN configurations...');
  const settings = getSettings();
  try {
    const l2tpUsers = db.prepare("SELECT username, password FROM users WHERE vpn_type = 'l2tp'").all();
    L2TPManager.updateUsers(l2tpUsers, settings.l2tp_psk);
    L2TPManager.initConfigs(settings);
    
    const wgPeers = db.prepare("SELECT public_key, ip_address FROM users WHERE vpn_type = 'wireguard'").all();
    const wgPeersFormatted = wgPeers.map(p => ({ publicKey: p.public_key, ip_address: p.ip_address }));
    WireGuardManager.updateConfig(settings.wg_private_key, wgPeersFormatted, settings);
  } catch (err) {
    console.error('Error during VPN sync:', err);
  }
};

// --- Auth Routes ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (user && user.login_password === password) {
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, role: user.role, username: user.username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, role, vpn_type, ip_address FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// --- API Routes (Admin Only) ---

app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, vpn_type, ip_address, role, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', authenticateToken, isAdmin, (req, res) => {
  const { username, password, vpn_type, login_password, role } = req.body;
  
  try {
    if (vpn_type === 'wireguard') {
      const { privateKey, publicKey } = WireGuardManager.generateKeys();
      const lastUser = db.prepare("SELECT ip_address FROM users WHERE vpn_type = 'wireguard' ORDER BY id DESC LIMIT 1").get();
      const nextIp = lastUser ? `10.8.0.${parseInt(lastUser.ip_address.split('.')[3]) + 1}` : '10.8.0.2';
      
      db.prepare('INSERT INTO users (username, vpn_type, private_key, public_key, ip_address, login_password, role) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(username, vpn_type, privateKey, publicKey, nextIp, login_password || '123456', role || 'user');
    } else {
      db.prepare('INSERT INTO users (username, password, vpn_type, login_password, role) VALUES (?, ?, ?, ?, ?)')
        .run(username, password, vpn_type, login_password || '123456', role || 'user');
    }
    
    syncVPNConfigs();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
  
  if (user && user.username === 'admin') {
    return res.status(403).json({ error: 'The primary admin account cannot be deleted.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  syncVPNConfigs();
  res.json({ success: true });
});

app.get('/api/users/:id/config', authenticateToken, isAdmin, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const settings = getSettings();
  
  if (user.vpn_type === 'wireguard') {
    const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint, settings.wg_port);
    res.json({ config });
  } else {
    res.status(400).json({ error: 'Config only available for WireGuard users' });
  }
});

app.get('/api/settings', authenticateToken, isAdmin, (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', authenticateToken, isAdmin, (req, res) => {
  const newSettings = req.body;
  Object.keys(newSettings).forEach(key => setSetting(key, String(newSettings[key])));
  syncVPNConfigs();
  res.json({ success: true });
});

// --- API Routes (User Accessible) ---

app.get('/api/config', authenticateToken, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).send('Not found');

  const settings = getSettings();
  
  if (user.vpn_type === 'wireguard') {
    const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint, settings.wg_port);
    const qr = await QRCode.toDataURL(config);
    res.json({ type: 'wireguard', config, qr });
  } else if (user.vpn_type === 'l2tp') {
    res.json({ 
      type: 'l2tp', 
      server: settings.server_endpoint,
      username: user.username,
      password: user.password,
      psk: settings.l2tp_psk
    });
  } else {
    res.json({ type: 'admin', message: 'No VPN configuration for admin' });
  }
});

app.get('/api/status', authenticateToken, (req, res) => {
  const isAdminUser = req.user.role === 'admin';
  const settings = getSettings();

  res.json({
    vpn: {
      wireguard: {
        active: true,
        port: settings.wg_port,
        details: isAdminUser ? WireGuardManager.getStatus() : null
      },
      l2tp: {
        active: true,
        details: isAdminUser ? L2TPManager.getStatus() : null
      }
    },
    uptime: process.uptime()
  });
});

// --- Firewall (Admin Only) ---

app.get('/api/rules', authenticateToken, isAdmin, (req, res) => {
  const rules = db.prepare('SELECT * FROM firewall_rules').all();
  res.json(rules);
});

app.post('/api/rules', authenticateToken, isAdmin, (req, res) => {
  const { external_port, internal_ip, internal_port, protocol, description } = req.body;
  db.prepare('INSERT INTO firewall_rules (external_port, internal_ip, internal_port, protocol, description) VALUES (?, ?, ?, ?, ?)')
    .run(external_port, internal_ip, internal_port, protocol, description);
  
  FirewallManager.addPortForward(external_port, internal_ip, internal_port, protocol);
  res.json({ success: true });
});

app.delete('/api/rules/:id', authenticateToken, isAdmin, (req, res) => {
  const rule = db.prepare('SELECT * FROM firewall_rules WHERE id = ?').get(req.params.id);
  if (rule) {
    FirewallManager.removePortForward(rule.external_port, rule.internal_ip, rule.internal_port, rule.protocol);
    db.prepare('DELETE FROM firewall_rules WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});

// --- Frontend catch-all ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// --- Init ---
const init = () => {
  FirewallManager.init();
  const settings = getSettings();
  if (!settings.wg_private_key) {
    console.log('WireGuard config not found in database. Initializing new server keys...');
    const { privateKey, publicKey } = WireGuardManager.generateKeys();
    setSetting('wg_private_key', privateKey);
    setSetting('wg_public_key', publicKey);
  } else {
    console.log('WireGuard keys loaded from database.');
  }
  syncVPNConfigs();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VPN Dashboard API running on port ${PORT}`);
  });
};

init();
