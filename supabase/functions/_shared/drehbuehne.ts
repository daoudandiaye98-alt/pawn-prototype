/**
 * Die Drehbühne — was die Function `anprobe` für Mode rechnet, als reine Logik.
 *
 * Vorbild ist Mira (trymira.style, Chrome-Erweiterung „Mira: Virtual Try-on", 0.2.14):
 * Aus einem Foto entsteht ein Avatar auf Weiß, und jede Anprobe wird in mehreren
 * Ansichten gerechnet — vorne, Seite, Rücken —, die sich wie ein Drehteller anschauen
 * lassen. Mira rechnet dafür mit Googles Bildmodellen (Gemini 3 Pro Image und
 * 3.1 Flash Image). PAWN nimmt dasselbe Modell über fal, mit eigenen Anweisungen.
 *
 * Der Ablauf hier: die Vorderansicht zuerst — sie ist nach einer halben Minute zu
 * sehen. Seite und Rücken rechnet ein ZWEITER Aufruf (`ansichten`), beide
 * nebeneinander. So bleibt jeder Aufruf weit unter der Wanduhr der Edge Runtime
 * (150 s Leerlauf, 400 s gesamt), und eine misslungene Nachansicht lässt sich
 * nachholen, ohne die ganze Anprobe neu zu bezahlen.
 *
 * Nichts in dieser Datei ruft ein Netz — darum ist sie getestet:
 * src/__tests__/drehbuehne-funktion.spec.ts
 */

export const ANSICHTEN = ["vorne", "seite", "hinten"] as const;
export type Ansicht = (typeof ANSICHTEN)[number];
export type Nachansicht = Exclude<Ansicht, "vorne">;
export const NACHANSICHTEN: readonly Nachansicht[] = ["seite", "hinten"];

/** Ein Outfit hat höchstens drei Stücke — darüber wird das Bild unscharf im Detail. */
export const MAX_STUECKE = 3;

/** Standardmodelle. Überschreibbar in ai_config.tryon_provider (edit_model, ansichten_modell, tryon_model). */
export const BILDMODELL = "fal-ai/nano-banana-pro/edit";
export const KOLORS = "fal-ai/kling/v1-5/kolors-virtual-try-on";

/**
 * Lizenzwache. IDM-VTON, CatVTON, OOTDiffusion und StableVITON stehen unter
 * CC BY-NC-SA 4.0 — nicht für kommerzielle Nutzung frei. PAWN verkauft. Steht so ein
 * Modell in ai_config, wird es trotzdem nie gerufen; an seine Stelle tritt der Ersatz.
 * Jede Schreibweise zählt: fal führt etwa `fal-ai/cat-vton` mit Bindestrich (Prüferfund 24.11.).
 */
export const NICHT_KOMMERZIELL = /idm[-_ ]?vton|cat[-_ ]?vton|\bootd(?:iffusion)?\b|stable[-_ ]?viton/i;
export function erlaubtesModell(modell: unknown, ersatz: string): string {
  const m = typeof modell === "string" ? modell.trim() : "";
  return m && !NICHT_KOMMERZIELL.test(m) ? m : ersatz;
}

/**
 * Was ein gerechnetes Bild kostet, in Cent (fal-Preisliste, Stand 24.11.2026): Nano Banana Pro
 * 15 ¢ (4K doppelt), Nano Banana 4 ¢, alles Unbekannte 12 ¢. Ein Satz aus ai_config gewinnt.
 */
export function centJeBild(modell: unknown, satz?: unknown, aufloesung?: unknown): number {
  if (typeof satz === "number" && Number.isFinite(satz) && satz >= 0) return satz;
  const m = typeof modell === "string" ? modell : "";
  if (/nano-banana-pro|gemini-3-pro/i.test(m)) return aufloesung === "4K" ? 30 : 15;
  if (/nano-banana|gemini-2\.5-flash|gemini-25-flash/i.test(m)) return 4;
  return 12;
}

/** Nur die neueren Bildmodelle kennen Seitenverhältnis und Auflösung — ältere lehnen unbekannte Felder ab. */
export function bildParameter(modell: string, aufloesung: unknown = "2K"): Record<string, string> {
  if (!/nano-banana-pro|nano-banana-2|gemini-3/i.test(modell)) return {};
  const res = aufloesung === "1K" || aufloesung === "2K" || aufloesung === "4K" ? aufloesung : "2K";
  return { aspect_ratio: "4:5", resolution: res };
}

/** product_id + product_ids → bis zu drei verschiedene Stücke, das zuerst genannte zuerst. */
export function stueckeAusAuftrag(body: { product_id?: unknown; product_ids?: unknown }): string[] {
  const roh = [body.product_id, ...(Array.isArray(body.product_ids) ? body.product_ids : [])];
  const ids: string[] = [];
  for (const x of roh) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_STUECKE);
}

/** Wo eine Ansicht im Eimer `kunden-bilder` liegt. Die Vorderansicht ist das Hauptbild der Anprobe. */
export function ansichtPfad(userId: string, anprobeId: string, ansicht: Ansicht): string {
  return ansicht === "vorne"
    ? `${userId}/anproben/${anprobeId}.jpg`
    : `${userId}/anproben/${anprobeId}-${ansicht}.jpg`;
}

/** Aus einem Dateinamen im Ordner `<user>/anproben` die Ansicht lesen — oder null, wenn er nicht dazugehört. */
export function ansichtAusDatei(anprobeId: string, name: string): Ansicht | null {
  if (name === `${anprobeId}.jpg`) return "vorne";
  for (const a of NACHANSICHTEN) if (name === `${anprobeId}-${a}.jpg`) return a;
  return null;
}

