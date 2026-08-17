import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Gesperrt } from "@/components/Gesperrt";
import type { Plan } from "@/lib/planGate";

/**
 * Teil K (Abschnitt 3) — die Gesprächs-Schublade des Bauern: Tipp auf Figur oder
 * Sprechzeile öffnet sie. Läuft über die bestehende designer-seitige KI (studio-ai,
 * Modus "chat" — mit Haus-Kontext und Plan-Zählung serverseitig); pawn-jarvis selbst
 * ist admin-only und bleibt es. Antworten erscheinen als Karten.
 */

type Msg = { role: "user" | "assistant"; content: string };

export function BauerGespraech({ open, onClose, plan, seed }: { open: boolean; onClose: () => void; plan: Plan; seed?: string }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [gesperrtGrund, setGesperrtGrund] = useState<"plan" | "kontingent" | "budget" | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  // Teil N — die Chips der Ankunft: öffnet sich das Gespräch mit einer Startfrage,
  // wird sie sofort gestellt (einmal pro Öffnen, nicht doppelt).
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (open && seed && seededRef.current !== seed && !busy) {
      seededRef.current = seed;
      setInput(seed);
      // Absenden im nächsten Tick, damit der Zustand steht.
      window.setTimeout(() => { void sendText(seed); }, 0);
    }
    if (!open) seededRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function sendText(text: string) {
    const q = text.trim();
    if (!q) return;
    setBusy((b) => {
      if (b) return b;
      return true;
    });
    let next: Msg[] = [];
    setMessages((prev) => {
      next = [...prev, { role: "user", content: q } as Msg];
      return next;
    });
    setInput("");
    setGesperrtGrund(undefined);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "chat", messages: next, locale } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { reply?: string; gesperrt?: boolean; grund?: "plan" | "kontingent" | "budget" };
    if (res.gesperrt) { setGesperrtGrund(res.grund ?? "kontingent"); return; }
    setMessages([...next, { role: "assistant", content: res.reply ?? "…" }]);
  }

  if (!open) return null;

  const send = () => {
    if (busy) return;
    void sendText(input);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("studio.bauer.gespraech.title")}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-[1.5px] border-foreground bg-white"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.bauer.gespraech.eyebrow")}</p>
            <p className="mt-0.5 font-serif text-lg leading-none">{t("studio.bauer.gespraech.title")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("studio.bauer.gespraech.close")} className="flex h-11 w-11 items-center justify-center border border-border hover:bg-foreground hover:text-background">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("studio.bauer.gespraech.empty")}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block max-w-[92%] whitespace-pre-wrap border px-3 py-2 text-left ${m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <p className="text-xs text-muted-foreground">{t("chat.thinking")}</p>}
          {gesperrtGrund && <Gesperrt feature="chat_nachricht" was="Nachrichten mit PAWN" plan={plan} grund={gesperrtGrund} />}
          <div ref={endRef} />
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("studio.bauer.gespraech.placeholder")}
            className="flex-1 border border-border bg-background px-3 py-2 text-sm "
          />
          <button type="button" onClick={send} disabled={busy || !input.trim()} aria-label={t("studio.bauer.gespraech.send")} className="flex h-11 w-11 items-center justify-center border border-foreground bg-foreground text-background disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
