import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
type Ctx = { open: () => void; close: () => void; toggle: () => void; isOpen: boolean };

const CopilotCtx = createContext<Ctx | null>(null);

export function useCopilot() {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error("CopilotProvider missing");
  return ctx;
}

interface HelpTopic { q: string; a: string }

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpTopics, setHelpTopics] = useState<HelpTopic[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "help_topics").maybeSingle();
      const v = data?.value as { topics?: HelpTopic[] } | undefined;
      if (v?.topics) setHelpTopics(v.topics);
    })();
  }, []);

  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 50); }, [isOpen]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const ctx: Ctx = {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((v) => !v),
  };

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");

    // instant match on help topics
    const hit = helpTopics.find((t) => t.q.toLowerCase() === q.toLowerCase());
    if (hit) { setMessages([...next, { role: "assistant", content: hit.a }]); return; }

    setBusy(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "chat", messages: next } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const reply = (data as { reply?: string })?.reply ?? "…";
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
  }, [input, messages, helpTopics]);

  return (
    <CopilotCtx.Provider value={ctx}>
      {children}
      {isOpen && (
        <>
          <div onClick={ctx.close} className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-white text-foreground shadow-2xl">
            <header className="flex h-16 items-center justify-between border-b border-border px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B0B0D] text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">PAWN Copilot</p>
                  <p className="font-serif text-base leading-none">Dein leiser Partner</p>
                </div>
              </div>
              <button onClick={ctx.close} aria-label="Schließen" className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-6">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">Frag mich alles zu deinem Store — oder wähle unten eine Schnellfrage.</p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : ""}>
                  <div className={`inline-block max-w-[92%] whitespace-pre-wrap border px-3 py-2 text-sm ${m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border bg-white"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && <p className="text-xs text-muted-foreground">Copilot denkt…</p>}
            </div>

            {helpTopics.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {helpTopics.slice(0, 3).map((t) => (
                    <button key={t.q} onClick={() => send(t.q)}
                      className="border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:bg-muted">
                      {t.q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-border p-4">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Deine Frage…"
                className="flex-1 border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
              <button onClick={() => send()} disabled={busy || !input.trim()}
                className="flex h-10 w-10 items-center justify-center bg-[#0B0B0D] text-white disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </>
      )}
    </CopilotCtx.Provider>
  );
}
