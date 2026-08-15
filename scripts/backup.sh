#!/usr/bin/env bash
# backup.sh — snapshot consistente do SQLite via sqlite backup API.
# Uso: ./scripts/backup.sh   (ou: docker compose exec app ./scripts/backup.sh)
set -euo pipefail
umask 077

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${JUNTOS_DB:-${DATA_DIR:-$DIR/data}/juntos.db}"
BACKUP_DIR="${JUNTOS_BACKUP_DIR:-$DIR/backups}"
RETENTION="${JUNTOS_BACKUP_RETENTION:-14}"

[ -f "$DB" ] || { echo "banco não encontrado: $DB"; exit 1; }
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
DEST="$BACKUP_DIR/juntos-$TS.db"
node --input-type=module -e "
import { DatabaseSync, backup } from 'node:sqlite';
const db = new DatabaseSync(process.argv[1]);
await backup(db, process.argv[2]);
db.close();
" "$DB" "$DEST"
echo "backup: $DEST ($(du -h "$DEST" | cut -f1))"

ls -1t "$BACKUP_DIR"/juntos-*.db 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs rm -f 2>/dev/null || true
echo "retenção: mantidos os últimos $RETENTION backups"
