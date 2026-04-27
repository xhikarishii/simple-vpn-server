const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Use a root-level /data directory for absolute separation from code
const dataDir = '/data';
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    // Fallback to local data dir if /data is not writable (though it should be in Docker)
    console.warn('Warning: Could not create /data, falling back to local storage.');
  }
}

const dbPath = path.join(fs.existsSync(dataDir) ? dataDir : path.join(__dirname, 'data'), 'vpn.db');
console.log(`Database path: ${dbPath}`);

const db = new Database(dbPath);

// Enable WAL mode for better reliability in Docker/Networked filesystems
db.pragma('journal_mode = WAL');

// Initialize tables with quoted identifiers for safety
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    login_password TEXT,
    role TEXT DEFAULT 'user',
    vpn_type TEXT,
    private_key TEXT,
    public_key TEXT,
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
    "key" TEXT PRIMARY KEY,
    "value" TEXT
  );

  CREATE TABLE IF NOT EXISTS blocklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'ip', -- 'ip' or 'domain'
    enabled INTEGER DEFAULT 1,
    last_updated DATETIME
  );

  CREATE TABLE IF NOT EXISTS attack_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source_ip TEXT,
    event_type TEXT, -- 'block', 'scan', etc.
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS geoblocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT UNIQUE,
    country_name TEXT,
    enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_or_subnet TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT, -- 'dns_block', 'ip_block', 'info'
    source_ip TEXT,
    details TEXT,
    severity TEXT DEFAULT 'info'
  );
`);

// Seed default settings and admin
const settingsCount = db.prepare('SELECT count(*) as count FROM settings').get().count;
if (settingsCount === 0) {
  db.prepare('INSERT INTO settings ("key", "value") VALUES (?, ?)').run('log_retention_days', '7');
}

const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
if (userCount === 0) {
  db.prepare('INSERT INTO users (username, login_password, role) VALUES (?, ?, ?)')
    .run('admin', 'admin123', 'admin');
}

module.exports = db;
