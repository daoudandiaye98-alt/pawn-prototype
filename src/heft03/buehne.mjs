/**
 * Die Bühne als Daten — die Rechnung, die keine drei Dimensionen braucht.
 *
 * `world.mjs` importiert THREE und ist damit ohne Browser nicht prüfbar. Alles,
 * was sich ohne Bildschirm entscheiden lässt — wo ein Stück landet, auf welcher
 * Ebene es liegt, ob eine Bühne veröffentlicht werden darf — steht deshalb hier.
 * Gleiches Muster wie archetyp.mjs und begleiter.mjs.
 */

/**
 * Das Feld, auf dem gestellt wird. DREI BENANNTE ZAHLEN, keine vergrabene.
 *
 * DIE ZAHLEN SIND GEMESSEN, NICHT ÜBERNOMMEN. Der Auftrag gab
 * `{breite:5.6, tiefe:2.4, z0:-1.35}` vor, mit der Begründung, die Ebene 2 liege
 * damit dort, wo heute die Podeste stehen, und „die Bühne darf nicht anders
 * aussehen als heute".
 *
 * Nachgerechnet gegen world.mjs:208, wo die drei Werke heute stehen:
 *
 *   Welt-x  -1,95 · 0,15 · 2,05        Welt-z  0,60 · 0,30 · 0,62
 *
 * · DIE BREITE STIMMT. (x-0,5)·5,6 bildet die drei auf 0,152 / 0,527 / 0,866 ab.
 *   Übernommen.
 *
 * · DIE TIEFE STIMMT NICHT. z0 -1,35 mit Tiefe 2,4 legt die erlaubte Spanne
 *   z 0,35–0,65 auf Welt-z -0,51 bis 0,21. Die Werke wanderten damit um
 *   0,81 (hintere Kante) bis 0,41 (vordere Kante) nach hinten — genau das,
 *   was der Auftrag verbietet. Einmal rot vorgeführt: mit den Zahlen des
 *   Auftrags meldet buehne.test.mjs „z 0.35 ergibt -0.51, erwartet 0.3".
 *
 * WARUM ES MIT z0 = -1,35 (ODER -1,15) NICHT GEHT, und das ist kein Geschmack,
 * sondern Arithmetik: der Datenbank-Trigger `heft_buehne_pruefen` erzwingt für
 * Werke z zwischen 0,35 und 0,65. Damit diese Spanne auf die heutigen Welt-z
 * 0,30 bis 0,62 fällt, ist die Tiefe festgelegt auf (0,62-0,30)/(0,65-0,35)
 * = 1,067 und z0 auf 0,30 - 0,35·1,067 = -0,073. Setzt man z0 stattdessen auf
 * die Rückwand (-1,15), ergibt sich für z 0,35 die Welt-z -0,40 — die Werke
 * stehen dann hinter ihrer heutigen Stelle, egal welche Tiefe man wählt.
 *
 * BEIDE ZIELE ZUGLEICH — „z=0 ist die Rückwand" UND „Werke bleiben, wo sie
 * sind" — sind also unerfüllbar. Weil der Trigger die Spanne festnagelt und der
 * Auftrag das Aussehen festnagelt, gewinnt das Aussehen: BUEHNE beschreibt die
 * STELLFLÄCHE, nicht den ganzen Aufbau. Die Rückwand steht weiterhin bei
 * Welt-z -1,15 (world.mjs:197) und liegt damit außerhalb dieses Feldes.
 */
export const BUEHNE = {breite: 5.6, tiefe: 1.067, z0: -0.073};

/** Waagerecht: 0 ist links, 1 ist rechts, 0,5 die Mitte. */
export const buehneX = (x) => (x - 0.5) * BUEHNE.breite;

/** In die Tiefe: 0 ist hinten, 1 ist vorn. */
export const buehneZ = (z) => BUEHNE.z0 + z * BUEHNE.tiefe;

/**
 * Die Rueckrichtung — vom Welt-Punkt zurueck auf 0..1 (B6).
 *
 * Sie ist der Kern des Ziehens: der Strahl aus dem Finger trifft die Stellflaeche in
 * WELT-Koordinaten, gespeichert wird aber in 0..1. Ohne Umkehrung muesste die Formel
 * ein zweites Mal hingeschrieben werden — und zwei Fassungen derselben Rechnung sind
 * zwei Wahrheiten, von denen eine irgendwann falsch wird.
 */
export const ausBuehneX = (weltX) => weltX / BUEHNE.breite + 0.5;
export const ausBuehneZ = (weltZ) => (weltZ - BUEHNE.z0) / BUEHNE.tiefe;

/**
 * Die Spanne des Hoehenschiebers (B7). 0,3 m ist eine Vase, 4,0 m ein Wandbild —
 * darueber hinaus steht nichts mehr auf einer Buehne, es haengt daneben.
 */
export const HOEHE = {von: 0.3, bis: 4.0};

