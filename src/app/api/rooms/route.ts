// Stanze: lista admin + creazione (link tokenizzati studente/coach)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, genToken, badRequest } from "@/lib/lesson/helpers";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return badRequest("Unauthorized", 401);
  const rooms = await db.room.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ rooms });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return badRequest("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const name = String(body.name || "").trim();
  const coachName = String(body.coachName || "").trim() || null;
  if (!name || name.length > 80) return badRequest("Room name required (max 80 chars)");

  const room = await db.room.create({
    data: {
      name,
      coachName,
      coachToken: genToken(),
      studentToken: genToken(),
      moves: "[]",
    },
  });

  // opzionale: collega subito una richiesta di lezione
  if (body.requestId) {
    const rid = String(body.requestId);
    const exists = await db.lessonRequest.findUnique({ where: { id: rid } });
    if (exists) {
      await db.lessonRequest.update({
        where: { id: rid },
        data: { roomId: room.id, status: exists.status === "new" ? "scheduled" : exists.status },
      });
    }
  }

  return Response.json({ room }, { status: 201 });
}
