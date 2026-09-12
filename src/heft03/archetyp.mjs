/**
 * Der Archetyp — dieselbe Rechnung für Gäste, die die Datenbank für Konten macht.
 *
 * WARUM ES DAS ZWEIMAL GIBT: `archetyp_berechnen()` ist SECURITY DEFINER und beginnt mit
 * `if uid is null then return; end if`. Ein Gast bekommt von ihr nie eine Antwort — sie
 * liest `kunden_stil`, `orders` und `anproben`, und nichts davon hat er. Wer ohne Konto
 * durch die Stilberatung geht, hätte also eine leere Seite. Diese Datei rechnet für ihn,
 * im Browser, aus dem, was er dabei hat: Quiz und Merkliste.
 *
 * DIE GRENZE DIESER FASSUNG, damit sie niemand für mehr hält: Käufe und Anproben kann
 * ein Gast nicht haben, also fehlen die beiden Summanden, die die RPC zusätzlich kennt
 * (`least(2.0, 1.0 × Käufe)` und `least(1.4, 0.7 × passende Anproben)`). Für einen Gast
 * sind sie immer null — die Rechnungen stimmen also überein, solange es ein Gast ist.
 * Meldet er sich an, gilt die RPC, nicht diese Datei.
 *
 * Gemessen am 12.09.2026 auf rnakubexbqfgfciynqpt: 18 aktive Archetypen, sechs je Welt,
 * alle mit `figur`, KEINER mit `bild_url`, KEINER mit `haus_archetypen`.
 */

/** Die Gewichte aus Auftrag O, C1. Sie stehen so auch in der RPC. */
export const GEWICHT = { richtung: 2.0, form: 1.8, je_werk: 0.5, werke_max: 2.0 };

/**
 * Die Zuversicht folgt der BELEGSTUFE, nie dem Punktestand.
 *
 * Das ist der Kern und der Grund, warum es eine eigene Leiter gibt: ein hoher Punktestand
 * heisst nur, dass ein Archetyp besser passt als die anderen — nicht, dass wir viel über
 * die Person wissen. Wer zwei Bilder antippt, bekommt einen Sieger mit 3,8 Punkten und
 * trotzdem nur 0,4 Zuversicht. Sonst verkauft die Seite eine Vermutung als Erkenntnis.
 */
export const STUFEN = { quiz: 0.4, foto: 0.55, merkliste: 0.7, anprobe: 0.75, kauf: 0.85, bestaetigt: 1.0 };

/**
 * Der Fließtext eines Werks, kleingeschrieben — wie `beratung.mjs › stilBegriffe`.
 * Bewusst dieselbe Reihenfolge und dieselben Felder: zwei Stellen, die dasselbe anders
 * lesen, ergeben zwei Wahrheiten.
 */
export function werkText(p) {
  const d = (p && p.dna) || {};
  return [
    ...(d.mood || []), ...(d.silhouette || []), ...(d.materials || []),
    ...(d.colors || []), ...(d.tags || []), (p && p.material) || '',
  ].join(' ').toLocaleLowerCase('de');
}

/** Trägt dieses Werk eines der Wörter des Archetyps? */
export function werkTrifft(p, woerter = []) {
  const hay = werkText(p);
  return woerter.some((w) => w && hay.includes(String(w).toLocaleLowerCase('de')));
}

/**
 * Der Punktestand eines Archetyps gegen Quiz und Merkliste.
 * `stil` ist `{welt, richtung, form}`, `werke` sind die gemerkten Werke als Objekte.
 */
export function punkte(archetyp, stil = {}, werke = []) {
  const a = archetyp || {};
  let p = 0;
  if (stil.richtung && (a.richtung || []).includes(stil.richtung)) p += GEWICHT.richtung;
  if (stil.form && (a.form || []).includes(stil.form)) p += GEWICHT.form;
  const treffer = werke.filter((w) => werkTrifft(w, a.woerter || [])).length;
  p += Math.min(GEWICHT.werke_max, GEWICHT.je_werk * treffer);
  return p;
}