/**
 * Die Grenzen der Ebene 2. Sie stehen NICHT hier zur Wahl — der Trigger
 * `heft_buehne_pruefen` wirft `werk_nicht_auf_ebene_zwei`, sobald ein Stück
 * darunter oder darüber liegt. Diese Zahlen bilden ihn nach, damit die
 * Oberfläche den Fehler verhindert statt ihn durchzureichen.
 */
export const EBENE_ZWEI = {von: 0.35, bis: 0.65};

/** Wie viele Werke eine Bühne braucht, bevor sie veröffentlicht werden darf. */
export const WERKE_MINDESTENS = 3;

/**
 * 1 hinten · 2 die Werke · 3 vorn. Deko liegt nie auf 2, ein Werk nie daneben.
 */
export function ebeneVon(z) {
  if (z < EBENE_ZWEI.von) return 1;
  if (z > EBENE_ZWEI.bis) return 3;
  return 2;
}

const fest = (wert, von, bis) => Math.min(bis, Math.max(von, wert));

/**
 * Die Klemme beim Ziehen (B6). Sie hält, sie federt nicht zurück: wer gegen sie
 * zieht, dessen Stück bleibt stehen. Ein Sprung zurück läse sich wie ein Fehler.
 */
export function klemmeStueck(stueck) {
  return {
    ...stueck,
    x: fest(stueck.x, 0, 1),
    z: fest(stueck.z, EBENE_ZWEI.von, EBENE_ZWEI.bis),
  };
}

/** Deko darf überall stehen, nur nicht auf der Ebene der Werke. */
export function klemmeDeko(deko, ebene) {
  const z = ebene === 'vorn'
    ? fest(deko.z, EBENE_ZWEI.bis + 0.01, 1)
    : fest(deko.z, 0, EBENE_ZWEI.von - 0.01);
  return {...deko, x: fest(deko.x, 0, 1), z};
}

/**
 * Die Hoehe eines Stuecks setzen (B7).
 *
 * Geklemmt wie alles andere: der Schieber kann nur 0,3–4,0 anbieten, aber er ist nicht
 * die einzige Tuer — `auf.gestellt` kommt auch aus dem Ziehen, und eine Zeile aus der
 * Datenbank kann alles enthalten. Geklemmt wird deshalb HIER, nicht in der Oberflaeche.
 */
export function mitHoehe(stueck, meter) {
  const h = Number(meter);
  if (!Number.isFinite(h)) return stueck;
  return {...stueck, hoehe_m: Math.round(fest(h, HOEHE.von, HOEHE.bis) * 100) / 100};
}

/**
 * Traegt dieses Werk einen GELIEHENEN Aufsteller? (B8)
 *
 * Die Bedingung „Werk ohne cutout_url" greift nie — drei von vier Werken haben einen,
 * nur zeigt er auf ein Beispielbild des Prototyps unter /heft/assets/. Genau das ist
 * die Bedingung: kein Freisteller ODER einer aus dem Beispielvorrat.
 */
export function geliehenerAufsteller(produkt) {
  const url = produkt?.dna?.heft?.cutout_url ?? produkt?.cutout ?? produkt?.image ?? '';
  if (!url) return true;
  return /(^|\/)heft\/assets\//.test(String(url));
}

/**
 * Was dem Veröffentlichen noch fehlt — VORHER, nicht als Datenbankfehler.
 *
 * Der Trigger wirft `buehne_braucht_drei_werke` und `werk_nicht_auf_ebene_zwei`.
 * Beides ist für den Menschen davor unsichtbar, wenn niemand es ihm sagt. Mit
 * dem heutigen Bestand trifft das JEDES Haus: `drape` hat je Welt ein Werk.
 */
export function fehltZumVeroeffentlichen(buehne) {
  const stuecke = buehne?.stuecke ?? [];
  const gruende = [];
  const fehlende = WERKE_MINDESTENS - stuecke.length;
  if (fehlende > 0) {
    gruende.push(fehlende === 1
      ? 'noch 1 Werk bis zum Veröffentlichen'
      : `noch ${fehlende} Werke bis zum Veröffentlichen`);
  }
  const daneben = stuecke.filter((s) => ebeneVon(s.z) !== 2).length;
  if (daneben > 0) {
    gruende.push(daneben === 1
      ? 'ein Werk liegt nicht auf der mittleren Ebene'
      : `${daneben} Werke liegen nicht auf der mittleren Ebene`);
  }
  return gruende;
}

/**
 * Der Platz eines Stuecks — alles, was world.mjs zum Hinstellen braucht,
 * ohne eine einzige Zeile THREE.
 *
 * Damit ist die Rechnung pruefbar und nur noch das Hinstellen selbst nicht.
 * `produkt` ist der Eintrag aus products[] (adapters.mjs legt ihn unter row.id
 * ab, deshalb ist werk_id die UUID und kein Slug).
 *
 * Die Reihenfolge der Hoehe ist die aus dem Auftrag und sie hat einen Grund:
 * stuecke[].hoehe_m ist die AUSNAHME, die diese eine Buehne kennt;
 * product_dna.heft.hoehe ist die REGEL, die das Werk ueberallhin mitnimmt.
 * Die Ausnahme gewinnt, die Regel bleibt stehen.
 */
