import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


interface Msg { role: "user" | "assistant"; content: string }

const OPENER: Msg = {
  role: "assistant",
  content: "Schön, dass du hier bist. Wonach ist dir heute — nach etwas zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?",
};

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([OPENER]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);


  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    // Taste signals are captured via the edge function later; no direct DB write from anon browser.


    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", {
        body: { messages: next },
      });
      const reply = (data as { reply?: string } | null)?.reply
        ?? (error ? "Kurz — ich sammle einen Gedanken. Sag mir nochmal, wonach dir ist." : "…");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Verbindung stockt. Versuch's gleich nochmal." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-black/25 backdrop-blur-[2px] transition-opacity duration-500 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-[80] flex h-full w-[min(420px,94vw)] flex-col border-l border-[rgba(12,12,14,.13)] bg-[#F1EEE7] transition-transform duration-700 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
      >
        <header className="flex items-center justify-between border-b border-[rgba(12,12,14,.13)] px-6 py-5">
          <div>
            <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#7C7972]">PAWN</p>
            <p className="mt-1 font-serif text-xl italic text-[#0C0C0E]">für dich da.</p>
          </div>
          <button
            onClick={onClose}
            className="text-[0.65rem] uppercase tracking-[0.32em] text-[#7C7972] hover:text-[#0C0C0E]"
          >
            Schließen
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-8">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "assistant" ? "" : "text-right"}>
              <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">
                {m.role === "assistant" ? "Pawn" : "Du"}
              </p>
              <p
                className={`mt-2 text-[0.95rem] leading-relaxed text-[#0C0C0E] ${
                  m.role === "assistant" ? "font-serif italic" : "font-light"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}
          {busy && (
            <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">Pawn denkt nach…</p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="border-t border-[rgba(12,12,14,.13)] px-6 py-5"
        >
          <div className="flex items-end gap-3 border-b border-[rgba(12,12,14,.28)] pb-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
              rows={1}
              placeholder="Schreib PAWN etwas…"
              className="flex-1 resize-none bg-transparent text-[0.95rem] font-light text-[#0C0C0E] placeholder:text-[#A8A49B] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="text-[0.6rem] uppercase tracking-[0.42em] text-[#0C0C0E] disabled:text-[#A8A49B]"
            >
              Senden
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
