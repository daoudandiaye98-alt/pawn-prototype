/**
 * Sonde: läuft Vercel Edge Middleware auf DIESEM Projekt?
 *
 * Warum überhaupt eine Sonde. Für die echte 404 (K7) braucht es Middleware:
 * hinter der SPA-Umschreibung in `vercel.json` antwortet der Server auf jede
 * erfundene Adresse mit 200, und ein Statuscode lässt sich nur VOR der
 * Umschreibung setzen. Ob Middleware hier greift, ist aber eine Behauptung,
 * solange es niemand gemessen hat: dieses Projekt ist Vite, nicht Next, und
 * die Reihenfolge Middleware → Umschreibung → statische Datei ist genau die
 * Stelle, an der so etwas schiefgeht.
 *
 * Deshalb erst dieser eine Weg, und sonst nichts.
 *
 *   GET /__sonde-middleware
 *     Antwort „middleware-laeuft" (text/plain)  → Middleware greift.
 *     Antwort HTML (die Anwendung)              → Middleware greift NICHT,
 *                                                 die Umschreibung war zuerst dran.
 *
 * Der Pfad beginnt mit zwei Unterstrichen, kollidiert also mit keiner Route des
 * Hefts, und der `matcher` lässt ausschließlich ihn durch. Jede andere Adresse
 * — Kasse, Anmeldung, Werk — läuft an dieser Datei vorbei, ohne sie zu berühren.
 *
 * Diese Datei ist ein Messgerät, kein Baustein. Sie wird durch die echte
 * 404-Middleware ERSETZT, sobald die Messung vorliegt — oder gelöscht, wenn
 * sie negativ ausfällt. Sie bleibt nicht liegen.
 */

export const config = {
  matcher: "/__sonde-middleware",
};

export default function middleware(): Response {
  return new Response("middleware-laeuft", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Zweiter, unabhängiger Beleg: auch wer nur die Kopfzeilen liest, sieht es.
      "x-pawn-sonde": "middleware",
      // Nie zwischenspeichern — eine Sonde, die aus dem Zwischenspeicher
      // antwortet, belegt nur den Zwischenspeicher.
      "cache-control": "no-store",
    },
  });
}
