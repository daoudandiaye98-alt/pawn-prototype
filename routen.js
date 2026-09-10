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
  "/ausgewaehlt",
  "/mode",
  "/mode/:seite",
  "/interior",
  "/interior/:seite",
  "/kunst",
  "/kunst/:seite",
  "/haeuser",
  "/haeuser/:seite",
  "/haus/:slug",
  "/haus/:slug/:blatt",
  "/werk/:slug",
  "/deine-dna",
  "/deine-dna/welt",
  "/deine-dna/richtung",
  "/deine-dna/form",
  "/deine-dna/linie",
  "/deine-dna/foto",
  "/deine-dna/massband",
  "/deine-dna/privacy",
  "/frag-pawn",
  "/vision",
  "/vision/:seite",
  "/fuer-designer",
  "/fuer-designer/:seite",
  "/suche",
  "/konto",
  "/konto/:seite",
  "/tasche",
  "/dna",
  "/designers",
  "/designers/all",
  "/boutique",
  "/neu",
  "/cart",
  "/checkout",
  "/account",
  "/shop",
  "/verzeichnis",
  "/apply",
  "/about",
  "/kuratierter-raum",
  "/drei-welten",
  "/ausgabe",
  "/inhalt",
  "/product/:slug",
  "/designer/:slug",
  "/auth",
  "/preise",
  "/preise/maison",
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
  "/presse/:slug",
  "/order/success",
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
 * Die Umzüge. Alte Adressen, die eine neue haben, antworten mit 301:
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
  { von: "/dna", nach: "/deine-dna" },
  { von: "/designers", nach: "/haeuser" },
  { von: "/designers/all", nach: "/haeuser" },
  { von: "/boutique", nach: "/ausgewaehlt" },
  { von: "/neu", nach: "/ausgewaehlt" },
  { von: "/cart", nach: "/tasche" },
  { von: "/checkout", nach: "/tasche" },
  { von: "/account", nach: "/konto" },
  { von: "/shop", nach: "/suche" },
  { von: "/verzeichnis", nach: "/suche" },
  { von: "/apply", nach: "/fuer-designer/2" },
  { von: "/about", nach: "/vision" },
  { von: "/kuratierter-raum", nach: "/vision" },
  { von: "/drei-welten", nach: "/haeuser" },
  { von: "/ausgabe", nach: "/" },
  { von: "/inhalt", nach: "/" },
  { von: "/product/:slug", nach: "/werk/:slug" },
  { von: "/designer/:slug", nach: "/haus/:slug" },
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
 * Musterkunst braucht es nicht — es gibt keine verschachtelten Platzhalter
 * und kein `*` außer dem Auffang.
 *
 * Ob es das Stück hinter `/werk/<slug>` wirklich gibt, weiß erst die Datenbank.
 * Das ist eine andere Frage als diese: hier geht es darum, ob die ADRESSE eine
 * Form hat, die die Seite kennt. Eine Form ohne Inhalt beantwortet die Seite
 * selbst — eine Form, die es nicht gibt, beantwortet der Server mit 404.
 */
export function istBekannteRoute(pfad) {
  const teile = zerlege(pfad);
  return ROUTEN.some((muster) => passt(zerlege(muster), teile));
}

function zerlege(pfad) {
  return pfad.split("/").filter((t) => t.length > 0);
}

/**
 * Platzhalter, die eine SEITE zaehlen, nehmen nur Ziffern.
 *
 * Das Heft hat je Welt so viele Doppelseiten, wie es Haeuser gibt — die Zahl steht
 * erst zur Laufzeit fest, die Adressen koennen darum nicht einzeln aufgezaehlt werden.
 * Waere `/mode/:seite` ein beliebiger Abschnitt, bekaeme `/mode/gibtesnicht` eine 200,
 * und genau das ist der Fehler, fuer den K7 gebaut wurde (Kontrolle 4.5).
 *
 * Deshalb: ein Platzhalter mit einem dieser Namen passt nur auf Ziffern. Dieselbe Regel
 * steht in `tools/vercel-routen.mjs`; `src/__tests__/heft03-adressen.spec.ts` haelt beide
 * gegeneinander.
 */
export const ZAEHLENDE_PLATZHALTER = ["seite", "blatt"];

function passt(muster, teile) {
  if (muster.length !== teile.length) return false;
  return muster.every((m, i) => {
    if (!m.startsWith(":")) return m === teile[i];
    if (ZAEHLENDE_PLATZHALTER.includes(m.slice(1))) return /^[0-9]+$/.test(teile[i]);
    return teile[i].length > 0;
  });
}
