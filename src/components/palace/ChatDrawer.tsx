import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ImagePlus, Link2, X } from "lucide-react";

interface Card { kind: "product" | "designer"; title: string; subtitle?: string; href: string; reason?: string }
interface Action { type: "navigate"; path: string; label: string }
interface Msg { role: "user" | "assistant"; content: string; cards?: Card[]; action?: Action | null; meta?: "consent"; imageUrl?: string }

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
  const { user } = useAuth();
  const OPENER: Msg = { role: "assistant", content: "Schön, dass du hier bist. Wonach ist dir heute — nach etwas zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?" };
  const CONSENT: Msg = { role: "assistant", meta: "consent", content: t("chat.consent") };

  const [messages, setMessages] = useState<Msg[]>([OPENER, CONSENT]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; path: string } | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [showPinterest, setShowPinterest] = useState(false);
  const [pinBoard, setPinBoard] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sessionId = useMemo(() => getSessionId(), []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild wählen."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Bild ist zu groß (max. 8 MB)."); return; }
    setUploadPct(5);
    const folder = user?.id ?? "anon";
    const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const ramp = window.setInterval(() => setUploadPct((p) => (p != null && p < 85 ? p + 8 : p)), 120);
    const { error } = await supabase.storage.from("taste-uploads").upload(path, file, { upsert: false });
    window.clearInterval(ramp);
    if (error) { setUploadPct(null); toast.error(error.message); return; }
    const { data } = await supabase.storage.from("taste-uploads").createSignedUrl(path, 60 * 60 * 24 * 7);
    setUploadPct(100);
    if (data?.signedUrl) setPendingImage({ url: data.signedUrl, path });
    window.setTimeout(() => setUploadPct(null), 400);
  };

  const sendMessage = async (text: string, opts?: { page_context?: { route?: string; product_slug?: string } }) => {
    const hasImage = !!pendingImage;
    if ((!text.trim() && !hasImage) || busy) return;
    setBusy(true);
    const userMsg: Msg = { role: "user", content: text || "(Bild)", imageUrl: pendingImage?.url };
    const wire = [...messages.filter((m) => m.meta !== "consent"), { role: "user" as const, content: text || "Bitte lies dieses Bild als Moodboard." }];
    setMessages((m) => [...m, userMsg]);
    setInput("");
    const imageUrl = pendingImage?.url;
    setPendingImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", {
        body: { messages: wire, session_id: sessionId, image_url: imageUrl, page_context: opts?.page_context },
      });
      const payload = (data ?? {}) as { reply?: string; cards?: Card[]; action?: Action | null; image_terms?: string[] };
      const reply = payload.reply ?? (error ? "Kurz — ich sammle einen Gedanken." : "…");
      const imgAddendum = imageUrl && (payload.image_terms?.length ?? 0) === 0
        ? "\n\nMagst du mir sagen, was daran dich trifft — Farben, Schnitt oder Stimmung?"
        : "";
      setMessages((m) => [...m, { role: "assistant", content: reply + imgAddendum, cards: payload.cards ?? [], action: payload.action ?? null }]);
      if (payload.action?.type === "navigate") setTimeout(() => navigate(payload.action!.path), 1500);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Verbindung stockt. Versuch's gleich nochmal." }]);
    } finally {
      setBusy(false);
    }
  };

  const savePinterest = async () => {
    const board = pinBoard.trim();
    if (!board.startsWith("https://")) { toast.error("Bitte Link mit https:// einfügen."); return; }
    try {
      await supabase.functions.invoke("pawn-chat", {
        body: { messages: [{ role: "user", content: "Ich habe mein Pinterest-Board verbunden." }], session_id: sessionId, pinterest_board: board },
      });
      setMessages((m) => [...m, {
        role: "assistant",
        content: "Danke — ich schaue mir dein Board an, sobald die Verbindung freigeschaltet ist. Bis dahin erzähl mir gern, was dir besonders auffällt."
      }]);
      setShowPinterest(false); setPinBoard("");
      toast.success("Pinterest-Board gemerkt.");
    } catch {
      toast.error("Konnte nicht speichern.");
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string; page_context?: { route?: string; product_slug?: string } }>).detail;
      if (detail?.message) void sendMessage(detail.message, { page_context: detail.page_context });
    };
    window.addEventListener("palace:chat-send", handler as EventListener);
    return () => window.removeEventListener("palace:chat-send", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, busy, pendingImage]);

  return (
    <>
      <div className={`fixed inset-0 z-[70] bg-black/25 backdrop-blur-[2px] transition-opacity duration-500 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={onClose} />
      <aside className={`fixed right-0 top-0 z-[80] flex h-full w-[min(420px,94vw)] flex-col border-l border-[rgba(0,0,0,.18)] bg-white transition-transform duration-700 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}>
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
                  {m.imageUrl && (
                    <div className={`mt-2 ${m.role === "assistant" ? "" : "ml-auto"} inline-block max-w-[220px] border border-[rgba(0,0,0,.18)]`}>
                      <img src={m.imageUrl} alt="Hochgeladenes Bild" className="max-h-52 w-full object-cover" />
                    </div>
                  )}
                  <p className={`mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed text-[#000000] ${m.role === "assistant" ? "font-serif italic" : "font-light"}`}>
                    {m.content}
                  </p>
                  {m.action && (
                    <div className="mt-4 space-y-2">
                      <button onClick={() => { navigate(m.action!.path); onClose(); }}
                        className="w-full border border-[#000000] px-4 py-3 text-left text-[0.7rem] uppercase tracking-[0.32em] text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]">
                        {m.action.label} →
                      </button>
                    </div>
                  )}
                  {m.cards && m.cards.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {m.cards.map((c, k) => (
                        <Link key={k} to={c.href} onClick={onClose} className="block border border-[rgba(0,0,0,.18)] bg-white px-4 py-3 transition-colors hover:border-[#000000]">
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

        {showPinterest && (
          <div className="border-t border-[rgba(0,0,0,.18)] bg-[rgba(0,0,0,.03)] px-6 py-3">
            <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[#7C7972]">Pinterest-Board</p>
            <div className="mt-2 flex gap-2">
              <input value={pinBoard} onChange={(e) => setPinBoard(e.target.value)}
                placeholder="https://pinterest.com/dein-name/moodboard"
                className="flex-1 border border-[rgba(0,0,0,.28)] bg-white px-2 py-1.5 text-xs" />
              <button onClick={savePinterest} className="border border-[#000000] bg-[#000000] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-white">Merken</button>
              <button onClick={() => setShowPinterest(false)} className="px-2 text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">Zu</button>
            </div>
          </div>
        )}

        {pendingImage && (
          <div className="flex items-center gap-3 border-t border-[rgba(0,0,0,.18)] px-6 py-3">
            <img src={pendingImage.url} alt="" className="h-14 w-14 border border-[rgba(0,0,0,.18)] object-cover" />
            <p className="flex-1 text-xs text-[#7C7972]">Bild bereit — schreib dazu oder schick es allein.</p>
            <button onClick={() => setPendingImage(null)} className="text-[#7C7972] hover:text-[#000000]" aria-label="Entfernen"><X className="h-4 w-4" /></button>
          </div>
        )}
        {uploadPct != null && (
          <div className="h-1 w-full bg-[rgba(0,0,0,.08)]">
            <div className="h-full bg-[#000000] transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="border-t border-[rgba(0,0,0,.18)] px-6 py-5">
          <div className="mb-2 flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 hover:text-[#000000]">
              <ImagePlus className="h-3.5 w-3.5" /> Bild
            </button>
            <button type="button" onClick={() => setShowPinterest((v) => !v)} className="flex items-center gap-1 hover:text-[#000000]">
              <Link2 className="h-3.5 w-3.5" /> Pinterest
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </div>
          <div className="flex items-end gap-3 border-b border-[rgba(0,0,0,.28)] pb-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
              rows={1} placeholder={t("chat.placeholder")}
              className="flex-1 resize-none bg-transparent text-[0.95rem] font-light text-[#000000] placeholder:text-[#A8A49B] focus:outline-none" />
            <button type="submit" disabled={busy || (!input.trim() && !pendingImage)}
              className="text-[0.6rem] uppercase tracking-[0.42em] text-[#000000] disabled:text-[#A8A49B]">
              {t("chat.send")}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
