// Richieste di lezione: lista admin + creazione pubblica
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin, badRequest } from "@/lib/lesson/helpers";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return badRequest("Unauthorized", 401);
  const requests = await db.lessonRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ requests });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON");
  const studentName = String(body.studentName || "").trim();
  const contact = String(body.contact || "").trim();
  const level = String(body.level || "").trim();
  const notes = String(body.notes || "").trim() || null;

  if (!studentName || studentName.length > 80) return badRequest("Name required (max 80 chars)");
  if (!contact || contact.length > 120) return badRequest("Contact required (max 120 chars)");
  if (!["beginner", "intermediate", "advanced"].includes(level)) return badRequest("Invalid level");

  const request = await db.lessonRequest.create({
    data: { studentName, contact, level, notes },
  });
  return Response.json({ request }, { status: 201 });
}
