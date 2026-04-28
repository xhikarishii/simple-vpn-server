const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const db = require('./db');
const FirewallManager = require('./firewall');
const WireGuardManager = require('./vpn/wireguard');
const OpenVPNManager = require('./vpn/openvpn');
const QRCode = require('qrcode');

const app = express();

// --- Security Configuration ---
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-here') {
  const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('jwt_secret');
  if (settings) {
    JWT_SECRET = settings.value;
  } else {
    // Generate a secure random secret if missing
    JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('jwt_secret', JWT_SECRET);
    console.log('NOTICE: Generated new secure JWT_SECRET and stored in database.');
  }
}

// --- Security Middleware ---
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier frontend dev, can be enabled later
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true, // Restrict in production
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

// --- Custom Rate Limiter ---
const rateLimits = new Map();
const rateLimit = (limit, windowMs) => (req, res, next) => {
  const ip = req.ip;
  // Whitelist local traffic from rate limiting
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }

  const now = Date.now();
  const userData = rateLimits.get(ip) || { count: 0, startTime: now };

  if (now - userData.startTime > windowMs) {
    userData.count = 1;
    userData.startTime = now;
  } else {
    userData.count++;
  }

  rateLimits.set(ip, userData);

  if (userData.count > limit) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  next();
};

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
  const rows = db.prepare('SELECT "key", "value" FROM settings').all();
  const settings = {
    server_endpoint: process.env.SERVER_ENDPOINT || 'your-ip-here',
    wg_subnet: '10.8.0.1/24',
    wg_port: 13895,
    wg_allowed_ips: '0.0.0.0/0, ::/0',
    ovpn_subnet: '10.10.0.0',
    ovpn_port: 443,
    ovpn_proto: 'udp'
  };
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
};

const setSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings ("key", "value") VALUES (?, ?)').run(key, value);
};

// --- System Task Queue (Prevents Race Conditions) ---
let isSyncing = false;
let pendingSync = false;

const syncVPNConfigs = async () => {
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;
  console.log('START: Syncing VPN and Firewall configurations in background...');
  
  const settings = getSettings();
  try {
    // Sync Firewall first with latest subnets/ports/whitelist
    const whitelist = db.prepare('SELECT ip_or_subnet FROM whitelist').all();
    FirewallManager.init(settings, whitelist);

    // Re-apply blocklist rules to the new custom chain
    const BlocklistManager = require('./security/blocklist');
    await BlocklistManager.updateIPBlocklists(settings);

    const ovpnUsers = db.prepare("SELECT username, password FROM users WHERE vpn_type = 'openvpn'").all();
    OpenVPNManager.updateUsers(ovpnUsers);
    OpenVPNManager.initConfigs(settings);
    
    const wgPeers = db.prepare("SELECT public_key, ip_address FROM users WHERE vpn_type = 'wireguard'").all();
    const wgPeersFormatted = wgPeers.map(p => ({ publicKey: p.public_key, ip_address: p.ip_address }));
    WireGuardManager.updateConfig(settings.wg_private_key, wgPeersFormatted, settings);
    
    console.log('SUCCESS: System synchronization complete.');
  } catch (err) {
    console.error('ERROR during system sync:', err);
  } finally {
    isSyncing = false;
    if (pendingSync) {
      pendingSync = false;
      syncVPNConfigs(); // Run pending sync
    }
  }
};

const triggerSync = () => {
  // Trigger after a delay to ensure the API response is fully sent to the client
  // before we potentially disrupt networking with iptables flushes.
  setTimeout(syncVPNConfigs, 1000);
};

// --- Auth Routes ---

