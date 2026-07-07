import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Sparkles, RefreshCw } from "lucide-react";

interface MirrorStats {
  views_total: number;
  wish_total: number;
  orders_count: number;
  revenue_eur: number;
  top: { slug: string; name: string; views: number; wish: number }[];
}
type Msg = { role: "user" | "assistant"; content: string };

export default function StudioCopilot() {
  const [mirror, setMirror] = useState<{ text: string; stats: MirrorStats } | null>(null);
  const [loadingMirror, setLoadingMirror] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMirror = async () => {
    setLoadingMirror(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "weekly_mirror" } });
    setLoadingMirror(false);
    if (error) { toast.error(error.message); return; }
    setMirror(data as { text: string; stats: MirrorStats });
  };
  useEffect(() => { void loadMirror(); }, []);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    const next = [...messages, { role: "user", content: q } as Msg];
    setMessages(next);
    setInput("");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "chat", messages: next } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const reply = (data as { reply?: string })?.reply ?? "…";
    setMessages([...next, { role: "assistant", content: reply }]);
  };

  return (
    <StudioShell title="PAWN Copilot" eyebrow="Dein leiser Partner">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="editorial-eyebrow">Spiegel · letzte 7 Tage</p>
              <h2 className="mt-2 font-serif text-2xl">Was im Store passiert.</h2>
            </div>
            <button onClick={loadMirror} disabled={loadingMirror} className="flex items-center gap-2 border border-border px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${loadingMirror ? "animate-spin" : ""}`} /> Aktualisieren
            </button>
          </div>

          {loadingMirror && <div className="mt-6 h-32 animate-pulse bg-muted" />}
          {!loadingMirror && mirror && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Ansichten" value={mirror.stats.views_total} />
                <Stat label="Merkzettel" value={mirror.stats.wish_total} />
                <Stat label="Verkäufe" value={mirror.stats.orders_count} />
                <Stat label="Umsatz" value={`€${mirror.stats.revenue_eur.toFixed(0)}`} />
              </div>
              <p className="mt-6 font-serif text-lg leading-relaxed text-foreground">{mirror.text}</p>
              {mirror.stats.top.length > 0 && (
                <ul className="mt-6 divide-y divide-border border-t border-border">
                  {mirror.stats.top.map((t) => (
                    <li key={t.slug} className="flex items-center justify-between py-3 text-sm">
                      <span className="truncate font-serif">{t.name}</span>
                      <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t.views} Ansichten · {t.wish} Merkzettel</span>
                    </li>
                  ))}
                </ul>
              )}
              {mirror.stats.views_total === 0 && mirror.stats.top.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">Noch keine Signale in dieser Woche.</p>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col border border-border bg-card">
          <div className="border-b border-border p-6">
            <p className="editorial-eyebrow flex items-center gap-2"><Sparkles className="h-3 w-3" /> Frag den Copilot</p>
            <h2 className="mt-2 font-serif text-xl">Zu deinem Store.</h2>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-6 min-h-[280px] max-h-[420px]">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">Beispiele: „Wie läuft mein Store?", „Was soll ich als Nächstes hochladen?", „Welches Stück ist stark?"</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block max-w-[92%] whitespace-pre-wrap border px-3 py-2 ${m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-muted-foreground">Copilot denkt…</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-4">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Deine Frage…" className="flex-1 border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            <button onClick={send} disabled={busy || !input.trim()} className="border border-accent bg-accent px-3 py-2 text-accent-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </StudioShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border p-3">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </div>
  );
}
