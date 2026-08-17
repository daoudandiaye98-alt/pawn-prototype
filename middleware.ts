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
import { istBekannteRoute, istPlattformOderDatei } from "./routen";

/*
 * Das Muster — drei Fassungen, zwei Messungen, ein Schluss.
 *
 *   1. Sonde, `matcher: ["/__sonde-middleware"]`      → lief (Antwort kam)
 *   2. `matcher: ["/((?!_vercel|assets|api).*)"]`     → 404 kam nicht
 *   3. gar kein `config`                              → 404 kam nicht,
 *      und der Lauf gegen die Vorschau von 996d7d7 belegt warum:
 *      „Keine Kopfzeile x-pawn-404" — die Middleware lief für diese Anfrage
 *      überhaupt nicht.
 *
 * Ich hatte Fassung 3 gebaut, weil ein Muster, das man nicht braucht, weg
 * gehört. Das war falsch herum gedacht: gemessen ist, dass DIESES Projekt eine
 * Middleware ohne Muster gar nicht erst aufruft. Also kommt das Muster zurück —
 * nicht als Filter, sondern als Anmeldung.
 *
 * `"/:pfad*"` ist gewöhnliche Pfad-Syntax und trifft jede Adresse samt Wurzel.
 * Bewusst KEINE negative Vorschau wie in Fassung 2: die ist der einzige andere
 * Verdächtige, und man ändert nicht zwei Dinge auf einmal. Das Aussortieren von
 * Dateien und Plattform-Adressen bleibt, wo es geprüft ist — in
 * `istPlattformOderDatei`.
 */
export const config = { matcher: ["/:pfad*"] };

export default async function middleware(request: Request): Promise<Response | undefined> {
  const pfad = new URL(request.url).pathname;

  if (istPlattformOderDatei(pfad)) return undefined;
  if (istBekannteRoute(pfad)) return undefined;

  /*
   * Die Hülle noch einmal holen — dieselbe Datei, die die Umschreibung
   * geliefert hätte, nur mit anderem Statuscode. `/index.html` trägt einen
   * Punkt und fällt damit oben aus der Prüfung: keine Schleife.
   */
  let huelle: Response;
  try {
    huelle = await fetch(new URL("/index.html", request.url), { headers: { accept: "text/html" } });
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
  return new Response(null, {
    headers: { "x-middleware-next": "1", "x-pawn-404": grund },
  });
}
