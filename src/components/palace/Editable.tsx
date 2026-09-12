/**
 * Texte und Bilder aus `site_content`, gelesen — nicht mehr bearbeitet.
 *
 * Teil O/K3: Der Auftritt-Modus (`?auftritt=1`) und mit ihm `lib/editMode`,
 * `AuftrittWerkzeuge` und `HausseiteBlocks` sind entfallen. `/haus/:slug` ist seit dem
 * Umschalttag das Heft; bearbeitet wird eine Hausseite in `/studio/heft`, und zwar im
 * echten Heft selbst. Diese Datei liefert deshalb nur noch den Lesepfad: `Editable` und
 * `EditableImage` rendern den gespeicherten Wert, `useContentValue` bleibt die Quelle für
 * Seiten, die einzelne Plattform-Texte brauchen.
 */
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Locale } from "@/lib/i18n";

const memCache = new Map<string, unknown>();
const memListeners = new Map<string, Set<(v: unknown) => void>>();

/** Deutsch bleibt der Rückfall — fehlt eine englische Übersetzung, zeigen wir `value` und melden es (Teil 22a). */
async function fetchKey(key: string, locale: Locale): Promise<{ value: unknown; fellBack: boolean }> {
  const { data } = await supabase.from("site_content").select("value, value_en").eq("key", key).maybeSingle();
  const row = data as { value?: unknown; value_en?: unknown } | null;
  const hasEn = typeof row?.value_en === "string" && row.value_en.length > 0;
  if (locale === "en" && hasEn) return { value: row!.value_en, fellBack: false };
  return { value: row?.value, fellBack: locale === "en" && !hasEn };
}

function subscribe(cacheKey: string, cb: (v: unknown) => void) {
  if (!memListeners.has(cacheKey)) memListeners.set(cacheKey, new Set());
  memListeners.get(cacheKey)!.add(cb);
  return () => { memListeners.get(cacheKey)?.delete(cb); };
}

function publish(cacheKey: string, v: unknown) {
  memCache.set(cacheKey, v);
  memListeners.get(cacheKey)?.forEach((fn) => fn(v));
}

interface ContentMeta { value: string; fellBack: boolean }

/** Wie useContentValue, meldet zusätzlich, ob gerade auf Deutsch zurückgefallen wurde (Teil 22a). */
export function useContentValueMeta(key: string, fallback = ""): ContentMeta {
  const { locale } = useI18n();
  const cacheKey = `${key}:${locale}`;
  const [meta, setMeta] = useState<ContentMeta>(() => {
    const cached = memCache.get(cacheKey) as ContentMeta | undefined;
    return cached ?? { value: fallback, fellBack: false };
  });
  useEffect(() => {
    let cancelled = false;
    void fetchKey(key, locale).then(({ value, fellBack }) => {
      if (cancelled) return;
      const next: ContentMeta = typeof value === "string" && value ? { value, fellBack } : { value: fallback, fellBack: false };
      publish(cacheKey, next);
      setMeta(next);
    });
    return subscribe(cacheKey, (v) => setMeta(v as ContentMeta));
  }, [key, fallback, locale, cacheKey]);
  return meta;
}

export function useContentValue(key: string, fallback = ""): string {
  return useContentValueMeta(key, fallback).value;
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

export function Editable({ contentKey, children, as, className }: EditableProps) {
  const Tag = (as ?? "span") as ElementType;
  const fallback = extractText(children);
  const { value, fellBack } = useContentValueMeta(contentKey, fallback);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { if (ref.current) ref.current.textContent = value; }, [value]);

  // Teil 22a: fehlt die englische Fassung, zeigen wir Deutsch weiter — aber sichtbar markiert.
  if (fellBack) {
    return (
      <Tag ref={ref} className={`${className ?? ""} border-b border-dashed border-current/40`}
        title="Noch keine englische Fassung — zeigt die deutsche.">
        {value || (children as ReactNode)}
      </Tag>
    );
  }
  return <Tag ref={ref} className={className}>{value || (children as ReactNode)}</Tag>;
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
  const value = useContentValue(contentKey, fallback);
  const src = value || fallback;
  return (
    <span className="relative block">
      {src
        ? <img src={src} alt={alt} className={className} loading={loading} />
        : (fallbackNode ?? <span className="block h-64 w-full bg-white" aria-label={alt} />)}
    </span>
  );
}
