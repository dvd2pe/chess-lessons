#!/usr/bin/env bash
# Restore del DB al boot: sopravvive ai riavvi sandbox (che cancellano i file
# non tracciati). Fonti in ordine: backups/ locale -> repo privata GitHub
# (dvd2pe/chess-lessons-data, clone/fetch via token nel remote 'data').
# Esce SEMPRE 0: il server deve partire comunque.
set -u
cd /home/z/my-project
DB=db/custom.db
SNAP=backups/custom-latest.db.gz
REPO=db-snapshot-repo

log() { echo "[db_restore] $*"; }

# 1) garantisce le credenziali git per le operazioni successive
if [ ! -f .git-credentials ]; then
  URL=$(git remote get-url data 2>/dev/null || true)
  TOKEN=$(printf '%s' "$URL" | sed -n 's|https://dvd2pe:\([^@]*\)@github.com|\1|p')
  if [ -n "$TOKEN" ]; then
    printf 'https://dvd2pe:%s@github.com\n' "$TOKEN" > .git-credentials
    chmod 600 .git-credentials
    log ".git-credentials ricostruito dal remote 'data' (.git/config sopravvive ai riavvii)"
  fi
fi

# 2) snapshot locale assente -> scarica dalla repo privata
if [ ! -f "$SNAP" ]; then
  if [ -d "$REPO/.git" ]; then
    (cd "$REPO" && git pull -q origin main 2>/dev/null) || true
  else
    URL=$(git remote get-url data 2>/dev/null || true)
    [ -n "$URL" ] && git clone -q "$URL" "$REPO" 2>/dev/null || true
  fi
  if [ -f "$REPO/custom-latest.db.gz" ]; then
    mkdir -p backups
    cp "$REPO/custom-latest.db.gz" "$SNAP"
    log "snapshot scaricato dalla repo privata GitHub"
  fi
fi

# 3) conta le righe live e nello snapshot
live_rows() {
  [ -f "$DB" ] || { echo 0; return; }
  python3 -c "
import sqlite3,sys
try:
    c=sqlite3.connect(sys.argv[1])
    print(c.execute('SELECT COUNT(*) FROM LessonRequest').fetchone()[0]+c.execute('SELECT COUNT(*) FROM Room').fetchone()[0])
except Exception:
    print(0)
" "$DB" 2>/dev/null || echo 0
}
snap_rows() {
  [ -f "$SNAP" ] || { echo 0; return; }
  python3 -c "
import sqlite3,sys,gzip,shutil
try:
    with gzip.open(sys.argv[1]) as f, open('/tmp/.db_chk','wb') as o:
        shutil.copyfileobj(f,o)
    c=sqlite3.connect('/tmp/.db_chk')
    print(c.execute('SELECT COUNT(*) FROM LessonRequest').fetchone()[0]+c.execute('SELECT COUNT(*) FROM Room').fetchone()[0])
except Exception:
    print(0)
" "$SNAP" 2>/dev/null || echo 0
  rm -f /tmp/.db_chk
}

LIVE=$(live_rows)
SNAPR=$(snap_rows)
log "righe live=$LIVE, righe snapshot=$SNAPR"

if [ "$LIVE" -ge 1 ]; then
  log "DB vivo: nessun restore necessario"
  exit 0
fi
if [ "$SNAPR" -ge 1 ]; then
  python3 -c "
import gzip,sys,shutil
with gzip.open(sys.argv[1]) as f, open(sys.argv[2],'wb') as o:
    shutil.copyfileobj(f,o)
print('[db_restore] DB ripristinato dallo snapshot (sopravvissuto al riavvio)')
" "$SNAP" "$DB"
  npx prisma db push --skip-generate >/dev/null 2>&1 && log "schema verificato con prisma db push"
else
  if [ ! -f "$DB" ]; then
    npx prisma db push --skip-generate >/dev/null 2>&1 && log "DB assente e nessuno snapshot: schema creato da zero"
  else
    log "nessuno snapshot con dati: mantengo il DB corrente"
  fi
fi
exit 0