app.post('/api/login', rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Handle both hashed and (legacy) plain text passwords for a smooth transition
  let isMatch = false;
  try {
    if (user.login_password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.login_password);
    } else {
      isMatch = user.login_password === password;
      // Auto-migrate to hash on successful login
      if (isMatch) {
        const hashed = await bcrypt.hash(password, 10);
        db.prepare('UPDATE users SET login_password = ? WHERE id = ?').run(hashed, user.id);
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Authentication error' });
  }

  if (isMatch) {
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

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  const { username, password, vpn_type, login_password, role } = req.body;
  
  try {
    const hashedLoginPassword = await bcrypt.hash(login_password || '123456', 10);
    
    if (vpn_type === 'wireguard') {
      const { privateKey, publicKey } = WireGuardManager.generateKeys();
      const lastUser = db.prepare("SELECT ip_address FROM users WHERE vpn_type = 'wireguard' ORDER BY id DESC LIMIT 1").get();
      const nextIp = lastUser ? `10.8.0.${parseInt(lastUser.ip_address.split('.')[3]) + 1}` : '10.8.0.2';
      
      db.prepare('INSERT INTO users (username, vpn_type, private_key, public_key, ip_address, login_password, role) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(username, vpn_type, privateKey, publicKey, nextIp, hashedLoginPassword, role || 'user');
    } else {
      db.prepare('INSERT INTO users (username, password, vpn_type, login_password, role) VALUES (?, ?, ?, ?, ?)')
        .run(username, password, vpn_type, hashedLoginPassword, role || 'user');
    }
    
    triggerSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { password, login_password, role } = req.body;
  
  try {
    const updates = [];
    const params = [];

    if (password) {
      updates.push('password = ?');
      params.push(password);
    }

    if (login_password) {
      const hashed = await bcrypt.hash(login_password, 10);
      updates.push('login_password = ?');
      params.push(hashed);
    }

    if (role) {
      updates.push('role = ?');
      params.push(role);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      triggerSync();
    }

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
  triggerSync();
  res.json({ success: true });
});

app.get('/api/users/:id/config', authenticateToken, isAdmin, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const settings = getSettings();
  
  if (user.vpn_type === 'wireguard') {
    const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint, settings.wg_port, settings);
    res.json({ config, type: 'wireguard' });
  } else if (user.vpn_type === 'openvpn') {
    const config = OpenVPNManager.getClientConfig(user.username, user.password, settings);
    res.json({ config, type: 'openvpn' });
  } else {
    res.status(400).json({ error: 'Config only available for VPN users' });
  }
});

app.post('/api/system/restart', authenticateToken, isAdmin, (req, res) => {
  console.log('User triggered manual system restart/sync...');
  triggerSync();
  res.json({ success: true, message: 'System synchronization and service restart triggered.' });
});

app.get('/api/settings', authenticateToken, isAdmin, (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', authenticateToken, isAdmin, rateLimit(5, 60 * 1000), (req, res) => {
  const newSettings = req.body;
  Object.keys(newSettings).forEach(key => setSetting(key, String(newSettings[key])));
  triggerSync();
  res.json({ success: true });
});

// --- API Routes (User Accessible) ---

app.get('/api/config', authenticateToken, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).send('Not found');

  const settings = getSettings();
  
  if (user.vpn_type === 'wireguard') {
    const config = WireGuardManager.getClientConfig(user.private_key, user.ip_address, settings.wg_public_key, settings.server_endpoint, settings.wg_port, settings);
    const qr = await QRCode.toDataURL(config);
    res.json({ type: 'wireguard', config, qr });
  } else if (user.vpn_type === 'openvpn') {
    const config = OpenVPNManager.getClientConfig(user.username, user.password, settings);
    res.json({ 
      type: 'openvpn', 
      config,
      server: settings.server_endpoint,
      username: user.username
    });
  } else {
    res.json({ type: 'admin', message: 'No VPN configuration for admin' });
  }
});