/**
 * Die Belege — jeder aus echten Daten, keiner erfunden.
 *
 * Sie sind der Grund, warum die Seite „Woran ich das lese:" überhaupt schreiben darf.
 * Steht hier nichts, wird dort auch nichts behauptet.
 */
export function belegeAus(stil = {}, werke = [], extra = {}) {
  const b = [];
  if (stil.welt) {
    b.push({ art: 'quiz', gewicht: GEWICHT.richtung + GEWICHT.form,
      text: [stil.welt, stil.richtung || '—', stil.form || '—'].join(' · ') });
  }
  if (extra.foto) b.push({ art: 'foto', gewicht: 1, text: 'Farbregister aus deinem Foto' });
  if (werke.length) {
    b.push({ art: 'merkliste', gewicht: Math.min(GEWICHT.werke_max, GEWICHT.je_werk * werke.length),
      text: werke.length + (werke.length === 1 ? ' gemerktes Stück' : ' gemerkte Stücke') });
  }
  return b;
}

/** Die Zuversicht aus der Belegstufe. Aufsteigend, nie absteigend. */
export function zuversichtAus({ foto = false, merkliste = 0, anproben = 0, kaeufe = 0, bestaetigt = false } = {}) {
  if (bestaetigt) return STUFEN.bestaetigt;
  let z = STUFEN.quiz;
  if (foto) z = STUFEN.foto;
  if (merkliste >= 3) z = Math.max(z, STUFEN.merkliste);
  if (anproben >= 1) z = Math.max(z, STUFEN.anprobe);
  if (kaeufe >= 1) z = Math.max(z, STUFEN.kauf);
  return z;
}

/**
 * Drei bis fünf Punkte statt eines Prozentwerts (Auftrag O, C2).
 *
 * „0,55" liest sich wie eine Messung. Drei von fünf Punkten liest sich wie das, was es
 * ist: eine Ahnung, die fester wird.
 */
export function punkteAnzeige(zuversicht) {
  const z = Number(zuversicht) || 0;
  const voll = z >= 1 ? 5 : z >= 0.85 ? 5 : z >= 0.75 ? 4 : z >= 0.7 ? 4 : z >= 0.55 ? 3 : 3;
  return { voll, gesamt: 5 };
}

/**
 * Der Archetyp eines Gastes. `null`, wenn die Welt fehlt — ohne Welt gibt es keinen
 * Katalog, gegen den zu rechnen wäre, und ohne Rechnung wird nichts behauptet.
 *
 * Rückgabe wie die RPC: {archetyp_key, zuversicht, belege, alternativen, bestaetigt}.
 * Gleiche Form heisst: die Doppelseite muss nicht wissen, woher ihre Daten kommen.
 */
export function archetypFuerGast(katalog = [], stil = {}, werke = [], extra = {}) {
  if (!stil.welt) return null;
  const eigene = katalog.filter((a) => a && a.aktiv !== false && a.welt === stil.welt);
  if (!eigene.length) return null;

  const bewertet = eigene
    .map((a) => ({ key: a.key, score: Number(punkte(a, stil, werke).toFixed(2)) }))
    // Bei Gleichstand entscheidet der Schlüssel — dieselbe Regel wie in der RPC
    // (`order by score desc, key`), damit dieselbe Person nicht je nach Laune eine
    // andere Figur bekommt.
    .sort((x, y) => (y.score - x.score) || (x.key < y.key ? -1 : 1));

  return {
    archetyp_key: bewertet[0].key,
    zuversicht: zuversichtAus({ foto: !!extra.foto, merkliste: werke.length, bestaetigt: !!extra.bestaetigt }),
    belege: belegeAus(stil, werke, extra),
    alternativen: bewertet.slice(0, 3),
    bestaetigt: !!extra.bestaetigt,
    gast: true,
  };
}

/**
 * Die nächste Alternative, wenn jemand „Eher nicht" sagt.
 * Nimmt den ersten Schlüssel, der weder der abgelehnte noch schon abgelehnt ist.
 */
export function naechsteAlternative(alternativen = [], abgelehnt = []) {
  const weg = new Set(abgelehnt);
  const treffer = alternativen.map((a) => (typeof a === 'string' ? a : a && a.key)).find((k) => k && !weg.has(k));
  return treffer || null;
}
