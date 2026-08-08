import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 21a — Das Gespräch findet auf der Seite statt.
 * Textbox + Verlauf leben direkt auf /dna. Bilder (Mehrfachauswahl) werden
 * gelesen (Vision, nie bewertet) und landen dauerhaft, einzeln löschbar, in
 * der Stil-Referenzen-Ablage. Bilder hochladen ist der einzige Weg — kein
 * externer Dienst.
 */

interface ChatMsg { id: string; role: "user" | "assistant"; text: string; at: string; imageUrls?: string[] }
interface StyleRef { id: string; url: string; beschreibung: string | null; herkunft: string; created_at: string }
interface PendingImage { id: string; previewUrl: string; file: File }

const MAX_IMAGES = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/avif"];

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  const KEY = "palace.chat.session_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) { id = (crypto.randomUUID?.() ?? String(Date.now())) as string; window.localStorage.setItem(KEY, id); }
  return id;
}

function humanUploadError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload")) return "Die Datei ist zu groß (max. 8 MB).";
  if (m.includes("mime") || m.includes("content type")) return "Dieses Dateiformat wird nicht unterstützt. Bitte JPG, PNG oder WEBP.";
  if (m.includes("duplicate") || m.includes("already exists")) return "Dieses Bild wurde gerade schon hochgeladen.";
  if (m.includes("row-level") || m.includes("unauthorized") || m.includes("jwt")) return "Deine Sitzung ist abgelaufen. Bitte melde dich neu an.";
  return `Hochladen fehlgeschlagen: ${message}`;
}

