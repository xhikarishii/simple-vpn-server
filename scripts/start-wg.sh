#!/bin/bash

echo "Starting WireGuard..."

# Ensure the config directory exists
mkdir -p /etc/wireguard

# Check if wg0.conf exists, if not, create a dummy one or wait for backend
if [ ! -f /etc/wireguard/wg0.conf ]; then
    echo "WireGuard config not found. Backend will initialize it."
else
    wg-quick up wg0 || echo "WireGuard failed to start, check kernel modules."
fi
