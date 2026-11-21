"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import RoomView from "@/components/lesson/RoomView";
import RequestForm from "@/components/lesson/RequestForm";
import AdminPanel from "@/components/lesson/AdminPanel";

function Views() {
  const sp = useSearchParams();
  const router = useRouter();
  const roomId = sp.get("room");
  const token = sp.get("k");
  const view = sp.get("view");

  if (roomId) return <RoomView roomId={roomId} token={token} />;
  if (view === "admin") return <AdminPanel />;
  if (view === "request") return <RequestForm />;

  // home — menu in stile Chess Free
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#1a1b1f" }}>
      <h1 className="text-4xl font-extrabold mb-1" style={{ color: "#c1c2c5" }}>
        Chess Lessons
      </h1>
      <p className="text-sm mb-8" style={{ color: "#696969" }}>One-on-one lessons in a private room</p>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button className="cg-btn py-3 text-base font-semibold" onClick={() => router.push("/?view=request")}>
          Request a lesson
        </button>
        <button className="cg-btn cg-btn-ghost py-3 text-base font-semibold" onClick={() => router.push("/?view=admin")}>
          Admin panel
        </button>
      </div>

      <p className="text-xs mt-10 text-center" style={{ color: "#4d4f52" }}>
        Students and coaches join lessons via a private room link.<br />
        Beta 0.1 — live board sync, coach position setup, external audio/video link.
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Views />
    </Suspense>
  );
}
