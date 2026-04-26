const axios = require('axios');
const shell = require('shelljs');
const fs = require('fs');
const db = require('../db');

const GeoBlockManager = {
  async updateGeoBlocks() {
    console.log('Updating Geo-Blocking lists...');
    const countries = db.prepare('SELECT * FROM geoblocks WHERE enabled = 1').all();
    
    // Create ipset for each country or one big set
    shell.exec('ipset create vpn_geoblock hash:net -! ');
    shell.exec('ipset flush vpn_geoblock');

    for (const country of countries) {
      try {
        const url = `http://www.ipdeny.com/ipblocks/data/countries/${country.country_code.toLowerCase()}.zone`;
        const response = await axios.get(url);
        const networks = response.data.split('\n').filter(line => line.trim());

        const tempFile = `/tmp/geoblock_${country.country_code}.txt`;
        const commands = networks.map(net => `add vpn_geoblock ${net} -!`).join('\n');
        fs.writeFileSync(tempFile, commands);
        shell.exec(`ipset restore < ${tempFile}`);
        fs.unlinkSync(tempFile);

        console.log(`Blocked Country: ${country.country_name} (${networks.length} networks)`);
      } catch (err) {
        console.error(`Failed to update Geo-Block for ${country.country_name}:`, err.message);
      }
    }

    // Apply to iptables
    shell.exec('iptables -C INPUT -m set --match-set vpn_geoblock src -j DROP 2>/dev/null || iptables -I INPUT -m set --match-set vpn_geoblock src -j DROP');
    shell.exec('iptables -C FORWARD -m set --match-set vpn_geoblock src -j DROP 2>/dev/null || iptables -I FORWARD -m set --match-set vpn_geoblock src -j DROP');
  },

  init() {
    this.updateGeoBlocks();
  }
};

module.exports = GeoBlockManager;
