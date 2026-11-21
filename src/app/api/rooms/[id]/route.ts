// Stato della stanza: ricostruisce FEN + lista mosse, gestisce token e ruolo
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/lesson/helpers";
import { replayMoves, roleFor } from "@/lib/lesson/chess-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("k");
  const room = await db.room.findUnique({ where: { id } });
  if (!room) return badRequest("Room not found", 404);

  const role = roleFor(room, token);
  const parsedMoves: string[] = JSON.parse(room.moves || "[]");
  const { fen, valid } = replayMoves(room.startFen, parsedMoves);

  return Response.json({
    room: {
      id: room.id,
      name: room.name,
      coachName: room.coachName,
      avLink: room.avLink,
      startFen: room.startFen,
      moves: valid,
      fen,
      updatedAt: room.updatedAt,
    },
    role,
  });
}

// Coach: aggiorna il link audio/video (Meet/Zoom)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");
  const room = await db.room.findUnique({ where: { id } });
  if (!room) return badRequest("Room not found", 404);
  if (roleFor(room, body.token) !== "coach") return badRequest("Coach only", 403);

  const avLink = String(body.avLink || "").trim() || null;
  if (avLink && !/^https?:\/\/.+/i.test(avLink)) return badRequest("AV link must be a http(s) URL");

  const updated = await db.room.update({ where: { id }, data: { avLink } });
  return Response.json({ ok: true, avLink: updated.avLink });
}
