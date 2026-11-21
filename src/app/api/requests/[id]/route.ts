// Aggiorna una richiesta: assegna coach / cambio stato
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, badRequest } from "@/lib/lesson/helpers";

const STATUSES = ["new", "assigned", "scheduled", "done"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return badRequest("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");

  const existing = await db.lessonRequest.findUnique({ where: { id } });
  if (!existing) return badRequest("Request not found", 404);

  const data: { coachName?: string; status?: string } = {};
  if (body.coachName !== undefined) {
    data.coachName = String(body.coachName).trim() || null;
    if (data.coachName && existing.status === "new") data.status = "assigned";
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return badRequest("Invalid status");
    data.status = body.status;
  }

  const request = await db.lessonRequest.update({ where: { id }, data });
  return Response.json({ request });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return badRequest("Unauthorized", 401);
  const { id } = await params;
  await db.lessonRequest.delete({ where: { id } }).catch(() => null);
  return Response.json({ ok: true });
}
