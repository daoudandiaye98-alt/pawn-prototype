import { useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { useThreads, useThreadMessages, sendMessage } from "@/features/messages/useMessages";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CATEGORY_FILTERS = ["alle", "allgemein", "auszahlung", "kampagne", "produkt", "technik"] as const;
const STATUS_FILTERS = ["alle", "open", "closed"] as const;

export default function AdminMessages() {
  const { user } = useAuth();
  const { threads } = useThreads();
  const [catFilter, setCatFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("alle");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("alle");
  const [active, setActive] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const { messages, listRef } = useThreadMessages(active);

  const filtered = useMemo(() => threads.filter((t) =>
    (catFilter === "alle" || t.category === catFilter) &&
    (statusFilter === "alle" || t.status === statusFilter)), [threads, catFilter, statusFilter]);
  const activeThread = useMemo(() => threads.find((t) => t.id === active), [threads, active]);

  const send = async () => {
    if (!active || !user || !reply.trim()) return;
    const { error } = await sendMessage(active, user.id, reply.trim());
    if (error) return toast.error(error.message);
    setReply("");
  };

  const closeThread = async () => {
    if (!active) return;
    await supabase.from("message_threads").update({ status: "closed" }).eq("id", active);
    toast.success("Thread geschlossen.");
  };

  return (
    <AdminShell title="Nachrichten" eyebrow="Inbox">
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex gap-2">
          {CATEGORY_FILTERS.map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1 text-[0.68rem] uppercase tracking-[0.28em] border ${catFilter === c ? "bg-foreground text-background" : "border-border text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-[0.68rem] uppercase tracking-[0.28em] border ${statusFilter === s ? "bg-foreground text-background" : "border-border text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <aside className="border border-border max-h-[75vh] overflow-y-auto">
          {filtered.length === 0 && <p className="p-6 text-xs text-muted-foreground">Keine Threads.</p>}
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setActive(t.id)}
              className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-secondary ${active === t.id ? "bg-secondary" : ""}`}>
              <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
                {t.category} · {t.status}
                {t.category === "produkt" && <span className="ml-2 border border-foreground/60 px-1.5 py-0.5 text-[0.5rem] text-foreground">PRODUKT</span>}
              </p>
              <p className="mt-1 font-serif text-sm">{t.subject}</p>
              <p className="mt-1 text-[0.62rem] text-muted-foreground">{new Date(t.last_message_at).toLocaleString("de-DE")}</p>
            </button>
          ))}
        </aside>

        <section className="min-h-[60vh] border border-border">
          {activeThread ? (
            <div className="flex h-[75vh] flex-col">
              <header className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <p className="editorial-eyebrow">{activeThread.category} · {activeThread.status}</p>
                  <h2 className="font-serif text-xl mt-1">{activeThread.subject}</h2>
                </div>
                {activeThread.status === "open" && (
                  <button onClick={closeThread} className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground underline">Schließen</button>
                )}
              </header>
              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((m) => (
                  <div key={m.id} className={m.sender_id === user?.id ? "text-right" : ""}>
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{m.sender_id === user?.id ? "PAWN" : "Designer"}</p>
                    <p className="mt-1 text-sm">{m.body}</p>
                    <p className="text-[0.6rem] text-muted-foreground">{new Date(m.created_at).toLocaleString("de-DE")}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2}
                    className="flex-1 border border-border bg-transparent p-2 focus:outline-none" placeholder="Antworten…" />
                  <button onClick={send} disabled={!reply.trim()} className="px-4 py-2 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">Senden</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center p-8 text-muted-foreground">Wähle einen Thread.</div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
