#!/usr/bin/env bash
# restore.sh — restaura um backup do SQLite.
# Uso: docker compose stop && ./scripts/restore.sh backups/juntos-20260808-123456.db && docker compose up -d
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${JUNTOS_DB:-$DIR/data/juntos.db}"
SRC="${1:?uso: $0 backups/juntos-20260808-123456.db}"

[ -f "$SRC" ] || { echo "arquivo não encontrado: $SRC"; exit 1; }
cp "$SRC" "$DB"
echo "restaurado: $SRC → $DB"
echo "se o app estiver rodando, reinicie: docker compose restart"
