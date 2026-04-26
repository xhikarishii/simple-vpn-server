const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'vpn.db'));

// Initialize tables with all required fields for RBAC and VPN keys
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT, -- For L2TP connection
    login_password TEXT, -- For Dashboard login
    role TEXT DEFAULT 'user', -- 'admin' or 'user'
    vpn_type TEXT, -- 'wireguard' or 'l2tp'
    private_key TEXT, -- User private key (for WireGuard)
    public_key TEXT, -- User public key (for WireGuard)
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS firewall_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_port INTEGER NOT NULL,
    internal_ip TEXT NOT NULL,
    internal_port INTEGER NOT NULL,
    protocol TEXT DEFAULT 'tcp',
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed default admin if no users exist
const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO users (username, login_password, role) VALUES (?, ?, ?)')
    .run('admin', 'admin123', 'admin');
}

module.exports = db;
