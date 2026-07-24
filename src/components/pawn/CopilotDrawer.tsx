import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { X, Send, Sparkles, Undo2, PlayCircle } from "lucide-react";

type ProposedAction = { action: string; params: Record<string, unknown>; label: string };
type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "action_proposal"; proposal: ProposedAction }
  | { role: "action_result"; action: string; ok: boolean; id?: string; error?: string };
type Ctx = { open: () => void; close: () => void; toggle: () => void; isOpen: boolean };

const CopilotCtx = createContext<Ctx | null>(null);

const NOOP: Ctx = { open: () => {}, close: () => {}, toggle: () => {}, isOpen: false };
export function useCopilot(): Ctx {
  return useContext(CopilotCtx) ?? NOOP;
}

interface HelpTopic { q: string; a: string }

// ---------- Admin command parser (rule-based fallback when no LLM tool-calls) ----------
function parseAdminCommand(text: string): ProposedAction | null {
  const t = text.trim();
  let m: RegExpMatchArray | null;

  // "ändere hero_headline zu …"
  m = t.match(/^(?:ändere|setze|update)\s+([a-z0-9_.-]+)\s+(?:zu|auf)\s+(.+)$/i);
  if (m) {
    const key = m[1], value = m[2].replace(/^["']|["']$/g, "");
    if (/^(commission|provision)/i.test(key)) {
      return { action: "set_config", params: { key: "platform_commission", value: { pct: Number(value) } }, label: `Provision auf ${value} % setzen` };
    }
    return { action: "set_content", params: { key, value }, label: `Inhalt „${key}" auf „${value}" setzen` };
  }

  // "neue kategorie X in welt Y"
  m = t.match(/^(?:neuer?|erstelle)\s+(?:kategorie|term|begriff)\s+(.+?)\s+in\s+welt\s+([\wäöü]+)$/i);
  if (m) return { action: "upsert_ontology_term", params: { term: m[1].toLowerCase(), kind: "attribute", world: [m[2]], learned: false }, label: `Ontologie-Term „${m[1]}" in ${m[2]}` };

  // "setze provision auf N"
  m = t.match(/^setze\s+provision\s+auf\s+(\d+(?:[,.]\d+)?)/i);
  if (m) return { action: "set_config", params: { key: "platform_commission", value: { pct: Number(m[1].replace(",", ".")) } }, label: `Provision auf ${m[1]} %` };

  // "benachrichtige alle designer: Text"
  m = t.match(/^benachrichtige\s+(alle\s+)?(designer|admins?)\s*:\s*(.+)$/i);
  if (m) {
    const target = /admin/i.test(m[2]) ? "admins" : "designers";
    return { action: "send_notification", params: { target, title: "PAWN Broadcast", body: m[3], link: null }, label: `Broadcast an ${target}: „${m[3].slice(0, 60)}"` };
  }

  // "berechne trends" / "trends neu"
  if (/^(berechne|update|refresh)\s+trends|trends\s+neu/i.test(t)) return { action: "recompute_trends", params: {}, label: "Trends neu berechnen" };

  // "plan von <slug> auf <plan>"
  m = t.match(/^plan\s+(?:von\s+)?([a-z0-9-]+)\s+auf\s+(haus|atelier|maison)$/i);
  if (m) return { action: "set_plan", params: { designer_slug: m[1], plan: m[2].toLowerCase() }, label: `Plan von ${m[1]} → ${m[2]}` };

  return null;
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const isAdmin = !!user && roles.includes("admin");
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

  const executeAction = useCallback(async (proposal: ProposedAction) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pawn-actions", {
      body: { mode: "execute", action: proposal.action, params: proposal.params, source: "admin_chat" },
    });
    setBusy(false);
    const res = (data ?? {}) as { ok?: boolean; id?: string; error?: string };
    if (error || !res.ok) {
      toast.error(res.error ?? error?.message ?? "Aktion fehlgeschlagen");
      setMessages((m) => [...m, { role: "action_result", action: proposal.action, ok: false, error: res.error ?? error?.message }]);
      return;
    }
    toast.success("Aktion ausgeführt.");
    setMessages((m) => [...m, { role: "action_result", action: proposal.action, ok: true, id: res.id }]);
  }, []);

  const undoAction = useCallback(async (id: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("pawn-actions", { body: { mode: "undo", action_id: id } });
    setBusy(false);
    if (error || !(data as { ok?: boolean })?.ok) {
      toast.error("Rückgängig fehlgeschlagen");
      return;
    }
    toast.success("Rückgängig gemacht.");
  }, []);

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");

    // Admin command parser (rule-based). If parsed → propose action card.
    if (isAdmin) {
      const parsed = parseAdminCommand(q);
      if (parsed) {
        setMessages((m) => [...m, { role: "assistant", content: "Ich schlage folgende Aktion vor:" }, { role: "action_proposal", proposal: parsed }]);
        return;
      }
    }

    // instant match on help topics
    const hit = helpTopics.find((t) => t.q.toLowerCase() === q.toLowerCase());
    if (hit) { setMessages([...next, { role: "assistant", content: hit.a }]); return; }

    setBusy(true);
    const userMsgs = next.filter((m): m is { role: "user" | "assistant"; content: string } => m.role === "user" || m.role === "assistant");
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "chat", messages: userMsgs } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const reply = (data as { reply?: string })?.reply ?? "…";
    setMessages((m) => [...m, { role: "assistant", content: reply }]);
  }, [input, messages, helpTopics, isAdmin]);

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
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">PAWN Copilot {isAdmin && <span className="ml-1 text-emerald-600">· mit Händen</span>}</p>
                  <p className="font-serif text-base leading-none">Dein leiser Partner</p>
                </div>
              </div>
              <button onClick={ctx.close} aria-label="Schließen" className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-6">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? 'Sag mir, was passieren soll. Beispiele: „ändere hero_headline zu …", „neue kategorie leinen in welt Mode", „benachrichtige alle designer: …".'
                    : helpTopics.length > 0
                      ? "Frag mich alles zu deinem Store — oder wähle unten eine Schnellfrage."
                      : "Frag mich alles zu deinem Store."}
                </p>
              )}
              {messages.map((m, i) => {
                if (m.role === "user" || m.role === "assistant") {
                  return (
                    <div key={i} className={m.role === "user" ? "text-right" : ""}>
                      <div className={`inline-block max-w-[92%] whitespace-pre-wrap border px-3 py-2 text-sm ${m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border bg-white"}`}>
                        {m.content}
                      </div>
                    </div>
                  );
                }
                if (m.role === "action_proposal") {
                  return (
                    <div key={i} className="border-2 border-dashed border-foreground/40 bg-muted/40 p-4">
                      <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Aktions-Vorschlag</p>
                      <p className="mt-1 text-sm">{m.proposal.label}</p>
                      <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">{m.proposal.action}({JSON.stringify(m.proposal.params)})</p>
                      <button onClick={() => executeAction(m.proposal)} disabled={busy}
                        className="mt-3 inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-background hover:bg-foreground/85 disabled:opacity-40">
                        <PlayCircle className="h-3 w-3" /> Ausführen
                      </button>
                    </div>
                  );
                }
                if (m.role !== "action_result") return null;
                const res = m;
                return (
                  <div key={i} className={`border px-3 py-2 text-sm ${res.ok ? "border-emerald-500/40 bg-emerald-50" : "border-red-500/40 bg-red-50"}`}>
                    {res.ok ? <>✓ Aktion „{res.action}" ausgeführt.</> : <>✕ Fehler: {res.error}</>}
                    {res.ok && res.id && (
                      <button onClick={() => res.id && undoAction(res.id)} className="ml-3 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground underline hover:text-foreground">
                        <Undo2 className="h-3 w-3" /> Rückgängig
                      </button>
                    )}
                  </div>
                );
              })}
              {busy && <p className="text-xs text-muted-foreground">Copilot denkt…</p>}
            </div>

            {helpTopics.length > 0 && !isAdmin && (
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
                placeholder={isAdmin ? "Kommando oder Frage…" : "Deine Frage…"}
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
