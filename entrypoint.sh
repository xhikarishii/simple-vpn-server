#!/bin/bash

# Enable IP Forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# Start Services
service cron start
/app/scripts/start-wg.sh
/app/scripts/start-openvpn.sh

# Start the Backend API
cd /app/backend
node server.js
