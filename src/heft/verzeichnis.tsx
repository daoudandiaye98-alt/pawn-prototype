/**
 * Teil X6 — das Verzeichnis.
 *
 * Der Katalog des Hefts. Zwölf Stücke je Doppelseite, sechs links, sechs rechts.
 * Jede Doppelseite hat ihre eigene Adresse (`/verzeichnis/1`, `/verzeichnis/2`,
 * …). Geblättert wird, nicht gerollt.
 *
 * **Warum kein endloses Scrollen.** Ein Heft hat Seiten. Wer ein Stück
 * wiederfinden oder weitergeben will, braucht eine Stelle, auf die er zeigen
 * kann — „Blatt 7" ist so eine Stelle, „irgendwo weiter unten" nicht. Das ist
 * der Preis der Einheit, und er ist bewusst bezahlt: 200 Stücke sind 17
 * Doppelseiten, ein normaler Katalog, kein Notbehelf.
 *
 * **Warum die Zahl je Doppelseite nicht am Gerät hängt.** Zwölf sind zwölf, auf
 * dem Telefon wie am Schreibtisch. Sonst zeigte `/verzeichnis/7` auf dem Telefon
 * andere Stücke als am Schreibtisch, und ein weitergegebener Link landete beim
 * Empfänger woanders — X2 verlangt Adressen, die etwas bedeuten. Auf dem Telefon
 * ist die linke Seite nicht zu sehen (siehe `heft.css`, Einzelseite), deshalb
 * trägt die rechte dort alle zwölf; das ist derselbe Schalter, den das
 * Inhaltsverzeichnis auf Doppelseite 02 schon benutzt.
 *
 * **Was hier NICHT steht.** Kein zweites Datenmodell und keine zweite Türhüter-
 * Regel: geladen wird dieselbe Abfrage wie in der Boutique, und was gezeigt
 * werden darf, entscheidet weiter `istZeigbar` — Name, Preis und Bild oder
 * nichts.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { istZeigbar } from "@/lib/publicData";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { bildVariante } from "@/lib/media";
import type { Welt } from "@/lib/weltFelder";

/**
 * Ein Stück, wie es im Heft steht.
 *
 * Es trägt zweierlei: die vier Angaben der Katalogzeile (Bild, Name, Haus,
 * Preis) und alles, was seine eigene Doppelseite braucht (X7). Beides aus
 * derselben Abfrage — ein Stück, ein Datensatz. Zwei Abfragen wären zwei
 * Wahrheiten, und die zweite wäre irgendwann die falsche.
 */
export interface Werk {
  id: string;
  slug: string;
  name: string;
  preis: number;
  welt: Welt | null;
  bild: string | null;
  haus: { id: string; slug: string; name: string; kannVerkaufen: boolean } | null;
  /** Der Satz des Hauses zum Stück. Fehlt er, steht keiner da. */
  beschreibung: string | null;
  /** Die Angaben der Welt (Technik, Maße, Material …) — roh, gelesen von `gefuellteFelder`. */
  dna: Record<string, unknown> | null;
  /** Größen, falls das Stück welche hat. Ein Bild hat keine. */
  groessen: string[];
  /** Nimmt das Haus für dieses Stück Anfragen an? */
  anfragenErlaubt: boolean;
}

export const STUECKE_JE_SEITE = 6;
export const STUECKE_JE_DOPPELSEITE = STUECKE_JE_SEITE * 2;

/** Die Adresse des Verzeichnisses. Eine Stelle, damit X1 sie in einer Zeile umzieht. */
export const V = "/verzeichnis";

/**
 * Die Adresse eines einzelnen Werks (X7).
 *
 * `/werk/<slug>` und nicht `/product/<slug>`: die alte Werkseite ist eine eigene
 * Seite mit eigenem Gerüst, das Werk im Heft ist eine Doppelseite. Solange beide
 * existieren, nimmt das Heft nur Adressen, die es vorher nicht gab — dieselbe
 * Regel wie bei den `/heft/…`-Sektionen. `drehhinweis.tsx` kennt diesen Pfad
 * schon: eine Werkseite wird nie ins Querformat gezwungen.
 */
export const werkPfad = (slug: string) => `/werk/${slug}`;

/** Dieselbe Obergrenze wie in der Boutique: 200 Stücke, also 17 Doppelseiten. */
const HOECHSTZAHL = 200;

/** Aus der Zahl der Stücke die Zahl der Blätter. Mindestens eines — ein leeres
 *  Verzeichnis ist ein Blatt mit einem Satz darauf, keine fehlende Seite. */
