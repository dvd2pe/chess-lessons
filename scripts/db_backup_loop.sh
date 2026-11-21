#!/usr/bin/env bash
# Loop di backup: snapshot consistente del DB ogni 90 secondi;
# se il contenuto e' cambiato, pusha lo snapshot sulla repo privata GitHub.
set -u
cd /home/z/my-project
while true; do
  OUT=$(python3 scripts/db_snapshot.py 2>/dev/null || true)
  case "$OUT" in
    CHANGED*) bash scripts/db_git_push.sh >/dev/null 2>&1 ;;
  esac
  sleep 90
done
