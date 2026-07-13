/**
 * <Editable contentKey="hero_headline">Default text</Editable>
 * - Reads current value from site_content (via useSiteContent-like lookup).
 * - In builder mode: contentEditable with dashed outline, hover key label.
 *   Blur / Enter → upsert to site_content + domain_event content.updated + toast.
 *   Escape → revert to last saved value.
 * - Otherwise: plain span with the value.
 *
 * <EditableImage contentKey="hero_image" fallback="/x.jpg" className="..." alt="..."/>
 * - Renders image; in builder mode overlays a small "Bild ändern" button.
 */
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEditMode } from "@/lib/editMode";
import { invalidateSiteContent } from "@/lib/siteContent";

const memCache = new Map<string, unknown>();
const memListeners = new Map<string, Set<(v: unknown) => void>>();

async function fetchKey(key: string): Promise<unknown> {
  const { data } = await supabase.from("site_content").select("value").eq("key", key).maybeSingle();
  return (data as { value?: unknown } | null)?.value;
}

function subscribe(key: string, cb: (v: unknown) => void) {
  if (!memListeners.has(key)) memListeners.set(key, new Set());
  memListeners.get(key)!.add(cb);
  return () => { memListeners.get(key)?.delete(cb); };
}

function publish(key: string, v: unknown) {
  memCache.set(key, v);
  memListeners.get(key)?.forEach((fn) => fn(v));
}

function useContentValue(key: string, fallback: string): string {
  const [v, setV] = useState<string>(() => {
    const cached = memCache.get(key);
    return typeof cached === "string" ? cached : fallback;
  });
  useEffect(() => {
    let cancelled = false;
    void fetchKey(key).then((val) => {
      if (cancelled) return;
      if (typeof val === "string") { publish(key, val); setV(val); }
    });
    return subscribe(key, (val) => { if (typeof val === "string") setV(val); });
  }, [key, fallback]);
  return v;
}

async function saveContent(key: string, value: unknown) {
  const { error } = await supabase.from("site_content").upsert({ key, value: value as never });
  if (error) { toast.error("Speichern fehlgeschlagen: " + error.message); return false; }
  publish(key, value);
  invalidateSiteContent();
  try {
    await supabase.from("domain_events").insert({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      type: "content.updated",
      actor: "system",
      payload: { key } as never,
    });
  } catch { /* best-effort */ }
  toast.success("Gespeichert");
  return true;
}

interface EditableProps {
  contentKey: string;
  children: ReactNode;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as { props?: { children?: ReactNode } })) {
    return extractText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export function Editable({ contentKey, children, as, className, multiline = false }: EditableProps) {
  const { enabled } = useEditMode();
  const Tag = (as ?? "span") as ElementType;
  const fallback = extractText(children);
  const value = useContentValue(contentKey, fallback);
  const ref = useRef<HTMLElement>(null);
  const lastSaved = useRef(value);

  useEffect(() => { lastSaved.current = value; }, [value]);

  useEffect(() => {
    // Sync DOM text when value changes from outside (unless user is editing)
    if (!enabled && ref.current) ref.current.textContent = value;
  }, [value, enabled]);

  if (!enabled) {
    return <Tag ref={ref} className={className}>{value || (children as ReactNode)}</Tag>;
  }

  return (
    <Tag
      ref={ref}
      className={`${className ?? ""} pawn-editable relative outline-none`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-key={contentKey}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
        if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.textContent = lastSaved.current;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={async (e: React.FocusEvent) => {
        const next = (e.currentTarget.textContent ?? "").trim();
        if (next === lastSaved.current) return;
        const ok = await saveContent(contentKey, next);
        if (ok) lastSaved.current = next;
      }}
    >
      {value || fallback}
    </Tag>
  );
}

interface EditableImageProps {
  contentKey: string;
  fallback: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  fallbackNode?: React.ReactNode;
}

export function EditableImage({ contentKey, fallback, alt, className, loading = "lazy", fallbackNode }: EditableImageProps) {
  const { enabled } = useEditMode();
  const value = useContentValue(contentKey, fallback);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const src = value || fallback;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${contentKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      await saveContent(contentKey, data.publicUrl);
    } catch (e) {
      toast.error("Upload fehlgeschlagen: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally { setUploading(false); }
  };

  return (
    <span className={`relative block ${enabled ? "outline outline-1 outline-dashed outline-black/60" : ""}`}>
      {src
        ? <img src={src} alt={alt} className={className} loading={loading} />
        : (fallbackNode ?? <span className="block h-64 w-full bg-[#E8E4DA]" aria-label={alt} />)}
      {enabled && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute left-2 top-2 z-10 bg-white/95 px-2 py-1 text-[0.6rem] uppercase tracking-[0.28em] text-black shadow-sm hover:bg-white"
            disabled={uploading}
          >
            {uploading ? "Lädt…" : "Bild ändern"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
          />
        </>
      )}
    </span>
  );
}
