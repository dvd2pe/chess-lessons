#!/usr/bin/env python3
"""Verifica end-to-end del portal Chess Lessons su localhost:3000."""
import json
import urllib.request

BASE = "http://localhost:3000"
ADMIN = "lesson-admin-2026"

ok_count = 0
fail_count = 0


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            raw = r.read().decode() or "{}"
            return r.status, (json.loads(raw) if raw.lstrip()[:1] in "{[" else {})
    except urllib.error.HTTPError as e:
        try:
            raw = e.read().decode() or "{}"
            return e.code, (json.loads(raw) if raw.lstrip()[:1] in "{[" else {})
        except Exception:
            return e.code, {}


def step(name, cond, extra=""):
    global ok_count, fail_count
    if cond:
        ok_count += 1
        print(f"  PASS  {name} {extra}")
    else:
        fail_count += 1
        print(f"  FAIL  {name} {extra}")


print("[1] Pagina home e viste client")
c, _ = call("GET", "/")
step("GET / -> 200", c == 200, f"(HTTP {c})")
c, _ = call("GET", "/?view=request")
step("GET /?view=request -> 200", c == 200, f"(HTTP {c})")

print("[2] Form richiesta lezione (pubblico)")
c, d = call("POST", "/api/requests", {"studentName": "Marco E2E", "contact": "marco@test.it", "level": "intermediate", "notes": "verifica automatica"})
step("POST /api/requests -> 201", c == 201, f"(HTTP {c})")
rid = (d.get("request") or {}).get("id", "")
step("request id presente", bool(rid), f"({rid[:12]}...)")
c, d = call("POST", "/api/requests", {"studentName": "", "contact": "x", "level": "beginner"})
step("POST senza nome -> 400", c == 400, f"(HTTP {c})")

print("[3] Admin: lista richieste + protezione")
c, _ = call("GET", "/api/requests")
step("GET senza admin key -> 401", c == 401, f"(HTTP {c})")
c, d = call("GET", "/api/requests", headers={"x-admin-key": ADMIN})
found = any(r.get("id") == rid for r in d.get("requests", []))
step("GET con admin key -> 200 e contiene richiesta", c == 200 and found, f"(HTTP {c})")

print("[4] Admin: creazione stanza + link tokenizzati")
c, d = call("POST", "/api/rooms", {"name": "Lezione E2E", "coachName": "Maestro Rossi", "requestId": rid}, headers={"x-admin-key": ADMIN})
room = d.get("room") or {}
step("POST /api/rooms -> 201", c == 201, f"(HTTP {c})")
step("coachToken + studentToken generati", bool(room.get("coachToken")) and bool(room.get("studentToken")))
rid_room, ctok, stok = room.get("id", ""), room.get("coachToken", ""), room.get("studentToken", "")
c, d = call("GET", "/api/requests", headers={"x-admin-key": ADMIN})
req = next((r for r in d.get("requests", []) if r["id"] == rid), {})
step("richiesta collegata alla stanza (status scheduled)", req.get("roomId") == rid_room and req.get("status") == "scheduled",
     f"(roomId match: {req.get('roomId') == rid_room}, status: {req.get('status')})")

print("[5] Rejoin: la stanza restituisce lo stato corrente (requisito M1)")
c, d = call("GET", f"/api/rooms/{rid_room}?k={stok}")
step("GET stanza con token studente -> 200", c == 200, f"(HTTP {c})")
step("mosse = []", d.get("room", {}).get("moves") == [])

print("[6] Mosse sincronizzate tra due ruoli (chess.js server-side)")
c, d = call("POST", f"/api/rooms/{rid_room}/move", {"token": stok, "san": "e4"})
step("studente muove e4 -> 200", c == 200, f"(HTTP {c})")
fen_after_e4 = (d.get("room") or {}).get("fen", "")
step("FEN aggiornata (nero a muovere dopo e4)", "4P3" in fen_after_e4 and fen_after_e4.split()[1] == "b", f"({fen_after_e4})")
c, d = call("POST", f"/api/rooms/{rid_room}/move", {"token": ctok, "san": "e5"})
step("coach muove e5 -> 200", c == 200, f"(HTTP {c})")
c, d = call("POST", f"/api/rooms/{rid_room}/move", {"token": stok, "san": "Ke7"})
step("mossa illegale -> 422", c == 422, f"(HTTP {c})")
c, _ = call("POST", f"/api/rooms/{rid_room}/move", {"token": "token-sbagliato", "san": "Nf3"})
step("token invalido -> 403", c == 403, f"(HTTP {c})")

print("[7] Rejoin dopo N mosse: posizione corrente rispedita")
c, d = call("GET", f"/api/rooms/{rid_room}?k={stok}")
moves = (d.get("room") or {}).get("moves", [])
step("rejoin studente: storico completo", c == 200 and moves == ["e4", "e5"], f"(mosse: {moves})")
c, d = call("GET", f"/api/rooms/{rid_room}?k={ctok}")
step("rejoin coach: stessa posizione", c == 200 and (d.get("room") or {}).get("fen", "").startswith("rnbqkbnr/pppp1ppp/8/4p3/4P3"))

print("[8] Editor posizione coach (FEN + reset storico)")
fen_preset = "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1"
c, d = call("POST", f"/api/rooms/{rid_room}/setup", {"token": stok, "fen": fen_preset})
step("setup FEN da studente -> 403 (coach only)", c == 403, f"(HTTP {c})")
c, d = call("POST", f"/api/rooms/{rid_room}/setup", {"token": ctok, "fen": fen_preset})
step("setup FEN da coach -> 200", c == 200, f"(HTTP {c})")
step("storico azzerato + startFen salvato", (d.get("room") or {}).get("moves") == [] and (d.get("room") or {}).get("startFen") == fen_preset)
c, _ = call("POST", f"/api/rooms/{rid_room}/setup", {"token": ctok, "fen": "fen-non-valida"})
step("FEN invalida -> 422", c == 422, f"(HTTP {c})")

print("[9] Undo coach")
c, d = call("POST", f"/api/rooms/{rid_room}/move", {"token": stok, "san": "Qe7"})
step("mossa su FEN custom -> 200", c == 200, f"(HTTP {c})")
c, d = call("POST", f"/api/rooms/{rid_room}/undo", {"token": ctok})
step("undo coach -> 200, storico vuoto", c == 200 and (d.get("room") or {}).get("moves") == [], f"(HTTP {c})")
c, _ = call("POST", f"/api/rooms/{rid_room}/undo", {"token": ctok})
step("undo su storico vuoto -> 422", c == 422, f"(HTTP {c})")

print("[10] Pagine delle stanze (link tokenizzati)")
c, _ = call("GET", f"/?room={rid_room}&k={stok}")
step("GET /?room=..&k=studente -> 200", c == 200, f"(HTTP {c})")
c, _ = call("GET", f"/?room={rid_room}&k={ctok}")
step("GET /?room=..&k=coach -> 200", c == 200, f"(HTTP {c})")

print()
print(f"RISULTATO: {ok_count} PASS / {fail_count} FAIL")
