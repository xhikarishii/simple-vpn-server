#!/bin/bash
set -e

mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOSQL
CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\`;
CREATE USER IF NOT EXISTS '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'%';

CREATE USER IF NOT EXISTS '$MYSQL_USER'@'127.0.0.1' IDENTIFIED BY '$MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'127.0.0.1';

USE \`$MYSQL_DATABASE\`;

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
);

CREATE TABLE IF NOT EXISTS firewall_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_port INT NOT NULL,
  internal_ip VARCHAR(50) NOT NULL,
  internal_port INT NOT NULL,
  protocol VARCHAR(20) DEFAULT 'tcp',
  description TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  \`key\` VARCHAR(255) PRIMARY KEY,
  value TEXT
);

-- Seed default admin if not exists
INSERT IGNORE INTO users (username, login_password, role) VALUES ('admin', 'admin123', 'admin');

FLUSH PRIVILEGES;
EOSQL
