const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'vpn.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT, -- For L2TP
    vpn_type TEXT NOT NULL, -- 'wireguard' or 'l2tp'
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

module.exports = db;
