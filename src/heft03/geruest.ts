/**
 * Das Geruest des Hefts — an EINER Stelle, fuer beide Huellen.
 *
 * WARUM ES DIESE DATEI GIBT. `app.js` greift auf feste Knoten zu
 * (`document.getElementById('mobile-reader')`, `#drawer-content`, `#hotspots`, …).
 * Diese Knoten stehen in `referenz/index.html`. HeftRoute03 schnitt sie sich
 * heraus — und `StudioHeft.tsx` rendert ein LEERES `<div>`. Darum war das Studio
 * leer: nicht, weil das Heft nicht lief, sondern weil es nichts zum Anfassen fand.
 * Zwei Huellen, ein Geruest, ein Ort.
 *
 * DIE EINE CSS-ZEILE, DIE DAS STUDIO ERST MOEGLICH MACHT — und sie ist gemessen,
 * nicht vermutet: Das Heft-CSS setzt 15-mal `position:fixed`, darunter
 * `#stage,#reader-layer{position:fixed;inset:0}`. In einem begrenzten Kasten
 * spannt sich ein solches Element ueber das FENSTER, nicht ueber den Kasten.
 * Gemessen in Chromium, 1280x900, Kasten 390x520:
 *
 *   ohne Einsperrung   fixed = 1280x900   → bricht aus, das Studio bliebe leer
 *   contain:paint      fixed =  390x520   → sitzt im Kasten
 *   transform:scale(1) fixed =  390x520   → sitzt auch, DARF ABER NICHT
 *
 * `transform` auf einem Vorfahren eroeffnet einen neuen 3D-Zeichenraum und
 * zerstoert damit die Perspektivrechnung des CSS3DRenderer (`dreiD.mjs`), der
 * die Doppelseite traegt. `contain:paint` macht den Kasten zum Bezugsrahmen,
 * ohne das Koordinatensystem anzutasten. Deshalb KASTEN_STIL und nicht scale().
 *
 * WAS DAMIT NICHT GEHEILT IST, damit es niemand fuer mehr haelt: `vw`/`vh`
 * beziehen sich weiter auf das Fenster. Die Vorschau auf 390 px zeigt die Buehne
 * richtig, aber jede vw-Regel (z. B. `#pawn-chat{width:min(392px,92vw)}`) rechnet
 * mit der Fensterbreite. Fuer das Stellen der Werke ist das ohne Belang, fuer eine
 * ehrliche Mobil-Vorschau nicht — die bleibt der Pruefstand.
 */
import geruestRoh from "./referenz/index.html?raw";

/**
 * Alles zwischen `<body>` und `</body>`, ohne den Starter der Vorschau und ohne
 * den Vorschau-Stempel (Entscheidung D6 — der Regler „Papier & Bewegung" bleibt).
 */
export const GERUEST: string = (() => {
  const anfang = geruestRoh.indexOf("<body");
  const ende = geruestRoh.lastIndexOf("</body>");
  const koerper = geruestRoh.slice(anfang, ende);
  return koerper
    .slice(koerper.indexOf(">") + 1)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<span class="prototype-badge">[\s\S]*?<\/span>/g, "")
    .trim();
})();

/** Die Klassen, die das Heft am `<body>` setzt und `stop()` wieder abraeumt. */
export const KOERPER_KLASSE = "is-intro";

/**
 * Der Stil, der `position:fixed` in den Kasten einsperrt. Siehe Dateikopf —
 * `contain:paint`, nie `transform`.
 */
export const KASTEN_STIL = { contain: "paint" } as const;

/** Ein Stylesheet in den Kopf haengen und zurueckgeben, damit es abraeumbar bleibt. */
export function stylesheet(href: string): HTMLLinkElement {
  const el = document.createElement("link");
  el.rel = "stylesheet";
  el.href = href;
  el.dataset.heft03 = "";
  document.head.appendChild(el);
  return el;
}
