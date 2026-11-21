"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board, { parseFen } from "./Board";
import { START_FEN, PRESETS } from "@/lib/lesson/presets";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Video, Undo2, FlipHorizontal2, Settings2, ExternalLink, Pencil, Check } from "lucide-react";

interface RoomState {
  id: string;
  name: string;
  coachName: string | null;
  avLink: string | null;
  startFen: string | null;
  moves: string[];
  fen: string;
  updatedAt: string;
}
type Role = "coach" | "student" | "spectator";

interface HistoryItem { san: string; from: string; to: string; color: "w" | "b" }

function replay(startFen: string | null, moves: string[]) {
  const game = new Chess();
  if (startFen) {
    try { game.load(startFen); } catch { game.reset(); }
  }
  const history: HistoryItem[] = [];
  for (const san of moves) {
    try {
      const mv = game.move(san);
      history.push({ san: mv.san, from: mv.from, to: mv.to, color: game.turn() === "w" ? "b" : "w" });
    } catch { break; }
  }
  return { game, history };
}

function playSound(san: string) {
  try {
    const isCapture = san.includes("x");
    const audio = new Audio(isCapture ? "/game/capture.wav" : "/game/move.wav");
    audio.volume = 0.5;
    void audio.play();
  } catch { /* noop */ }
}

const PALETTE = [
  ["wK", "wQ", "wR", "wB", "wN", "wP"],
  ["bK", "bQ", "bR", "bB", "bN", "bP"],
];

function pieceCodeToImg(code: string): string {
  const color = code[0] === "w" ? "white" : "black";
  return `/game/pieces/classic/${color}/${code[1].toLowerCase()}.webp`;
}

