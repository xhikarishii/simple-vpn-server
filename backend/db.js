const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'vpn_user',
  password: process.env.DB_PASS || 'vpn_password',
  database: process.env.DB_NAME || 'vpn_server',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  const connection = await pool.getConnection();
  try {
    console.log('Initializing MariaDB schema...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT,
        login_password TEXT,
        role VARCHAR(50) DEFAULT 'user',
        vpn_type VARCHAR(50),
        private_key TEXT,
        public_key TEXT,
        ip_address VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS firewall_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        external_port INT NOT NULL,
        internal_ip VARCHAR(50) NOT NULL,
        internal_port INT NOT NULL,
        protocol VARCHAR(20) DEFAULT 'tcp',
        description TEXT
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(255) PRIMARY KEY,
        value TEXT
      )
    `);

    // Seed default admin
    const [rows] = await connection.query('SELECT count(*) as count FROM users');
    if (rows[0].count === 0) {
      await connection.query(
        'INSERT INTO users (username, login_password, role) VALUES (?, ?, ?)',
        ['admin', 'admin123', 'admin']
      );
      console.log('Default admin seeded.');
    }
  } finally {
    connection.release();
  }
}

module.exports = { pool, initDB };
