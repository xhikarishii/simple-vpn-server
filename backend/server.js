const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { pool, initDB } = require('./db');
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
const getSettings = async () => {
  const [rows] = await pool.query('SELECT * FROM settings');
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

const setSetting = async (key, value) => {
  await pool.query('INSERT INTO settings (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [key, value, value]);
};

const syncVPNConfigs = async () => {
  console.log('Syncing VPN configurations...');
  const settings = await getSettings();
  try {
    const [l2tpUsers] = await pool.query("SELECT username, password FROM users WHERE vpn_type = 'l2tp'");
    L2TPManager.updateUsers(l2tpUsers, settings.l2tp_psk);
    L2TPManager.initConfigs(settings);
    
    const [wgPeers] = await pool.query("SELECT public_key, ip_address FROM users WHERE vpn_type = 'wireguard'");
    const wgPeersFormatted = wgPeers.map(p => ({ publicKey: p.public_key, ip_address: p.ip_address }));
    WireGuardManager.updateConfig(settings.wg_private_key, wgPeersFormatted, settings);
  } catch (err) {
    console.error('Error during VPN sync:', err);
  }
};

// --- Auth Routes ---

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  const user = rows[0];

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

app.get('/api/me', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT id, username, role, vpn_type, ip_address FROM users WHERE id = ?', [req.user.id]);
  res.json(rows[0]);
});

// --- API Routes (Admin Only) ---

app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  const [users] = await pool.query('SELECT id, username, vpn_type, ip_address, role, created_at FROM users');
  res.json(users);
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  const { username, password, vpn_type, login_password, role } = req.body;
  
  try {
    if (vpn_type === 'wireguard') {
      const { privateKey, publicKey } = WireGuardManager.generateKeys();
      const [lastUser] = await pool.query("SELECT ip_address FROM users WHERE vpn_type = 'wireguard' ORDER BY id DESC LIMIT 1");
      const nextIp = lastUser[0] ? `10.8.0.${parseInt(lastUser[0].ip_address.split('.')[3]) + 1}` : '10.8.0.2';
      
      await pool.query('INSERT INTO users (username, vpn_type, private_key, public_key, ip_address, login_password, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, vpn_type, privateKey, publicKey, nextIp, login_password || '123456', role || 'user']);
    } else {
      await pool.query('INSERT INTO users (username, password, vpn_type, login_password, role) VALUES (?, ?, ?, ?, ?)',
        [username, password, vpn_type, login_password || '123456', role || 'user']);
    }
    
    await syncVPNConfigs();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  await syncVPNConfigs();
  res.json({ success: true });
});

app.get('/api/users/:id/config', authenticateToken, isAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const settings = await getSettings();
  
  if (user.vpn_type === 'wireguard') {
    const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint, settings.wg_port);
    res.json({ config });
  } else {
    res.status(400).json({ error: 'Config only available for WireGuard users' });
  }
});

app.get('/api/settings', authenticateToken, isAdmin, async (req, res) => {
  res.json(await getSettings());
});

app.post('/api/settings', authenticateToken, isAdmin, async (req, res) => {
  const newSettings = req.body;
  for (const key of Object.keys(newSettings)) {
    await setSetting(key, String(newSettings[key]));
  }
  await syncVPNConfigs();
  res.json({ success: true });
});

// --- API Routes (User Accessible) ---

app.get('/api/config', authenticateToken, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).send('Not found');

  const settings = await getSettings();
  
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

app.get('/api/status', authenticateToken, async (req, res) => {
  const isAdminUser = req.user.role === 'admin';
  const settings = await getSettings();

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

app.get('/api/rules', authenticateToken, isAdmin, async (req, res) => {
  const [rules] = await pool.query('SELECT * FROM firewall_rules');
  res.json(rules);
});

app.post('/api/rules', authenticateToken, isAdmin, async (req, res) => {
  const { external_port, internal_ip, internal_port, protocol, description } = req.body;
  await pool.query('INSERT INTO firewall_rules (external_port, internal_ip, internal_port, protocol, description) VALUES (?, ?, ?, ?, ?)',
    [external_port, internal_ip, internal_port, protocol, description]);
  
  FirewallManager.addPortForward(external_port, internal_ip, internal_port, protocol);
  res.json({ success: true });
});

app.delete('/api/rules/:id', authenticateToken, isAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM firewall_rules WHERE id = ?', [req.params.id]);
  const rule = rows[0];
  if (rule) {
    FirewallManager.removePortForward(rule.external_port, rule.internal_ip, rule.internal_port, rule.protocol);
    await pool.query('DELETE FROM firewall_rules WHERE id = ?', [req.params.id]);
  }
  res.json({ success: true });
});

// --- Frontend catch-all ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// --- Init ---
const init = async () => {
  try {
    // Wait a bit for MariaDB to start up
    console.log('Waiting for database...');
    await new Promise(r => setTimeout(r, 5000));
    
    await initDB();
    FirewallManager.init();
    
    const settings = await getSettings();
    if (!settings.wg_private_key) {
      console.log('Generating server WireGuard keys...');
      const { privateKey, publicKey } = WireGuardManager.generateKeys();
      await setSetting('wg_private_key', privateKey);
      await setSetting('wg_public_key', publicKey);
    }
    
    await syncVPNConfigs();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`VPN Dashboard API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  }
};

init();