export default function RoomView({ roomId, token }: { roomId: string; token: string | null }) {
  const { toast } = useToast();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [role, setRole] = useState<Role>("spectator");
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [paletteSel, setPaletteSel] = useState<string | null>(null);
  const [fenInput, setFenInput] = useState("");
  const [avInput, setAvInput] = useState("");
  const [showAvForm, setShowAvForm] = useState(false);
  const lastMovesLen = useRef<number>(-1);

  const load = async (silent = true) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}?k=${encodeURIComponent(token || "")}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Room not found");
        return;
      }
      const data = await res.json();
      const isNewMove = data.room.moves.length > lastMovesLen.current;
      setRoom(data.room);
      setRole(data.role);
      setAvInput(data.room.avLink || "");
      if (isNewMove && lastMovesLen.current >= 0) playSound(data.room.moves[data.room.moves.length - 1]);
      lastMovesLen.current = data.room.moves.length;
      setError(null);
    } catch {
      if (!silent) setError("Network error");
    }
  };

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 2500);
    return () => clearInterval(t);
  }, [roomId, token]);

  const { game, history } = useMemo(
    () => replay(room?.startFen || null, room?.moves || []),
    [room?.startFen, room?.moves]
  );

  const interactiveEnabled = role !== "spectator" && !game.isGameOver();

  const legalMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!interactiveEnabled) return map;
    for (const mv of game.moves({ verbose: true })) {
      (map[mv.from] ||= []).push(mv.to);
    }
    return map;
  }, [game, interactiveEnabled]);

  const makeMove = async (from: string, to: string): Promise<boolean> => {
    // mossa ottimistica client
    const probe = new Chess(game.fen());
    let mv;
    try { mv = probe.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!mv) return false;
    playSound(mv.san);
    lastMovesLen.current = (room?.moves.length || 0) + 1;
    const res = await fetch(`/api/rooms/${roomId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, san: mv.san }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Move rejected", description: j.error || "Illegal move" });
      load(true);
      return false;
    }
    const data = await res.json();
    setRoom(data.room);
    return true;
  };

  const setupFromFen = (fen: string) => {
    // board locale per il setup: usa il FEN modificato lato client, applicato con POST
    setRoom((r) => (r ? { ...r, startFen: fen, moves: [], fen } : r));
  };

  const applySetup = async (fen: string) => {
    const res = await fetch(`/api/rooms/${roomId}/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, fen }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Invalid position", description: j.error || "FEN not valid" });
      return;
    }
    lastMovesLen.current = 0;
    setRoom(j.room);
    toast({ title: "Position applied" });
  };

  // setup: mosse libere su una copia del fen corrente
  const fenForSetup = room?.fen || START_FEN;

  const doSetupMove = (from: string, to: string) => {
    const map = parseFen(fenForSetup);
    const piece = map[from];
    if (!piece) return;
    const next = switchSquares(fenForSetup, from, to);
    setupFromFen(next);
    pendingSetup.current = next;
  };

  const doSetupRemove = (sq: string) => {
    const next = removePiece(fenForSetup, sq);
    setupFromFen(next);
    pendingSetup.current = next;
  };

  const doSetupPlace = (sq: string, code: string) => {
    const next = placePiece(fenForSetup, sq, code);
    setupFromFen(next);
    pendingSetup.current = next;
  };

  const pendingSetup = useRef<string | null>(null);

  const undo = async () => {
    const res = await fetch(`/api/rooms/${roomId}/undo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast({ title: "Undo", description: j.error || "Nothing to undo" }); return; }
    setRoom(j.room);
  };

  const saveAv = async () => {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, avLink: avInput }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast({ title: "AV link", description: j.error || "Error" }); return; }
    toast({ title: "Audio/video link saved" });
    setShowAvForm(false);
    load(true);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#1a1b1f" }}>
        <div className="cg-panel p-6 text-center max-w-sm w-full">
          <div className="text-lg font-semibold text-white mb-2">Room unavailable</div>
          <div className="text-sm" style={{ color: "#909296" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#1a1b1f" }}>
        <div className="animate-pulse text-sm" style={{ color: "#909296" }}>Loading room…</div>
      </div>
    );
  }

  const resultText = gameResult(game);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a1b1f", color: "#c1c2c5" }}>
      {/* header */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{room.name}</h1>
          <div className="text-xs mt-0.5" style={{ color: "#909296" }}>
            {room.coachName ? `Coach: ${room.coachName} · ` : ""}
            You are: <span style={{ color: "#e8c34f" }}>{role}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {room.avLink && (
            <a href={room.avLink} target="_blank" rel="noreferrer" className="cg-btn cg-btn-accent inline-flex items-center gap-2">
              <Video size={16} /> Audio/Video
            </a>
          )}
          <button className="cg-btn cg-btn-ghost" onClick={() => setFlipped((f) => !f)} aria-label="Flip board">
            <FlipHorizontal2 size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 pb-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        {/* board column */}
        <div className="flex flex-col gap-3">
          <div className="mx-auto w-full" style={{ maxWidth: 560 }}>
            <Board
              fen={setupMode ? fenForSetup : room.fen}
              orientation={flipped ? "black" : "white"}
              lastMove={setupMode ? null : history.length ? history[history.length - 1] : null}
              legalMap={legalMap}
              interactive={interactiveEnabled && !setupMode}
              setupMode={setupMode && role === "coach"}
              selectedPalettePiece={paletteSel}
              onMakeMove={makeMove}
              onSetupMove={doSetupMove}
              onSetupRemove={doSetupRemove}
              onSetupPlace={doSetupPlace}
            />
            {resultText && (
              <div className="cg-panel mt-3 p-3 text-center text-sm font-semibold" style={{ color: "#e8c34f" }}>
                {resultText}
              </div>
            )}
          </div>

          {/* palette setup */}
          {setupMode && role === "coach" && (
            <div className="cg-panel p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold" style={{ color: "#909296" }}>ADD PIECES — click a piece, then a square. Drag a piece off the board to remove it.</div>
              {PALETTE.map((row, i) => (
                <div key={i} className="flex gap-1.5 flex-wrap">
                  {row.map((code) => (
                    <button
                      key={code}
                      className={`rounded p-1 border ${paletteSel === code ? "border-[#e8c34f]" : "border-[#373a40]"}`}
                      style={{ background: "#1a1b1f" }}
                      onClick={() => setPaletteSel(paletteSel === code ? null : code)}
                      aria-label={`Select ${code}`}
                    >
                      <img src={pieceCodeToImg(code)} alt={code} className="w-7 h-7" />
                    </button>
                  ))}
                </div>
              ))}
              <button
                className={`rounded p-1 border w-fit ${paletteSel === "__erase" ? "border-[#e8c34f]" : "border-[#373a40]"}`}
                style={{ background: "#1a1b1f", color: "#c1c2c5", fontSize: 12, padding: "4px 10px" }}
                onClick={() => setPaletteSel(paletteSel === "__erase" ? null : "__erase")}
              >
                Eraser tool
              </button>
            </div>
          )}
        </div>

        {/* side panel */}
        <aside className="flex flex-col gap-3">
          {/* moves */}
          <div className="cg-panel p-3">
            <div className="text-xs font-semibold mb-2" style={{ color: "#909296" }}>MOVES</div>
            <div className="max-h-64 overflow-y-auto cg-scroll text-sm font-mono">
              {history.length === 0 ? (
                <div className="text-xs" style={{ color: "#696969" }}>No moves yet</div>
              ) : (
                <ol className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5">
                  {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                    <li key={i} className="contents">
                      <span style={{ color: "#696969" }}>{i + 1}.</span>
                      <span className="text-white">{history[i * 2]?.san}</span>
                      <span className="text-white">{history[i * 2 + 1]?.san || ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* controlli coach */}
          {role === "coach" && (
            <div className="cg-panel p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold" style={{ color: "#909296" }}>COACH CONTROLS</div>
              <div className="flex gap-2 flex-wrap">
                <button className="cg-btn cg-btn-ghost inline-flex items-center gap-2" onClick={undo}>
                  <Undo2 size={14} /> Undo move
                </button>
                <button
                  className={`inline-flex items-center gap-2 ${setupMode ? "cg-btn cg-btn-accent" : "cg-btn cg-btn-ghost"}`}
                  onClick={() => { setSetupMode((s) => !s); setPaletteSel(null); pendingSetup.current = null; }}
                >
                  <Pencil size={14} /> {setupMode ? "Exit setup" : "Setup position"}
                </button>
              </div>

              {setupMode && (
                <div className="flex flex-col gap-2 pt-1">
                  <select
                    className="cg-input"
                    value=""
                    onChange={(e) => {
                      const p = PRESETS.find((x) => x.id === e.target.value);
                      if (p) { applySetup(p.fen); }
                    }}
                  >
                    <option value="">Presets…</option>
                    {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Input
                      className="cg-input flex-1"
                      placeholder="Paste FEN…"
                      value={fenInput}
                      onChange={(e) => setFenInput(e.target.value)}
                    />
                    <button
                      className="cg-btn"
                      onClick={() => {
                        if (pendingSetup.current) applySetup(pendingSetup.current);
                        else if (fenInput.trim()) applySetup(fenInput.trim());
                        else toast({ title: "Nothing to apply" });
                      }}
                    >
                      <Check size={14} /> Apply
                    </button>
                  </div>
                  <button className="cg-btn cg-btn-ghost" onClick={() => applySetup(START_FEN)}>Reset to starting position</button>
                  <div className="text-[11px]" style={{ color: "#696969" }}>
                    Board edits are local until you press Apply.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* audio/video */}
          <div className="cg-panel p-3 flex flex-col gap-2">
            <div className="text-xs font-semibold" style={{ color: "#909296" }}>AUDIO / VIDEO</div>
            {room.avLink ? (
              <a href={room.avLink} target="_blank" rel="noreferrer" className="cg-btn cg-btn-accent inline-flex items-center justify-center gap-2">
                <ExternalLink size={14} /> Join audio/video call
              </a>
            ) : (
              <div className="text-xs" style={{ color: "#696969" }}>No call link set yet.</div>
            )}
            {role === "coach" && (
              <>
                {showAvForm ? (
                  <div className="flex gap-2">
                    <Input className="cg-input flex-1" placeholder="https://meet.google.com/…" value={avInput} onChange={(e) => setAvInput(e.target.value)} />
                    <button className="cg-btn" onClick={saveAv}>Save</button>
                  </div>
                ) : (
                  <button className="cg-btn cg-btn-ghost inline-flex items-center gap-2" onClick={() => setShowAvForm(true)}>
                    <Settings2 size={14} /> {room.avLink ? "Edit call link" : "Set call link"}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="text-[11px] px-1" style={{ color: "#696969" }}>
            Room state syncs automatically. If you reconnect, the current position is restored.
          </div>
        </aside>
      </main>
    </div>
  );
}

function gameResult(game: Chess): string | null {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White";
    return `Checkmate — ${winner} wins`;
  }
  if (game.isStalemate()) return "Draw — stalemate";
  if (game.isInsufficientMaterial()) return "Draw — insufficient material";
  if (game.isThreefoldRepetition()) return "Draw — threefold repetition";
  if (game.isDraw()) return "Draw";
  return "Game over";
}

// utilità FEN per il setup
function fenRows(fen: string) { return fen.split(" ")[0].split("/"); }

function switchSquares(fen: string, from: string, to: string): string {
  const rows = fenRows(fen);
  const grid = expandGrid(rows);
  const gf = 8 - parseInt(from[1], 10);
  const gfCol = from.charCodeAt(0) - 97;
  const gt = 8 - parseInt(to[1], 10);
  const gtCol = to.charCodeAt(0) - 97;
  const tmp = grid[gf][gfCol];
  grid[gf][gfCol] = grid[gt][gtCol];
  grid[gt][gtCol] = tmp;
  return collapseGrid(grid) + " " + fen.split(" ").slice(1).join(" ");
}

function removePiece(fen: string, sq: string): string {
  const grid = expandGrid(fenRows(fen));
  const row = 8 - parseInt(sq[1], 10);
  const col = sq.charCodeAt(0) - 97;
  grid[row][col] = ".";
  return collapseGrid(grid) + " " + fen.split(" ").slice(1).join(" ");
}

function placePiece(fen: string, sq: string, code: string): string {
  const grid = expandGrid(fenRows(fen));
  const row = 8 - parseInt(sq[1], 10);
  const col = sq.charCodeAt(0) - 97;
  const ch = code[0] === "w" ? code[1].toUpperCase() : code[1].toLowerCase();
  grid[row][col] = ch;
  return collapseGrid(grid) + " " + fen.split(" ").slice(1).join(" ");
}

function expandGrid(rows: string[]): string[][] {
  return rows.map((r) => {
    const out: string[] = [];
    for (const ch of r) {
      if (/\d/.test(ch)) out.push(...Array(parseInt(ch, 10)).fill("."));
      else out.push(ch);
    }
    return out;
  });
}

function collapseGrid(grid: string[][]): string {
  return grid.map((row) => {
    let out = "";
    let empty = 0;
    for (const ch of row) {
      if (ch === ".") empty++;
      else {
        if (empty) { out += empty; empty = 0; }
        out += ch;
      }
    }
    if (empty) out += empty;
    return out;
  }).join("/");
}
