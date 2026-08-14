/**
 * DIE SITZUNGSSPUR — was ein Gast in DIESEM Besuch angesehen hat.
 *
 * Eingeloggte haben ein Geschmacksprofil (domain_events + user_memory). Gäste
 * haben nichts — anonymes Stöbern wird bewusst nirgends gezählt (siehe
 * usePageVisit). Damit „Deine Boutique" auch ohne Konto etwas Ehrliches zeigen
 * kann, merkt sich diese Datei die angesehenen Werke im `sessionStorage`.
 *
 * Was das bewusst NICHT ist:
 *   · keine neue Tabelle, keine neue Spalte, kein Server-Speicher
 *   · nichts, was den Tab überlebt — sessionStorage stirbt mit dem Fenster
 *   · nichts ohne Zustimmung — ohne erteilte Einwilligung wird nichts geschrieben
 *
 * Sie ist die Antwort auf „bei Gästen speisen sich die Signale aus der laufenden
 * Sitzung": eine Spur im Sand, kein Eintrag im Buch.
 */

const SCHLUESSEL = "pawn.sitzungsspur.v1";
const MAX = 24;

export interface Sitzungsspur {
  /** Zuletzt angesehene Werke, neueste zuerst. */
  werke: { slug: string; welt: string | null; haus: string | null }[];
}

const LEER: Sitzungsspur = { werke: [] };

export function leseSitzungsspur(): Sitzungsspur {
  if (typeof window === "undefined") return LEER;
  try {
    const roh = sessionStorage.getItem(SCHLUESSEL);
    if (!roh) return LEER;
    const daten = JSON.parse(roh) as Sitzungsspur;
    return Array.isArray(daten?.werke) ? daten : LEER;
  } catch {
    return LEER;
  }
}

/**
 * Notiert ein angesehenes Werk. `erlaubt` kommt vom Einwilligungs-Banner —
 * ist es false, passiert hier gar nichts.
 */
export function merkeAngesehen(
  erlaubt: boolean,
  werk: { slug: string; welt?: string | null; haus?: string | null },
): void {
  if (!erlaubt || typeof window === "undefined" || !werk.slug) return;
  try {
    const spur = leseSitzungsspur();
    const ohne = spur.werke.filter((w) => w.slug !== werk.slug);
    const neu: Sitzungsspur = {
      werke: [{ slug: werk.slug, welt: werk.welt ?? null, haus: werk.haus ?? null }, ...ohne].slice(0, MAX),
    };
    sessionStorage.setItem(SCHLUESSEL, JSON.stringify(neu));
  } catch {
    /* Voller oder gesperrter Speicher ist kein Grund, den Besuch zu stören. */
  }
}

/** Die häufigste Welt dieser Sitzung — oder null, wenn es keine klare gibt. */
export function weltDerSitzung(spur: Sitzungsspur): string | null {
  const zaehler = new Map<string, number>();
  for (const w of spur.werke) if (w.welt) zaehler.set(w.welt, (zaehler.get(w.welt) ?? 0) + 1);
  let beste: string | null = null;
  let hoechste = 0;
  for (const [welt, n] of zaehler) if (n > hoechste) { hoechste = n; beste = welt; }
  return hoechste >= 2 ? beste : null;
}

/** Die Häuser dieser Sitzung, häufigste zuerst. */
export function haeuserDerSitzung(spur: Sitzungsspur): string[] {
  const zaehler = new Map<string, number>();
  for (const w of spur.werke) if (w.haus) zaehler.set(w.haus, (zaehler.get(w.haus) ?? 0) + 1);
  return Array.from(zaehler.entries()).sort((a, b) => b[1] - a[1]).map(([haus]) => haus);
}
