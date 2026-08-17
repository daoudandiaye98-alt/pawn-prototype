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

export const config = {
  /*
   * Alles außer den Dingen, die es wirklich als Datei gibt. Der Ausschluss
   * steht doppelt: hier grob (damit Bilder und Skripte die Middleware gar
   * nicht erst wecken) und in `istPlattformOderDatei` genau. Ein Muster hier
   * ist eine Optimierung, kein Schutz — verlassen wird sich auf die Funktion.
   */
  matcher: "/((?!_vercel|assets|api).*)",
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const pfad = new URL(request.url).pathname;

  if (istPlattformOderDatei(pfad)) return undefined;
  if (istBekannteRoute(pfad)) return undefined;

  /*
   * Die Hülle noch einmal holen — dieselbe Datei, die die Umschreibung
   * geliefert hätte, nur mit anderem Statuscode. `/index.html` trägt einen
   * Punkt und fällt damit oben aus der Prüfung: keine Schleife.
   */
  const huelle = await fetch(new URL("/index.html", request.url), {
    headers: { accept: "text/html" },
  });

  /*
   * Wenn das Nachladen scheitert, bleibt alles wie bisher: 200 mit der Hülle.
   * Das ist der heutige Zustand — schlechter wird es dadurch nie. Eine leere
   * Seite oder ein Servertext wäre schlechter als eine falsche 200.
   */
  if (!huelle.ok) return undefined;

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
