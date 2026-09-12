/**
 * DER BEGLEITER — Ereignisse rein, höchstens ein Satz raus.
 *
 * WAS VORHER WAR, und warum es weg musste: `begleiterTakt()` in app.js rotierte alle
 * paar Sekunden feste Sätze aus einer Liste im Code. Er wusste nichts — nicht, ob
 * jemand zum ersten Mal da ist, nicht, was er sich gemerkt hat, nicht einmal, ob er
 * denselben Satz gerade eben schon gesagt hatte. Ein Automat, der spricht, weil Zeit
 * vergeht.
 *
 * WAS JETZT GILT: Ereignis → Regel → Satz. Die Regeln und die Sätze stehen in der
 * Datenbank (`begleiter_regeln`, `begleiter_saetze`), nicht hier. Dieses Modul ist
 * der Verstand dazwischen — und es kennt weder DOM noch Datenbank. Alles, was es
 * braucht, bekommt es übergeben; alles, was es tut, gibt es zurück. Genau deshalb
 * ist es prüfbar, ohne einen Browser zu starten.
 *
 * KEINE SPRACHMODELL-AUFRUFE. Regel plus Katalog, deterministisch. Das Sprachmodell
 * kommt erst, wenn die Person selbst mit ihm spricht.
 */

/** Die Grenzen des Schweigens (A3). Als Objekt, damit Tests sie stauchen können. */
export const GRENZEN = {
  /** Mindestabstand zwischen zwei ungefragten Blasen, zusätzlich zur Abklingzeit der Regel. */
  abstand_ms: 25_000,
  /** So viele ungefragte Blasen je Sitzung. Danach nur noch die starken Ereignisse. */
  blasen_je_sitzung: 8,
  /** Nach dem × sagt er eine Weile gar nichts. */
  ruhe_nach_x_ms: 90_000,
};

/**
 * Ereignisse, die auch nach dem Blasen-Budget noch sprechen dürfen.
 * Sie haben alle gemeinsam, dass die Person gerade etwas GETAN hat — sie sind
 * Antwort, nicht Zwischenruf.
 */
export const STARKE_EREIGNISSE = new Set([
  'merken', 'kasse', 'kauf', 'anprobe_fertig', 'rang_aufstieg', 'betreten',
]);

/** Die Ränge in ihrer Reihenfolge — für den Vergleich beim Aufstieg. */
export const RAENGE = ['bauer', 'springer', 'laeufer', 'turm', 'dame'];

/**
 * Eine Bedingung gegen den Zustand prüfen.
 *
 * Jeder Schlüssel ist eine UND-Bedingung. Ein Schlüssel, den wir nicht kennen, macht
 * die Regel unwahr — nicht wahr. Das ist Absicht: eine Regel, die einen neuen
 * Schlüssel einführt, soll schweigen, bis der Code ihn versteht, statt bei jedem
 * Ereignis loszureden.
 */
export function bedingungTrifft(bedingung, zustand, daten) {
  if (!bedingung || typeof bedingung !== 'object') return true;
  const m = zustand.merkliste ?? 0;
  for (const [schluessel, soll] of Object.entries(bedingung)) {
    switch (schluessel) {
      case 'besuch':        if (zustand.besuch !== soll) return false; break;
      case 'kontext':       if (zustand.kontext !== soll) return false; break;
      case 'welt':          if ((daten.welt ?? zustand.welt) !== soll) return false; break;
      case 'konto':         if (!!zustand.konto !== !!soll) return false; break;
      case 'avatar':        if (!!zustand.avatar !== !!soll) return false; break;
      case 'linie':         if (!!zustand.linie !== !!soll) return false; break;
      case 'cutout':        if (!!daten.cutout !== !!soll) return false; break;
      case 'bestellung':    if (!!zustand.bestellung !== !!soll) return false; break;
      case 'merk_sichtbar': if (!!zustand.merk_sichtbar !== !!soll) return false; break;
      case 'min_ms':        if (!(Number(daten.ms) >= Number(soll))) return false; break;
      case 'merkliste_min': if (!(m >= Number(soll))) return false; break;
      case 'merkliste_eq':  if (m !== Number(soll)) return false; break;
      case 'stuecke_lt':    if (!(Number(zustand.stuecke ?? 0) < Number(soll))) return false; break;
      case 'aufrufe_min':   if (!(Number(zustand.aufrufe ?? 0) >= Number(soll))) return false; break;
      case 'anfragen_offen_min': if (!(Number(zustand.anfragen_offen ?? 0) >= Number(soll))) return false; break;
      default: return false;   // unbekannter Schlüssel — lieber schweigen
    }
  }
  return true;
}

