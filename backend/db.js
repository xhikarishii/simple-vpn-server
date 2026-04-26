const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'vpn.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT, -- For L2TP
    login_password TEXT, -- For Dashboard Login
    role TEXT DEFAULT 'user', -- 'admin' or 'user'
    vpn_type TEXT, -- 'wireguard' or 'l2tp' (can be null for pure admin)
    private_key TEXT, -- For WireGuard
    public_key TEXT, -- For WireGuard
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
