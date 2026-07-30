import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ImagePlus, Link2, X } from "lucide-react";

/**
 * Teil 21a — Das Gespräch findet auf der Seite statt.
 * Ersetzt das Öffnen einer Seitenleiste: Textbox + Verlauf leben direkt auf
 * /dna. Bilder (Mehrfachauswahl) werden gelesen (Vision, nie bewertet) und
 * landen dauerhaft, einzeln löschbar, in der Stil-Referenzen-Ablage.
 */

interface ChatMsg { id: string; role: "user" | "assistant"; text: string; at: string; imageUrls?: string[] }
interface StyleRef { id: string; url: string; beschreibung: string | null; herkunft: string; created_at: string }
interface PendingImage { url: string; path: string; file: File }

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "palace.chat.session_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) { id = (crypto.randomUUID?.() ?? String(Date.now())) as string; window.localStorage.setItem(KEY, id); }
  return id;
}

export function DnaChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [showPinterest, setShowPinterest] = useState(false);
  const [pinBoard, setPinBoard] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sessionId = useRef(getSessionId());

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const [{ data: mem }, { data: refRows }] = await Promise.all([
      supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle(),
      supabase.from("style_references" as never).select("id, url, beschreibung, herkunft, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const verlauf = ((mem as { preferences?: { dna_chat_verlauf?: ChatMsg[] } } | null)?.preferences?.dna_chat_verlauf) ?? [];
    setMessages(Array.isArray(verlauf) ? verlauf : []);
    setRefs(((refRows ?? []) as unknown as StyleRef[]));
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 6 - pendingImages.length);
    for (const file of list) {
      if (!file.type.startsWith("image/")) { toast.error("Bitte nur Bilder wählen."); continue; }
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name}: zu groß (max. 8 MB).`); continue; }
      setPendingImages((p) => [...p, { url: URL.createObjectURL(file), path: "", file }]);
    }
  };
  const removePending = (i: number) => setPendingImages((p) => p.filter((_, idx) => idx !== i));

  const uploadPending = async (): Promise<{ urls: string[]; paths: string[] }> => {
    if (!user || pendingImages.length === 0) return { urls: [], paths: [] };
    const urls: string[] = []; const paths: string[] = [];
    for (const img of pendingImages) {
      const path = `${user.id}/dna/${Date.now()}-${img.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("taste-uploads").upload(path, img.file, { upsert: false });
      if (error) { toast.error(error.message); continue; }
      const { data } = await supabase.storage.from("taste-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl) { urls.push(data.signedUrl); paths.push(path); }
    }
    return { urls, paths };
  };

  const send = async () => {
    if (!user || busy) return;
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;
    setBusy(true);
    const { urls: imageUrls, paths: imagePaths } = await uploadPending();
    setPendingImages([]);
    const wire = [
      ...messages.map((m) => ({ role: m.role, content: m.text })),
      { role: "user" as const, content: text || "Bitte lies diese Bilder als Moodboard." },
    ];
    const userTurn: ChatMsg = { id: crypto.randomUUID(), role: "user", text: text || "(Bild)", at: new Date().toISOString(), imageUrls };
    setMessages((m) => [...m, userTurn]);
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", {
        body: { messages: wire, session_id: sessionId.current, image_urls: imageUrls, image_paths: imagePaths, persist_thread: true, page_context: { route: "/dna" } },
      });
      const payload = (data ?? {}) as { reply?: string };
      const reply = payload.reply ?? (error ? "Kurz — ich sammle einen Gedanken." : "…");
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: reply, at: new Date().toISOString() }]);
      if (imageUrls.length) void loadRefsOnly();
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: "Verbindung stockt. Versuch's gleich nochmal.", at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  const loadRefsOnly = async () => {
    if (!user) return;
    const { data } = await supabase.from("style_references" as never).select("id, url, beschreibung, herkunft, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
    setRefs(((data ?? []) as unknown as StyleRef[]));
  };

  const deleteRef = async (id: string) => {
    setRefs((r) => r.filter((x) => x.id !== id));
    await supabase.from("style_references" as never).delete().eq("id", id);
  };

  const savePinterest = async () => {
    const board = pinBoard.trim();
    if (!board.startsWith("https://")) { toast.error("Bitte Link mit https:// einfügen."); return; }
    try {
      await supabase.functions.invoke("pawn-chat", {
        body: { messages: [{ role: "user", content: "Ich habe mein Pinterest-Board verbunden." }], session_id: sessionId.current, pinterest_board: board, persist_thread: true, page_context: { route: "/dna" } },
      });
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", at: new Date().toISOString(),
        text: "Danke — ich schaue mir dein Board an, sobald die Verbindung freigeschaltet ist. Bis dahin erzähl mir gern, was dir daran besonders auffällt." }]);
      setShowPinterest(false); setPinBoard("");
      toast.success("Pinterest-Board gemerkt.");
    } catch {
      toast.error("Konnte nicht speichern.");
    }
  };

  if (!user) return null;
  if (loading) return <div className="h-40 animate-pulse border border-[rgba(0,0,0,.18)] bg-white" />;

  return (
    <div className="border-[1.5px] border-black bg-white">
      <div className="border-b border-[rgba(0,0,0,.18)] px-6 py-5 md:px-8">
        <p className="palace-eyebrow">Das Gespräch</p>
        <h3 className="palace-serif mt-2 text-[1.4rem] italic text-black">Erzähl mir, oder zeig mir etwas.</h3>
      </div>

      <div ref={listRef} className="max-h-[60vh] min-h-[180px] space-y-6 overflow-y-auto px-6 py-6 md:px-8">
        {messages.length === 0 && (
          <p className="text-[0.95rem] leading-relaxed text-black/60">
            Kein Fragebogen — nur ein Gespräch. Erzähl mir von einem Anlass, einer Stimmung, oder lade Fotos hoch, die dich treffen.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "assistant" ? "" : "text-right"}>
            <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">{m.role === "assistant" ? "Pawn" : "Du"}</p>
            {m.imageUrls && m.imageUrls.length > 0 && (
              <div className={`mt-2 flex flex-wrap gap-2 ${m.role === "assistant" ? "" : "justify-end"}`}>
                {m.imageUrls.map((u, i) => (
                  <img key={i} src={u} alt="Hochgeladenes Bild" className="h-20 w-20 border border-[rgba(0,0,0,.18)] object-cover" />
                ))}
              </div>
            )}
            <p className={`mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed text-black ${m.role === "assistant" ? "font-serif italic" : "font-light"}`}>
              {m.text}
            </p>
          </div>
        ))}
        {busy && <p className="text-[0.57rem] uppercase tracking-[0.42em] text-[#A8A49B]">Pawn denkt nach…</p>}
      </div>

      {showPinterest && (
        <div className="border-t border-[rgba(0,0,0,.18)] bg-[rgba(0,0,0,.03)] px-6 py-3 md:px-8">
          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[#7C7972]">Pinterest-Board</p>
          <p className="mt-1 text-[0.72rem] text-black/50">Ein Screenshot funktioniert genauso gut — Bilder tragen den Wert, nicht die Verbindung.</p>
          <div className="mt-2 flex gap-2">
            <input value={pinBoard} onChange={(e) => setPinBoard(e.target.value)}
              placeholder="https://pinterest.com/dein-name/moodboard"
              className="flex-1 border border-[rgba(0,0,0,.28)] bg-white px-2 py-1.5 text-xs" />
            <button onClick={savePinterest} className="border border-black bg-black px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-white">Merken</button>
            <button onClick={() => setShowPinterest(false)} className="px-2 text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">Zu</button>
          </div>
        </div>
      )}

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(0,0,0,.18)] px-6 py-3 md:px-8">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.url} alt="" className="h-14 w-14 border border-[rgba(0,0,0,.18)] object-cover" />
              <button onClick={() => removePending(i)} aria-label="Entfernen" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center border border-black bg-white text-black hover:bg-black hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="text-xs text-[#7C7972]">bereit — schreib dazu oder schick sie allein.</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-[rgba(0,0,0,.18)] px-6 py-5 md:px-8">
        <div className="mb-2 flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 hover:text-black">
            <ImagePlus className="h-3.5 w-3.5" /> Bilder
          </button>
          <button type="button" onClick={() => setShowPinterest((v) => !v)} className="flex items-center gap-1 hover:text-black">
            <Link2 className="h-3.5 w-3.5" /> Pinterest
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
        <div className="flex items-end gap-3 border-b border-[rgba(0,0,0,.28)] pb-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1} placeholder="Erzähl mir von dir…"
            className="flex-1 resize-none bg-transparent text-[0.95rem] font-light text-black placeholder:text-[#A8A49B] focus:outline-none" />
          <button type="submit" disabled={busy || (!input.trim() && pendingImages.length === 0)}
            className="text-[0.6rem] uppercase tracking-[0.42em] text-black disabled:text-[#A8A49B]">
            Senden
          </button>
        </div>
      </form>

      {refs.length > 0 && (
        <div className="border-t-[1.5px] border-black px-6 py-6 md:px-8">
          <p className="palace-eyebrow">Deine Stil-Referenzen</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {refs.map((r) => (
              <div key={r.id} className="group relative border border-[rgba(0,0,0,.18)]">
                <img src={r.url} alt={r.beschreibung ?? "Stil-Referenz"} className="aspect-square w-full object-cover" />
                <button type="button" onClick={() => void deleteRef(r.id)} aria-label="Löschen"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center border border-black bg-white/90 text-black opacity-0 transition-opacity hover:bg-black hover:text-white group-hover:opacity-100">
                  <X className="h-3.5 w-3.5" />
                </button>
                {r.beschreibung && (
                  <p className="border-t border-[rgba(0,0,0,.18)] bg-white px-2 py-1.5 text-[0.68rem] leading-tight text-black/60">
                    {r.beschreibung}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.68rem] uppercase tracking-[0.24em] text-black/35">aus deinen Bildern · einzeln löschbar</p>
        </div>
      )}
    </div>
  );
}
