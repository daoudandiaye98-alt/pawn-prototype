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
 * `./routen.js` — mit Endung, und die Endung lautet `.js`, obwohl die Datei
 * `routen.ts` heißt. Das sieht nach einem Tippfehler aus und ist keiner.
 *
 * Vercel prüft diese Datei mit strengeren Import-Regeln als unser eigener
 * Typecheck (`--moduleResolution node16`). Ohne Endung schlägt der Import dort
 * fehl — und zwar OHNE den Build rot zu machen: die Middleware wird einfach
 * nicht mit ausgeliefert. Genau das stand im Build-Protokoll von caf8afd:
 *
 *   middleware.ts(31,57): error TS2835: Relative import paths need explicit
 *   file extensions … Did you mean './routen.js'?
 *
 * Das erklärt alle drei Messungen: die Sonde lief, weil sie nichts importiert
 * hat. Beide Fassungen mit Import liefen nicht — weder mit noch ohne Muster.
 * Ich habe zuerst das Muster verdächtigt und einen ganzen Lauf darauf
 * verwendet; der Beweis lag die ganze Zeit im Build-Protokoll, nicht im
 * Prüfstand.
 *
 * `.js` ist dabei die richtige Schreibweise für eine `.ts`-Datei: unter diesen
 * Regeln benennt der Import die AUSGABE, nicht die Quelle.
 */
import { istBekannteRoute, istPlattformOderDatei } from "./routen.js";

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
 * Ich habe daraus zuerst geschlossen, das Muster sei die Ursache, und Fassung 4
 * mit `"/:pfad*"` gebaut. **Das war falsch** — auch sie lief nicht. Die Ursache
 * stand die ganze Zeit im Build-Protokoll und steht unten am `import`: der
 * Import ohne Dateiendung, an dem Vercel die Middleware stillschweigend
 * fallen lässt. Was alle drei gescheiterten Fassungen gemeinsam hatten, war
 * nicht das Muster, sondern dieser Import; die Sonde hatte keinen.
 *
 * Das Muster bleibt trotzdem stehen, aber ehrlich beschriftet: es ist eine
 * Anmeldung, kein Filter, und es ist nicht das, was den Fehler behoben hat.
 * `"/:pfad*"` trifft jede Adresse samt Wurzel. Das Aussortieren von Dateien und
 * Plattform-Adressen bleibt, wo es geprüft ist — in `istPlattformOderDatei`.
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
   * Zusätzlich ins Protokoll, nicht nur in die Kopfzeile.
   *
   * Die Kopfzeile ist der Weg nach außen, für den Prüfstand und für `curl -I`.
   * Ob Vercel sie auf dem Weiter-Pfad wirklich durchreicht, ist ungeprüft — und
   * genau daran hing eine Stunde: die Middleware lief, fiel jedes Mal zurück,
   * und von außen sah das aus wie „läuft nicht". Diese Zeile steht in den
   * Laufzeit-Protokollen und beantwortet die Frage in zehn Sekunden.
   *
   * Kein Fund-Werkzeug auf Zeit: ein stiller Rückfall, der niemandem etwas
   * sagt, ist genau die Sorte Ausnahme, die der Umzug verbietet.
   */
  console.warn(`[pawn-404] weiter statt 404 — Grund: ${grund}`);
  return new Response(null, {
    headers: { "x-middleware-next": "1", "x-pawn-404": grund },
  });
}
