"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Copy, Plus, DoorOpen, ExternalLink } from "lucide-react";

interface LessonRequest {
  id: string;
  studentName: string;
  contact: string;
  level: string;
  notes: string | null;
  status: string;
  coachName: string | null;
  roomId: string | null;
  createdAt: string;
}

interface Room {
  id: string;
  name: string;
  coachName: string | null;
  coachToken: string;
  studentToken: string;
  avLink: string | null;
  createdAt: string;
}

const STATUSES = ["new", "assigned", "scheduled", "done"];

export default function AdminPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"requests" | "rooms">("requests");
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCoach, setNewRoomCoach] = useState("");

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}), "x-admin-key": adminKey } });
      if (res.status === 401) {
        toast({ title: "Wrong admin key" });
        localStorage.removeItem("cl_admin_key");
        setAuthed(false);
        throw new Error("unauthorized");
      }
      return res;
    },
    [adminKey, toast]
  );

  const loadAll = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([authFetch("/api/requests"), authFetch("/api/rooms")]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      setRequests(j1.requests || []);
      setRooms(j2.rooms || []);
    } catch { /* unauthorized handled in authFetch */ }
  }, [authFetch]);

  const tryAuth = useCallback(
    async (key: string) => {
      const res = await fetch("/api/requests", { headers: { "x-admin-key": key } });
      if (res.ok) {
        localStorage.setItem("cl_admin_key", key);
        setAdminKey(key);
        setAuthed(true);
      } else {
        toast({ title: "Wrong admin key", description: "Ask the developer for the admin key." });
      }
    },
    [toast]
  );

  useEffect(() => {
    const saved = localStorage.getItem("cl_admin_key");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bootstrap da localStorage
    if (saved) tryAuth(saved);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dati admin
    if (authed) loadAll();
  }, [authed, loadAll]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: "Copy failed" })
    );
  };

  const roomLinks = (room: Room) => ({
    student: `${location.origin}/?room=${room.id}&k=${room.studentToken}`,
    coach: `${location.origin}/?room=${room.id}&k=${room.coachToken}`,
  });

  const patchRequest = async (id: string, data: { coachName?: string; status?: string }) => {
    const res = await authFetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const j = await res.json();
      setRequests((rs) => rs.map((r) => (r.id === id ? j.request : r)));
    }
  };

  const createRoomFor = async (req: LessonRequest) => {
    const res = await authFetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Lesson — ${req.studentName}`, coachName: req.coachName, requestId: req.id }),
    });
    const j = await res.json();
    if (!res.ok) { toast({ title: "Error", description: j.error }); return; }
    toast({ title: "Room created", description: "Links ready — copy them below." });
    await loadAll();
    setTab("rooms");
  };

  const createRoomManual = async () => {
    if (!newRoomName.trim()) { toast({ title: "Room name required" }); return; }
    const res = await authFetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoomName, coachName: newRoomCoach }),
    });
    const j = await res.json();
    if (!res.ok) { toast({ title: "Error", description: j.error }); return; }
    setNewRoomName("");
    setNewRoomCoach("");
    toast({ title: "Room created" });
    await loadAll();
  };

  const login = (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#1a1b1f" }}>
      <div className="cg-panel p-6 w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-bold text-white">Admin panel</h1>
        <p className="text-sm -mt-2" style={{ color: "#909296" }}>Enter the admin key.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); tryAuth(adminKey); }}
          className="flex gap-2"
        >
          <Input className="cg-input flex-1" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Admin key" />
          <button type="submit" className="cg-btn">Enter</button>
        </form>
        <button className="cg-btn cg-btn-ghost" onClick={() => router.push("/")}>Back to home</button>
      </div>
    </div>
  );

  if (!authed) return login;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a1b1f", color: "#c1c2c5" }}>
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Admin panel</h1>
        <button className="cg-btn cg-btn-ghost" onClick={() => router.push("/")}>Home</button>
      </header>

      <div className="px-4 flex gap-2">
        <button className={tab === "requests" ? "cg-btn cg-btn-accent" : "cg-btn cg-btn-ghost"} onClick={() => setTab("requests")}>
          Lesson requests ({requests.length})
        </button>
        <button className={tab === "rooms" ? "cg-btn cg-btn-accent" : "cg-btn cg-btn-ghost"} onClick={() => setTab("rooms")}>
          Rooms ({rooms.length})
        </button>
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-3">
        {tab === "requests" && (
          <>
            {requests.length === 0 && <div className="cg-panel p-6 text-center text-sm" style={{ color: "#696969" }}>No lesson requests yet.</div>}
            {requests.map((r) => (
              <div key={r.id} className="cg-panel p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-white">{r.studentName}</div>
                    <div className="text-xs" style={{ color: "#909296" }}>
                      {r.contact} · <span style={{ color: "#e8c34f" }}>{r.level}</span> · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.notes && <div className="text-xs mt-1" style={{ color: "#909296" }}>“{r.notes}”</div>}
                  </div>
                  <select
                    className="cg-input w-auto text-xs"
                    value={r.status}
                    onChange={(e) => patchRequest(r.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    className="cg-input flex-1 min-w-[160px]"
                    placeholder="Assign coach…"
                    defaultValue={r.coachName || ""}
                    onBlur={(e) => { if ((e.target.value || "") !== (r.coachName || "")) patchRequest(r.id, { coachName: e.target.value }); }}
                  />
                  {r.roomId ? (
                    <button className="cg-btn cg-btn-ghost inline-flex items-center gap-2" onClick={() => setTab("rooms")}>
                      <DoorOpen size={14} /> Room ready
                    </button>
                  ) : (
                    <button className="cg-btn inline-flex items-center gap-2" onClick={() => createRoomFor(r)}>
                      <Plus size={14} /> Create room
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "rooms" && (
          <>
            <div className="cg-panel p-4 flex flex-col gap-2">
              <div className="text-xs font-semibold" style={{ color: "#909296" }}>CREATE A PRIVATE ROOM</div>
              <div className="flex gap-2 flex-wrap">
                <Input className="cg-input flex-1 min-w-[180px]" placeholder="Room name (student or lesson)" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} />
                <Input className="cg-input w-40" placeholder="Coach name" value={newRoomCoach} onChange={(e) => setNewRoomCoach(e.target.value)} />
                <button className="cg-btn inline-flex items-center gap-2" onClick={createRoomManual}><Plus size={14} /> Create</button>
              </div>
            </div>

            {rooms.length === 0 && <div className="cg-panel p-6 text-center text-sm" style={{ color: "#696969" }}>No rooms yet.</div>}
            {rooms.map((room) => {
              const links = roomLinks(room);
              return (
                <div key={room.id} className="cg-panel p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-bold text-white">{room.name}</div>
                    <a href={`/?room=${room.id}&k=${room.coachToken}`} target="_blank" rel="noreferrer" className="cg-btn cg-btn-accent inline-flex items-center gap-2">
                      <ExternalLink size={14} /> Open as coach
                    </a>
                  </div>
                  {room.coachName && <div className="text-xs" style={{ color: "#909296" }}>Coach: {room.coachName}</div>}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] w-16" style={{ color: "#696969" }}>STUDENT</span>
                      <code className="text-[11px] truncate flex-1" style={{ color: "#c1c2c5" }}>{links.student}</code>
                      <button className="cg-btn cg-btn-ghost" onClick={() => copy(links.student, "Student link")}><Copy size={13} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] w-16" style={{ color: "#696969" }}>COACH</span>
                      <code className="text-[11px] truncate flex-1" style={{ color: "#c1c2c5" }}>{links.coach}</code>
                      <button className="cg-btn cg-btn-ghost" onClick={() => copy(links.coach, "Coach link")}><Copy size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
