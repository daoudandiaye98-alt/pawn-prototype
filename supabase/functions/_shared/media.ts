import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Werkbilder liegen im privaten Bucket `designer-media`. Gespeichert wird nur
 * der Ort des Bildes — wer es abrufen will (z. B. ein Bild-zu-Video-Dienst),
 * braucht eine frische, kurzlebige signierte URL. Das ist die Server-Seite von
 * src/lib/media.ts.
 */
const BUCKET = "designer-media";

export function mediaPfad(value?: string | null): string | null {
  if (!value) return null;
  const treffer = value.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/designer-media\/([^?#]+)/);
  if (treffer) {
    try { return decodeURIComponent(treffer[1]); } catch { return treffer[1]; }
  }
  if (/^(https?:|data:|blob:|\/)/i.test(value)) return null;
  return value;
}

/** Gibt eine abrufbare URL zurück. Fremde URLs laufen unverändert durch. */
export async function signiereMedia(
  admin: SupabaseClient,
  value?: string | null,
  sekunden = 60 * 60,
): Promise<string | null> {
  const pfad = mediaPfad(value);
  if (!pfad) return value ?? null;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(pfad, sekunden);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
