/**
 * Teil B2 — wer wann auftritt.
 *
 * Diese Datei verteilt nur Verzögerungen und setzt Merkmale; die Bewegung
 * selbst steht in `auftritt.css`. Das ist Absicht: eine Choreografie, die in
 * JavaScript Bild für Bild rechnet, kostet auf einem Telefon mehr als sie wert
 * ist — und sie ließe sich nicht mit einer Medienabfrage abbestellen.
 *
 * **Einmal je Blatt und Sitzung.** Wer zurückblättert, hat die Seite schon
 * gesehen; ein zweiter Auftritt wäre eine Behauptung, es sei etwas Neues
 * gekommen. Der Merker liegt in `sessionStorage`: neue Sitzung, neuer Auftritt.
 */
import { zerlege } from "./zerlege";

const MERKER = "pawn.auftritt.v1";

/** Die Stufen in Reihenfolge. Jede Stufe wartet, bis die vorige durch ist. */
interface Stufe {
  /** Woran man die Elemente dieser Stufe erkennt. */
  wahl: string;
  art: "hebt" | "atmet";
  /** Wortweise/zeichenweise zerlegen, bevor gestaffelt wird? */
  zerlegen?: "wort" | "zeichen";
  /** Abstand zwischen den Teilen dieser Stufe, als Token-Name. */
  staffel?: "--staffel-wort" | "--staffel-zeichen" | "--staffel-karte";
}

/**
 * Die Reihenfolge aus B2 — Kicker, Schlagzeile, Zeilen, Bilder.
 *
 * Bilder stehen zuletzt in der Liste, aber sie starten bei 0: ein Bild, das
 * nach dem Text käme, ließe die Seite zweimal ankommen. Sie tragen die
 * Choreografie, sie folgen ihr nicht — deshalb bekommen sie keinen Vorlauf.
 */
const STUFEN: Stufe[] = [
  { wahl: ".hx-kicker", art: "hebt" },
  { wahl: ".hx-schlagzeile", art: "hebt", zerlegen: "wort", staffel: "--staffel-wort" },
  /* `:not(.hx-kicker)`: der Kicker steht auf dem Umschlag INNERHALB der
     Haltung und gehört schon zur ersten Stufe. */
  { wahl: ".hx-cover-haltung p:not(.hx-kicker)", art: "hebt", zerlegen: "zeichen", staffel: "--staffel-zeichen" },
  {
    wahl: ".hx-vorspann, .hx-fliesstext, .hx-bildunterschrift, .hx-welt-zeile,"
      + " .hx-inhalt-zeile, .hx-werk-zeile, .hx-haus-zeile",
    art: "hebt",
    staffel: "--staffel-karte",
  },
  { wahl: ".hx-platte img, .hx-kapitel-platte img", art: "atmet" },
];

function zahl(stil: CSSStyleDeclaration, name: string, ersatz: number): number {
  const roh = stil.getPropertyValue(name).trim();
  if (roh.endsWith("ms")) return parseFloat(roh);
  if (roh.endsWith("s")) return parseFloat(roh) * 1000;
  return ersatz;
}

/**
 * Lässt eine Szene auftreten.
 *
 * @param wurzel     Das Element der Szene.
 * @param schluessel Ihr Schlüssel — der Merker hängt daran.
 * @returns `true`, wenn wirklich etwas aufgetreten ist.
 */
export function auftreten(wurzel: HTMLElement, schluessel: string): boolean {
  let gesehen: string[] = [];
  try { gesehen = JSON.parse(sessionStorage.getItem(MERKER) ?? "[]"); } catch { /* egal */ }
  if (gesehen.includes(schluessel)) return false;

  const stil = getComputedStyle(document.documentElement);
  const block = zahl(stil, "--dauer-block", 700);

  /* Vorlauf je Stufe: die nächste beginnt, wenn die vorige ihre Teile
     losgeschickt hat — nicht erst, wenn sie fertig ist. Sonst dauert eine
     Doppelseite mit vier Stufen mehrere Sekunden, und das ist kein Auftritt
     mehr, sondern eine Wartezeit. */
  let vorlauf = 0;

  for (const stufe of STUFEN) {
    /*
     * Wer schon eine Stufe hat, bekommt keine zweite.
     *
     * Gemessen: der Kicker des Umschlags liegt innerhalb der Haltung und wurde
     * von zwei Stufen erfasst — er bewegte sich als Ganzes UND zeichenweise.
     * Die Wahl ist inzwischen enger, aber die Wache bleibt: Auswahlausdrücke
     * überschneiden sich, sobald jemand eine Sektion umbaut, und dann sieht man
     * eine doppelte Bewegung, ohne zu wissen, woher sie kommt.
     */
    const treffer = [...wurzel.querySelectorAll<HTMLElement>(stufe.wahl)]
      .filter((el) => !el.hasAttribute("data-auftritt") && !el.hasAttribute("data-zerlegt"));
    if (treffer.length === 0) continue;

    const schritt = stufe.staffel ? zahl(stil, stufe.staffel, 50) : 0;
    let n = 0;

    for (const el of treffer) {
      const teile = stufe.zerlegen ? zerlege(el, stufe.zerlegen).teile : [el];
      /* Zerlegt: das Elternelement selbst darf nicht auch noch animieren,
         sonst bewegt sich alles zweimal. */
      if (stufe.zerlegen && teile[0] !== el) el.style.opacity = "1";

      for (const teil of teile) {
        teil.style.setProperty("--verzug", `${vorlauf + n * schritt}ms`);
        teil.setAttribute("data-auftritt", stufe.art);
        if (teile.length > 1 || stufe.staffel === "--staffel-karte") {
          teil.setAttribute("data-auftritt-teil", "");
        }
        /* Ein Bild, das sich vergrößert, braucht einen Rahmen, der schneidet. */
        if (stufe.art === "atmet") teil.parentElement?.setAttribute("data-auftritt-rahmen", "");
        n++;
      }
    }

    /* Bilder laufen parallel zum Text (s. o.), also schieben sie nichts. */
    if (stufe.art !== "atmet") vorlauf += Math.min(block, Math.max(schritt * n, block * 0.35));
  }

  try { sessionStorage.setItem(MERKER, JSON.stringify([...gesehen, schluessel])); } catch { /* egal */ }
  return true;
}
