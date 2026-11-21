#!/usr/bin/env python3
"""Estrae i pezzi 'classic' (data URI inline) e le celle board classic in public/game/ del progetto Next."""
import json, base64, re, shutil
from pathlib import Path

SRC = Path("/home/z/my-project/scripts/design-assets.json")
MIRROR = Path("/home/z/my-project/repo-chess/audit-extracted/chess-free.game-files.crazygames.com/chess-free/375/assets")
DEST = Path("/home/z/my-project/public/game")
DEST.mkdir(parents=True, exist_ok=True)
(DEST / "pieces" / "classic" / "white").mkdir(parents=True, exist_ok=True)
(DEST / "pieces" / "classic" / "black").mkdir(parents=True, exist_ok=True)
(DEST / "board" / "classic").mkdir(parents=True, exist_ok=True)

data = json.loads(SRC.read_text())

saved = []
def save_datauri(uri: str, dest: Path):
    m = re.match(r"data:([^;]+);base64,(.*)", uri, re.S)
    if not m:
        return False
    dest.write_bytes(base64.b64decode(m.group(2)))
    return True

for design in ("classic", "wooden", "steklo", "mramor", "multik"):
    figs = data["figures"].get(design)
    if not figs:
        continue
    for color in ("white", "black"):
        for piece, url in figs.get(color, {}).items():
            if url.startswith("data:"):
                dest = DEST / "pieces" / design / color / f"{piece}.webp"
                (dest.parent).mkdir(parents=True, exist_ok=True)
                if save_datauri(url, dest):
                    saved.append(str(dest.relative_to(DEST)))
            elif url.startswith("/assets/"):
                srcf = MIRROR / url.split("/")[-1]
                dest = DEST / "pieces" / design / color / (srcf.suffix and f"{piece}{srcf.suffix}")
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(srcf, dest)
                saved.append(str(dest.relative_to(DEST)))

boards = data["boards"].get("brown-parquet") or data["boards"].get("classic")
if boards:
    for cell, url in boards.items():
        if cell not in ("b", "w"):
            continue
        if url.startswith("data:"):
            dest = DEST / "board" / "classic" / f"{cell}.png"
            save_datauri(url, dest)
            saved.append(str(dest.relative_to(DEST)))
        elif url.startswith("/assets/"):
            srcf = MIRROR / url.split("/")[-1]
            dest = DEST / "board" / "classic" / f"{cell}.png"
            shutil.copy(srcf, dest)
            saved.append(str(dest.relative_to(DEST)))

print(f"salvati {len(saved)} asset in public/game:")
for s in sorted(saved):
    print(" ", s)

# suoni mossa/cattura
for wav, name in (("Move-CX0pz_x1.wav", "move.wav"), ("Capture-BEU4p7FD.wav", "capture.wav")):
    shutil.copy(MIRROR / wav, DEST / name)
    print(" ", f"{name}")
