import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Werkbilder liegen im privaten Bucket `designer-media`. Gespeichert wird nur
 * der Ort des Bildes — wer es abrufen will (z. B. ein Bild-zu-Video-Dienst),
 * braucht eine frische, kurzlebige signierte URL. Das ist die Server-Seite von
 * src/lib/media.ts.
 */
const BUCKETS = ["designer-media", "campaign-assets", "mediathek"];

export function mediaPfad(value?: string | null): { bucket: string; pfad: string } | null {
  if (!value) return null;
  const treffer = value.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/(${BUCKETS.join("|")})/([^?#]+)`));
  if (treffer) {
    let pfad = treffer[2];
    try { pfad = decodeURIComponent(pfad); } catch { /* Pfad bleibt wie er ist */ }
    return { bucket: treffer[1], pfad };
  }
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return null;
  return { bucket: "designer-media", pfad: value };
}

/** Gibt eine abrufbare URL zurück. Fremde URLs laufen unverändert durch. */
export async function signiereMedia(
  admin: SupabaseClient,
  value?: string | null,
  sekunden = 60 * 60,
): Promise<string | null> {
  const ort = mediaPfad(value);
  if (!ort) return value ?? null;
  const { data, error } = await admin.storage.from(ort.bucket).createSignedUrl(ort.pfad, sekunden);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
