#!/bin/bash

echo "Starting L2TP/IPsec services..."

# Start StrongSwan (IPsec)
ipsec start

# Wait for StrongSwan to be ready
sleep 2

# Start xl2tpd
mkdir -p /var/run/xl2tpd
if [ -f /var/run/xl2tpd/l2tp-control ]; then
    rm /var/run/xl2tpd/l2tp-control
fi

xl2tpd