export function blattZahl(anzahl: number): number {
  return Math.max(1, Math.ceil(anzahl / STUECKE_JE_DOPPELSEITE));
}

/** `/verzeichnis/7` → 7. Alles andere → 1. */
export function blattAusPfad(pfad: string): number {
  const treffer = /^\/verzeichnis\/(\d+)\/?$/.exec(pfad);
  const n = treffer ? Number(treffer[1]) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.min(n, blattZahl(HOECHSTZAHL)) : 1;
}

/* ————————————————— Die Reiter: Welt, Preis, Haus ————————————————— */

/**
 * Preisbänder statt Schieber.
 *
 * Ein Schieber braucht eine Fläche und zwei Griffe; ein Reiter ist ein Wort am
 * Blattrand. Drei Bänder sind grob, und grob ist hier richtig: wer genau sucht,
 * nimmt die Boutique. Das obere Band ist offen — teure Kunst darf nie
 * unsichtbar werden (dieselbe Regel wie beim Schieber in Teil Q).
 */
export interface Preisband {
  schluessel: string;
  wort: string;
  kurz: string;
  von: number;
  bis: number | null;
}
export const PREISBAENDER: Preisband[] = [
  { schluessel: "bis-200", wort: "bis 200 €", kurz: "€", von: 0, bis: 200 },
  { schluessel: "200-1000", wort: "200–1000 €", kurz: "€€", von: 200, bis: 1000 },
  /* Zwei Zeichen, nicht drei: der eingefahrene Streifen ist so breit wie die
     Sektionszahl („01"), und „€€€" ragte darüber hinaus. */
  { schluessel: "ab-1000", wort: "ab 1000 €", kurz: "€+", von: 1000, bis: null },
];

export interface Filter {
  welt: string | null;
  preis: string | null;
  /** Der Slug des Hauses — nicht sein Name: der Name kann sich ändern, die Adresse nicht. */
  haus: string | null;
}

export const OHNE_FILTER: Filter = { welt: null, preis: null, haus: null };

export function istGefiltert(f: Filter): boolean {
  return f.welt !== null || f.preis !== null || f.haus !== null;
}

export function filtern(werke: Werk[], f: Filter): Werk[] {
  const band = f.preis ? PREISBAENDER.find((b) => b.schluessel === f.preis) : undefined;
  return werke.filter((w) => {
    if (f.welt && w.welt !== f.welt) return false;
    if (f.haus && w.haus?.slug !== f.haus) return false;
    if (band && (w.preis < band.von || (band.bis !== null && w.preis >= band.bis))) return false;
    return true;
  });
}

/**
 * Welche Reiter es überhaupt gibt — aus dem Bestand, nicht aus einer Liste.
 *
 * Ein Reiter, der auf ein leeres Blatt führt, ist ein Versprechen, das die Seite
 * nicht hält. Deshalb entstehen die Reiter aus den Stücken, die wirklich da
 * sind: keine Welt ohne Ware, kein Haus ohne Werk, kein Preisband ohne Preis.
 * Bei einem Haus und einem Werk ist das Register also kurz — das ist kein
 * Baufehler, es fehlt Ware.
 */
export interface ReiterWahl {
  schluessel: string;
  wort: string;
  kurz: string;
  wert: string;
}
export function reiterAus(werke: Werk[]): { welten: ReiterWahl[]; preise: ReiterWahl[]; haeuser: ReiterWahl[] } {
  const welten = [...new Set(werke.map((w) => w.welt).filter((w): w is Welt => !!w))];
  const haeuser = new Map<string, string>();
  for (const w of werke) if (w.haus) haeuser.set(w.haus.slug, w.haus.name);
  return {
    welten: welten.map((w) => ({ schluessel: `welt-${w}`, wort: w, kurz: w.slice(0, 2), wert: w })),
    preise: PREISBAENDER
      .filter((b) => werke.some((w) => w.preis >= b.von && (b.bis === null || w.preis < b.bis)))
      .map((b) => ({ schluessel: `preis-${b.schluessel}`, wort: b.wort, kurz: b.kurz, wert: b.schluessel })),
    haeuser: [...haeuser.entries()].map(([slug, name]) => ({
      schluessel: `haus-${slug}`, wort: name, kurz: name.slice(0, 2).toUpperCase(), wert: slug,
    })),
  };
}

/* ————————————————— Das Laden ————————————————— */