export type Stueck = { name: string; notiz?: string | null };

/** Eine Hausnotiz wird Teil der Anweisung — kurz, einzeilig, ohne Steuerzeichen. */
export function notizKurz(t: unknown, max = 160): string {
  if (typeof t !== "string") return "";
  const s = t.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function liste(stuecke: Stueck[]): string {
  return stuecke
    .map((s, i) => `Image ${i + 2}: ${notizKurz(s.name, 80) || "a piece"}${s.notiz ? ` (${notizKurz(s.notiz)})` : ""}`)
    .join("\n");
}

const RAHMEN =
  "Full body from head to toe, centered, with empty margin above the head and below the feet. " +
  "Plain seamless white studio background, soft even light, photorealistic, portrait format 4:5.";
const PERSON_TREU =
  "Keep the person exactly as in image 1: same face, skin tone, hair, body shape, height, proportions and pose. " +
  "Do not beautify, slim, age or otherwise change the person.";
const STUECK_TREU =
  "Reproduce every piece faithfully: same colour, fabric, texture, pattern, cut, length, seams and hardware. " +
  "Do not invent logos, text or additional items.";

/** Die Vorderansicht: die Person aus Bild 1 trägt die Stücke aus den Bildern 2 bis n. */
export function anprobePrompt(stuecke: Stueck[], zusatz?: string | null): string {
  const einzeln = stuecke.length <= 1;
  return [
    "Image 1 shows a person. The following images show pieces made by independent design houses:",
    liste(stuecke),
    `Dress the person from image 1 in ${einzeln ? "this piece" : "all of these pieces together, as one outfit"}. ` +
      "Replace only the clothing these pieces cover and keep everything else the person wears.",
    PERSON_TREU,
    STUECK_TREU,
    RAHMEN,
    notizKurz(zusatz, 300),
  ].filter(Boolean).join("\n");
}

const DREHUNG: Record<Nachansicht, string> = {
  seite: "seen from the side: the person has turned 90 degrees to their left, so the camera shows their right side in profile",
  hinten: "seen from behind: the person has turned 180 degrees, so the camera shows their back",
};

/** Seite oder Rücken: dieselbe Person im selben Outfit, gedreht. Bild 1 ist die fertige Vorderansicht. */
export function ansichtPrompt(ansicht: Nachansicht, stuecke: Stueck[]): string {
  const teil = ansicht === "hinten" ? "back" : "side";
  return [
    "Image 1 shows a person wearing an outfit, front view. The following images show the pieces of that outfit:",
    liste(stuecke),
    `Show the same person in the exact same outfit, ${DREHUNG[ansicht]}.`,
    "Same body, proportions, hair and skin tone. Same garments with identical colours, fabric and details. " +
      `Where the product images show the ${teil} of a piece, follow them exactly. Do not add or remove items.`,
    "Same framing and scale as image 1. " + RAHMEN,
  ].join("\n");
}

/** Das Foto der Kundin, freigestellt, auf Weiß — mit festem Rahmen für jede spätere Anprobe. */
export const AVATAR_PROMPT =
  "Place this exact person on a plain seamless white studio background with soft even light. " +
  "Do not change the person's face, body, proportions, pose or clothing in any way. " +
  "Full body from head to toe, centered, with empty margin above the head and below the feet.";

/** Was die Function im `request_handle` einer Anprobe über die Nachansichten festhält. */
export type AnsichtenStand = {
  status: "offen" | "laeuft" | "fertig" | "fehler";
  seit?: string;
  versuche: number;
  fehlend?: Nachansicht[];
};

const STATI = new Set(["offen", "laeuft", "fertig", "fehler"]);

export function ansichtenStand(handle: unknown): AnsichtenStand {
  const roh = handle && typeof handle === "object" ? (handle as Record<string, unknown>).ansichten : null;
  const a = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const status = typeof a.status === "string" && STATI.has(a.status) ? (a.status as AnsichtenStand["status"]) : "offen";
  const fehlend = Array.isArray(a.fehlend)
    ? (a.fehlend.filter((x) => NACHANSICHTEN.includes(x as Nachansicht)) as Nachansicht[])
    : undefined;
  return {
    status,
    seit: typeof a.seit === "string" ? a.seit : undefined,
    versuche: typeof a.versuche === "number" && a.versuche >= 0 ? a.versuche : 0,
    ...(fehlend && fehlend.length ? { fehlend } : {}),
  };
}

/** Höchstens drei Läufe je Anprobe; ein laufender wird vier Minuten lang nicht doppelt gestartet. */
export const MAX_VERSUCHE = 3;
export const LAUF_GILT_MS = 4 * 60_000;
export function darfAnsichtenStarten(stand: AnsichtenStand, jetzt: number): boolean {
  if (stand.versuche >= MAX_VERSUCHE) return false;
  if (stand.status === "laeuft" && stand.seit) {
    const seit = Date.parse(stand.seit);
    if (Number.isFinite(seit) && jetzt - seit < LAUF_GILT_MS) return false;
  }
  return true;
}

/** Die Stücke, die eine Anprobe trägt: aus dem Auftrag, sonst das eine aus `product_id`. */
export function stueckeDerAnprobe(handle: unknown, productId: string): string[] {
  const roh = handle && typeof handle === "object" ? (handle as Record<string, unknown>).stuecke : null;
  const ids = Array.isArray(roh) ? roh.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
  return ids.length ? ids.slice(0, MAX_STUECKE) : [productId];
}
