#!/usr/bin/env bash
# Push dello snapshot DB corrente sulla repo PRIVATA dvd2pe/chess-lessons-data.
# Chiamato dal loop di backup quando lo snapshot e' cambiato.
set -u
SNAP=/home/z/my-project/backups/custom-latest.db.gz
REPO=/home/z/my-project/db-snapshot-repo

[ -f "$SNAP" ] || exit 1
mkdir -p "$REPO" || exit 1

# se il clone e' sparito (riavvio sandbox), riclonalo usando il token
# conservato nel remote 'data' di my-project (.git/config sopravvive ai riavvii)
if [ ! -d "$REPO/.git" ]; then
  URL=$(git -C /home/z/my-project remote get-url data 2>/dev/null)
  [ -n "$URL" ] && git clone -q "$URL" "$REPO" || exit 1
fi

cp "$SNAP" "$REPO/custom-latest.db.gz"
cd "$REPO" || exit 1
git add custom-latest.db.gz token.txt 2>/dev/null
if git diff --cached --quiet; then
  echo "snapshot repo: nessuna modifica"
  exit 0
fi
git commit -q -m "db snapshot $(date '+%Y-%m-%d %H:%M:%S')"
git push -q origin main && echo "snapshot pushato su chess-lessons-data"
