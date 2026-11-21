#!/usr/bin/env python3
"""Snapshot consistente del DB SQLite -> gzip in backups/custom-latest.db.gz.

Usa l'API di backup di SQLite (sicura con il server in esecuzione).
Stampa CHANGED se il contenuto e' diverso dall'ultimo snapshot, altrimenti SAME.
"""
import gzip
import hashlib
import os
import sqlite3
import sys

DB = "/home/z/my-project/db/custom.db"
OUT = "/home/z/my-project/backups/custom-latest.db.gz"
HASH = "/home/z/my-project/backups/.last_hash"


def main() -> int:
    if not os.path.exists(DB):
        print("NO_DB")
        return 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    src = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    dst = sqlite3.connect("/tmp/.db_snap_tmp")
    with dst:
        src.backup(dst)
    src.close()
    dst.close()

    raw = open("/tmp/.db_snap_tmp", "rb").read()
    os.remove("/tmp/.db_snap_tmp")
    h = hashlib.sha256(raw).hexdigest()

    prev = open(HASH).read().strip() if os.path.exists(HASH) else ""
    if prev == h and os.path.exists(OUT):
        print("SAME")
        return 0
    with gzip.open(OUT, "wb", compresslevel=9) as f:
        f.write(raw)
    open(HASH, "w").write(h)
    print("CHANGED", h[:12])
    return 0


if __name__ == "__main__":
    sys.exit(main())
