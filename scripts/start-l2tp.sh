#!/bin/bash

echo "Starting L2TP/IPsec services..."

# Start StrongSwan (IPsec)
ipsec start

# Wait for StrongSwan to be ready
sleep 2

# Start xl2tpd
mkdir -p /var/run/xl2tpd
rm -f /var/run/xl2tpd/l2tp-control

/usr/sbin/xl2tpd -c /etc/xl2tpd/xl2tpd.conf
