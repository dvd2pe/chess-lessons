// Helper condivisi per le API di Chess Lessons
import { NextRequest } from "next/server";

export const ADMIN_KEY = process.env.ADMIN_KEY || "lesson-admin-2026";

export function isAdmin(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("key") || "";
  return key === ADMIN_KEY;
}

export function genToken(len = 14): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(len);
  globalThis.crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function badRequest(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}
