#!/usr/bin/env bash
# backup.sh — snapshot consistente do SQLite (checkpoint + cópia).
# Uso: ./scripts/backup.sh   (ou: docker compose exec app ./scripts/backup.sh)
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${JUNTOS_DB:-$DIR/data/juntos.db}"
BACKUP_DIR="${JUNTOS_BACKUP_DIR:-$DIR/backups}"
RETENTION="${JUNTOS_BACKUP_RETENTION:-14}"

[ -f "$DB" ] || { echo "banco não encontrado: $DB"; exit 1; }
mkdir -p "$BACKUP_DIR"

node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1]);
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
db.close();
" "$DB"

TS=$(date +%Y%m%d-%H%M%S)
DEST="$BACKUP_DIR/juntos-$TS.db"
cp "$DB" "$DEST"
echo "backup: $DEST ($(du -h "$DEST" | cut -f1))"

ls -1t "$BACKUP_DIR"/juntos-*.db 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f
echo "retenção: mantidos os últimos $RETENTION backups"
