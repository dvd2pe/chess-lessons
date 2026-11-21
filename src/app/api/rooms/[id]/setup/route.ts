// Setup posizione (coach): imposta FEN di partenza e azzera la storia mosse
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/lesson/helpers";
import { roleFor, fenIsValid, replayMoves } from "@/lib/lesson/chess-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");
  const room = await db.room.findUnique({ where: { id } });
  if (!room) return badRequest("Room not found", 404);
  if (roleFor(room, body.token) !== "coach") return badRequest("Coach only", 403);

  const fen = String(body.fen || "").trim();
  if (!fenIsValid(fen)) return badRequest("Invalid FEN position", 422);

  const updated = await db.room.update({
    where: { id },
    data: {
      startFen: fen,
      moves: JSON.stringify([]),
    },
  });

  const { fen: currentFen, valid } = replayMoves(updated.startFen, []);
  return Response.json({
    room: {
      id: updated.id,
      name: updated.name,
      coachName: updated.coachName,
      avLink: updated.avLink,
      startFen: updated.startFen,
      moves: valid,
      fen: currentFen,
      updatedAt: updated.updatedAt,
    },
    role: "coach",
  });
}
