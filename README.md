# Chess Lessons — Beta 0.1

Mobile-friendly beta for **one-on-one chess lessons**: a student submits a lesson request, the team assigns a coach manually, and both participants join a **private room with a shared chessboard**. Lessons use an **external link** for audio/video (Google Meet, Zoom, …).

The interface reuses the design language and assets of the "Chess Free" game (dark theme, olive buttons, classic board and piece sprites) — no foreign UI components.

## Features

| Requirement | Status |
|---|---|
| Student lesson request form (name, contact, level, notes) with DB persistence | Done |
| Admin panel: view requests, assign coach, create private rooms, generate shareable links | Done |
| Roles student / coach / admin via tokenized links (no registration) | Done |
| Coach position editor: drag pieces, FEN input, teaching presets | Done |
| Shared chessboard with move validation (chess.js, server-side) | Done |
| Two devices, same room: moves sync and reconnect restores the current position | Done (sync via 2.5s polling of room state) |
| External audio/video link field (Meet/Zoom) in the room | Done |
| Mobile-first responsive layout | Done |
| Setup & deploy docs (this file) | Done |
| Instant real-time push via WebSocket (replaces polling) | Next step — planned |

## Stack

- Next.js 16 (App Router, TypeScript) + Tailwind CSS
- Prisma ORM + SQLite (`db/custom.db`)
- chess.js (move validation, server and client)
- Socket.io reserved for the next real-time step (mini-service pattern already available)

## Run locally

```bash
bun install            # or npm install
bun run db:push        # create/update SQLite database
bun run dev            # http://localhost:3000
```

Environment variables (`.env`):

```
DATABASE_URL=file:/home/z/my-project/db/custom.db
ADMIN_KEY=lesson-admin-2026   # change before deploying
```

## Usage — a full practice lesson (handoff walkthrough)

1. **Student requests a lesson**: open `/` → "Request a lesson" → fill name, contact, level, notes.
2. **Admin assigns a coach**: open `/` → "Admin panel" → enter admin key → open the request → type the coach name (status becomes *assigned*) → "Create room". The request is linked to the new room.
3. **Share links**: in "Rooms", copy the **student link** (`/?room=<id>&k=<studentToken>`) and the **coach link** (`/?room=<id>&k=<coachToken>`). Send each participant their link. Roles derive from the token — no registration.
4. **Coach prepares the lesson**: open the coach link → "Setup position" → choose a preset (Lucena, back-rank mate, Najdorf…), paste a FEN, or drag pieces freely (drag off-board removes; palette adds; eraser clears) → "Apply".
5. **Both join**: student and coach open their links on two devices. Moves made on either device appear on the other within ~2 seconds. If someone disconnects and rejoins the same link, the current position and move list are restored automatically.
6. **Audio/video**: coach sets the Meet/Zoom URL ("Set call link") → both see the "Audio/Video" button in the room header.
7. During the lesson: move list updates, illegal moves are rejected server-side, "Undo move" (coach) removes the last move, board flip available for both, checkmate/draw detection with result banner, move/capture sounds.

## Quick verification (beta checks)

- **Portal flow**: open `/` → request form → admin panel (default key `lesson-admin-2026`, override with `ADMIN_KEY` in `.env`) → create room → share the two tokenized links → play moves from two devices.
- **Automated E2E**: with the dev server running, `python3 scripts/e2e_portal.py` — 28 checks covering form, admin auth, room creation, move validation, rejoin state, FEN setup, undo and permission guards.
- **Game mirror check**: with the `repo-chess/` mirror (clone of `github.com/dvd2pe/chess`) beside the project, open **`/game-full`** — a dev-only read-only route serves the mirrored build. Verified end to end: full main menu, "Play with computer" starts a game, moves and AI replies work, zero failed network requests (see `VERIFICA-RUNTIME.md` in the mirror repo).

## Data persistence (survives sandbox restarts)

