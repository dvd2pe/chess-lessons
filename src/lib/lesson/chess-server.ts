// Utilità scacchi lato server (validazione mosse, ruoli, FEN)
import { Chess } from "chess.js";

export interface RoomLike {
  coachToken: string;
  studentToken: string;
  startFen: string | null;
  moves: string;
}

export function replayMoves(startFen: string | null, moves: string[]): { fen: string; valid: string[] } {
  const game = new Chess();
  if (startFen) {
    try {
      game.load(startFen);
    } catch {
      game.reset();
    }
  }
  const valid: string[] = [];
  for (const san of moves) {
    try {
      game.move(san);
      valid.push(san);
    } catch {
      break;
    }
  }
  return { fen: game.fen(), valid };
}

export function roleFor(room: { coachToken: string; studentToken: string }, token: string | null | undefined): "coach" | "student" | "spectator" {
  if (!token) return "spectator";
  if (token === room.coachToken) return "coach";
  if (token === room.studentToken) return "student";
  return "spectator";
}

export function fenIsValid(fen: string): boolean {
  try {
    const g = new Chess();
    g.load(fen);
    return true;
  } catch {
    return false;
  }
}

export function isValidMoveSequence(startFen: string | null, moves: string[]): boolean {
  const game = new Chess();
  if (startFen) {
    try {
      game.load(startFen);
    } catch {
      return false;
    }
  }
  for (const san of moves) {
    try {
      game.move(san);
    } catch {
      return false;
    }
  }
  return true;
}
