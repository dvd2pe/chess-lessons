#!/usr/bin/env python3
"""Completa il mirror di Chess Free scaricando dal CDN tutti gli asset referenziati ma mancanti."""
import re
import json
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

BASE = "https://chess-free.game-files.crazygames.com/chess-free/375/"
ROOT = Path("/home/z/my-project/repo-chess/audit-extracted/chess-free.game-files.crazygames.com/chess-free/375")
ASSETS = ROOT / "assets"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"}

ASSET_EXT = ("js", "css", "png", "webp", "jpg", "svg", "gif", "mp3", "wav", "json", "wasm", "txt", "html", "mp4", "woff", "woff2", "ttf")

# pattern: "./nome-hash.ext" in JS/CSS  |  "nome-hash.ext" bare  |  url(./x)  |  ../../packages/...
RE_QUOTED = re.compile(r'"(\.\./\.\./packages/[^"]{5,160}\.(?:' + "|".join(ASSET_EXT) + r'))"')
RE_REL    = re.compile(r'"\.\/([A-Za-z0-9_.\-]{4,120}\.(?:' + "|".join(ASSET_EXT) + r'))"')
RE_BARE   = re.compile(r'"([A-Za-z0-9_.\-]{1,100}?\-[A-Za-z0-9_\-]{6,10}\.(?:png|webp|jpg|svg|gif|mp3|wav|json|woff2?|ttf))"')
RE_CSSURL = re.compile(r'url\(\s*[\'"]?\.?/?([A-Za-z0-9_.\-]{4,120}\.(?:png|webp|jpg|svg|gif|woff2?|ttf))[\'"]?\s*\)')

def scan_file(path: Path):
    """Estrae i riferimenti asset da un file JS/CSS/HTML."""
    try:
        txt = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return set()
    refs = set()
    for m in RE_REL.finditer(txt):
        refs.add(m.group(1))
    for m in RE_BARE.finditer(txt):
        refs.add(m.group(1))
    for m in RE_CSSURL.finditer(txt):
        refs.add(m.group(1))
    for m in RE_QUOTED.finditer(txt):
        refs.add(m.group(1))
    # engine worker: nomi speciali senza hash
    if "engine" in txt:
        for m in re.finditer(r'"(\.?/?engine(\.wasm)?\.js)"', txt):
            refs.add(m.group(1).lstrip("./"))
    return {r for r in refs if not r.endswith((".ts",))}

def candidates(ref: str):
    """URL candidate per un riferimento, in ordine di prova."""
    out = []
    if ref.startswith("../../packages/"):
        # risoluzione relativa al bundle in assets/: assets/../.. => 375/../.. => /chess-free/
        out.append("https://chess-free.game-files.crazygames.com/chess-free/" + ref.split("../../", 1)[1])
        out.append("https://chess-free.game-files.crazygames.com/" + ref.split("../../", 1)[1])
        return out
    if ref.startswith("engine"):
        out.append(BASE + ref)            # root documento (confermato 200)
        out.append(BASE + "assets/" + ref)
        return out
    out.append(BASE + "assets/" + ref)
    if ref.endswith((".html",)):                       # pagine root documento
        out.append(BASE + ref)
    if ref.endswith(".mp3") or ref.endswith(".wav"):
        out.append(BASE + "shared/music/" + ref)
        out.append(BASE + "shared/emotions/" + ref)
    return out

def fetch(url: str):
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                if not data:
                    return None
                return data
        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                return None
            if e.code >= 500:
                continue
            return None
        except Exception:
            continue
    return None

def try_download(ref: str):
    for url in candidates(ref):
        data = fetch(url)
        if data:
            return url, data
    return None, None

def save(ref: str, url: str, data: bytes):
    """Salva il file rispettando la struttura locale del mirror (ROOT = .../chess-free/375)."""
    if "/chess-free/375/" in url:
        rel = url.split("/chess-free/375/")[1]          # es. assets/x.js, engine.js
        dest = ROOT / rel
    elif "/chess-free/" in url:                          # es. packages/... (fuori da 375/)
        rel = url.split("/chess-free/")[1]               # es. packages/chess-board/...
        dest = ROOT.parent / rel
    elif "/shared/" in url:
        rel = "shared/" + url.split("/shared/")[1]
        dest = ROOT / rel
    else:
        dest = ROOT / "assets" / ref
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size == len(data):
        return dest, False
    dest.write_bytes(data)
    return dest, True

def main():
    seen = set()          # refs già provati
    stats = {"downloaded": 0, "bytes": 0, "already": 0, "missing": []}

    pending = set()
    for f in [ROOT / "index.html", ASSETS / "main-osqZAit2.js", ASSETS / "main-Cv7OJqtW.css",
              ASSETS / "BoardCellFigureMoves-Q5bXcpw7.css"]:
        pending |= scan_file(f)

    for pas in range(1, 6):
        new = [r for r in pending if r not in seen]
        if not new:
            break
        print(f"[pass {pas}] refs da provare: {len(new)}", flush=True)
        found_js = set()
        def work(ref):
            url, data = try_download(ref)
            return ref, url, data
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = {ex.submit(work, r): r for r in new}
            for fut in as_completed(futs):
                ref, url, data = fut.result()
                seen.add(ref)
                if data:
                    dest, created = save(ref, url, data)
                    if created:
                        stats["downloaded"] += 1
                        stats["bytes"] += len(data)
                    else:
                        stats["already"] += 1
                    if dest.suffix in (".js", ".css") and pas < 5:
                        found_js |= scan_file(dest)
                else:
                    stats["missing"].append(ref)
        pending |= found_js
        print(f"[pass {pas}] scaricati={stats['downloaded']}, tot {stats['bytes']/1e6:.1f} MB, mancanti={len(stats['missing'])}", flush=True)

    # report
    report = {
        "downloaded_files": stats["downloaded"],
        "reused_present": stats["already"],
        "downloaded_bytes": stats["bytes"],
        "missing_refs": sorted(stats["missing"]),
        "total_refs_scanned": len(seen),
    }
    Path("/home/z/my-project/scripts/mirror_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: (v if not isinstance(v, list) else v[:20]) for k, v in report.items()}, indent=2))
    print(f"missing totali: {len(stats['missing'])}")

if __name__ == "__main__":
    main()
