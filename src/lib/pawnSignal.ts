import { supabase } from "@/integrations/supabase/client";

/**
 * Teil 32 — Die Nutzungs-Schleife: schreibt ein Nutzungsmuster nach pawn_signals, dieselbe
 * Tabelle wie Teil 28c/30. "pattern" enthält ausschließlich Kategorien/Zählwerte — welche
 * Funktion benutzt wurde, nie was eingegeben oder besprochen wurde. Client-seitiges
 * Gegenstück zu supabase/functions/_shared/pawnSignal.ts.
 */
export type NutzungsSignalKind =
  | "funktion_genutzt" | "funktion_ignoriert"
  | "zug_erledigt" | "zug_uebersprungen"
  | "deck_frage" | "automatik_an" | "automatik_aus";

export async function schreibePawnSignal(
  kind: NutzungsSignalKind,
  pattern: Record<string, unknown>,
  world?: string | null,
): Promise<void> {
  try {
    await supabase.from("pawn_signals").insert({ quelle: "studio", kind, pattern: pattern as never, world: world ?? null });
  } catch {
    /* Signalstrom darf nie eine echte Aktion blockieren */
  }
}

const SEEN_KEY_PREFIX = "pawn.rooms_seen.";

/** Einmal je Sitzung und Haus je Raum — sonst würde jede erneute Navigation die Tabelle fluten. */
export function markRoomUsedOncePerSession(designerId: string, roomKey: string): void {
  if (typeof window === "undefined") return;
  const storeKey = `${SEEN_KEY_PREFIX}${designerId}`;
  let seen: string[] = [];
  try { seen = JSON.parse(sessionStorage.getItem(storeKey) ?? "[]"); } catch { seen = []; }
  if (seen.includes(roomKey)) return;
  sessionStorage.setItem(storeKey, JSON.stringify([...seen, roomKey]));
  void schreibePawnSignal("funktion_genutzt", { funktion: roomKey });
}

const ROOM_KEYS: Array<{ prefix: string; key: string }> = [
  { prefix: "/studio/produkte", key: "produkte" },
  { prefix: "/studio/kampagnen", key: "inszenieren" },
  { prefix: "/studio/mediathek", key: "mediathek" },
  { prefix: "/studio/videothek", key: "videothek" },
  { prefix: "/studio/hausseite", key: "hausseite" },
  { prefix: "/studio/dna", key: "werkbuch" },
  { prefix: "/studio/brand", key: "brand" },
  { prefix: "/studio/content-begleiter", key: "content_begleiter" },
  { prefix: "/studio/automatik", key: "automatik" },
  { prefix: "/studio/empfehlungen", key: "empfehlungen" },
  { prefix: "/studio/plan", key: "plan" },
  { prefix: "/studio/bestellungen", key: "bestellungen" },
  { prefix: "/studio/tueren", key: "tueren" },
];

export function roomKeyForPath(pathname: string): string | null {
  const hit = ROOM_KEYS.find((r) => pathname.startsWith(r.prefix));
  return hit?.key ?? null;
}
