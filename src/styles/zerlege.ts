/**
 * Teil B1 — der Wort-Spalter.
 *
 * Neverland zerlegt Text schon im Markup: jedes Wort ein eigenes Element, das
 * einzeln verschoben werden kann. Ohne das gibt es keine wortweise Staffelung —
 * ein Textknoten hat keine Teile, die man bewegen könnte.
 *
 * **Die drei Regeln, die das Ganze tragen:**
 *
 * 1. **Leerzeichen bleiben AUSSERHALB der Hüllen.** Läge das Leerzeichen im
 *    Span, wäre es Teil eines `inline-block` — und ein `inline-block` bricht
 *    nicht in seiner Mitte um. Der Satz verlöre seinen natürlichen Umbruch und
 *    liefe an schmalen Stellen aus der Seite.
 *
 * 2. **Vorlesehilfen hören den ganzen Satz, nie die Teile.** Zerhackter Text
 *    wird Wort für Wort mit Pausen vorgelesen — für sehende Leser unsichtbar,
 *    für hörende eine Zumutung. Deshalb bekommt das Elternelement den
 *    vollständigen Text als `aria-label` und die Teile werden `aria-hidden`.
 *
 * 3. **Einmal beim Aufbau, nie im Scroll.** Das Zerlegen schreibt DOM; im
 *    Bild-Takt getan wäre es der teuerste Fehler, den man machen kann.
 *
 * Die Datei hängt an nichts aus diesem Projekt — sie kann als Bibliothek
 * weiterwandern (dasselbe Ziel wie `bewegung.css`).
 */

/** Woran man erkennt, dass ein Element bereits zerlegt wurde. */
const FERTIG = "data-zerlegt";

export interface ZerlegeErgebnis {
  /** Die Hüllen in Lesereihenfolge — für die Staffelung. */
  teile: HTMLElement[];
  /** Macht die Zerlegung rückgängig und stellt den ursprünglichen Text her. */
  zurueck: () => void;
}

/**
 * Wickelt jedes Wort (oder jedes Zeichen) in eine eigene Hülle.
 *
 * @param element  Das Element mit dem Text. Sein Inhalt muss reiner Text sein —
 *                 verschachtelte Auszeichnung wird NICHT zerlegt, sondern
 *                 unangetastet gelassen (siehe unten).
 * @param art      `"wort"` für Fließtext und Schlagzeilen, `"zeichen"` nur für
 *                 Cover-Zeilen. Zeichenweise Staffelung über einem ganzen Absatz
 *                 ergibt hunderte Elemente und sieht aus wie ein Ladefehler.
 */
export function zerlege(
  element: HTMLElement,
  art: "wort" | "zeichen" = "wort",
): ZerlegeErgebnis {
  /* Schon zerlegt: die vorhandenen Hüllen zurückgeben, nichts doppelt tun. */
  if (element.hasAttribute(FERTIG)) {
    return {
      teile: [...element.querySelectorAll<HTMLElement>("[data-teil]")],
      zurueck: () => {},
    };
  }

  /*
   * Nur reiner Text wird zerlegt.
   *
   * Ein Element mit Auszeichnung darin (ein Link, eine Kursive) würde beim
   * Zerlegen seine Struktur verlieren — aus einem Link mitten im Satz würden
   * drei Wörter ohne Ziel. Solche Stellen bleiben ganz und bewegen sich als
   * EIN Teil; das ist die ehrlichere Bewegung, nicht die ärmere.
   */
  const nurText = [...element.childNodes].every((n) => n.nodeType === Node.TEXT_NODE);
  const ganzerText = (element.textContent ?? "").trim();
  if (!nurText || ganzerText.length === 0) {
    return { teile: [element], zurueck: () => {} };
  }

  const vorher = element.innerHTML;

  /*
   * Aufteilen — und die Trenner MITNEHMEN.
   *
   * `split(/(\s+)/)` behält die Leerzeichen als eigene Stücke. Sie werden als
   * nackte Textknoten wieder eingesetzt, also außerhalb der Hüllen: der Umbruch
   * bleibt dem Browser überlassen, wie in Regel 1 verlangt.
   */
  const stuecke = art === "wort"
    ? ganzerText.split(/(\s+)/)
    : [...ganzerText].map((z) => z);

  const teile: HTMLElement[] = [];
  const bruch = document.createDocumentFragment();

  for (const stueck of stuecke) {
    if (stueck.length === 0) continue;
    if (/^\s+$/.test(stueck)) {
      bruch.appendChild(document.createTextNode(stueck));
      continue;
    }
    const huelle = document.createElement("span");
    huelle.setAttribute("data-teil", "");
    huelle.setAttribute("aria-hidden", "true");
    huelle.style.display = "inline-block";
    huelle.style.willChange = "transform";
    huelle.textContent = stueck;
    bruch.appendChild(huelle);
    teile.push(huelle);
    /* Zeichenweise: das Leerzeichen steht nicht im Stück, sondern zwischen
       ihnen — es muss hier eingesetzt werden, sonst klebt das Wort zusammen. */
    if (art === "zeichen" && stueck === " ") continue;
  }

  /* Regel 2: der ganze Satz für das Ohr, die Teile nur für das Auge. */
  const hatteLabel = element.hasAttribute("aria-label");
  if (!hatteLabel) element.setAttribute("aria-label", ganzerText);
  element.setAttribute(FERTIG, art);
  element.replaceChildren(bruch);

  return {
    teile,
    zurueck: () => {
      element.innerHTML = vorher;
      element.removeAttribute(FERTIG);
      if (!hatteLabel) element.removeAttribute("aria-label");
    },
  };
}
