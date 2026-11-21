#!/usr/bin/env bash
# Hook pre-avvio del server (dev e start): restore DB al boot + avvio loop backup.
# Fallisce sempre soft (exit 0): il server deve partire comunque.
set -u
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 0
bash scripts/db_restore.sh || true
if ! pgrep -f "db_backup_loop.sh" >/dev/null 2>&1; then
  nohup bash scripts/db_backup_loop.sh >/dev/null 2>&1 &
fi
exit 0
