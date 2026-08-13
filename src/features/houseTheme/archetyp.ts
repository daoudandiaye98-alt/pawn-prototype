import galeriePlate from "@/assets/archetyp-galerie.webp";
import editorialPlate from "@/assets/archetyp-editorial.webp";
import atelierPlate from "@/assets/archetyp-atelier.webp";
import archivPlate from "@/assets/archetyp-archiv.webp";

/**
 * Teil K (Abschnitt 4+5) — die vier Stil-Archetypen der Doppelseite. Ein Archetyp ändert,
 * WIE die Werkliste erzählt (Layout-Rhythmus, Trenner), nie das PAWN-Gesetz selbst:
 * #000/#FFF, Playfair/Cormorant, Hairlines bleiben unangetastet; Farbe kommt nur aus
 * den Werken. Die Basis-Platten sind leise Sektions-Trenner mit niedrigem Kontrast und
 * stehen nie ungeschützt hinter Text.
 *
 * Gespeichert wird die Wahl in designers.brand_dna.archetyp (jsonb, keine Migration).
 * Ohne ausdrückliche Wahl gilt der Vorschlag aus der Rochade-DNA, sonst Editorial.
 */

export type Archetyp = "galerie" | "editorial" | "atelier" | "archiv";

export const ARCHETYPEN: Archetyp[] = ["galerie", "editorial", "atelier", "archiv"];
export const DEFAULT_ARCHETYP: Archetyp = "editorial";

export const ARCHETYP_PLATES: Record<Archetyp, string> = {
  galerie: galeriePlate,
  editorial: editorialPlate,
  atelier: atelierPlate,
  archiv: archivPlate,
};

type BrandDna = Record<string, unknown> | null | undefined;

function merkmale(brandDna: BrandDna): Record<string, unknown> | null {
  if (!brandDna || typeof brandDna !== "object") return null;
  const rochade = (brandDna as { rochade?: { merkmale?: Record<string, unknown> } }).rochade;
  return rochade && typeof rochade === "object" && rochade.merkmale && typeof rochade.merkmale === "object"
    ? rochade.merkmale
    : null;
}

/** Die ausdrückliche Wahl des Hauses (Tab Stil) — oder null, wenn nie gewählt wurde. */
export function gewaehlterArchetyp(brandDna: BrandDna): Archetyp | null {
  const v = brandDna && typeof brandDna === "object" ? (brandDna as { archetyp?: unknown }).archetyp : null;
  return typeof v === "string" && (ARCHETYPEN as string[]).includes(v) ? (v as Archetyp) : null;
}

/**
 * Rochade-DNA → Archetyp-Vorschlag. Zuordnung laut Auftrag:
 * roh/texturbetont → Atelier · Raster/sachlich → Archiv · bildlastig + Weißraum →
 * Galerie · Serifen/editorial → Editorial · Fallback immer Editorial.
 */
export function archetypVorschlag(brandDna: BrandDna): Archetyp {
  const m = merkmale(brandDna);
  if (!m) return DEFAULT_ARCHETYP;
  const ton = String(m.tonalitaet ?? "").toLowerCase();
  const layout = String(m.layout_muster ?? "");
  const bildlastig = m.bildlastig === true;
  if (/roh|rau|textur|handwerk|werkstatt|unfertig/.test(ton)) return "atelier";
  if (layout === "raster" || layout === "liste") return "archiv";
  if (bildlastig && layout === "vollbild_sektionen") return "galerie";
  if (String(m.typo_gefuehl ?? "") === "serif") return "editorial";
  if (bildlastig) return "galerie";
  return DEFAULT_ARCHETYP;
}

/** Was die Doppelseite tatsächlich rendert: ausdrückliche Wahl vor Vorschlag vor Standard. */
export function aktiverArchetyp(brandDna: BrandDna): Archetyp {
  return gewaehlterArchetyp(brandDna) ?? archetypVorschlag(brandDna);
}
