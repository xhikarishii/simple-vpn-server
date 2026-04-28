#!/bin/bash

# OpenVPN Startup Script for Simple VPN Server
# This script initializes the PKI if necessary and starts the OpenVPN service.

OVPN_DATA="/etc/openvpn"
mkdir -p $OVPN_DATA

# Create auth file if it doesn't exist
touch $OVPN_DATA/auth.txt

# Start OpenVPN with the generated config
# Note: server.conf is managed by the backend (openvpn.js)
if [ -f "$OVPN_DATA/server.conf" ]; then
    echo "Starting OpenVPN..."
    openvpn --config $OVPN_DATA/server.conf --daemon
else
    echo "Waiting for backend to generate server.conf..."
fi