// Posizioni didattiche preimpostate per le lezioni
export interface Preset {
  id: string;
  name: string;
  fen: string;
}

export const PRESETS: Preset[] = [
  { id: "start", name: "Starting position", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { id: "empty", name: "Empty board", fen: "8/8/8/8/8/8/8/8 w - - 0 1" },
  { id: "back-rank", name: "Back-rank mate", fen: "6k1/5ppp/8/8/8/8/8/R5RK w - - 0 1" },
  { id: "lucena", name: "Lucena position", fen: "3K4/P7/8/8/8/8/r7/2R4k w - - 0 1" },
  { id: "philidor", name: "Philidor defence", fen: "5rk1/5p1p/8/8/8/8/r7/4R1K1 w - - 0 1" },
  { id: "rook-endgame", name: "Rook vs King", fen: "8/8/8/8/8/2k5/8/K6R w - - 0 1" },
  { id: "two-bishops", name: "Two bishops mate", fen: "8/8/8/8/8/1k6/BB6/K7 w - - 0 1" },
  { id: "kq-vs-k", name: "Queen vs King", fen: "8/8/8/4k3/8/8/8/K3Q3 w - - 0 1" },
  { id: "pawn-endgame", name: "King + Pawn vs King", fen: "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1" },
  { id: "sicilian", name: "Sicilian Najdorf", fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 5" },
  { id: "italian", name: "Italian game", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 5" },
  { id: "endgame-kpawns", name: "Pawn race endgame", fen: "8/8/8/1k6/8/8/1P6/1K6 w - - 0 1" },
];

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