interface Zeile {
  id: string;
  slug: string;
  name: string;
  price: number;
  world: string | null;
  image_url: string | null;
  description: string | null;
  product_dna: Record<string, unknown> | null;
  size_variants: unknown;
  allow_custom_requests: boolean | null;
  designers: { id: string; slug: string; brand_name: string; kauf_freigeschaltet: boolean | null } | null;
}

/** Die Größen eines Stücks — aus `size_variants`, ohne leere Einträge. */
function groessenAus(roh: unknown): string[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .map((v) => (v as { size?: string })?.size)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

export function useVerzeichnisWerke() {
  const [werke, setWerke] = useState<Werk[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, price, world, image_url, description, product_dna, size_variants,"
          + " allow_custom_requests, designers ( id, slug, brand_name, kauf_freigeschaltet )",
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(HOECHSTZAHL);
      if (abgebrochen) return;
      if (error) {
        setFehler("Das Verzeichnis lässt sich gerade nicht laden. Die Stücke sind da, die Leitung nicht.");
        setLaedt(false);
        return;
      }
      const zeilen = (data ?? []) as unknown as Zeile[];
      setWerke(
        zeilen.filter(istZeigbar).map((z) => ({
          id: z.id,
          slug: z.slug,
          name: z.name,
          preis: Number(z.price),
          welt: (z.world as Welt | null) ?? null,
          bild: z.image_url,
          haus: z.designers
            ? {
              id: z.designers.id,
              slug: z.designers.slug,
              name: z.designers.brand_name,
              /* Dieselbe Wahrheit wie auf der alten Werkseite: nur `false`
                 sperrt. Fehlt die Spalte, wird nicht stillschweigend gesperrt. */
              kannVerkaufen: z.designers.kauf_freigeschaltet !== false,
            }
            : null,
          beschreibung: z.description,
          dna: z.product_dna,
          groessen: groessenAus(z.size_variants),
          anfragenErlaubt: z.allow_custom_requests === true,
        })),
      );
      setLaedt(false);
    })();
    return () => { abgebrochen = true; };
  }, []);

  return { werke, laedt, fehler };
}

/* ————————————————— Der Stand, den die Doppelseiten lesen ————————————————— */

export interface VerzeichnisStand {
  /** Bereits gefiltert — die Doppelseite schneidet nur noch ihre zwölf heraus. */
  werke: Werk[];
  /**
   * Der ganze Bestand, ungefiltert — daraus entstehen die Werk-Doppelseiten (X7).
   *
   * **Warum ungefiltert.** Die Adresse eines Werks (`/werk/<slug>`) muss
   * bestehen, egal welche Reiter gerade gewählt sind. Käme die Liste der
   * Werkseiten aus der gefilterten Auswahl, verschwände ein weitergegebener Link
   * in dem Moment, in dem der Empfänger einen Filter in seiner Adresse hat — und
   * das Heft schlüge vorn auf statt beim Werk. Die Reiter legen das Verzeichnis
   * neu; sie nehmen kein Werk aus dem Heft.
   */
  alle: Werk[];
  laedt: boolean;
  fehler: string | null;
  gefiltert: boolean;
  /**
   * Wie viele Blätter es mindestens gibt — die Zahl aus der Adresse, mit der das
   * Heft betreten wurde.
   *
   * Nötig, weil die Stücke erst nach dem ersten Bild da sind. Ohne diese Zahl
   * kennt das Heft im Moment des Betretens nur ein Katalogblatt, `/verzeichnis/7`
   * fände seine Doppelseite nicht und würde vorn aufschlagen — die Hülle hält
   * ihre Startseite bewusst nur einmal fest (sonst schlüge das eigene
   * Fortschreiben der Adresse beim Blättern zurück).
   *
   * Sie wird beim Betreten festgehalten und danach nicht mehr verändert: eine
   * Liste, die unter einem rollenden Wendel kürzer wird, zieht dem Leser den
   * Boden weg. Reicht der Katalog nicht so weit, sagt das Blatt es.
   */
  mindestBlaetter: number;
}

export const LEERES_VERZEICHNIS: VerzeichnisStand = {
  werke: [], alle: [], laedt: true, fehler: null, gefiltert: false, mindestBlaetter: 1,
};

/**
 * Der Satz, der statt Stücken auf dem Blatt steht — oder `null`, wenn Stücke da
 * sind.
 *
 * Fünf Fälle, alle ausgeschrieben. Ein leerer Zustand steht im Satzspiegel und
 * ist ein Satz, kein grauer Kasten; und es gibt keine Doppelseite ohne
 * Erklärung, warum sie leer ist.
 */