export function platzFuer(stueck, produkt) {
  const k = klemmeStueck(stueck);
  return {
    x: buehneX(k.x),
    z: buehneZ(k.z),
    lift: produkt?.stage?.lift ?? 0.17,
    hoehe: stueck.hoehe_m || produkt?.stage?.h || 2.6,
    drehung: (stueck.drehung || 0) * Math.PI / 180,
  };
}

/**
 * Was beim Schreiben einer Buehne wirklich in die Zeile geht (B4).
 *
 * DER VERSIONSRIEGEL IST DER PUNKT. Wer zwei Fenster offen hat, soll nicht
 * stillschweigend das aeltere gewinnen lassen. Geschrieben wird deshalb mit
 * einer Bedingung auf die Version, die beim Lesen galt — trifft sie keine
 * Zeile, hat jemand anderes dazwischen geschrieben, und der Aufrufer erfaehrt
 * es, statt dass eine Aenderung lautlos verschwindet.
 *
 * Die Stuecke werden dabei GEKLEMMT, nicht nur geprueft: was hier durchgeht,
 * darf vom Trigger heft_buehne_pruefen nicht mehr abgelehnt werden.
 */
export function schreibEntwurf(entwurf) {
  const gelesen = Number.isFinite(entwurf?.version) ? entwurf.version : 0;
  return {
    bedingung: {id: entwurf?.id, version: gelesen},
    zeile: {
      layout: entwurf?.layout ?? 'fan',
      kicker: entwurf?.kicker ?? null,
      titel: entwurf?.titel ?? null,
      text: entwurf?.text ?? null,
      boden: entwurf?.boden ?? {},
      ruecken: entwurf?.ruecken ?? {papier: 'weiss'},
      licht: entwurf?.licht ?? {},
      stuecke: (entwurf?.stuecke ?? []).map(klemmeStueck),
      deko: entwurf?.deko ?? [],
      eigenhaendig: entwurf?.eigenhaendig === true,
      version: gelesen + 1,
    },
  };
}

/**
 * Das erste Ziehen macht die Buehne eigenhaendig (B6) — danach raeumt keine
 * automatische Komposition mehr auf. Was von Hand gestellt wurde, bleibt
 * gestellt; sonst waere jede Muehe beim naechsten Aufschlagen weg.
 */
export function nachDemZiehen(entwurf, stueckIndex, position) {
  const stuecke = (entwurf?.stuecke ?? []).map((s, i) =>
    i === stueckIndex ? klemmeStueck({...s, ...position}) : s);
  return {...entwurf, stuecke, layout: 'frei', eigenhaendig: true};
}

/**
 * Deko auf die Ebenen verteilen (B2).
 *
 * `katalog` ist heft_deko nach `key`. Er liefert `ebene` ('hinten'|'vorn'),
 * `cutout_url` und `seitenverhaeltnis` — letzteres spart das Nachmessen am
 * Bild, die Hoehen liegen auf derselben Skala wie die der Werke.
 *
 * WAS NICHT IM KATALOG STEHT, ERSCHEINT NICHT. Kein Platzhalter, kein
 * graues Rechteck: ein Aufsteller ohne Freistellung ist kein Aufsteller.
 * Dasselbe Gesetz wie bei den leeren Abschnitten der Archetypen-Seite.
 *
 * Die Ebene entscheidet der KATALOG, nicht die Zeile der Buehne — sonst
 * stuende eine Wand ploetzlich vor dem Mantel. Die Zeile darf nur noch
 * innerhalb ihrer Ebene schieben, und klemmeDeko haelt sie dort.
 */
export function dekoNachEbenen(deko = [], katalog = {}) {
  const hinten = [], vorn = [];
  for (const eintrag of deko) {
    const k = katalog[eintrag?.key];
    if (!k || !k.cutout_url) continue;
    const ebene = k.ebene === 'vorn' ? 'vorn' : 'hinten';
    const geklemmt = klemmeDeko(eintrag, ebene);
    (ebene === 'vorn' ? vorn : hinten).push({
      id: 'deko:' + eintrag.key,
      cutout: k.cutout_url,
      ratio: k.seitenverhaeltnis || undefined,
      x: buehneX(geklemmt.x),
      z: buehneZ(geklemmt.z),
      hoehe: eintrag.hoehe_m || k.hoehe_m || 1.7,
      drehung: (eintrag.drehung || 0) * Math.PI / 180,
    });
  }
  // Hinten zuerst zeichnen, damit die vordere Ebene wirklich davor liegt.
  return {hinten, vorn};
}
