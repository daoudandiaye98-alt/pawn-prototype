/**
 * Die Adressen, die es wirklich gibt.
 *
 * **Warum diese Datei existiert.** Hinter der SPA-Umschreibung in `vercel.json`
 * antwortet der Server auf JEDE Adresse mit 200 — auch auf erfundene. Für
 * Suchmaschinen ist damit `/gibtesnicht-4d9f21` eine gültige Seite (Kontrolle
 * 4.5). Den Statuscode kann nur die Middleware setzen, und die läuft vor der
 * Umschreibung. Gemessen am 17.08.2026 über die Sonde `/__sonde-middleware`:
 * Antwort `middleware-laeuft`, Kopfzeile `x-pawn-sonde: middleware` — Edge
 * Middleware greift auf diesem Projekt.
 *
 * Um zu wissen, welche Adresse erfunden ist, muss die Middleware wissen, welche
 * echt sind. Hier steht diese Liste — **einmal**, für den Server. Der Browser
 * hat seine eigene in `src/App.tsx`, weil React Router sie als JSX braucht.
 *
 * **Zwei Listen, eine Wahrheit.** Dass sie nicht auseinanderlaufen, ist keine
 * Disziplinfrage: `src/__tests__/routen.spec.ts` liest die Pfade aus `App.tsx`
 * und vergleicht sie mit dieser Liste. Wer eine Route hinzufügt und diese Datei
 * vergisst, sieht einen roten Test — nicht eine Seite, die Google als 404
 * gemeldet wird.
 *
 * Diese Datei liegt bewusst im Wurzelverzeichnis: `middleware.ts` wird von
 * Vercel gebündelt, nicht von Vite, und kennt den `@/`-Kurzweg nicht.
 */

/** Alle Routen, in der Reihenfolge aus `App.tsx`. Ohne den Auffang `*`. */
export const ROUTEN = [
  "/",
  "/mode",
  "/interior",
  "/kunst",
  "/kuratierter-raum",
  "/drei-welten",
  "/haeuser",
  "/deine-dna",
  "/frag-pawn",
  "/fuer-designer",
  "/neu",
  "/auth",
  "/dna",
  "/designers",
  "/ausgabe",
  "/ausgabe/001",
  "/ausgabe/001/:seite",
  "/heft",
  "/heft/:sektion",
  "/inhalt",
  "/verzeichnis",
  "/verzeichnis/:seite",
  "/werk/:slug",
  "/haus/:slug",
  "/haus/:slug/:blatt",
  "/vision",
  "/preise",
  "/preise/maison",
  "/about",
  "/designers/all",
  "/designer/:slug",
  "/apply",
  "/apply/form",
  "/start",
  "/einladung/:refCode",
  "/datenschutz",
  "/impressum",
  "/versand",
  "/agb",
  "/widerruf",
  "/barrierefreiheit",
  "/wie-pawn-ki-nutzt",
  "/vertrag-kuendigen",
  "/kontakt",
  "/shop",
  "/boutique",
  "/product/:slug",
  "/presse/:slug",
  "/cart",
  "/checkout",
  "/kasse",
  "/order/success",
  "/account",
  "/admin",
  "/admin/dna",
  "/admin/products",
  "/admin/applications",
  "/admin/designers",
  "/admin/kampagnen",
  "/admin/ai",
  "/admin/ki",
  "/admin/trends",
  "/admin/akquise",
  "/admin/feldzug",
  "/admin/wachstum",
  "/admin/jarvis",
  "/admin/nachrichten",
  "/admin/zahlungen",
  "/admin/texte-bilder",
  "/admin/posting",
  "/admin/archiv",
  "/admin/editionen",
  "/admin/werbung",
  "/admin/aktionen",
  "/studio",
  "/studio/werke",
  "/studio/werke/neu",
  "/studio/werke/bilder",
  "/studio/werke/rochade",
  "/studio/doppelseite",
  "/studio/doppelseite/stil",
  "/studio/clips",
  "/studio/clips/neu",
  "/studio/clips/fertig",
  "/studio/aufbau",
  "/studio/produkte",
  "/studio/produkte/neu",
  "/studio/mediathek",
  "/studio/hausseite",
  "/studio/kampagnen",
  "/studio/kampagnen/neu",
  "/studio/videothek",
  "/studio/postfach",
  "/studio/geschaeft",
  "/studio/bestellungen",
  "/studio/versand",
  "/studio/content-begleiter",
  "/studio/empfehlungen",
  "/studio/beweis",
  "/studio/plan",
  "/studio/dna",
  "/studio/brand",
  "/studio/nachrichten",
  "/studio/auszahlung",
  "/studio/copilot",
  "/studio/einstellungen",
  "/studio/automatik",
  "/studio/vertraege",
  "/studio/tueren",
  "/studio/onboarding",
  "/portal",
  "/portal/onboarding",
  "/portal/editor",
];

