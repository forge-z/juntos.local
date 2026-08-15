#!/usr/bin/env bash
# restore.sh — restaura um backup do SQLite.
# Uso local: pare o app e execute JUNTOS_RESTORE_CONFIRMED=1 ./scripts/restore.sh backups/juntos-20260808-123456.db
set -euo pipefail
umask 077

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${JUNTOS_DB:-${DATA_DIR:-$DIR/data}/juntos.db}"
SRC="${1:?uso: $0 backups/juntos-20260808-123456.db}"

if [ "${JUNTOS_RESTORE_CONFIRMED:-}" != "1" ]; then
  echo "pare o app antes de restaurar e defina JUNTOS_RESTORE_CONFIRMED=1" >&2
  exit 2
fi

[ -f "$SRC" ] || { echo "arquivo não encontrado: $SRC"; exit 1; }
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const result = db.prepare('PRAGMA integrity_check').get();
db.close();
if (result.integrity_check !== 'ok') { console.error('backup inválido: ' + result.integrity_check); process.exit(1); }
" "$SRC"
mkdir -p "$(dirname "$DB")"
TMP="$DB.restore.$$"
trap 'rm -f "$TMP"' EXIT
cp "$SRC" "$TMP"
rm -f "$DB-wal" "$DB-shm"
mv -f "$TMP" "$DB"
trap - EXIT
echo "restaurado: $SRC → $DB"
echo "reinicie o app após a restauração (npm start ou docker compose up -d)"
