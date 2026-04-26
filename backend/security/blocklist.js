const axios = require('axios');
const shell = require('shelljs');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const BlocklistManager = {
  // Use ipset for high performance IP blocking
  async updateIPBlocklists() {
    console.log('Updating IP blocklists...');
    const lists = db.prepare("SELECT * FROM blocklists WHERE enabled = 1 AND type = 'ip'").all();
    
    // Create/Flush the ipset 'vpn_blocklist'
    shell.exec('ipset create vpn_blocklist hash:net -! ');
    shell.exec('ipset flush vpn_blocklist');

    for (const list of lists) {
      try {
        const response = await axios.get(list.url);
        const ips = response.data.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

        // Add to ipset (batching for performance)
        const tempFile = `/tmp/ipset_${list.id}.txt`;
        const ipCommands = ips.map(ip => `add vpn_blocklist ${ip} -!`).join('\n');
        fs.writeFileSync(tempFile, ipCommands);
        shell.exec(`ipset restore < ${tempFile}`);
        fs.unlinkSync(tempFile);

        db.prepare('UPDATE blocklists SET last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(list.id);
        console.log(`Updated list: ${list.name} (${ips.length} IPs)`);
      } catch (err) {
        console.error(`Failed to update blocklist ${list.name}:`, err.message);
      }
    }

    // Ensure iptables is using this ipset
    shell.exec('iptables -C INPUT -m set --match-set vpn_blocklist src -j DROP 2>/dev/null || iptables -I INPUT -m set --match-set vpn_blocklist src -j DROP');
    shell.exec('iptables -C FORWARD -m set --match-set vpn_blocklist src -j DROP 2>/dev/null || iptables -I FORWARD -m set --match-set vpn_blocklist src -j DROP');
  },

  async updateDomainBlocklists() {
    console.log('Updating Domain blocklists (Adblocking)...');
    const lists = db.prepare("SELECT * FROM blocklists WHERE enabled = 1 AND type = 'domain'").all();
    const dnsmasqDir = '/etc/dnsmasq.d';
    const blockFile = path.join(dnsmasqDir, 'adblock.conf');

    if (!fs.existsSync(dnsmasqDir)) {
      shell.exec(`mkdir -p ${dnsmasqDir}`);
    }

    let domainsCount = 0;
    const writeStream = fs.createWriteStream(blockFile);

    for (const list of lists) {
      try {
        const response = await axios.get(list.url);
        const lines = response.data.split('\n');
        
        for (let line of lines) {
          // Strip comments and handle various host file formats
          const cleanLine = line.split('#')[0].split('//')[0].trim();
          if (cleanLine) {
            const parts = cleanLine.split(/\s+/);
            // If it's a hosts file like '0.0.0.0 domain.com', domain is the 2nd part
            // If it's a raw list like 'domain.com', it's the 1st part
            const domain = parts.length > 1 ? parts[1] : parts[0];
            
            // Simple validation: must have a dot, no weird characters, and not be 'localhost'
            if (domain && domain.includes('.') && /^[a-zA-Z0-9.-]+$/.test(domain) && domain !== 'localhost') {
              writeStream.write(`address=/${domain}/0.0.0.0\n`);
              domainsCount++;
            }
          }
        }
        db.prepare('UPDATE blocklists SET last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(list.id);
      } catch (err) {
        console.error(`Failed to update domain list ${list.name}:`, err.message);
      }
    }
    writeStream.end();

    // Restart dnsmasq to apply
    console.log(`Applied ${domainsCount} domains to adblocker.`);
    shell.exec('pkill dnsmasq');
    
    // Create base dnsmasq config if not exists
    const baseConf = '/etc/dnsmasq.conf';
    const confContent = `
no-resolv
server=127.0.0.1#5053
conf-dir=/etc/dnsmasq.d
user=root
`;
    fs.writeFileSync(baseConf, confContent);

    // Start dnsmasq
    shell.exec('dnsmasq --conf-file=/etc/dnsmasq.conf');
  },

  init() {
    // Initial sync
    this.updateIPBlocklists();
    this.updateDomainBlocklists();
    
    // Seed default lists if empty
    const count = db.prepare('SELECT count(*) as count FROM blocklists').get().count;
    if (count === 0) {
      db.prepare('INSERT INTO blocklists (name, url, type) VALUES (?, ?, ?)')
        .run('Feodo Tracker (Botnets)', 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt', 'ip');
      db.prepare('INSERT INTO blocklists (name, url, type) VALUES (?, ?, ?)')
        .run('Steven Black Ads & Malware', 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', 'domain');
      
      this.updateIPBlocklists();
      this.updateDomainBlocklists();
    }
  }
};

module.exports = BlocklistManager;
