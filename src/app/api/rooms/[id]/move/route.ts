// Mossa: validata lato server con chess.js, persistita, ritorna lo stato aggiornato
import { NextRequest } from "next/server";
import { Chess } from "chess.js";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/lesson/helpers";
import { replayMoves, roleFor } from "@/lib/lesson/chess-server";
import { START_FEN } from "@/lib/lesson/presets";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const room = await db.room.findUnique({ where: { id } });
  if (!room) return badRequest("Room not found", 404);
  const role = roleFor(room, body.token);
  if (role === "spectator") return badRequest("Invalid room token", 403);

  const moves: string[] = JSON.parse(room.moves || "[]");
  const game = new Chess();
  if (room.startFen) {
    try {
      game.load(room.startFen);
    } catch {
      game.reset();
    }
  }
  for (const san of moves) {
    try {
      game.move(san);
    } catch {
      break;
    }
  }

  // mosse consentite: coach e studente muovono entrambi (il coach gestisce la lezione)
  let mv;
  try {
    mv = game.move(String(body.san || ""));
  } catch {
    return badRequest("Illegal move", 422);
  }
  if (!mv) return badRequest("Illegal move", 422);

  moves.push(mv.san);
  const updated = await db.room.update({
    where: { id },
    data: { moves: JSON.stringify(moves) },
  });

  const { fen, valid } = replayMoves(room.startFen, moves);
  return Response.json({
    room: {
      id: room.id,
      name: room.name,
      coachName: room.coachName,
      avLink: room.avLink,
      startFen: room.startFen,
      moves: valid,
      fen,
      updatedAt: updated.updatedAt,
    },
    role,
  });
}
