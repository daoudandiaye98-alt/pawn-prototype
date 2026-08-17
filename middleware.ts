/**
 * Die echte 404 — K7, Kontrolle 4.5.
 *
 * **Der Fehler.** `vercel.json` schreibt jede Adresse auf die SPA um, damit
 * React Router sie übernehmen kann. Die Umschreibung liefert dabei die Hülle
 * mit **Status 200** — auch für `/gibtesnicht-4d9f21`. Der Besucher sieht die
 * „Seite nicht gefunden"-Seite und hält sie für richtig; eine Suchmaschine
 * sieht 200 und nimmt die erfundene Adresse in den Index auf. Gemessen im
 * Prüfstand: `4.5  /diese-seite-gibt-es-nicht-4d9f21 · gemessen Status 200 ·
 * soll Status 404`.
 *
 * **Warum es nur hier zu beheben ist.** Ein Statuscode steht in der ersten
 * Zeile der Antwort. Wenn React im Browser merkt, dass es die Adresse nicht
 * kennt, ist diese Zeile längst geschrieben. Nur die Middleware läuft VOR der
 * Umschreibung — dass sie das auf diesem Projekt wirklich tut, war eine
 * Behauptung, bis die Sonde `/__sonde-middleware` am 17.08.2026 mit
 * `middleware-laeuft` geantwortet hat (text/plain, Kopfzeile
 * `x-pawn-sonde: middleware`). Diese Datei ist die Sonde, ersetzt durch das,
 * wofür gemessen wurde.
 *
 * **Was hier passiert.** Kennt `routen.ts` die Adresse, geschieht nichts —
 * `undefined` heißt „weiter wie bisher", die Umschreibung greift, der Browser
 * bekommt seine Seite mit 200. Kennt sie sie nicht, wird dieselbe Hülle
 * geholt und mit **404** ausgeliefert: der Mensch sieht unverändert die Seite
 * mit dem Weg zurück, die Maschine sieht die Wahrheit.
 *
 * **Was hier NICHT passiert.** Keine Weiterleitung, keine eigene Fehlerseite,
 * kein Text. Eine zweite „nicht gefunden"-Seite neben `src/pages/NotFound.tsx`
 * wären zwei Fassungen derselben Sache — genau das, was der Umzug verbietet.
 */
/*
 * **Die Anmeldung — nach der Vercel-Doku für Nicht-Next-Projekte.**
 *
 * Sechs Läufe lang hat diese Datei nicht ausgelöst, und ich habe sechs Ursachen
 * behauptet und widerlegt: das Muster, den Import ohne Endung, den Import mit
 * `.js`-Endung, fehlende Kekse, fehlende Bypass-Kopfzeile, `routen` als `.ts`
 * hinter einem `.js`-Import. Keine davon war es. Was fehlte, stand die ganze
 * Zeit in der Doku und nicht in meinen Vermutungen:
 *
 *   - `next()` aus `@vercel/functions` ist das „weiter wie bisher" — nicht
 *     `undefined` und nicht eine selbstgebaute Antwort mit `x-middleware-next`.
 *   - `@vercel/functions` gehört als echte Abhängigkeit in die `package.json`.
 *
 * Vite ist dabei kein Ausschlussgrund; Routing-Middleware gibt es auch ohne
 * Next.js. Und das Root Directory des Projekts ist nicht gesetzt, also der
 * Repo-Stamm — diese Datei liegt richtig. Beides geprüft, nicht vermutet.
 */
import { next } from "@vercel/functions";
import { istBekannteRoute, istPlattformOderDatei } from "./routen.js";

/*
 * `routen.js` ist echtes JavaScript (Typen in `routen.d.ts`), damit der Import
 * wörtlich stimmt. Das war einer der sechs Versuche und hat den Fehler nicht
 * behoben — richtig ist es trotzdem: ein `./routen.js`, hinter dem in Wahrheit
 * ein `routen.ts` liegt, ist ein Kunstgriff, den nicht jeder Bündler
 * versprechen muss, und wenn er ihn nicht auflöst, verschwindet die Middleware
 * still statt den Build rot zu färben.
 *
 * `"/:pfad*"` trifft jede Adresse samt Wurzel. Das ist eine Anmeldung, kein
 * Filter — aussortiert wird unten in `istPlattformOderDatei`, wo es geprüft ist.
 */
export const config = { matcher: ["/:pfad*"] };

