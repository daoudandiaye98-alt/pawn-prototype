/**
 * Teil X2, Schritt 1 — die Doppelseiten.
 *
 * Stand dieses Schritts: **vier leere Doppelseiten mit echten Adressen.** Sie
 * tragen den Satzspiegel, den Ton, den Kolumnentitel, das Folio und je einen
 * Weg — aber noch keinen Inhalt. Der kommt in Schritt 3 (X5, die elf
 * redaktionellen Sektionen) und Schritt 4 (X6, das Verzeichnis).
 *
 * **Warum hier noch nicht `/` steht.** Der Umschlag gehört auf `/`. Diese
 * Adresse trägt bis Schritt 3 aber noch die alte Landing, und X1 (löschen)
 * ist Schritt 8. Solange beides existiert, nimmt das Heft nur Adressen, die
 * es vorher nicht gab — `/heft`, `/inhalt`, `/verzeichnis/…`. Der Umschlag
 * liegt deshalb vorläufig auf `/heft`; mit X5 zieht er auf `/` und diese
 * Zeile verschwindet. Bis dahin ist die Seite für Kundinnen unverändert
 * benutzbar, und niemand steht vor einem halben Magazin.
 *
 * Der leere Zustand ist ausgeschrieben und nicht weggelassen: eine Doppelseite
 * ohne Erklärung gibt es im Heft nicht (X6).
 */
import type { Doppelseite } from "../doppelseiten";
import { folios } from "../doppelseiten";
import {
  Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile, Vorspann,
} from "../satzspiegel";

/** Wie viele Katalog-Doppelseiten es in diesem Schritt gibt. */
export const VERZEICHNIS_SEITEN = 3;

/**
 * Die Doppelseiten in Leserichtung.
 *
 * Eine Funktion und keine Konstante, weil der Katalog in X6 aus Daten entsteht
 * und dann eine wechselnde Zahl von Doppelseiten liefert. Die Reihenfolge hier
 * ist die Reihenfolge im Heft — es gibt keine zweite Liste, die man
 * synchron halten müsste.
 */
export function heftSeiten(): Doppelseite[] {
  const seiten: Doppelseite[] = [];

  /* 01 — Umschlag */
  seiten.push(bau({
    schluessel: "umschlag",
    pfad: "/heft",
    kolumne: "Umschlag",
    sektion: "umschlag",
    reiter: "Umschlag",
    ton: "papier",
    nummer: 1,
    links: (f) => (
      <Heftseite lage="links" kolumne="Umschlag" folio={f}>
        <Schlagzeile>Ein Raum, keine Auslage.</Schlagzeile>
        <Vorspann>Mode · Interior · Kunst</Vorspann>
        <Bildunterschrift>Was hier hängt, hat jemand gemacht.</Bildunterschrift>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Umschlag" folio={f}
        weg={{ text: "Das Inhaltsverzeichnis", zu: "/inhalt" }}
      >
        <Kicker>Ausgabe 001</Kicker>
        <Fliesstext>
          Die Platte für den Umschlag liegt noch nicht auf dem Tisch. Sie kommt mit
          Schritt 3 — bis dahin steht hier Papier, keine Behauptung.
        </Fliesstext>
      </Heftseite>
    ),
  }));

  /* 02 — Inhalt. Die linke Seite wird in Schritt 3 die Navigation. */
  seiten.push(bau({
    schluessel: "inhalt",
    pfad: "/inhalt",
    kolumne: "Inhalt",
    sektion: "inhalt",
    reiter: "Inhalt",
    ton: "papier",
    nummer: 2,
    links: (f) => (
      <Heftseite lage="links" kolumne="Inhalt" folio={f}>
        <Kicker>Inhalt</Kicker>
        <Fliesstext>
          Hier stehen ab Schritt 3 die elf Sektionen dieses Hefts, als Verzeichnis
          zum Anspringen. Bis dahin führt das Griffregister an der Außenkante.
        </Fliesstext>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Inhalt" folio={f}
        weg={{ text: "In das Verzeichnis", zu: "/verzeichnis/1" }}
      >
        <Vorspann>
          Erst Haltung, dann Auswahl, dann Handlung. Das ist die Ordnung des Hefts —
          und sie ist der Grund, warum das Verzeichnis hinten liegt.
        </Vorspann>
      </Heftseite>
    ),
  }));

  /* 12+ — Das Verzeichnis. In diesem Schritt drei Doppelseiten ohne Stücke. */
  for (let n = 1; n <= VERZEICHNIS_SEITEN; n++) {
    seiten.push(bau({
      schluessel: `verzeichnis-${n}`,
      pfad: `/verzeichnis/${n}`,
      kolumne: "Das Verzeichnis",
      sektion: "verzeichnis",
      reiter: n === 1 ? "Verzeichnis" : undefined,
      ton: "papier",
      nummer: seiten.length + 1,
      links: (f) => (
        <Heftseite lage="links" kolumne="Das Verzeichnis" folio={f}>
          <Kicker>{`Verzeichnis · Blatt ${n}`}</Kicker>
          <Fliesstext>
            Zwölf Stücke je Doppelseite, sechs links und sechs rechts — so ist es
            in X6 vorgesehen. Die Stücke fehlen, weil die Datenbank nicht antwortet;
            das ist der Grund, nicht ein leeres Raster.
          </Fliesstext>
        </Heftseite>
      ),
      rechts: (f) => (
        <Heftseite
          lage="rechts" kolumne="Das Verzeichnis" folio={f}
          weg={n === VERZEICHNIS_SEITEN
            ? { text: "Zurück zum Inhalt", zu: "/inhalt" }
            : { text: "Weiterblättern", zu: `/verzeichnis/${n + 1}` }}
        >
          <Bildunterschrift>
            {`Blatt ${n} von ${VERZEICHNIS_SEITEN}. Der Katalog wächst mit den Stücken,
            nicht mit dem Gerüst.`}
          </Bildunterschrift>
        </Heftseite>
      ),
    }));
  }

  return seiten;
}

/* ————————————————— Der Bauhelfer ————————————————— */

/**
 * Nimmt einer Doppelseite die Folio-Rechnung ab.
 *
 * Ohne das müsste jede Seite ihre eigene Zahl kennen — und beim Einfügen einer
 * Sektion in der Mitte wären alle folgenden falsch. Hier steht die Rechnung
 * einmal: die Nummer der Doppelseite bestimmt beide Folios.
 */
function bau(a: {
  schluessel: string;
  pfad: string;
  kolumne: string;
  sektion: string;
  reiter?: string;
  ton: Doppelseite["ton"];
  nummer: number;
  links: (folio: number | null) => Doppelseite["links"];
  rechts: (folio: number | null) => Doppelseite["rechts"];
}): Doppelseite {
  const f = folios(a.nummer);
  return {
    schluessel: a.schluessel,
    pfad: a.pfad,
    kolumne: a.kolumne,
    sektion: a.sektion,
    reiter: a.reiter,
    ton: a.ton,
    links: a.links(f.links),
    rechts: a.rechts(f.rechts),
  };
}
