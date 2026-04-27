const { spawn } = require('child_process');
const db = require('../db');
const fs = require('fs');

/**
 * LogWorker handles ingestion of security logs from dnsmasq and iptables.
 * It tails log files and inserts relevant events into the system_logs table.
 */
const LogWorker = {
  start() {
    console.log('Starting LogWorker...');
    this.tailDNS();
    this.tailIPBlocks();
    this.startCleanupTask();
  },

  /**
   * Tails dnsmasq logs to capture ad-blocking events.
   */
  tailDNS() {
    const logFile = '/data/dnsmasq.log';
    
    // Ensure the log file exists so tail doesn't fail
    if (!fs.existsSync(logFile)) {
      try {
        fs.writeFileSync(logFile, '');
      } catch (err) {
        console.error('Failed to create dnsmasq log file:', err.message);
        return;
      }
    }

    console.log(`Tailing DNS logs from ${logFile}`);
    const tail = spawn('tail', ['-f', logFile]);
    
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // dnsmasq logs blocked domains as 0.0.0.0
        if (line.includes('0.0.0.0')) {
          this.logDNSBlock(line);
        }
      }
    });

    tail.stderr.on('data', (data) => {
      console.error(`DNS tail error: ${data}`);
    });
  },

  logDNSBlock(line) {
    // Example format: Apr 27 14:00:00 dnsmasq[123]: reply ad-server.com is 0.0.0.0
    const match = line.match(/reply (.*) is 0\.0\.0\.0/);
    if (match) {
      const domain = match[1];
      try {
        db.prepare('INSERT INTO system_logs (type, details, severity) VALUES (?, ?, ?)')
          .run('dns_block', `Blocked domain: ${domain}`, 'warning');
      } catch (err) {
        console.error('Failed to insert DNS log:', err.message);
      }
    }
  },

  /**
   * Tails system logs for iptables block events.
   * Note: Requires rsyslog or similar to be running in the container.
   */
  tailIPBlocks() {
    const logFile = '/var/log/syslog';
    if (!fs.existsSync(logFile)) {
      console.warn(`Log file ${logFile} not found. IP block logging may be unavailable.`);
      return;
    }

    console.log(`Tailing IP block logs from ${logFile}`);
    const tail = spawn('tail', ['-f', logFile]);
    
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('VPN_BLOCK:')) {
          this.logIPBlock(line);
        }
      }
    });
  },

  logIPBlock(line) {
    // Example: Apr 27 14:00:00 kernel: [123.456] VPN_BLOCK: IN=eth0 ... SRC=1.2.3.4 DST=...
    const srcMatch = line.match(/SRC=([0-9.]+)/);
    if (srcMatch) {
      const srcIp = srcMatch[1];
      try {
        db.prepare('INSERT INTO system_logs (type, source_ip, details, severity) VALUES (?, ?, ?, ?)')
          .run('ip_block', srcIp, `Blocked connection attempt from ${srcIp}`, 'error');
      } catch (err) {
        console.error('Failed to insert IP block log:', err.message);
      }
    }
  },

  /**
   * Schedules periodic cleanup of old logs.
   */
  startCleanupTask() {
    // Run cleanup every 12 hours
    setInterval(() => {
      this.cleanup();
    }, 12 * 60 * 60 * 1000);
    
    // Run immediately on start
    setTimeout(() => this.cleanup(), 5000);
  },

  cleanup() {
    try {
      const retentionDays = db.prepare('SELECT value FROM settings WHERE key = ?').get('log_retention_days')?.value || 7;
      console.log(`Cleaning up logs older than ${retentionDays} days...`);
      
      const result = db.prepare("DELETE FROM system_logs WHERE timestamp < datetime('now', ?)")
        .run(`-${retentionDays} days`);
      
      if (result.changes > 0) {
        console.log(`Purged ${result.changes} old log entries.`);
      }
    } catch (err) {
      console.error('Log cleanup failed:', err.message);
    }
  }
};

module.exports = LogWorker;
