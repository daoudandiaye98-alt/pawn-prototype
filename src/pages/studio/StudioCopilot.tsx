import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Sparkles, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface MirrorStats {
  views_total: number;
  wish_total: number;
  orders_count: number;
  revenue_eur: number;
  top: { slug: string; name: string; views: number; wish: number }[];
}
type Msg = { role: "user" | "assistant"; content: string };

export default function StudioCopilot() {
  const { t, locale } = useI18n();
  const [mirror, setMirror] = useState<{ text: string; stats: MirrorStats } | null>(null);
  const [loadingMirror, setLoadingMirror] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMirror = async () => {
    setLoadingMirror(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "weekly_mirror", locale } });
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
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "chat", messages: next, locale } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const reply = (data as { reply?: string })?.reply ?? "…";
    setMessages([...next, { role: "assistant", content: reply }]);
  };

  return (
    <StudioShell title={t("studio.copilot.title")} eyebrow={t("studio.copilot.eyebrow")}>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="editorial-eyebrow">{t("studio.copilot.mirror.eyebrow")}</p>
              <h2 className="mt-2 font-serif text-2xl">{t("studio.copilot.mirror.heading")}</h2>
            </div>
            <button onClick={loadMirror} disabled={loadingMirror} className="flex items-center gap-2 border border-border px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-3 w-3 ${loadingMirror ? "animate-spin" : ""}`} /> {t("studio.copilot.mirror.refresh")}
            </button>
          </div>

          {loadingMirror && <div className="mt-6 h-32 animate-pulse bg-muted" />}
          {!loadingMirror && mirror && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={t("studio.copilot.mirror.views")} value={mirror.stats.views_total} />
                <Stat label={t("studio.copilot.mirror.wishlist")} value={mirror.stats.wish_total} />
                <Stat label={t("studio.copilot.mirror.sales")} value={mirror.stats.orders_count} />
                <Stat label={t("studio.copilot.mirror.revenue")} value={`€${mirror.stats.revenue_eur.toFixed(0)}`} />
              </div>
              <p className="mt-6 font-serif text-lg leading-relaxed text-foreground">{mirror.text}</p>
              {mirror.stats.top.length > 0 && (
                <ul className="mt-6 divide-y divide-border border-t border-border">
                  {mirror.stats.top.map((top) => (
                    <li key={top.slug} className="flex items-center justify-between py-3 text-sm">
                      <span className="truncate font-serif">{top.name}</span>
                      <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.copilot.mirror.topRow", { views: top.views, wish: top.wish })}</span>
                    </li>
                  ))}
                </ul>
              )}
              {mirror.stats.views_total === 0 && mirror.stats.top.length === 0 && (
                <p className="mt-6 text-sm text-muted-foreground">{t("studio.copilot.mirror.noSignals")}</p>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col border border-border bg-card">
          <div className="border-b border-border p-6">
            <p className="editorial-eyebrow flex items-center gap-2"><Sparkles className="h-3 w-3" /> {t("studio.copilot.chat.eyebrow")}</p>
            <h2 className="mt-2 font-serif text-xl">{t("studio.copilot.chat.heading")}</h2>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-6 min-h-[280px] max-h-[420px]">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("studio.copilot.chat.examples")}</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
                <div className={`inline-block max-w-[92%] whitespace-pre-wrap border px-3 py-2 ${m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-muted-foreground">{t("chat.thinking")}</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-4">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("studio.copilot.chat.placeholder")} className="flex-1 border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
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