/**
 * Der Schlüssel, unter dem ein Gesagtes im Gedächtnis liegt.
 *
 * Regeln, deren `notiz` „je Werk" oder „je Haus" sagt, sollen sich je Stück erinnern —
 * sonst sagt der Bauer denselben Satz über ein anderes Werk nie wieder, obwohl er dort
 * neu wäre. Deshalb hängt an solchen Regeln die Kennung des Gegenstands.
 */
export function merkSchluessel(regel, daten) {
  const notiz = String(regel.notiz ?? '');
  if (/je\s+Werk/i.test(notiz) && daten.werk_id) return `${regel.key}#${daten.werk_id}`;
  if (/je\s+Haus/i.test(notiz) && daten.haus_slug) return `${regel.key}#${daten.haus_slug}`;
  return regel.key;
}

/** Alle Platzhalter, die in einem Text vorkommen — `{werk}` → `werk`. */
export function platzhalterIn(text) {
  return [...String(text).matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
}

/**
 * Einen Satz füllen.
 *
 * DAS EHRLICHKEITSGESETZ: fehlt ein Platzhalter, gibt es KEINEN Satz. Nicht raten,
 * nicht durch „ein Stück" ersetzen. Ein Werk ohne hinterlegten Ort darf nicht dazu
 * führen, dass PAWN einen Ort erfindet — dann schweigt er lieber.
 */
export function fuelle(text, werte) {
  const fehlt = platzhalterIn(text).filter((p) => {
    const w = werte[p];
    return w === undefined || w === null || String(w).trim() === '';
  });
  if (fehlt.length) return null;
  return String(text).replace(/\{([a-z_]+)\}/g, (_, p) => String(werte[p]));
}

/**
 * Die Stimme: eine Fassung wählen, nie zweimal hintereinander dieselbe.
 *
 * `zuletzt` ist der Index der vorigen Fassung dieses Satzes. Bei nur einer Fassung
 * gibt es nichts zu wechseln — dann wiederholt sie sich, und das ist in Ordnung.
 */
export function waehleVariante(varianten, sprache, zuletzt, zufall) {
  const liste = (varianten && (varianten[sprache] || varianten.de)) || [];
  if (!liste.length) return null;
  if (liste.length === 1) return { text: liste[0], index: 0 };
  let i = Math.floor(zufall() * liste.length) % liste.length;
  if (i === zuletzt) i = (i + 1) % liste.length;
  return { text: liste[i], index: i };
}

/**
 * Das Gedächtnis — eine schmale Hülle über dem, was Gast und Konto unterschiedlich
 * ablegen. Der Verstand fragt nur `hat`, `merke`, `abgelehnt`; wo die Daten liegen,
 * geht ihn nichts an.
 */
export function gedaechtnisAus(roh = {}) {
  const gesagt = { ...(roh.gesagt || {}) };
  const abgelehnt = new Set(roh.abgelehnt || []);
  return {
    gesagt,
    abgelehnt,
    besuche: Number(roh.besuche ?? 0),
    letzter_besuch: roh.letzter_besuch ?? null,
    rang: roh.rang ?? 'bauer',
    /** Wann wurde dieser Schlüssel zuletzt gesagt? 0 = nie. */
    wann(key) { return Number(gesagt[key] ?? 0); },
    istAbgelehnt(key) { return abgelehnt.has(key) || abgelehnt.has(String(key).split('#')[0]); },
    merke(key, ts) { gesagt[key] = ts; },
    lehneAb(key) { abgelehnt.add(String(key).split('#')[0]); },
    roh() { return { gesagt, abgelehnt: [...abgelehnt], besuche: this.besuche, letzter_besuch: this.letzter_besuch, rang: this.rang }; },
  };
}

/**
 * Der Begleiter.
 *
 * @param {object} o
 *  - saetze, regeln : der Katalog aus der Datenbank
 *  - flaeche        : 'heft' oder 'studio' — Regeln der anderen Fläche gelten nie
 *  - sprache        : 'de' | 'en'
 *  - jetzt()        : Zeitgeber in ms (Date.now); in Tests eine Zahl, die man dreht
 *  - zufall()       : 0..1 (Math.random); in Tests fest
 *  - gedaechtnis    : aus gedaechtnisAus(), wird beim Sprechen fortgeschrieben
 *  - grenzen        : überschreibt GRENZEN (Tests)
 */
export function erschaffeBegleiter({
  saetze = [], regeln = [], flaeche = 'heft', sprache = 'de',
  jetzt = () => Date.now(), zufall = Math.random,
  gedaechtnis = gedaechtnisAus({}), grenzen = {},
} = {}) {
  const G = { ...GRENZEN, ...grenzen };
  const satzNach = new Map(saetze.filter((s) => s.aktiv !== false).map((s) => [s.key, s]));
  const meine = regeln
    .filter((r) => r.aktiv !== false && (r.flaeche ?? 'heft') === flaeche)
    .sort((a, b) => (b.prioritaet ?? 0) - (a.prioritaet ?? 0)
                 || (b.abklingzeit_s ?? 0) - (a.abklingzeit_s ?? 0));

  /** Zustand der laufenden Sitzung — nicht im Gedächtnis, er endet mit dem Schließen. */
  const sitzung = { gesagt: new Set(), ungefragte: 0, letzteBlase: 0, stillBis: 0, variante: {} };

  /** Darf jetzt überhaupt jemand sprechen? `null` = ja, sonst der Grund. */
  function warumStill(ereignis, zustand) {
    const t = jetzt();
    if (t < sitzung.stillBis) return 'ruhe_nach_x';
    if (zustand.stumm) return 'stumm';                       // Chat/Drawer/Dreh/Zustimmung/Kasse
    const stark = STARKE_EREIGNISSE.has(ereignis);
    if (!stark && sitzung.ungefragte >= G.blasen_je_sitzung) return 'budget';
    if (!stark && t - sitzung.letzteBlase < G.abstand_ms) return 'abstand';
    return null;
  }

  return {
    grenzen: G,
    sitzung,
    gedaechtnis,

    /**
     * SINNE. Ein Ereignis hereingeben, höchstens eine Blase herausbekommen.
     * Gibt `null` zurück, wenn geschwiegen wird — und das ist der Normalfall.
     */
    melde(ereignis, daten = {}, zustand = {}) {
      const still = warumStill(ereignis, zustand);
      if (still) return null;

      const t = jetzt();
      for (const regel of meine) {
        if (regel.ereignis !== ereignis) continue;
        if (!bedingungTrifft(regel.bedingung, zustand, daten)) continue;

        const key = merkSchluessel(regel, daten);
        if (gedaechtnis.istAbgelehnt(key)) continue;                    // × gilt für immer
        if (regel.einmal === 'sitzung' && sitzung.gesagt.has(key)) continue;
        if (regel.einmal === 'immer' && gedaechtnis.wann(key) > 0) continue;
        const abkling = Number(regel.abklingzeit_s ?? 0) * 1000;
        if (abkling > 0 && t - gedaechtnis.wann(key) < abkling) continue;

        const satz = satzNach.get(regel.satz_key);
        if (!satz) continue;
        const gewaehlt = waehleVariante(satz.varianten, sprache, sitzung.variante[regel.satz_key], zufall);
        if (!gewaehlt) continue;
        const text = fuelle(gewaehlt.text, zustand.werte || {});
        if (text === null) continue;      // Ehrlichkeitsgesetz — nächste Regel versuchen

        sitzung.variante[regel.satz_key] = gewaehlt.index;
        sitzung.gesagt.add(key);
        gedaechtnis.merke(key, t);
        sitzung.letzteBlase = t;
        if (!STARKE_EREIGNISSE.has(ereignis)) sitzung.ungefragte += 1;

        return {
          key, regel_key: regel.key, satz_key: regel.satz_key, text,
          aktion: regel.aktion || { art: 'sagen' },
          prioritaet: regel.prioritaet ?? 0,
        };
      }
      return null;
    },

    /** Das × — 90 s gar nichts, und dieser Schlüssel nie wieder. */
    ablehnen(key) {
      gedaechtnis.lehneAb(key);
      sitzung.stillBis = jetzt() + G.ruhe_nach_x_ms;
      return String(key).split('#')[0];
    },

    /** Steigt der Rang, ist das ein Ereignis — sonst passiert es unbemerkt. */
    rangGewechselt(neu) {
      const alt = gedaechtnis.rang || 'bauer';
      if (!neu || neu === alt) return null;
      if (RAENGE.indexOf(neu) <= RAENGE.indexOf(alt)) { gedaechtnis.rang = neu; return null; }
      gedaechtnis.rang = neu;
      return { von: alt, nach: neu };
    },
  };
}
