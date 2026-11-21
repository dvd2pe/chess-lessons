// Serve il mirror di Chess Free (repo dvd2pe/chess) per la verifica runtime.
// Dev-only: richiede la cartella repo-chess/ accanto al progetto (clona
// https://github.com/dvd2pe/chess in ./repo-chess per usarla in produzione locale).
// Non e' una feature del prodotto: serve solo a controllare che il mirror
// scaricato dal CDN sia eseguibile e completo.
import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const ROOT = path.join(
  process.cwd(),
  "repo-chess",
  "audit-extracted",
  "chess-free.game-files.crazygames.com",
  "chess-free",
  "375"
);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: parts } = await params;
  const rel = (parts || []).join("/");
  const file = path.normalize(path.join(ROOT, rel || "index.html"));
  if (!file.startsWith(ROOT)) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    // L'index.html originale usa percorsi relativi ("./assets/..."):
    // iniettiamo <base> cosi' funzionano anche da /game-full (senza slash),
    // senza modificare il mirror su disco.
    if (ext === ".html") {
      const html = data
        .toString("utf-8")
        .replace("<head>", '<head><base href="/game-full/">');
      return new Response(html, {
        headers: { "Content-Type": type, "Cache-Control": "no-store" },
      });
    }
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