export function verzeichnisSatz(
  k: VerzeichnisStand,
  blattLeer: boolean,
  ueberBestand: boolean,
): string | null {
  if (!blattLeer) return null;
  if (k.fehler) return k.fehler;
  if (k.laedt) return "Das Verzeichnis wird geholt.";
  if (ueberBestand) return "So weit reicht das Verzeichnis nicht. Das erste Blatt liegt am Anfang.";
  if (k.gefiltert) return "Mit dieser Wahl steht hier nichts. Nimm einen Reiter zurück, dann füllt sich das Blatt wieder.";
  return "Noch steht kein Stück im Verzeichnis. Die ersten Häuser ziehen ein.";
}

/* ————————————————— Die Zeilen auf dem Blatt ————————————————— */

/**
 * Sechs Einträge, jeder ein Weg zu seinem Werk.
 *
 * Bild, Name, Haus, Preis — vier Angaben, die reichen, um sich zu entscheiden.
 * Mehr wäre eine Werkseite, und die liegt hinter dem Link.
 *
 * **Der Link blättert, er lädt nicht neu.** Jedes Werk hat seine eigene
 * Doppelseite im selben Heft (X7); `zuNummer` sagt, welche. Die Adresse steht
 * trotzdem am `<a>`, damit Mittelklick, Weitergeben und Suchmaschine
 * funktionieren — dieselbe Bauart wie im Inhaltsverzeichnis. Fehlt die Nummer
 * (das Werk ist noch nicht im Heft), bleibt der Link ein gewöhnlicher Link.
 */
export function WerkZeilen({ werke, aufWerk }: {
  werke: Werk[];
  /** Blättert zum Werk. Gibt `false`, wenn es (noch) keine Doppelseite dafür gibt. */
  aufWerk?: (slug: string) => boolean;
}) {
  const { locale } = useI18n();
  if (werke.length === 0) return null;
  return (
    <ol className="hx-verzeichnis">
      {werke.map((w) => (
        <li key={w.id}>
          <Link
            className="hx-werk"
            to={werkPfad(w.slug)}
            onClick={(e) => {
              /* Fremde Absichten nicht abfangen: neuer Tab, neues Fenster. */
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              if (!aufWerk?.(w.slug)) return;
              e.preventDefault();
            }}
          >
            {/* Der Rahmen steht auch ohne Bild — sonst rutschte die Zeile, sobald
                ein Stück sein Foto verliert. `istZeigbar` lässt zwar keines ohne
                Bild herein; die Fläche hält trotzdem, statt sich darauf zu
                verlassen. */}
            {/* Zwölf Stück je Doppelseite: hier zählt jedes Kilobyte doppelt.
                420 px reichen für die Kachel auf einem scharfen Bildschirm —
                das Original wäre bis zu 725 kB groß (siehe `bildVariante`). */}
            <span className="hx-werk-bild">
              {w.bild
                ? <img src={bildVariante(w.bild, { breite: 420 })} alt="" loading="lazy" decoding="async" />
                : null}
            </span>
            <span className="hx-werk-name">{w.name}</span>
            {w.haus ? <span className="hx-werk-haus">{w.haus.name}</span> : null}
            <span className="hx-werk-preis">{formatPrice(w.preis, locale)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/**
 * Der Stand für die Doppelseiten.
 *
 * Nimmt den Bestand entgegen und filtert ihn — lädt aber selbst nicht. Sonst
 * liefe die Abfrage zweimal: einmal hier und einmal für die Reiter, die den
 * UNgefilterten Bestand brauchen (ein gewählter Reiter darf die anderen nicht
 * wegnehmen).
 */
export function useVerzeichnisStand(
  bestand: { werke: Werk[]; laedt: boolean; fehler: string | null },
  filter: Filter,
  mindestBlaetter: number,
): VerzeichnisStand {
  const gefiltert = istGefiltert(filter);
  const sichtbar = useMemo(() => filtern(bestand.werke, filter), [bestand.werke, filter]);
  return useMemo(
    () => ({
      werke: sichtbar,
      alle: bestand.werke,
      laedt: bestand.laedt,
      fehler: bestand.fehler,
      gefiltert,
      mindestBlaetter,
    }),
    [sichtbar, bestand.werke, bestand.laedt, bestand.fehler, gefiltert, mindestBlaetter],
  );
}
