// Undo ultima mossa (coach)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/lesson/helpers";
import { roleFor, replayMoves } from "@/lib/lesson/chess-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");
  const room = await db.room.findUnique({ where: { id } });
  if (!room) return badRequest("Room not found", 404);
  if (roleFor(room, body.token) !== "coach") return badRequest("Coach only", 403);

  const moves: string[] = JSON.parse(room.moves || "[]");
  if (moves.length === 0) return badRequest("No moves to undo", 422);
  moves.pop();

  const updated = await db.room.update({
    where: { id },
    data: { moves: JSON.stringify(moves) },
  });
  const { fen, valid } = replayMoves(room.startFen, moves);
  return Response.json({
    room: {
      id: updated.id,
      name: updated.name,
      coachName: updated.coachName,
      avLink: updated.avLink,
      startFen: updated.startFen,
      moves: valid,
      fen,
      updatedAt: updated.updatedAt,
    },
    role: "coach",
  });
}
