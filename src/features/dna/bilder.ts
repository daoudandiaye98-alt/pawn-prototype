/**
 * D1/D2/D4 — die Bilder der Kundin.
 *
 * Alles liegt im privaten Eimer `kunden-bilder` unter `<user_id>/<ordner>/`.
 * Die Zeile in `kunden_bilder` ist der Eintrag, das Objekt im Eimer die Datei —
 * gelöscht wird immer beides, nie nur das eine.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const EIMER = "kunden-bilder";

export type BildArt = "avatar" | "raum" | "wand";

export interface KundenBild {
  id: string;
  art: string;
  quelle_path: string;
  basis_path: string | null;
  name: string | null;
  masse: Record<string, unknown> | null;
  status: string | null;
  fehler: string | null;
  aktiv: boolean;
  created_at: string;
}

/** Ordner je Art — Avatare getrennt von Räumen, damit man sie einzeln findet. */
export function ordnerFuer(art: BildArt): string {
  return art === "avatar" ? "avatar" : "raeume";
}

export async function signiere(pfad: string | null | undefined, sekunden = 3600): Promise<string | null> {
  if (!pfad) return null;
  const { data } = await supabase.storage.from(EIMER).createSignedUrl(pfad, sekunden);
  return data?.signedUrl ?? null;
}

export interface Einwilligung {
  erteilt: boolean;
  laden: boolean;
  setzen: (ja: boolean) => Promise<void>;
}

/** Ohne `profiles.consent_avatar` geht auf diesen Seiten gar nichts. */
export function useAvatarEinwilligung(userId?: string | null): Einwilligung {
  const [erteilt, setErteilt] = useState(false);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    let lebt = true;
    void (async () => {
      if (!userId) { setLaden(false); return; }
      const { data } = await supabase.from("profiles").select("consent_avatar").eq("id", userId).maybeSingle();
      if (!lebt) return;
      setErteilt(!!(data as { consent_avatar?: boolean } | null)?.consent_avatar);
      setLaden(false);
    })();
    return () => { lebt = false; };
  }, [userId]);

  const setzen = useCallback(async (ja: boolean) => {
    const { error } = await supabase.rpc("avatar_einwilligung", { _ja: ja });
    if (error) throw new Error(error.message);
    setErteilt(ja);
  }, []);

  return { erteilt, laden, setzen };
}

export interface BilderSammlung {
  bilder: KundenBild[];
  laden: boolean;
  fehler: string | null;
  neuLaden: () => Promise<void>;
  hochladen: (datei: File, art: BildArt, masse?: Record<string, unknown>) => Promise<void>;
  entfernen: (bild: KundenBild) => Promise<void>;
  aktivSetzen: (bild: KundenBild) => Promise<void>;
  masseSetzen: (bild: KundenBild, masse: Record<string, unknown>) => Promise<void>;
}

export function useKundenBilder(userId: string | null | undefined, arten: BildArt[]): BilderSammlung {
  const [bilder, setBilder] = useState<KundenBild[]>([]);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const schluessel = arten.join(",");

  const neuLaden = useCallback(async () => {
    if (!userId) { setBilder([]); setLaden(false); return; }
    setLaden(true);
    const { data, error } = await supabase
      .from("kunden_bilder")
      .select("id, art, quelle_path, basis_path, name, masse, status, fehler, aktiv, created_at")
      .eq("user_id", userId)
      .in("art", schluessel.split(","))
      .order("created_at", { ascending: false });
    if (error) setFehler(error.message);
    else { setFehler(null); setBilder((data ?? []) as unknown as KundenBild[]); }
    setLaden(false);
  }, [userId, schluessel]);

  useEffect(() => { void neuLaden(); }, [neuLaden]);

  const hochladen = useCallback(async (datei: File, art: BildArt, masse?: Record<string, unknown>) => {
    if (!userId) throw new Error("nicht_angemeldet");
    const endung = (datei.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const pfad = `${userId}/${ordnerFuer(art)}/${crypto.randomUUID()}.${endung}`;
    const { error: upErr } = await supabase.storage.from(EIMER).upload(pfad, datei, {
      contentType: datei.type || "image/jpeg", upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { error: insErr } = await supabase.from("kunden_bilder").insert({
      user_id: userId, art, quelle_path: pfad, name: datei.name.slice(0, 120),
      masse: (masse ?? {}) as never, status: "hochgeladen", aktiv: false,
    } as never);
    if (insErr) {
      // Kein Eintrag ohne Datei und keine Datei ohne Eintrag.
      await supabase.storage.from(EIMER).remove([pfad]);
      throw new Error(insErr.message);
    }
    await neuLaden();
  }, [userId, neuLaden]);

  const entfernen = useCallback(async (bild: KundenBild) => {
    const pfade = [bild.quelle_path, bild.basis_path].filter((p): p is string => !!p);
    const { error: rmErr } = await supabase.storage.from(EIMER).remove(pfade);
    if (rmErr) throw new Error(rmErr.message);
    const { error } = await supabase.from("kunden_bilder").delete().eq("id", bild.id);
    if (error) throw new Error(error.message);
    await neuLaden();
  }, [neuLaden]);

  /** Genau ein aktives Bild je Art. */
  const aktivSetzen = useCallback(async (bild: KundenBild) => {
    if (!userId) return;
    const aus = await supabase.from("kunden_bilder").update({ aktiv: false } as never)
      .eq("user_id", userId).eq("art", bild.art);
    if (aus.error) throw new Error(aus.error.message);
    const an = await supabase.from("kunden_bilder").update({ aktiv: true } as never).eq("id", bild.id);
    if (an.error) throw new Error(an.error.message);
    await neuLaden();
  }, [userId, neuLaden]);

  const masseSetzen = useCallback(async (bild: KundenBild, masse: Record<string, unknown>) => {
    const { error } = await supabase.from("kunden_bilder")
      .update({ masse: { ...(bild.masse ?? {}), ...masse } as never } as never).eq("id", bild.id);
    if (error) throw new Error(error.message);
    await neuLaden();
  }, [neuLaden]);

  return { bilder, laden, fehler, neuLaden, hochladen, entfernen, aktivSetzen, masseSetzen };
}

/** Das Kontingent (10 Anproben je 24 h) — sichtbar, nicht geraten. */
export function useAnprobeKontingent(userId?: string | null) {
  const [stand, setStand] = useState<{ heute: number; frei: number } | null>(null);
  useEffect(() => {
    let lebt = true;
    void (async () => {
      if (!userId) return;
      const { data } = await supabase.rpc("anprobe_kontingent");
      if (!lebt) return;
      const erste = Array.isArray(data) ? data[0] : data;
      if (erste) setStand(erste as { heute: number; frei: number });
    })();
    return () => { lebt = false; };
  }, [userId]);
  return stand;
}
