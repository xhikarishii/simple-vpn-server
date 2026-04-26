#!/bin/bash
set -e

# This script runs inside the container during initialization.
# It uses the root password to set up the application user correctly.

echo "Running Bulletproof MariaDB Setup..."

# We use the socket for the initial setup to ensure root access works regardless of networking
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
-- 1. Create the database
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;

-- 2. Clean up anonymous users that often cause "Host not allowed" issues
DELETE FROM mysql.user WHERE User='';

-- 3. Drop existing user to ensure a clean slate
DROP USER IF EXISTS '${DB_USER}'@'%';
DROP USER IF EXISTS '${DB_USER}'@'localhost';
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';

-- 4. Create user and grant permissions for all possible host resolutions
CREATE USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';

GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';

-- 5. Initialize Schema
USE \`${DB_NAME}\`;

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

INSERT IGNORE INTO users (username, login_password, role) VALUES ('admin', 'admin123', 'admin');

FLUSH PRIVILEGES;
EOSQL

echo "Bulletproof MariaDB Setup Completed."
