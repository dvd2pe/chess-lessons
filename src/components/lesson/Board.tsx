"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface Piece { type: string; color: "w" | "b" }
export type Square = string; // es. "e4"
export type BoardMap = Record<Square, Piece>;

export function parseFen(fen: string): BoardMap {
  const map: BoardMap = {};
  const rows = fen.split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r] || "") {
      if (/\d/.test(ch)) file += parseInt(ch, 10);
      else {
        const square = String.fromCharCode(97 + file) + String(8 - r);
        map[square] = { type: ch.toLowerCase(), color: ch === ch.toUpperCase() ? "w" : "b" };
        file++;
      }
    }
  }
  return map;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function cellBg(square: Square): string {
  const fileIdx = FILES.indexOf(square[0]);
  const rankIdx = RANKS.indexOf(square[1]);
  const dark = (fileIdx + rankIdx) % 2 === 1;
  return dark ? "url(/game/board/classic/b.png)" : "url(/game/board/classic/w.png)";
}

export function squareName(file: number, rank: number, flipped: boolean): Square {
  const f = flipped ? 7 - file : file;
  const r = flipped ? rank : 7 - rank;
  return FILES[f] + RANKS[r];
}

interface DragState {
  from: Square;
  piece: Piece;
  x: number;
  y: number;
  size: number;
}

export interface BoardProps {
  fen: string;
  orientation?: "white" | "black";
  lastMove?: { from: Square; to: Square } | null;
  legalMap?: Record<Square, Square[]>;   // mosse legali: from -> [to,...]
  interactive?: boolean;                 // mode gioco: mosse legali
  setupMode?: boolean;                   // mode setup coach: mosse libere
  selectedPalettePiece?: string | null;  // es. "wK", "bP", "__erase"
  onMakeMove?: (from: Square, to: Square) => boolean;
  onSetupMove?: (from: Square, to: Square) => void;
  onSetupRemove?: (square: Square) => void;
  onSetupPlace?: (square: Square, pieceCode: string) => void;
}

export default function Board({
  fen,
  orientation = "white",
  lastMove = null,
  legalMap = {},
  interactive = false,
  setupMode = false,
  selectedPalettePiece = null,
  onMakeMove,
  onSetupMove,
  onSetupRemove,
  onSetupPlace,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const boardMap = parseFen(fen);
  const flipped = orientation === "black";

  const cells: Square[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      cells.push(squareName(file, rank, flipped));
    }
  }

  const squareFromPoint = useCallback((x: number, y: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    return squareName(Math.min(col, 7), Math.min(row, 7), flipped);
  }, [flipped]);

  const startDrag = (square: Square, piece: Piece, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (setupMode && selectedPalettePiece) return; // in palette mode si piazza col click
    const cellSize = boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 56;
    setDrag({ from: square, piece, x: e.clientX, y: e.clientY, size: cellSize });
    setSelected(square);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    const sq = squareFromPoint(e.clientX, e.clientY);
    setHoverSquare(sq);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const target = squareFromPoint(e.clientX, e.clientY);
    const d = drag;
    setDrag(null);
    setHoverSquare(null);
    if (!target) {
      // trascinato fuori dalla scacchiera: rimozione in setup
      if (setupMode) onSetupRemove?.(d.from);
      return;
    }
    if (target === d.from) {
      // click semplice: in interactive mostra le mosse legali (già mostrate con selected)
      return;
    }
    if (setupMode) {
      onSetupMove?.(d.from, target);
    } else if (interactive) {
      const targets = legalMap[d.from] || [];
      if (targets.includes(target)) {
        onMakeMove?.(d.from, target);
        setSelected(null);
      }
    }
  };

  const clickCell = (square: Square) => {
    if (setupMode && selectedPalettePiece) {
      if (selectedPalettePiece === "__erase") onSetupRemove?.(square);
      else onSetupPlace?.(square, selectedPalettePiece);
      return;
    }
    // in interactive: click-click move
    if (interactive && !setupMode && selected && selected !== square) {
      const targets = legalMap[selected] || [];
      if (targets.includes(square)) {
        onMakeMove?.(selected, square);
        setSelected(null);
        return;
      }
    }
    if (boardMap[square]) setSelected(square);
    else setSelected(null);
  };

  const legalTargets = selected && !setupMode ? legalMap[selected] || [] : [];

  return (
    <div
      ref={boardRef}
      className="relative w-full select-none"
      style={{ aspectRatio: "1 / 1", touchAction: drag ? "none" : "auto" }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="grid grid-cols-8 w-full h-full overflow-hidden rounded-sm">
        {cells.map((sq) => {
          const piece = boardMap[sq];
          const isLastFrom = lastMove?.from === sq;
          const isLastTo = lastMove?.to === sq;
          const isLegal = legalTargets.includes(sq);
          const fileIdx = FILES.indexOf(sq[0]);
          const rankIdx = RANKS.indexOf(sq[1]);
          const showFile = rankIdx === (flipped ? 0 : 7);
          const showRank = fileIdx === (flipped ? 7 : 0);
          return (
            <div
              key={sq}
              data-square={sq}
              className="relative"
              style={{
                aspectRatio: "1 / 1",
                backgroundImage: cellBg(sq),
                backgroundSize: "cover",
                boxShadow: hoverSquare === sq && drag ? "inset 0 0 0 3px rgba(0,0,0,0.35)" : undefined,
              }}
              onPointerDown={(e) => {
                if (setupMode && selectedPalettePiece) { clickCell(sq); return; }
                if (piece) startDrag(sq, piece, e);
              }}
              onClick={() => clickCell(sq)}
            >
              {(isLastFrom || isLastTo) && (
                <div className="absolute inset-0" style={{ background: "rgba(170,162,58,0.45)" }} />
              )}
              {piece && !(drag?.from === sq) && (
                <img
                  src={`/game/pieces/classic/${piece.color === "w" ? "white" : "black"}/${piece.type}.webp`}
                  alt={sq}
                  draggable={false}
                  className="absolute inset-0 w-full h-full"
                  style={{ cursor: interactive || setupMode ? "grab" : "default", pointerEvents: "none" }}
                />
              )}
              {isLegal && !piece && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-full" style={{ width: "26%", height: "26%", background: "rgba(0,0,0,0.22)" }} />
                </div>
              )}
              {isLegal && piece && (
                <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 4px rgba(0,0,0,0.25)", borderRadius: 4 }} />
              )}
              {showFile && (
                <span className="absolute bottom-0 right-1 text-[10px] font-semibold opacity-70 pointer-events-none" style={{ color: "#1a1b1f" }}>
                  {sq[0]}
                </span>
              )}
              {showRank && (
                <span className="absolute top-0 left-1 text-[10px] font-semibold opacity-70 pointer-events-none" style={{ color: "#1a1b1f" }}>
                  {sq[1]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {drag && (
        <img
          src={`/game/pieces/classic/${drag.piece.color === "w" ? "white" : "black"}/${drag.piece.type}.webp`}
          alt=""
          draggable={false}
          className="fixed pointer-events-none z-50"
          style={{
            left: drag.x,
            top: drag.y,
            width: `${drag.size}px`,
            height: `${drag.size}px`,
            transform: "translate(-50%, -50%)",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          }}
        />
      )}
    </div>
  );
}
