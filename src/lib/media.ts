import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Werkbilder liegen im privaten Bucket `designer-media`.
 * In der Datenbank steht deshalb nur der Ort des Bildes (Pfad bzw. eine URL,
 * aus der sich der Pfad ablesen lässt) — niemals eine dauerhaft gültige
 * Signatur. Beim Anzeigen wird jedes Mal frisch eine kurzlebige signierte URL
 * erzeugt. So kann kein Bild jemals „ablaufen".
 */
const BUCKETS = ["designer-media", "campaign-assets", "mediathek"] as const;
const GUELTIG_SEKUNDEN = 60 * 60; // 1 Stunde
const NEU_SIGNIEREN_NACH_MS = 45 * 60 * 1000; // vorsorglich vor Ablauf

type Eintrag = { url: string; erzeugtMs: number };

const cache = new Map<string, Eintrag>();
const laufend = new Map<string, Promise<string | null>>();

/** Liest den Bucket-Pfad aus einem gespeicherten Wert. `null`, wenn der Wert
 *  kein designer-media-Bild ist (externe URL, data:, blob: …). */
export function mediaPfad(value?: string | null): { bucket: string; pfad: string } | null {
  if (!value) return null;
  const treffer = value.match(
    new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/(${BUCKETS.join("|")})/([^?#]+)`),
  );
  if (treffer) {
    let pfad = treffer[2];
    try { pfad = decodeURIComponent(pfad); } catch { /* Pfad bleibt wie er ist */ }
    return { bucket: treffer[1], pfad };
  }
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return null;
  return { bucket: "designer-media", pfad: value }; // bereits ein blanker Pfad
}

/** Erzeugt (oder holt aus dem Zwischenspeicher) eine kurzlebige signierte URL. */
export async function signiereMedia(value?: string | null): Promise<string | null> {
  const ort = mediaPfad(value);
  if (!ort) return value ?? null;
  const pfad = `${ort.bucket}/${ort.pfad}`;

  const treffer = cache.get(pfad);
  if (treffer && Date.now() - treffer.erzeugtMs < NEU_SIGNIEREN_NACH_MS) return treffer.url;

  const bereitsUnterwegs = laufend.get(pfad);
  if (bereitsUnterwegs) return bereitsUnterwegs;

  const anfrage = (async () => {
    const { data, error } = await supabase.storage.from(ort.bucket).createSignedUrl(ort.pfad, GUELTIG_SEKUNDEN);
    // Rückfall: lässt sich nicht signieren (z. B. fehlende Leseerlaubnis), bleibt
    // der gespeicherte Wert stehen — nie ein leeres Bild wegen unserer Mechanik.
    if (error || !data?.signedUrl) return value && /^https?:/i.test(value) ? value : null;
    cache.set(pfad, { url: data.signedUrl, erzeugtMs: Date.now() });
    return data.signedUrl;
  })().finally(() => laufend.delete(pfad));


  laufend.set(pfad, anfrage);
  return anfrage;
}

/**
 * Dieselbe Datei, aber in Anzeigegröße und als webp.
 *
 * **Der Fund.** Auf der Landing lag ein Werkfoto als rohes PNG: 742 004 Byte
 * (725 kB) für eine Karte, die 4:5 in einer Spalte steht. Gemessen am 17.08.2026
 * an `campaign-assets/…/msa27zwvo2usif.png` — das ist kein Ausreißer, sondern
 * der Normalfall: was ein Haus hochlädt, wird unverkleinert ausgeliefert.
 *
 * **Die Behebung.** Supabase kann dieselbe Datei über einen zweiten Weg
 * ausliefern (`/render/image/` statt `/object/`) und dabei verkleinern und in
 * webp umwandeln. Dieselbe Datei, dieselbe Berechtigung, kein Upload, keine
 * Kopie — nur eine andere Adresse. Gemessen für dasselbe Foto:
 *
 * | Weg                        | Größe   | Typ        |
 * |----------------------------|---------|------------|
 * | `/object/sign/…` (bisher)  | 725 kB  | image/png  |
 * | `/render/image/sign/…`     |  37 kB  | image/webp |
 *
 * Beide Formen sind geprüft, die signierte wie die öffentliche. Alles andere
 * (fremde Adressen, `data:`, `blob:`) bleibt unangetastet — dort gibt es keinen
 * zweiten Weg, und eine geratene Adresse wäre ein totes Bild.
 */
export function bildVariante(
  url: string | undefined | null,
  { breite, guete = 80 }: { breite: number; guete?: number },
): string | undefined {
  if (!url) return undefined;
  if (!/\/storage\/v1\/object\/(sign|public)\//.test(url)) return url;

  const umgeschrieben = url.replace(
    /\/storage\/v1\/object\/(sign|public)\//,
    "/storage/v1/render/image/$1/",
  );
  const trenner = umgeschrieben.includes("?") ? "&" : "?";
  return `${umgeschrieben}${trenner}width=${Math.round(breite)}&quality=${guete}`;
}

/** React-Hook: gibt die anzeigbare URL zurück. Nicht-designer-media-Werte
 *  werden unverändert durchgereicht. */
export function useMediaUrl(value?: string | null): string | undefined {
  const ort = mediaPfad(value);
  const pfad = ort ? `${ort.bucket}/${ort.pfad}` : null;
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