- Live DB: `db/custom.db` (SQLite, gitignored — mai nella repo pubblica, contiene dati degli studenti).
- **Backup loop**: ogni 90 s snapshot consistente (API backup SQLite) in `backups/custom-latest.db.gz`; se il contenuto cambia viene pushato automaticamente sulla repo **privata** `dvd2pe/chess-lessons-data`.
- **Restore al boot**: `scripts/db_boot.sh` (hook su `npm run dev` e `npm run start`) — se il DB è assente o vuoto, lo ripristina dallo snapshot locale o scaricandolo da GitHub. Recovery point massimo: ~90 s di dati.
- **Token GitHub**: conservato nel remote `data` dentro `.git/config` (sopravvive ai riavvii, mai pushato); `.git-credentials` viene ricostruito al boot. Se anche `.git/` viene perso, reinserire il token: `git remote add data https://dvd2pe:<TOKEN>@github.com/dvd2pe/chess-lessons-data.git`.
- Dati demo: `python3 scripts/seed_demo.py` (idempotente — non duplica).
- In produzione su hosting cliente il filesystem persiste nativamente: il meccanismo resta attivo come backup extra. Per più istanze/processi valutare Postgres gestito (in Prisma basta cambiare `provider` nel datasource).

## API reference

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/requests` | POST | public | Create lesson request |
| `/api/requests` | GET | admin key | List requests |
| `/api/requests/[id]` | PATCH | admin key | Assign coach / change status |
| `/api/requests/[id]` | DELETE | admin key | Delete request |
| `/api/rooms` | GET / POST | admin key | List / create rooms (tokens generated server-side) |
| `/api/rooms/[id]?k=token` | GET | room token | Room state: fen, moves, avLink, role |
| `/api/rooms/[id]` | PATCH | coach token | Set audio/video link |
| `/api/rooms/[id]/move` | POST | room token | Make a move (validated with chess.js) |
| `/api/rooms/[id]/setup` | POST | coach token | Set custom starting position (FEN) |
| `/api/rooms/[id]/undo` | POST | coach token | Remove last move |

## Deploy (hosting you control)

**Option A — VPS (Ubuntu + Node 20/bun):**

```bash
git clone <your-repo> && cd app
bun install && bun run db:push
ADMIN_KEY=<secret> DATABASE_URL=file:$(pwd)/db/custom.db bun run build
ADMIN_KEY=<secret> DATABASE_URL=file:$(pwd)/db/custom.db bun run start   # port 3000
```

Put Caddy or nginx in front for HTTPS:

```
yourdomain.com {
  reverse_proxy localhost:3000
}
```

**Option B — Railway / Render / Fly.io:** set `ADMIN_KEY` and `DATABASE_URL` env vars, build command `bun run build`, start command `bun run start`. Persist the `db/` folder (volume) to keep the SQLite database.

**Recurring costs (reference):** domain ~10 €/year; VPS from ~4–6 €/month (Hetzner/DO); Railway/Render free tiers have cold starts — a paid instance (~5 $/month) is recommended for lessons. No other external services are required: audio/video rides on the client's own Meet/Zoom account.

## Architecture notes

- Single visible route `/` — views are driven by query params: `/?view=request`, `/?view=admin`, `/?room=<id>&k=<token>`.
- Tokens are the only credential: whoever holds the coach token can move pieces, undo, setup positions and set the AV link. The student token can play moves. Without a token the room is read-only.
- Moves are stored as SAN list + optional `startFen`; FEN is recomputed server-side by replaying them, so state stays consistent and rejoin-safe.
- Sync today = short polling every 2.5 s (state key: fen+moves+avLink). The next step swaps this for a socket.io mini-service on port 3003 (Caddy forwards via `XTransformPort`) for instant push and reconnect events — no API contract changes needed.

## Game assets license note

Board/piece sprites and sounds are extracted from the "Chess Free" build (Smartberry) present in the `repo-chess` mirror, and are used here for the beta demo/handoff. For a public production release, replace them with licensed assets (the UI keeps working with any piece set placed in `public/game/pieces/classic/`).
