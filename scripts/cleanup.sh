#!/bin/bash
# VPN Core Cleanup Script
# Restores host networking state when the container stops

echo "VPN Server shutting down. Restoring system networking..."

# 1. Restore default iptables policies to avoid lockout
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# 2. Flush all rules and custom chains
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# 3. Clean up ipsets
ipset destroy vpn_blocklist 2>/dev/null
ipset destroy vpn_whitelist 2>/dev/null

# 4. Stop VPN interfaces if they still exist
wg-quick down wg0 2>/dev/null
pkill -9 openvpn 2>/dev/null
killall dnsmasq 2>/dev/null

# 5. Restore /etc/resolv.conf if it was modified (optional, check if needed)
# If the app modified resolv.conf, we should restore it from a backup here.

echo "Networking restored. System is safe."
