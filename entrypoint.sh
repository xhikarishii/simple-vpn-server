#!/bin/bash

# Enable IP Forwarding (Handled by Docker sysctls in compose)
# echo 1 > /proc/sys/net/ipv4/ip_forward

# Ensure cleanup script is executable
chmod +x /app/scripts/cleanup.sh

# Cleanup function
cleanup() {
    echo "Caught signal, cleaning up..."
    /app/scripts/cleanup.sh
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM

# Start Services
service cron start
/app/scripts/start-wg.sh
/app/scripts/start-openvpn.sh

# Start the Backend API
cd /app/backend
if [ "$NODE_ENV" = "development" ]; then
    npm run dev &
else
    node server.js &
fi

# Wait for the backend process
wait $!