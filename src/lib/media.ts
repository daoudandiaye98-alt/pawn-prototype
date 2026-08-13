import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Werkbilder liegen im privaten Bucket `designer-media`.
 * In der Datenbank steht deshalb nur der Ort des Bildes (Pfad bzw. eine URL,
 * aus der sich der Pfad ablesen lässt) — niemals eine dauerhaft gültige
 * Signatur. Beim Anzeigen wird jedes Mal frisch eine kurzlebige signierte URL
 * erzeugt. So kann kein Bild jemals „ablaufen".
 */
const BUCKET = "designer-media";
const GUELTIG_SEKUNDEN = 60 * 60; // 1 Stunde
const NEU_SIGNIEREN_NACH_MS = 45 * 60 * 1000; // vorsorglich vor Ablauf

type Eintrag = { url: string; erzeugtMs: number };

const cache = new Map<string, Eintrag>();
const laufend = new Map<string, Promise<string | null>>();

/** Liest den Bucket-Pfad aus einem gespeicherten Wert. `null`, wenn der Wert
 *  kein designer-media-Bild ist (externe URL, data:, blob: …). */
export function mediaPfad(value?: string | null): string | null {
  if (!value) return null;
  const treffer = value.match(
    /\/storage\/v1\/object\/(?:sign|public|authenticated)\/designer-media\/([^?#]+)/,
  );
  if (treffer) {
    try {
      return decodeURIComponent(treffer[1]);
    } catch {
      return treffer[1];
    }
  }
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return null;
  return value; // bereits ein blanker Pfad
}

/** Erzeugt (oder holt aus dem Zwischenspeicher) eine kurzlebige signierte URL. */
export async function signiereMedia(value?: string | null): Promise<string | null> {
  const pfad = mediaPfad(value);
  if (!pfad) return value ?? null;

  const treffer = cache.get(pfad);
  if (treffer && Date.now() - treffer.erzeugtMs < NEU_SIGNIEREN_NACH_MS) return treffer.url;

  const bereitsUnterwegs = laufend.get(pfad);
  if (bereitsUnterwegs) return bereitsUnterwegs;

  const anfrage = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, GUELTIG_SEKUNDEN);
    if (error || !data?.signedUrl) return null;
    cache.set(pfad, { url: data.signedUrl, erzeugtMs: Date.now() });
    return data.signedUrl;
  })().finally(() => laufend.delete(pfad));

  laufend.set(pfad, anfrage);
  return anfrage;
}

/** React-Hook: gibt die anzeigbare URL zurück. Nicht-designer-media-Werte
 *  werden unverändert durchgereicht. */
export function useMediaUrl(value?: string | null): string | undefined {
  const pfad = mediaPfad(value);
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!pfad) return value ?? undefined;
    return cache.get(pfad)?.url;
  });

  useEffect(() => {
    let aktiv = true;
    if (!pfad) {
      setUrl(value ?? undefined);
      return;
    }
    const treffer = cache.get(pfad);
    if (treffer && Date.now() - treffer.erzeugtMs < NEU_SIGNIEREN_NACH_MS) {
      setUrl(treffer.url);
      return;
    }
    void signiereMedia(value).then((neu) => {
      if (aktiv) setUrl(neu ?? undefined);
    });
    return () => {
      aktiv = false;
    };
  }, [pfad, value]);

  return url;
}
