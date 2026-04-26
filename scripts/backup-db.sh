#!/bin/bash

# Database backup script
BACKUP_DIR="/data/backups"
DB_FILE="/data/vpn.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/vpn_backup_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Use sqlite3 to create a safe online backup
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Keep only the last 7 days of backups
find "$BACKUP_DIR" -name "vpn_backup_*.db" -mtime +7 -delete

echo "[$(date)] Backup completed: $BACKUP_FILE"
