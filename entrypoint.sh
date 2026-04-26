#!/bin/bash

# Enable IP Forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# Start VPN Services
/app/scripts/start-wg.sh
/app/scripts/start-l2tp.sh

# Start the Backend API
cd /app/backend
node server.js
