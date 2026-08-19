/**
 * Erzeugt `vercel.json` aus `routen.js`.
 *
 * **Warum das hier steht.** Die 404 sollte aus einer Middleware kommen. Sieben
 * Fassungen und sieben Läufe gegen die eigene Vorschau haben gezeigt, dass diese
 * Datei auf diesem Projekt nicht ausgelöst wird — auch nicht in der
 * dokumentierten Nicht-Next-Fassung mit `next()` aus `@vercel/functions`, auch
 * nicht bei nicht gesetztem Root Directory. Warum, weiß ich bis heute nicht.
 * Statt einen achten Versuch daran zu hängen, macht es diese Datei ohne sie:
 * `vercel.json` kann den Statuscode selbst setzen, wenn statt `rewrites` die
 * ältere `routes`-Form benutzt wird.
 *
 * **Der Ablauf.** `handle: filesystem` liefert erst alles, was es als Datei
 * wirklich gibt (Bündel, Bilder, Schriften). Danach bekommt jede Adresse, die
 * `routen.js` kennt, die Hülle mit 200. Was übrig bleibt, bekommt dieselbe
 * Hülle mit **404**: der Mensch sieht unverändert die Seite mit dem Weg zurück,
 * die Suchmaschine sieht die Wahrheit.
 *
 * **Warum erzeugt und nicht von Hand gepflegt.** `vercel.json` liest die
 * Plattform, BEVOR gebaut wird — die Datei kann also nicht während des Baus
 * entstehen und muss eingecheckt sein. Zwei Listen derselben Adressen wären
 * genau die Doppelung, die der Umzug verbietet. Deshalb: `routen.js` bleibt die
 * eine Wahrheit, diese Datei schreibt sie um, und `vercel-routen.spec.ts`
 * schlägt fehl, sobald das Eingecheckte nicht mehr dazu passt.
 *
 *   node tools/vercel-routen.mjs          → schreibt vercel.json
 *   node tools/vercel-routen.mjs --pruefen → nur vergleichen (Rückgabewert 1)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROUTEN, UMZUEGE } from "../routen.js";

/**
 * Eine Adresse aus dem Register in einen Regex-Ausdruck übersetzen.
 *
 * `:name` steht für genau einen nicht-leeren Abschnitt — dieselbe Regel wie in
 * `passt()` in `routen.js`. Alles andere wird wörtlich genommen und muss dafür
 * entschärft werden: ein Punkt in einer Adresse ist ein Punkt, kein Platzhalter.
 */
function alsMuster(route) {
  const teile = route.split("/").filter((t) => t.length > 0);
  if (teile.length === 0) return "^/$";
  const ausdruck = teile
    .map((t) => (t.startsWith(":") ? "[^/]+" : t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  /* Der abschließende Schrägstrich ist erlaubt: /mode und /mode/ sind dieselbe
     Seite, und ein 404 für die Schreibweise mit Strich wäre eine Falle. */
  return `^/${ausdruck}/?$`;
}

/**
 * Ein Umzug als Weiterleitungs-Regel: `:name` wird gefangen und im Ziel wieder
 * eingesetzt. 301, weil die alten Adressen dauerhaft umgezogen sind (X1).
 */
function alsUmzug(u) {
  const teile = u.von.split("/").filter((t) => t.length > 0);
  const namen = [];
  const ausdruck = teile
    .map((t) => {
      if (t.startsWith(":")) { namen.push(t.slice(1)); return "([^/]+)"; }
      return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  let ziel = u.nach;
  namen.forEach((n, i) => { ziel = ziel.replace(`:${n}`, `$${i + 1}`); });
  return {
    src: teile.length === 0 ? "^/$" : `^/${ausdruck}/?$`,
    status: 301,
    headers: { Location: ziel },
  };
}

export function baueVercelJson() {
  return {
    /*
     * Kein erklärender Schlüssel in der Datei: `vercel.json` wird gegen ein
     * festes Schema geprüft, und ein unbekannter Schlüssel macht sie ungültig —
     * das legt die Auslieferung lahm. Der Hinweis steht deshalb hier oben und
     * in `tools/pruefstand/README.md`, nicht im Erzeugnis.
     */
    routes: [
      /* Erst die echten Dateien: Bündel, Bilder, Schriften, robots.txt. Ohne
         diese Zeile bekäme jede davon die Hülle statt ihres Inhalts. */
      { handle: "filesystem" },
      /* Dann die Umzüge (X1): 301 gewinnt gegen die 200-Regel derselben
         Adresse, weil Vercel die Liste von oben abarbeitet. */
      ...UMZUEGE.map(alsUmzug),
      /* Jede bekannte Adresse: die Hülle, Status 200 wie bisher. */
      ...ROUTEN.map((r) => ({ src: alsMuster(r), dest: "/index.html" })),
      /* Alles Übrige: dieselbe Hülle, aber ehrlich beschriftet. `no-store`, weil
         die Adresse morgen ein Werk sein kann. */
      {
        src: "/.*",
        dest: "/index.html",
        status: 404,
        headers: { "cache-control": "no-store", "x-pawn-404": "vercel-json" },
      },
    ],
  };
}

const ziel = new URL("../vercel.json", import.meta.url);

/**
 * Der Befehlsteil läuft NUR, wenn diese Datei direkt aufgerufen wird.
 *
 * Die Wache (`vercel-routen.spec.ts`) importiert `baueVercelJson()`. Ohne diese
 * Schwelle schriebe schon der Import die Datei neu — ein Test, der sein eigenes
 * Prüfobjekt herstellt, kann nichts mehr widerlegen.
 */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const inhalt = JSON.stringify(baueVercelJson(), null, 2) + "\n";
  if (process.argv.includes("--pruefen")) {
    if (readFileSync(ziel, "utf8") !== inhalt) {
      console.error("vercel.json passt nicht mehr zu routen.js — `node tools/vercel-routen.mjs` laufen lassen.");
      process.exit(1);
    }
    console.log("vercel.json ist auf dem Stand von routen.js.");
  } else {
    writeFileSync(ziel, inhalt);
    console.log(`vercel.json geschrieben — ${ROUTEN.length} bekannte Adressen + Auffang mit 404.`);
  }
}
