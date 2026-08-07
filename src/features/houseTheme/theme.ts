/**
 * Teil 15a: gemeinsamer Typ + CSS-Variablen-Übersetzung für das Haus-Thema. Die Halle selbst
 * (Startseite, Welten, Ausgabe, Kasse, Konto) liest das nie — nur HausseiteBlocks und die
 * Produktseite eines Hauses mit veröffentlichter Hausseite werden damit umschlossen.
 */
import type { CSSProperties } from "react";

export type Typografie = "editorial" | "zart" | "archiv" | "warm";
export type Flaechenrhythmus = "eng" | "ruhig" | "luftig" | "episch";
export type Kantenhaerte = "hart" | "weich" | "rund";
export type Bewegungscharakter = "ruhig" | "gestaffelt" | "ausdrucksstark";
export type Textur = "keine" | "papier" | "leinen" | "rauschen";
export type Uebergangsart = "fade" | "iris" | "schnitt" | "wisch";
export type Zuversicht = "niedrig" | "mittel" | "hoch";
export type ThemeQuelle = "dna_destilliert" | "designer_beschrieben" | "manuell_verfeinert";

export interface GuardrailNote { feld: string; von: string; zu: string; grund: string }

export interface HouseTheme {
  id?: string;
  version?: number;
  name?: string | null;
  input_prompt?: string | null;
  farbwelt: { bg: string; fg: string; accent: string; muted: string };
  typografie: Typografie;
  flaechenrhythmus: Flaechenrhythmus;
  kantenhaerte: Kantenhaerte;
  bewegungscharakter: Bewegungscharakter;
  hintergrundtextur: { typ: Textur; media_asset_id?: string | null };
  uebergangsart: Uebergangsart;
  zuversicht?: Zuversicht;
  quelle?: ThemeQuelle;
  guardrail_notes?: GuardrailNote[];
}

export const DEFAULT_HOUSE_THEME: HouseTheme = {
  farbwelt: { bg: "#FFFFFF", fg: "#000000", accent: "#000000", muted: "#FFFFFF" },
  typografie: "editorial",
  flaechenrhythmus: "ruhig",
  kantenhaerte: "hart",
  bewegungscharakter: "ruhig",
  hintergrundtextur: { typ: "keine" },
  uebergangsart: "fade",
};

export const TYPOGRAFIE_LABEL: Record<Typografie, string> = {
  editorial: "Editorial (Playfair Display)", zart: "Zart (Cormorant Garamond)",
  archiv: "Archiv (Mono)", warm: "Warm (Cormorant + Georgia)",
};
export const FLAECHENRHYTHMUS_LABEL: Record<Flaechenrhythmus, string> = {
  eng: "Eng", ruhig: "Ruhig", luftig: "Luftig", episch: "Episch",
};
export const KANTENHAERTE_LABEL: Record<Kantenhaerte, string> = {
  hart: "Hart (keine Rundung)", weich: "Weich", rund: "Rund",
};
export const BEWEGUNGSCHARAKTER_LABEL: Record<Bewegungscharakter, string> = {
  ruhig: "Ruhig", gestaffelt: "Gestaffelt", ausdrucksstark: "Ausdrucksstark",
};
export const TEXTUR_LABEL: Record<Textur, string> = {
  keine: "Keine", papier: "Papier", leinen: "Leinen", rauschen: "Rauschen",
};

const RADIUS: Record<Kantenhaerte, string> = { hart: "0px", weich: "6px", rund: "20px" };
const GAP: Record<Flaechenrhythmus, string> = { eng: "2.5rem", ruhig: "4.5rem", luftig: "6.5rem", episch: "9rem" };
const REVEAL: Record<Bewegungscharakter, { dur: string; dist: string }> = {
  ruhig: { dur: "0.6s", dist: "16px" },
  gestaffelt: { dur: "0.85s", dist: "28px" },
  ausdrucksstark: { dur: "1.1s", dist: "44px" },
};

/**
 * Teil 26a — bewusste Ausnahme vom Farb- und Kantengesetz (nicht verhandelbar für den Rest der
 * App): innerhalb von .house-theme darf ein Designer freie Farben (farbwelt) und Rundungen
 * (kantenhaerte → --house-radius, 0/6/20px) wählen. Das ist Absicht, kein Verstoß — siehe
 * CLAUDE.md "Design-Gesetze" und den Kommentar über der .house-theme-Regel in index.css.
 */
export function themeCssVars(theme: HouseTheme): CSSProperties {
  return {
    "--house-bg": theme.farbwelt.bg,
    "--house-fg": theme.farbwelt.fg,
    "--house-accent": theme.farbwelt.accent,
    "--house-muted": theme.farbwelt.muted,
    "--house-radius": RADIUS[theme.kantenhaerte],
    "--house-gap-y": GAP[theme.flaechenrhythmus],
    "--house-reveal-dur": REVEAL[theme.bewegungscharakter].dur,
    "--house-reveal-dist": REVEAL[theme.bewegungscharakter].dist,
  } as CSSProperties;
}

export function resolveTheme(row: Partial<HouseTheme> | null | undefined): HouseTheme {
  if (!row) return DEFAULT_HOUSE_THEME;
  return {
    ...DEFAULT_HOUSE_THEME,
    ...row,
    farbwelt: { ...DEFAULT_HOUSE_THEME.farbwelt, ...(row.farbwelt ?? {}) },
    hintergrundtextur: { ...DEFAULT_HOUSE_THEME.hintergrundtextur, ...(row.hintergrundtextur ?? {}) },
  };
}
