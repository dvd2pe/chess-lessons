#!/usr/bin/env python3
"""Popola dati demo realistici nel portal Chess Lessons (per verifica admin)."""
import json
import urllib.request

BASE = "http://localhost:3000"
ADMIN = "lesson-admin-2026"


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


# evita duplicati se il seeding gira due volte
_, d = call("GET", "/api/requests", headers={"x-admin-key": ADMIN})
existing = {r["studentName"] for r in d.get("requests", [])}
if existing:
    print(f"già presenti {len(existing)} richieste: {sorted(existing)} — niente duplicati")
else:
    demo = [
        {"studentName": "Giulia Bianchi", "contact": "giulia.bianchi@gmail.com", "level": "beginner",
         "notes": "Prima esperienza con gli scacchi, preferirei lezioni serali"},
        {"studentName": "Luca Ferri", "contact": "+39 333 123 4567", "level": "intermediate",
         "notes": "Vuole prepararsi al torneo sociale di primavera"},
        {"studentName": "Sara Conti", "contact": "sara.conti@outlook.com", "level": "advanced",
         "notes": "Interessata a tattica, finali e analisi delle partite"},
    ]
    ids = []
    for req in demo:
        c, d = call("POST", "/api/requests", req)
        print("richiesta:", req["studentName"], "->", c)
        if c == 201:
            ids.append(d["request"]["id"])

    # stanza demo collegata alla prima richiesta, con coach, mosse e link Meet
    if ids:
        c, d = call("POST", "/api/rooms",
                    {"name": "Lezione demo — Giulia B.", "coachName": "Maestro Rossi", "requestId": ids[0]},
                    headers={"x-admin-key": ADMIN})
        room = d["room"]
        print("stanza:", room["name"], "->", c)
        for san in ("e4", "e5", "Nf3"):
            call("POST", f"/api/rooms/{room['id']}/move", {"token": room["studentToken"], "san": san})
        c, _ = call("PATCH", f"/api/rooms/{room['id']}",
                    {"token": room["coachToken"], "avLink": "https://meet.google.com/demo-lezione-scacchi"})
        print("avLink impostato ->", c)
        print(f"\nStudent link: /?room={room['id']}&k={room['studentToken']}")
        print(f"Coach link:   /?room={room['id']}&k={room['coachToken']}")
