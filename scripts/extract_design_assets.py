#!/usr/bin/env python3
"""Estrae il mapping design->asset dal bundle Chess Free e verifica i file locali."""
import re, json
from pathlib import Path

BUNDLE = Path("/home/z/my-project/repo-chess/audit-extracted/chess-free.game-files.crazygames.com/chess-free/375/assets/main-osqZAit2.js")
ASSETS = BUNDLE.parent
OUT = Path("/home/z/my-project/scripts/design-assets.json")

txt = BUNDLE.read_text(encoding="utf-8", errors="ignore")

# 1) definizioni variabili: Xxx=""+new URL("file",import.meta.url).href   |   Xxx="data:..."
vardef = {}
for m in re.finditer(r'([A-Za-z_$][A-Za-z0-9_$]{1,5})=""\+new URL\("([^"]+)",import\.meta\.url\)\.href', txt):
    vardef[m.group(1)] = "/assets/" + m.group(2)
for m in re.finditer(r'([A-Za-z_$][A-Za-z0-9_$]{1,5})="(data:image/[^"]{40,})"', txt):
    vardef[m.group(1)] = m.group(2)
print(f"variabili risolte: {len(vardef)} (hashed: {sum(1 for v in vardef.values() if v.startswith('/assets/'))}, dataURI: {sum(1 for v in vardef.values() if v.startswith('data:'))})")

# 2) mapping "<packages path>": varName
PKG = re.compile(r'"(\.\./\.\./packages/chess-board/src/images/chess/(figures|boards)/[^"]+)":([A-Za-z_$][A-Za-z0-9_$]{0,5})\b')
figs, boards, unresolved = {}, {}, []
for m in PKG.finditer(txt):
    path, kind, var = m.group(1), m.group(2), m.group(3)
    if var not in vardef:
        unresolved.append(path); continue
    url = vardef[var]
    if kind == "figures":
        # .../figures/<design>/<color>/<piece>.<ext>
        parts = path.split("/")
        design, color, piece = parts[-3], parts[-2], parts[-1].rsplit(".", 1)[0]
        figs.setdefault(design, {}).setdefault(color, {})[piece] = url
    else:
        # .../boards/<design>/<b|w>.png
        parts = path.split("/")
        design, cell = parts[-2], parts[-1].rsplit(".", 1)[0]
        boards.setdefault(design, {})[cell] = url

print(f"design figures: {len(figs)} | design boards: {len(boards)} | non risolti: {len(unresolved)}")

# 3) verifica/download file hashed referenziati ma assenti
import urllib.request
missing = []
for design in figs.values():
    for color in design.values():
        for url in color.values():
            if url.startswith("/assets/"):
                f = ASSETS / url.split("/")[-1]
                if not f.exists():
                    missing.append(url)
for b in boards.values():
    for url in b.values():
        if url.startswith("/assets/") and not (ASSETS / url.split("/")[-1]).exists():
            missing.append(url)
print(f"file hashed da scaricare: {len(missing)}")
for url in missing[:40]:
    full = "https://chess-free.game-files.crazygames.com/chess-free/375" + url
    try:
        data = urllib.request.urlopen(urllib.request.Request(full, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
        (ASSETS / url.split("/")[-1]).write_bytes(data)
        print("  ok", url)
    except Exception as e:
        print("  FAIL", url, e)

OUT.write_text(json.dumps({"figures": figs, "boards": boards}, indent=1))
print("salvato", OUT)

# riepilogo design chiave
for d in ("classic", "classic-3d", "wooden", "steklo", "mramor", "gold3d"):
    if d in figs:
        print(d, "->", list(figs[d].get("white", {}).items())[:2])