/**
 * Adressen, die nie durch die Middleware laufen sollen.
 *
 * Alles mit Punkt im letzten Teil ist eine Datei (`/assets/index-abc.js`,
 * `/favicon.ico`, `/robots.txt`). `/api` und `/_vercel` gehören der Plattform.
 * Diese Prüfung ist der Grund, warum das Nachladen der Hülle unten keine
 * Schleife baut: `/index.html` trägt einen Punkt.
 */
/**
 * X1 — die fünf Umzüge. Alte Adressen, die eine neue haben, antworten mit 301:
 * für den Menschen unsichtbar, für die Suchmaschine die Ansage, den Eintrag
 * umzuschreiben statt doppelt zu führen.
 *
 * `:name` in `von` wird als ein Abschnitt gefangen und in `nach` als `:name`
 * wieder eingesetzt — dieselbe Platzhalter-Sprache wie in ROUTEN. Die Ziele
 * müssen bekannte Adressen sein; die Wache in `vercel-routen.spec.ts` prüft es.
 *
 * WICHTIG: jede Adresse hier steht AUCH in ROUTEN, weil `App.tsx` sie als
 * clientseitigen Umzug führt (Navigate) — für Klicks in der App, wo kein
 * Server dazwischen liegt. Serverseitig kommt die 301-Regel vor der 200-Regel
 * und gewinnt.
 */
export const UMZUEGE = [
  { von: "/shop", nach: "/verzeichnis/1" },
  { von: "/product/:slug", nach: "/werk/:slug" },
  { von: "/designer/:slug", nach: "/haus/:slug" },
  { von: "/heft", nach: "/" },
  /* Der Umschlag hieß `/heft/umschlag` — sein Ziel ist `/`, nicht `/umschlag`.
     Die eigene Zeile VOR der Musterzeile, damit sie zuerst greift. */
  { von: "/heft/umschlag", nach: "/" },
  { von: "/heft/:sektion", nach: "/:sektion" },
];

export function istPlattformOderDatei(pfad) {
  if (pfad.startsWith("/api/") || pfad.startsWith("/_vercel/")) return true;
  const letzter = pfad.slice(pfad.lastIndexOf("/") + 1);
  return letzter.includes(".");
}

/**
 * Passt die Adresse auf eine echte Route?
 *
 * Ein `:name`-Abschnitt passt auf genau einen nicht-leeren Abschnitt. Mehr
 * Musterkunst braucht es nicht — im Heft gibt es keine verschachtelten
 * Platzhalter und kein `*` außer dem Auffang.
 *
 * Ob es das Stück hinter `/werk/<slug>` wirklich gibt, weiß erst die Datenbank.
 * Das ist eine andere Frage als diese: hier geht es darum, ob die ADRESSE eine
 * Form hat, die das Heft kennt. Eine Form ohne Inhalt beantwortet die Seite
 * selbst — eine Form, die es nicht gibt, beantwortet der Server mit 404.
 */
export function istBekannteRoute(pfad) {
  const teile = zerlege(pfad);
  return ROUTEN.some((muster) => passt(zerlege(muster), teile));
}

function zerlege(pfad) {
  return pfad.split("/").filter((t) => t.length > 0);
}

function passt(muster, teile) {
  if (muster.length !== teile.length) return false;
  return muster.every((m, i) => (m.startsWith(":") ? teile[i].length > 0 : m === teile[i]));
}
