#!/bin/bash
# OpenVPN Auth Script
AUTH_FILE="/etc/openvpn/auth.txt"
USER_PASS_FILE=$1

USER=$(head -n 1 "$USER_PASS_FILE")
PASS=$(tail -n 1 "$USER_PASS_FILE")

if grep -q "^$USER $PASS$" "$AUTH_FILE"; then
  exit 0
else
  exit 1
fi
