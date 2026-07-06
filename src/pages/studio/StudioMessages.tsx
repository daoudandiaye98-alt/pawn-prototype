import { useMemo, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useThreads, useThreadMessages, sendMessage, createThread, type MessageCategory } from "@/features/messages/useMessages";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const CATEGORIES: { value: MessageCategory; label: string }[] = [
  { value: "allgemein", label: "Allgemein" },
  { value: "auszahlung", label: "Auszahlung" },
  { value: "kampagne", label: "Kampagne" },
  { value: "produkt", label: "Produkt" },
  { value: "technik", label: "Technik" },
];

export default function StudioMessages() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const { threads } = useThreads();
  const [active, setActive] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<MessageCategory>("allgemein");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const { messages, listRef } = useThreadMessages(active);
  const activeThread = useMemo(() => threads.find((t) => t.id === active), [threads, active]);

  const startThread = async () => {
    if (!designer || !user || !subject.trim() || !body.trim()) return;
    const { thread, error } = await createThread({
      designer_id: designer.id, subject: subject.trim(), category, body: body.trim(), created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setSubject(""); setBody(""); setComposeOpen(false);
    if (thread) setActive(thread.id);
    toast.success("Nachricht gesendet.");
  };

  const send = async () => {
    if (!active || !user || !reply.trim()) return;
    const { error } = await sendMessage(active, user.id, reply.trim());
    if (error) return toast.error(error.message);
    setReply("");
  };

  return (
    <StudioShell title="Nachrichten" eyebrow="Kanal">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <aside className="border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">Verlauf</p>
            <button onClick={() => setComposeOpen(true)} className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground underline">Neu</button>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {threads.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">Noch keine Threads.</li>}
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t.id)}
                  className={`w-full border-b border-border px-4 py-3 text-left hover:bg-secondary ${active === t.id ? "bg-secondary" : ""}`}
                >
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t.category} · {t.status}</p>
                  <p className="mt-1 font-serif text-sm">{t.subject}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-h-[60vh] border border-border">
          {composeOpen ? (
            <div className="p-6 space-y-4">
              <p className="editorial-eyebrow">Neuer Thread</p>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Betreff"
                className="w-full border-b border-border bg-transparent py-2 focus:outline-none" />
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => setCategory(c.value)}
                    className={`px-3 py-1 text-[0.68rem] uppercase tracking-[0.28em] border ${category === c.value ? "bg-foreground text-background" : "border-border text-muted-foreground"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Deine Nachricht…"
                className="w-full border border-border bg-transparent p-3 focus:outline-none" />
              <div className="flex gap-3">
                <button onClick={startThread} disabled={!subject.trim() || !body.trim()}
                  className="px-4 py-2 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">Senden</button>
                <button onClick={() => setComposeOpen(false)} className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">Abbrechen</button>
              </div>
            </div>
          ) : activeThread ? (
            <div className="flex h-[70vh] flex-col">
              <header className="border-b border-border px-6 py-4">
                <p className="editorial-eyebrow">{activeThread.category} · {activeThread.status}</p>
                <h2 className="font-serif text-xl mt-1">{activeThread.subject}</h2>
              </header>
              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((m) => (
                  <div key={m.id} className={m.sender_id === user?.id ? "text-right" : ""}>
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{m.sender_id === user?.id ? "Du" : "PAWN"}</p>
                    <p className="mt-1 text-sm">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    className="flex-1 border border-border bg-transparent p-2 focus:outline-none" placeholder="Antworten…" />
                  <button onClick={send} disabled={!reply.trim()} className="px-4 py-2 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">Senden</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center p-8 text-center text-muted-foreground">
              Wähle einen Thread oder starte einen neuen.
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
