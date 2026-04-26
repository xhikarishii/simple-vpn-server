#!/bin/bash

# This script is called by cron to update security blocklists automatically
echo "[$(date)] Starting automated blocklist sync..."

# Call the internal API to trigger the update
# We use curl to localhost since it's running inside the container
# No token needed if we check for 127.0.0.1 in the backend or use a secret header
curl -X POST http://localhost:3001/api/blocklists/sync -H "X-Internal-Sync: true"

echo "[$(date)] Blocklist sync completed."