export function DnaChat() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
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
  useEffect(() => () => { pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    const free = MAX_IMAGES - pendingImages.length;
    if (free <= 0) { toast.error(`Höchstens ${MAX_IMAGES} Bilder auf einmal.`); return; }
    if (incoming.length > free) toast.message(`Nur die ersten ${free} Bilder werden übernommen.`);
    const accepted: PendingImage[] = [];
    for (const file of incoming.slice(0, free)) {
      const typeOk = file.type ? (file.type.startsWith("image/") && (ALLOWED.includes(file.type) || file.type.startsWith("image/"))) : false;
      if (!typeOk) { toast.error(`${file.name}: kein Bildformat. Bitte JPG, PNG oder WEBP.`); continue; }
      if (file.size > MAX_BYTES) { toast.error(`${file.name}: zu groß (max. 8 MB).`); continue; }
      accepted.push({ id: crypto.randomUUID(), previewUrl: URL.createObjectURL(file), file });
    }
    if (accepted.length) setPendingImages((p) => [...p, ...accepted]);
  };

  const removePending = (id: string) => setPendingImages((p) => {
    const hit = p.find((x) => x.id === id);
    if (hit) URL.revokeObjectURL(hit.previewUrl);
    return p.filter((x) => x.id !== id);
  });

  const uploadPending = async (): Promise<{ urls: string[]; paths: string[] }> => {
    if (!user || pendingImages.length === 0) return { urls: [], paths: [] };
    const urls: string[] = []; const paths: string[] = [];
    const total = pendingImages.length;
    setUploadPct(1);
    for (let i = 0; i < total; i++) {
      const img = pendingImages[i];
      const safeName = img.file.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "bild.jpg";
      const path = `${user.id}/dna/${Date.now()}-${i}-${safeName}`;
      const { error } = await supabase.storage.from("taste-uploads").upload(path, img.file, {
        upsert: false,
        contentType: img.file.type || "image/jpeg",
      });
      if (error) { toast.error(humanUploadError(error.message)); continue; }
      const { data, error: signErr } = await supabase.storage.from("taste-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !data?.signedUrl) { toast.error("Bild gespeichert, aber die Vorschau konnte nicht erzeugt werden."); continue; }
      urls.push(data.signedUrl); paths.push(path);
      setUploadPct(Math.round(((i + 1) / total) * 100));
    }
    window.setTimeout(() => setUploadPct(null), 500);
    if (urls.length === 0) toast.error("Kein Bild konnte hochgeladen werden.");
    return { urls, paths };
  };

  const send = async () => {
    if (!user || busy) return;
    const text = input.trim();
    if (!text && pendingImages.length === 0) return;
    setBusy(true);
    const { urls: imageUrls, paths: imagePaths } = await uploadPending();
    if (!text && imageUrls.length === 0) { setBusy(false); return; }
    pendingImages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
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
      const payload = (data ?? {}) as { reply?: string; error?: string };
      if (error || payload.error) {
        const raw = (payload.error ?? error?.message ?? "").toLowerCase();
        const hint = raw.includes("credit") || raw.includes("guthaben") || raw.includes("quota") || raw.includes("429")
          ? "Das KI-Guthaben ist gerade aufgebraucht. Deine Bilder sind gespeichert — versuch es später noch einmal."
          : "Die Bilder sind gespeichert, aber PAWN konnte gerade nicht antworten. Versuch es gleich nochmal.";
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: payload.reply ?? hint, at: new Date().toISOString() }]);
      } else {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: payload.reply ?? "…", at: new Date().toISOString() }]);
      }
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

  if (!user) return null;
  if (loading) return <div className="h-40 animate-pulse border border-[rgba(0,0,0,.18)] bg-white" />;

  return (
    <div className="border-[1.5px] border-black bg-white">
      <div className="border-b border-[rgba(0,0,0,.18)] px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <PawnFigurSvg className="h-8 w-6 shrink-0" />
          <div>
            <p className="palace-eyebrow">Das Gespräch</p>
            <h3 className="palace-serif mt-1 text-[1.4rem] italic text-black">Erzähl mir, oder zeig mir etwas.</h3>
          </div>
        </div>
        <p className="mt-3 text-[0.72rem] text-black/50">{t("dna.chat.herkunft")}</p>
      </div>

      <div ref={listRef} className="max-h-[60vh] min-h-[180px] space-y-6 overflow-y-auto px-6 py-6 md:px-8">
        {messages.length === 0 && (
          <p className="text-[0.95rem] leading-relaxed text-black/60">
            Kein Fragebogen — nur ein Gespräch. Erzähl mir von einem Anlass, einer Stimmung, oder lade Fotos hoch, die dich treffen.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "assistant" ? "flex items-start gap-2" : "text-right"}>
            {m.role === "assistant" && <PawnFigurSvg className="mt-1 h-4 w-3 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[0.57rem] uppercase tracking-[0.42em] text-black/40">{m.role === "assistant" ? "Pawn" : "Du"}</p>
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
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2">
            <PawnFigurSvg className="h-4 w-3 shrink-0" />
            <span className="text-[0.57rem] uppercase tracking-[0.42em] text-black/40">Pawn denkt nach…</span>
          </div>
        )}
      </div>

      {uploadPct !== null && (
        <div className="border-t border-[rgba(0,0,0,.18)] px-6 py-3 md:px-8">
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-black/60">Bilder werden hochgeladen · {uploadPct}%</p>
          <div className="mt-2 h-[3px] w-full bg-[rgba(0,0,0,.12)]">
            <div className="h-full bg-black transition-all duration-300" style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {pendingImages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(0,0,0,.18)] px-6 py-3 md:px-8">
          {pendingImages.map((img) => (
            <div key={img.id} className="relative">
              <img src={img.previewUrl} alt="" className="h-14 w-14 border border-[rgba(0,0,0,.18)] object-cover" />
              <button onClick={() => removePending(img.id)} aria-label="Entfernen" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center border border-black bg-white text-black hover:bg-black hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <p className="text-xs text-black/60">bereit — schreib dazu oder schick sie allein.</p>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-[rgba(0,0,0,.18)] px-6 py-5 md:px-8">
        <div className="mb-2 flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.28em] text-black/60">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 hover:text-black">
            <ImagePlus className="h-3.5 w-3.5" /> Bilder hochladen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
        <p className="mb-3 text-[0.72rem] text-black/50">Bilder hochladen — Fotos von dir, Screenshots, alles was deinen Geschmack zeigt.</p>
        <div className="flex items-end gap-3 border-b border-[rgba(0,0,0,.28)] pb-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1} placeholder="Erzähl mir von dir…"
            className="flex-1 resize-none bg-transparent text-[0.95rem] font-light text-black placeholder:text-black/40 focus:outline-none" />
          <button type="submit" disabled={busy || (!input.trim() && pendingImages.length === 0)}
            className="text-[0.6rem] uppercase tracking-[0.42em] text-black disabled:text-black/40">
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