app.get('/api/status', authenticateToken, (req, res) => {
  const isAdminUser = req.user.role === 'admin';
  const settings = getSettings();
  const BlocklistManager = require('./security/blocklist');

  let securityStats = {
    blockedIps: 0,
    blockedDomains: 0,
    firewallBlocks: 0,
    dnsBlocks: 0
  };

  if (isAdminUser) {
    const listStats = BlocklistManager.getStats();
    securityStats.blockedIps = listStats.ipCount;
    securityStats.blockedDomains = listStats.domainCount;

    try {
      securityStats.firewallBlocks = db.prepare("SELECT count(*) as count FROM system_logs WHERE type = 'ip_block'").get().count;
      securityStats.dnsBlocks = db.prepare("SELECT count(*) as count FROM system_logs WHERE type = 'dns_block'").get().count;
    } catch (err) {
      console.error('Failed to fetch security log counts:', err);
    }
  }

  res.json({
    vpn: {
      wireguard: {
        active: true,
        port: settings.wg_port,
        details: isAdminUser ? WireGuardManager.getStatus() : null
      },
      openvpn: {
        active: true,
        details: isAdminUser ? OpenVPNManager.getStatus() : null
      }
    },
    security: securityStats,
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
  
  // Call the hardened FirewallManager which includes validation
  const success = FirewallManager.addPortForward(external_port, internal_ip, internal_port, protocol);
  
  if (success) {
    db.prepare('INSERT INTO firewall_rules (external_port, internal_ip, internal_port, protocol, description) VALUES (?, ?, ?, ?, ?)')
      .run(external_port, internal_ip, internal_port, protocol, description);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid firewall parameters' });
  }
});

app.delete('/api/rules/:id', authenticateToken, isAdmin, (req, res) => {
  const rule = db.prepare('SELECT * FROM firewall_rules WHERE id = ?').get(req.params.id);
  if (rule) {
    FirewallManager.removePortForward(rule.external_port, rule.internal_ip, rule.internal_port, rule.protocol);
    db.prepare('DELETE FROM firewall_rules WHERE id = ?').run(req.params.id);
  }
  res.json({ success: true });
});


// --- Security & Blocklists (Admin Only) ---

app.get('/api/blocklists', authenticateToken, isAdmin, (req, res) => {
  const lists = db.prepare('SELECT * FROM blocklists').all();
  res.json(lists);
});

app.post('/api/blocklists', authenticateToken, isAdmin, async (req, res) => {
  const { name, url, type } = req.body;
  db.prepare('INSERT INTO blocklists (name, url, type) VALUES (?, ?, ?)').run(name, url, type);
  res.json({ success: true });
});

app.delete('/api/blocklists/:id', authenticateToken, isAdmin, (req, res) => {
  db.prepare('DELETE FROM blocklists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/blocklists/sync', async (req, res) => {
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  const isInternal = isLocal && req.headers['x-internal-sync'] === 'true';
  
  if (!isInternal) {
    // Standard auth check for external requests
    return new Promise((resolve) => {
      authenticateToken(req, res, () => {
        isAdmin(req, res, async () => {
          const BlocklistManager = require('./security/blocklist');
          const settings = getSettings();
          await BlocklistManager.updateIPBlocklists(settings);
          await BlocklistManager.updateDomainBlocklists();
          res.json({ success: true });
          resolve();
        });
      });
    });
  }

  // Internal request (Cron)
  const BlocklistManager = require('./security/blocklist');
  const settings = getSettings();
  await BlocklistManager.updateIPBlocklists(settings);
  await BlocklistManager.updateDomainBlocklists();
  res.json({ success: true });
});

app.get('/api/logs', authenticateToken, isAdmin, (req, res) => {
  const { start, end, type, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let baseQuery = 'FROM system_logs WHERE 1=1';
  const params = [];

  if (start) {
    baseQuery += ' AND timestamp >= ?';
    params.push(start);
  }
  if (end) {
    baseQuery += ' AND timestamp <= ?';
    params.push(end);
  }
  if (type && type !== 'all') {
    baseQuery += ' AND type = ?';
    params.push(type);
  }

  try {
    const total = db.prepare(`SELECT count(*) as count ${baseQuery}`).get(...params).count;
    const logs = db.prepare(`SELECT * ${baseQuery} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
    res.json({ total, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Geo-Blocking ---

app.get('/api/geoblocks', authenticateToken, isAdmin, (req, res) => {
  const blocks = db.prepare('SELECT * FROM geoblocks').all();
  res.json(blocks);
});

app.post('/api/geoblocks', authenticateToken, isAdmin, async (req, res) => {
  const { country_code, country_name } = req.body;
  db.prepare('INSERT OR IGNORE INTO geoblocks (country_code, country_name) VALUES (?, ?)').run(country_code, country_name);
  const GeoBlockManager = require('./security/geoblock');
  await GeoBlockManager.updateGeoBlocks();
  res.json({ success: true });
});

app.delete('/api/geoblocks/:id', authenticateToken, isAdmin, (req, res) => {
  db.prepare('DELETE FROM geoblocks WHERE id = ?').run(req.params.id);
  const GeoBlockManager = require('./security/geoblock');
  GeoBlockManager.updateGeoBlocks();
  res.json({ success: true });
});

// --- Whitelist (Admin Only) ---
app.get('/api/whitelist', authenticateToken, isAdmin, (req, res) => {
  const list = db.prepare('SELECT * FROM whitelist').all();
  res.json(list);
});

app.post('/api/whitelist', authenticateToken, isAdmin, (req, res) => {
  const { ip_or_subnet, description } = req.body;
  try {
    db.prepare('INSERT INTO whitelist (ip_or_subnet, description) VALUES (?, ?)').run(ip_or_subnet, description);
    const BlocklistManager = require('./security/blocklist');
    BlocklistManager.updateIPBlocklists(getSettings());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/whitelist/:id', authenticateToken, isAdmin, (req, res) => {
  db.prepare('DELETE FROM whitelist WHERE id = ?').run(req.params.id);
  const BlocklistManager = require('./security/blocklist');
  BlocklistManager.updateIPBlocklists(getSettings());
  res.json({ success: true });
});

// --- Init ---
const init = async () => {
  const BlocklistManager = require('./security/blocklist');
  const GeoBlockManager = require('./security/geoblock');
  const LogWorker = require('./security/log-worker');
  
  // Sync Server Endpoint from .env if provided
  if (process.env.SERVER_ENDPOINT && process.env.SERVER_ENDPOINT !== 'your-public-ip-here') {
    console.log(`Syncing Server Endpoint from .env: ${process.env.SERVER_ENDPOINT}`);
    setSetting('server_endpoint', process.env.SERVER_ENDPOINT);
  }

  const settings = getSettings();
  if (!settings.wg_private_key) {
    console.log('WireGuard config not found in database. Initializing new server keys...');
    const { privateKey, publicKey } = WireGuardManager.generateKeys();
    setSetting('wg_private_key', privateKey);
    setSetting('wg_public_key', publicKey);
  } else {
    console.log('WireGuard keys loaded from database.');
  }

  // Initialize Security Subsystems
  BlocklistManager.init(settings);
  GeoBlockManager.init();
  LogWorker.start();
  
  triggerSync();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VPN Dashboard API running on port ${PORT}`);
  });
};

// --- Frontend catch-all ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

init();