export default async function middleware(request: Request): Promise<Response> {
  const pfad = new URL(request.url).pathname;

  if (istPlattformOderDatei(pfad)) return next();
  if (istBekannteRoute(pfad)) return next();

  /*
   * Die Hülle noch einmal holen — dieselbe Datei, die die Umschreibung
   * geliefert hätte, nur mit anderem Statuscode. `/index.html` trägt einen
   * Punkt und fällt damit oben aus der Prüfung: keine Schleife.
   *
   * **Der Ausweis des Besuchers kommt mit.** Ohne ihn ist dieser Nachschlag eine
   * anonyme Anfrage — und auf einer gesperrten Vorschau weist die Sperre eine
   * anonyme Anfrage ab. Die Middleware fällt dann jedes Mal auf „weiter wie
   * bisher" zurück, obwohl sie läuft.
   *
   * Welcher Ausweis das ist, hängt vom Besucher ab, und genau daran scheiterte
   * 24cbe64: ein Mensch im Browser trägt einen Keks, der Prüfstand dagegen
   * weist sich per Kopfzeile aus (`x-vercel-protection-bypass`, siehe
   * `tools/pruefstand/lauf.ts`). Nur die Kekse weiterzugeben half ihm also
   * nichts. Deshalb gehen alle Ausweise mit, soweit vorhanden.
   *
   * Auf pawn.vision fällt nichts davon auf, weil dort nichts gesperrt ist —
   * dieser Fehler lebt ausschließlich auf der Vorschau.
   *
   * Sachlich richtig ist die Weitergabe ohnehin: die Hülle wird für DIESEN
   * Besucher geholt, also mit seiner Kennung, nicht mit keiner.
   */
  const nachschlagKopf: Record<string, string> = { accept: "text/html" };
  for (const name of ["cookie", "authorization", "x-vercel-protection-bypass"]) {
    const wert = request.headers.get(name);
    if (wert) nachschlagKopf[name] = wert;
  }
  let huelle: Response;
  try {
    huelle = await fetch(new URL("/index.html", request.url), { headers: nachschlagKopf });
  } catch (fehler) {
    /*
     * Alles bleibt wie bisher: 200 mit der Hülle aus der Umschreibung. Das ist
     * der heutige Zustand — schlechter wird es dadurch nie. Die Kopfzeile sagt,
     * dass es diesen Weg gab, damit ein stiller Rückfall nicht als Erfolg
     * durchgeht.
     */
    return weiter(`fehler-${(fehler as Error).name}`);
  }
  if (!huelle.ok) return weiter(`huelle-${huelle.status}`);

  return new Response(huelle.body, {
    status: 404,
    headers: {
      "content-type": huelle.headers.get("content-type") ?? "text/html; charset=utf-8",
      /* Eine 404 gehört nicht in den Zwischenspeicher: die Adresse kann morgen
         ein Werk sein. */
      "cache-control": "no-store",
      /* Damit der Prüfstand — und jeder Mensch mit `curl -I` — sieht, dass die
         404 aus dieser Datei kommt und nicht aus einem Zufall. */
      "x-pawn-404": "middleware",
    },
  });
}

/**
 * Weiter wie bisher — aber nicht stumm.
 *
 * Vercel übernimmt die Kopfzeilen einer Antwort mit `x-middleware-next: 1`,
 * lässt die Anfrage aber weiterlaufen. So steht im Protokoll, dass die
 * Middleware lief und **warum** sie keine 404 gesetzt hat. Ohne diese Spur
 * sähe „Status 200" identisch aus, egal ob die Middleware gar nicht lief oder
 * ob sie lief und an der Hülle scheiterte — zwei Fehler, zwei Behebungen.
 *
 * Was die Spur NICHT beweist: bleibt die Kopfzeile aus, kann das heißen „lief
 * nicht" oder „lief, ging weiter, und Vercel hat die Kopfzeile beim
 * Weiterreichen verworfen". Beides sähe gleich aus. Solange die 404 nicht
 * ankommt, ist das kein Unterschied, der die Behebung ändert — kommt sie an,
 * erübrigt sich die Frage.
 */
function weiter(grund: string): Response {
  /*
   * Auch der Rücktritt geht über `next()` — nicht über eine selbstgebaute
   * Antwort mit `x-middleware-next`. Diese Kopfzeile von Hand zu setzen war
   * einer der sechs Irrtümer: sie ist Vercels Innenleben, nicht unsere Schnur.
   *
   * Der Grund steht zusätzlich im Protokoll. Die Kopfzeile ist der Weg nach
   * außen, für den Prüfstand und für `curl -I`; ob sie auf dem Weiter-Pfad
   * durchgereicht wird, ist ungeprüft. Ein stiller Rückfall, der niemandem
   * etwas sagt, ist genau die Sorte Ausnahme, die der Umzug verbietet.
   */
  console.warn(`[pawn-404] weiter statt 404 — Grund: ${grund}`);
  return next({ headers: { "x-pawn-404": grund } });
}
