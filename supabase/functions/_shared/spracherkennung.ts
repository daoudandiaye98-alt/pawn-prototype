/* ============================================================================
 * PART 47 Befund 3 „Die Verlorenen": d.oostingartist (.nl-Domain, niederländische Bio)
 * bekam trotzdem 'de', weil Spracherkennung bislang allein ein LLM-Urteil über den Bio-Text
 * war, mit Deutsch als Rückfall bei Unklarheit — die Domain wurde nie geprüft. Härtung: ein
 * deterministischer Check in dieser Priorität — (1) Domain-Länder-Code, (2) Bio-Text,
 * (3) Profil-Standort. Liefert dieser Check ein Ergebnis, gilt es als bindend (überschreibt
 * ein abweichendes LLM-Urteil); liefert er keins, bleibt Englisch der sichere Rückfall statt
 * Deutsch — nur .de/.at/.ch oder ein eindeutig deutscher Bio-Text ergeben Deutsch.
 *
 * Eigenes Modul (statt inline in pawn-jarvis/index.ts), damit harteSpracherkennung() ohne
 * Nebenwirkungen (kein Deno.serve-Start beim Import) regressionsgetestet werden kann.
 * ========================================================================== */

const NICHT_DEUTSCHE_TLDS = new Set(["nl", "fr", "it", "es", "se", "dk", "be", "pt", "uk", "pl", "cz"]);
const DEUTSCHE_TLDS = new Set(["de", "at", "ch"]);

export function domainEndung(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.replace(/^www\./, "");
    const teile = host.split(".");
    return teile.length > 1 ? teile[teile.length - 1].toLowerCase() : null;
  } catch { return null; }
}

/** Eindeutig deutsche Signalwörter/Umlaute im Bio-Text — bewusst konservativ, lieber "unklar"
 * (null) als ein falsches Deutsch-Urteil aus einem einzelnen Fremdwort. */
export function biospracheDeutsch(bio: string | null): boolean | null {
  if (!bio || bio.trim().length < 8) return null;
  const b = bio.toLowerCase();
  if (/[äöüß]/.test(b)) return true;
  const deutscheWoerter = /\b(und|nicht|handgemacht|manufaktur|schmuck|kleidung|kollektion|künstlerin|künstler|designerin|designer aus|handwerk|einzelstück|nachhaltig)\b/;
  const englischeWoerter = /\b(the|and|based in|handmade|jewelry|clothing|collection|artist|designer from|sustainable|one[- ]of[- ]a[- ]kind)\b/;
  if (deutscheWoerter.test(b) && !englischeWoerter.test(b)) return true;
  if (englischeWoerter.test(b)) return false;
  return null;
}

export function standortDeutsch(location: string | null): boolean | null {
  if (!location) return null;
  const l = location.toLowerCase();
  if (/deutschland|germany|\bde\b|österreich|austria|\bat\b|schweiz|switzerland|\bch\b/.test(l)) return true;
  if (l.trim().length > 0) return false;
  return null;
}

/** Bindendes Ergebnis (überschreibt das LLM) — immer, ohne Ausnahme. Bleiben Domain-Endung,
 * Bio-Text UND Profil-Standort alle unklar (kein einziger Beleg für Deutsch), ist Englisch die
 * bindende Wahl: Deutsch darf nur bei einem echten, positiven Beleg gesetzt werden, nie als
 * Voreinstellung (Befund 1: ein komplett belegloses Profil bekam bisher trotzdem einen deutschen
 * Entwurf, weil die Entscheidung in diesem Fall beim LLM lag). */
export function harteSpracherkennung(website: string | null, bio: string | null, location: string | null): "de" | "en" {
  const tld = domainEndung(website);
  if (tld) {
    if (DEUTSCHE_TLDS.has(tld)) return "de";
    if (NICHT_DEUTSCHE_TLDS.has(tld)) return "en";
  }
  const bioSignal = biospracheDeutsch(bio);
  if (bioSignal !== null) return bioSignal ? "de" : "en";
  const standortSignal = standortDeutsch(location);
  if (standortSignal !== null) return standortSignal ? "de" : "en";
  return "en";
}
