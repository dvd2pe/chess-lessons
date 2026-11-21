"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const LEVELS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export default function RequestForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [level, setLevel] = useState("beginner");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      toast({ title: "Missing fields", description: "Please fill in your name and contact." });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name, contact, level, notes }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Error", description: j.error || "Could not send request" });
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#1a1b1f" }}>
        <div className="cg-panel p-8 text-center max-w-md w-full">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#7b9041" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Request sent!</h2>
          <p className="text-sm mb-6" style={{ color: "#c1c2c5" }}>
            Our team will assign you a coach and send you a private lesson room link. Check your inbox.
          </p>
          <button className="cg-btn" onClick={() => router.push("/")}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#1a1b1f" }}>
      <form onSubmit={submit} className="cg-panel p-6 w-full max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-white">Request a lesson</h1>
        <p className="text-sm -mt-2" style={{ color: "#909296" }}>
          Tell us who you are and what you need — we will match you with a coach.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#909296" }}>YOUR NAME</span>
          <input className="cg-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mario Rossi" maxLength={80} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#909296" }}>CONTACT (EMAIL OR PHONE)</span>
          <input className="cg-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" maxLength={120} />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#909296" }}>LEVEL</span>
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                type="button"
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${level === l.id ? "cg-btn cg-btn-accent" : "cg-btn cg-btn-ghost"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "#909296" }}>NOTES (OPTIONAL)</span>
          <textarea className="cg-input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals, availability, preferred days…" maxLength={500} />
        </label>

        <button type="submit" className="cg-btn cg-btn-accent w-full py-2.5 text-base" disabled={sending}>
          {sending ? "Sending…" : "Send request"}
        </button>
      </form>
    </div>
  );
}
