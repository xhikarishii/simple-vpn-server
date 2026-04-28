/**
 * OpenVPN Secure Auth Script (Node.js)
 * Verifies username and password against the application database.
 */
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/vpn.db');
const USER_PASS_FILE = process.argv[2];

if (!USER_PASS_FILE || !fs.existsSync(USER_PASS_FILE)) {
    process.exit(1);
}

const lines = fs.readFileSync(USER_PASS_FILE, 'utf8').split('\n');
const username = lines[0]?.trim();
const password = lines[1]?.trim();

if (!username || !password) {
    process.exit(1);
}

try {
    const db = new Database(DB_PATH);
    const user = db.prepare("SELECT password FROM users WHERE username = ? AND vpn_type = 'openvpn'").get(username);
    
    if (user && user.password === password) {
        process.exit(0);
    } else {
        process.exit(1);
    }
} catch (err) {
    console.error('Auth error:', err);
    process.exit(1);
}
