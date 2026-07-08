import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

interface Card { kind: "product" | "designer"; title: string; subtitle?: string; href: string; reason?: string }
interface Action { type: "navigate"; path: string; label: string }
interface Msg { role: "user" | "assistant"; content: string; cards?: Card[]; action?: Action | null; meta?: "consent" }

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "palace.chat.session_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) { id = (crypto.randomUUID?.() ?? String(Date.now())) as string; window.localStorage.setItem(KEY, id); }
  return id;
}

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const OPENER: Msg = { role: "assistant", content: "Schön, dass du hier bist. Wonach ist dir heute — nach etwas zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?" };
  const CONSENT: Msg = { role: "assistant", meta: "consent", content: t("chat.consent") };

  const [messages, setMessages] = useState<Msg[]>([OPENER, CONSENT]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sessionId = useMemo(() => getSessionId(), []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const wire = [...messages.filter((m) => m.meta !== "consent"), { role: "user" as const, content: text }];
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", { body: { messages: wire, session_id: sessionId } });
      const payload = (data ?? {}) as { reply?: string; cards?: Card[]; action?: Action | null };
      const reply = payload.reply ?? (error ? "Kurz — ich sammle einen Gedanken." : "…");
      setMessages((m) => [...m, { role: "assistant", content: reply, cards: payload.cards ?? [], action: payload.action ?? null }]);
      if (payload.action?.type === "navigate") {
        setTimeout(() => { navigate(payload.action!.path); }, 1500);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Verbindung stockt. Versuch's gleich nochmal." }]);
    } finally {
      setBusy(false);
    }
  };

  // Listen for external prefilled messages
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) void sendMessage(detail.message);
    };
    window.addEventListener("palace:chat-send", handler as EventListener);
    return () => window.removeEventListener("palace:chat-send", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/25 backdrop-blur-[2px] transition-opacity duration-500 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-[80] flex h-full w-[min(420px,94vw)] flex-col border-l border-[rgba(0,0,0,.18)] bg-white transition-transform duration-700 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
      >

        <header className="flex items-center justify-between border-b border-[rgba(0,0,0,.18)] px-6 py-5">
          <div>
            <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#7C7972]">PAWN</p>
            <p className="mt-1 font-serif text-xl italic text-[#000000]">für dich da.</p>
          </div>
          <button onClick={onClose} className="text-[0.65rem] uppercase tracking-[0.32em] text-[#7C7972] hover:text-[#000000]">Schließen</button>
        </header>

        <div ref={listRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-8">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "assistant" ? "" : "text-right"}>
              {m.meta === "consent" ? (
                <p className="border border-[rgba(0,0,0,.18)] bg-white px-3 py-2 text-[0.7rem] leading-relaxed text-[#7C7972]">
                  {t("chat.consent")}{" "}
                  <Link to="/datenschutz" onClick={onClose} className="underline hover:text-[#000000]">/datenschutz</Link>.
                </p>
              ) : (
                <>
                  <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">{m.role === "assistant" ? "Pawn" : "Du"}</p>
                  <p className={`mt-2 text-[0.95rem] leading-relaxed text-[#000000] ${m.role === "assistant" ? "font-serif italic" : "font-light"}`}>
                    {m.content}
                  </p>
                  {m.action && (
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => { navigate(m.action!.path); onClose(); }}
                        className="w-full border border-[#000000] px-4 py-3 text-left text-[0.7rem] uppercase tracking-[0.32em] text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"
                      >
                        {m.action.label} →
                      </button>
                      <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[#A8A49B]">{t("chat.navigating")}</p>
                    </div>
                  )}
                  {m.cards && m.cards.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {m.cards.map((c, k) => (
                        <Link key={k} to={c.href} onClick={onClose}
                          className="block border border-[rgba(0,0,0,.18)] bg-white px-4 py-3 transition-colors hover:border-[#000000]">
                          <p className="text-[0.55rem] uppercase tracking-[0.42em] text-[#7C7972]">
                            {c.kind === "product" ? "Stück" : "Designer"}{c.subtitle ? ` · ${c.subtitle}` : ""}
                          </p>
                          <p className="mt-1 font-serif italic text-[1rem] text-[#000000]">{c.title}</p>
                          {c.reason && <p className="mt-1 text-[0.78rem] text-[#000000]/70">{c.reason}</p>}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {busy && <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">{t("chat.thinking")}</p>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
          className="border-t border-[rgba(0,0,0,.18)] px-6 py-5">
          <div className="flex items-end gap-3 border-b border-[rgba(0,0,0,.28)] pb-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
              rows={1}
              placeholder={t("chat.placeholder")}
              className="flex-1 resize-none bg-transparent text-[0.95rem] font-light text-[#000000] placeholder:text-[#A8A49B] focus:outline-none"
            />
            <button type="submit" disabled={busy || !input.trim()}
              className="text-[0.6rem] uppercase tracking-[0.42em] text-[#000000] disabled:text-[#A8A49B]">
              {t("chat.send")}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
