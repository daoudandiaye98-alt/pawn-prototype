/**
 * Teil X5 — die elf redaktionellen Sektionen, plus das Verzeichnis.
 *
 * Die Reihenfolge ist die Dramaturgie des Hefts: **erst Haltung, dann Auswahl,
 * dann Handlung.** Sie ist der Grund, warum das Verzeichnis hinten liegt und
 * nicht vorn.
 *
 *   01  Umschlag              Papier
 *   02  Inhalt                Papier    linke Seite = die Navigation
 *   03  Der kuratierte Raum   Papier    Platte über den Bund
 *   04  Drei Welten           Papier    Platte über den Bund
 *   05  Mode                  Nacht
 *   06  Interior              Papier
 *   07  Kunst                 Papier
 *   08  Unsere Häuser         Nacht
 *   09  Deine DNA             Papier
 *   10  Frag PAWN             Nacht
 *   11  Für Designer          Papier
 *   12+ Das Verzeichnis       Papier    viele Doppelseiten (X6)
 *
 * Der Wechsel Papier → Nacht → Papier ist der Rhythmus (X4). Die Tafel in X5
 * setzt Nacht auf 05, 08 und 10; das ist nicht ganz „jede dritte Sektion", und
 * die Tafel gilt — sie ist die genauere Angabe.
 *
 * **Woher die Texte kommen.** Sie ziehen um, sie werden nicht neu erfunden (X1):
 * „Der kuratierte Raum", „YOUR MOVE.", der Anspruch, die drei Weltzeilen, die
 * drei Fakten und „Jeder beginnt als Bauer." standen alle schon auf der Landing.
 * Neu geschrieben ist nur, was die Form des Hefts verlangt — Vorspann und
 * Bildunterschriften, wo vorher ein Bildraster stand.
 *
 * **Warum die Sektionsadressen `/heft/…` heißen.**
 *
 * `/mode`, `/interior` und `/kunst` sind heute lebende Kundenseiten. Sie jetzt zu
 * beanspruchen, hieße: eine funktionierende Weltseite gegen eine Heftsektion
 * tauschen, bevor Verzeichnis (X6), Werk (X7) und Kasse (X9) im Heft stehen —
 * also den Kaufweg unterbrechen, um eine Hülle zu zeigen. Solange beides
 * existiert, nimmt das Heft nur Adressen, die es vorher nicht gab. Mit X1
 * (Schritt 8) fällt das Präfix, und die Sektionen ziehen auf ihre endgültigen
 * Adressen; zu ändern ist dann diese eine Zeichenkette.
 */
import { PawnWordmark } from "@/components/pawn/PawnWordmark";
import type { Doppelseite } from "../doppelseiten";
import { folios } from "../doppelseiten";
import {
  Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile, Vorspann,
} from "../satzspiegel";
import { AufPlatte, Platte, PlatteBund } from "../platte";
import { Inhaltsverzeichnis } from "../inhaltsverzeichnis";
import {
  LEERES_VERZEICHNIS, STUECKE_JE_DOPPELSEITE, STUECKE_JE_SEITE, V, WerkZeilen,
  blattZahl, verzeichnisSatz, werkPfad, type VerzeichnisStand,
} from "../verzeichnis";
import { WerkSeiteLinks, WerkSeiteRechts, werkKolumne } from "../werk";
import {
  HausSeiteLinks, HausSeiteRechts, HausZeilen, bausteinInhalt, hausKolumne, hausPfad,
  LEERE_HAEUSER, type HaeuserStand,
} from "../haeuser";

/**
 * Das Präfix der Sektionsadressen — seit X1 leer: das Heft liegt auf den
 * endgültigen Adressen, der Umschlag auf `/`. Die Konstante bleibt stehen,
 * weil sie der eine Ort ist, an dem ein künftiger Umzug wieder eine Zeile
 * wäre (und weil `${S}/mode` lesbarer bleibt als ein nacktes "/mode").
 */
const S = "";

/** Die Adresse der Sektion „Frag PAWN" — die Marke am Blattrand braucht sie. */
export const FRAG_PAWN_PFAD = `${S}/frag-pawn`;

export interface HeftSeitenOptionen {
  /** Antippen im Inhaltsverzeichnis soll blättern, nicht neu laden. */
  aufSprung: (nummer: number) => void;
  /**
   * Baut Doppelseite 02 ohne ihr Inhaltsverzeichnis.
   *
   * Das Verzeichnis der Sektionen braucht die Liste aller Doppelseiten — also
   * das Ergebnis genau dieser Funktion. Es holt sie sich, indem es sie noch
   * einmal baut; mit diesem Schalter kann der zweite Aufbau kein drittes
   * Verzeichnis mehr enthalten. Die Schachtelung endet damit **nachweisbar** bei
   * zwei, statt sich darauf zu verlassen, dass niemand das nicht gezeichnete
   * Element doch einmal zeichnet.
   *
   * Die Alternative wäre eine zweite Aufzählung der Sektionen, die man synchron
   * halten müsste — und genau die will X2 nicht.
   */
  ohneInhalt?: boolean;
  /**
   * Der Katalog (X6). Ohne Angabe steht ein Blatt mit dem ehrlichen Satz da.
   *
   * Er kommt von außen, weil er aus der Datenbank kommt und diese Funktion rein
   * bleiben soll: sie ordnet Doppelseiten, sie holt keine Daten. Die Route lädt,
   * filtert und reicht den Stand herein.
   */
  verzeichnis?: VerzeichnisStand;
  /**
   * Die Häuser (X8). Wie das Verzeichnis: von außen gereicht, weil sie aus der
   * Datenbank kommen und diese Funktion rein bleibt. Ohne Angabe trägt die
   * Sektion 08 ihren Satz und es gibt keine Kapitel.
   */
  haeuser?: HaeuserStand;
}

/**
 * Die Doppelseiten in Leserichtung.
 *
 * Eine Funktion und keine Konstante, weil der Katalog in X6 aus Daten entsteht
 * und dann eine wechselnde Zahl von Doppelseiten liefert. Die Reihenfolge hier
 * ist die Reihenfolge im Heft — es gibt keine zweite Liste, die man synchron
 * halten müsste, und das Inhaltsverzeichnis liest dieselbe.
 */
export function heftSeiten({ aufSprung, ohneInhalt, verzeichnis, haeuser }: HeftSeitenOptionen): Doppelseite[] {
  const seiten: Doppelseite[] = [];

  /* ——— 01 Umschlag — das Cover (Teil Ω, Checkpoint 1) ———
     Wortmarke monumental über den Bund, der Bauer darin atmet, drei Zeilen
     Haltung, EIN Weg hinein. Keine Bedienungsanleitung: ein Umschlag erklärt
     nicht das Blättern, er ist das Versprechen des Hefts.

     Die Wortmarke ist die echte Komponente (Designgesetz: nicht nachbauen) —
     monumental gesetzt über denselben Bund-Trick wie die Platten: zweimal im
     DOM, jede Seite doppelt so breit wie sie selbst, an ihre Bundkante
     geschoben. Die Haltung stand schon auf der Landing und im Editorial —
     Texte ziehen um, sie werden nicht neu erfunden (X1). */
  seiten.push(bau({
    schluessel: "umschlag",
    /* Der Umschlag ist die Startseite — X1. */
    pfad: "/",
    kolumne: "Umschlag",
    titel: "PAWN",
    sektion: "umschlag",
    reiter: "Umschlag",
    ton: "papier",
    nummer: 1,
    links: (f) => (
      <Heftseite lage="links" kolumne="Umschlag" folio={f}>
        <CoverMarke lage="links" />
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Umschlag" folio={f}
        weg={{ text: "Eintreten", zu: "/inhalt" }}
      >
        <CoverMarke lage="rechts" />
        <div className="hx-cover-haltung">
          <Kicker>Ausgabe 001 · Mode · Interior · Kunst</Kicker>
          <p>Kunst von Händen, nicht von Fabriken.</p>
          <p>Was hier hängt, hat jemand gemacht.</p>
          <p>93 % jedes Kaufs gehen direkt an das Haus.</p>
        </div>
      </Heftseite>
    ),
  }));

  /* ——— 02 Inhalt — die linke Seite ist die Navigation (X5) ——— */
  seiten.push(bau({
    schluessel: "inhalt",
    pfad: "/inhalt",
    kolumne: "Inhalt",
    titel: "Inhalt",
    sektion: "inhalt",
    reiter: "Inhalt",
    ton: "papier",
    nummer: 2,
    links: (f) => (
      <Heftseite lage="links" kolumne="Inhalt" folio={f}>
        <Kicker>Inhalt</Kicker>
        {/* Dieselbe Liste, aus der das Heft besteht — es gibt keine zweite. */}
        {ohneInhalt ? null : (
          <Inhaltsverzeichnis
            seiten={heftSeiten({ aufSprung, ohneInhalt: true, verzeichnis })}
            aufSprung={aufSprung}
          />
        )}
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Inhalt" folio={f}
        weg={{ text: "Der kuratierte Raum", zu: `${S}/kuratierter-raum` }}
      >
        <Schlagzeile>Erst Haltung, dann Auswahl, dann Handlung.</Schlagzeile>
        {/*
          Hier stand bis zur Einzelseiten-Korrektur eine zweite Fassung des
          Inhaltsverzeichnisses, weil die linke Seite auf dem Telefon nicht zu
          sehen war. Sie ist zu sehen, seit der Wendel dort um EINE Seite wendet —
          der Behelf ist mit seiner Ursache weg.
        */}
        <Fliesstext>
          Das ist die Ordnung dieses Hefts. Wer wissen will, was PAWN ist, liest
          vorn. Wer kaufen will, blättert nach hinten — dort liegt das Verzeichnis.
          Beides ist einen Griff entfernt, und keines drängt sich vor.
        </Fliesstext>
      </Heftseite>
    ),
  }));

  /* ——— 03 Der kuratierte Raum — Editorial, vier Sätze, Platte über den Bund ——— */
  seiten.push(bau({
    schluessel: "kuratierter-raum",
    pfad: `${S}/kuratierter-raum`,
    kolumne: "Der kuratierte Raum",
    titel: "Ein Raum, keine Auslage.",
    sektion: "kuratierter-raum",
    reiter: "Raum",
    ton: "papier",
    nummer: 3,
    links: (f) => (
      <Heftseite lage="links" kolumne="Der kuratierte Raum" folio={f}>
        <PlatteBund name="galeriehalle" alt="Eine leere, hohe Halle mit Fensterreihe und Betonboden." />
        <AufPlatte>
          <Kicker>Editorial</Kicker>
          <Schlagzeile>Ein Raum, keine Auslage.</Schlagzeile>
        </AufPlatte>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Der kuratierte Raum" folio={f}
        weg={{ text: "Drei Welten", zu: `${S}/drei-welten` }}
      >
        <PlatteBund name="galeriehalle" alt="" />
        <AufPlatte>
          {/* Vier Sätze. Nicht fünf. */}
          <Fliesstext>
            PAWN ist ein kuratierter Markt für unabhängige Häuser aus Mode, Interior
            und Kunst. Jede Bewerbung wird geprüft — was hier hängt, hat jemand
            gemacht. 93 % jedes Kaufs gehen direkt an das Haus, 7 % bleiben bei PAWN.
            Wir zeigen Dinge; die Menschen dahinter bringen die Häuser selbst mit.
          </Fliesstext>
        </AufPlatte>
      </Heftseite>
    ),
  }));

  /* ——— 04 Drei Welten — drei Bilder, drei Wege ———
     X5 verlangt hier drei Wege, X4 „ein Weg je Doppelseite". Das ist kein
     Widerspruch, den man wegdrücken muss: die drei Welten SIND der Inhalt dieser
     Sektion, kein Satz von Handlungsknöpfen. Sie stehen deshalb als drei
     benannte Wege im Satz — und der Fuß bleibt frei, statt einen vierten
     hinzuzufügen. */
  seiten.push(bau({
    schluessel: "drei-welten",
    pfad: `${S}/drei-welten`,
    kolumne: "Drei Welten",
    titel: "Eine Halle, viele Räume.",
    sektion: "drei-welten",
    reiter: "Welten",
    ton: "papier",
    nummer: 4,
    links: (f) => (
      <Heftseite lage="links" kolumne="Drei Welten" folio={f}>
        <PlatteBund name="objektreihe" alt="Eine Reihe stiller Objekte auf einer langen Ablage: gefaltetes Leinen, eine Vase, eine Schale, ein Glas." />
        <AufPlatte>
          <Kicker>Die Halle</Kicker>
          <Schlagzeile>Eine Halle, viele Räume.</Schlagzeile>
        </AufPlatte>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite lage="rechts" kolumne="Drei Welten" folio={f}>
        <PlatteBund name="objektreihe" alt="" />
        <AufPlatte>
          <WeltZeilen aufSprung={aufSprung} />
        </AufPlatte>
      </Heftseite>
    ),
  }));

  /* ——— 05 Mode — Nacht ——— */
  seiten.push(welt({
    schluessel: "mode",
    pfad: `${S}/mode`,
    kolumne: "Mode",
    titel: "Stücke, die eine Handschrift tragen.",
    ton: "nacht",
    nummer: 5,
    platte: "mode-stange",
    plattenAlt: "Eine schmale Kleiderstange mit einem dunklen Mantel, einem hellen Plisseekleid und einem schwarzen Trägerkleid.",
    kicker: "Sektion 05 · Mode",
    text: "Ein Mantel, der einmal genäht wurde, nicht zehntausendmal. Kleidung aus kleinen Häusern trägt die Entscheidungen der Person, die sie gemacht hat — in der Naht, im Fall, in der Wahl des Stoffs.",
    unterschrift: "Kleiderstange, Atelier.",
    weg: { text: "Interior", zu: `${S}/interior` },
  }));

  /* ——— 06 Interior ——— */
  seiten.push(welt({
    schluessel: "interior",
    pfad: `${S}/interior`,
    kolumne: "Interior",
    titel: "Objekte, an denen man die Verbindung sieht.",
    ton: "papier",
    nummer: 6,
    platte: "interior-ecke",
    plattenAlt: "Eine helle Zimmerecke mit einem runden Bouclé-Sessel und einem pilzförmigen Holzobjekt auf einem Steinsockel.",
    kicker: "Sektion 06 · Interior",
    text: "Ein Stuhl ist eine Behauptung darüber, wie man sitzen soll. Interior aus unabhängigen Häusern ist deshalb selten Möbel und meistens Haltung — Objekte, die einen Raum nicht füllen, sondern ändern.",
    unterschrift: "Sessel und Sockel, Morgenlicht.",
    weg: { text: "Kunst", zu: `${S}/kunst` },
  }));

  /* ——— 07 Kunst ——— */
  seiten.push(welt({
    schluessel: "kunst",
    pfad: `${S}/kunst`,
    kolumne: "Kunst",
    titel: "Arbeiten, die einen Raum verändern.",
    ton: "papier",
    nummer: 7,
    platte: "kunst-staffelei",
    plattenAlt: "Eine hölzerne Staffelei mit einem großen schwarz-weißen abstrakten Bild, daneben Pinsel in einem Tonkrug.",
    kicker: "Sektion 07 · Kunst",
    text: "Eine Arbeit hängt nie allein. Sie zieht die Wand mit, das Licht, den Abstand, aus dem man sie ansieht. Deshalb steht bei jedem Werk, wie groß es ist — nicht nur, was es kostet.",
    unterschrift: "Staffelei, Arbeitsraum.",
    weg: { text: "Unsere Häuser", zu: `${S}/haeuser` },
  }));

  /* ——— 08 Unsere Häuser — Nacht ———
     „Die Häuser dieser Ausgabe" sind Daten. Solange die Datenbank nicht
     antwortet, steht hier kein leeres Raster und keine erfundene Liste, sondern
     der Satz, der erklärt, was ein Haus ist. Die Häuser selbst zieht X8 ein —
     dort bekommt jedes sein eigenes Kapitel. */
  /* Die Kapitel liegen hinter den Werken (unten) — hier entsteht nur schon der
     Sprungbefehl, nach demselben Handel wie `aufWerk`: die Tabelle füllt sich
     beim Bauen der Kapitel, gelesen wird sie erst beim Antippen. */
  const kap = haeuser ?? LEERE_HAEUSER;
  const hausNummer = new Map<string, number>();
  const aufHaus = (slug: string): boolean => {
    const n = hausNummer.get(slug);
    if (!n) return false;
    aufSprung(n);
    return true;
  };

  seiten.push(bau({
    schluessel: "haeuser",
    pfad: `${S}/haeuser`,
    kolumne: "Unsere Häuser",
    titel: "Jedes Haus ein eigenes Kapitel.",
    sektion: "haeuser",
    reiter: "Unsere Häuser",
    ton: "nacht",
    nummer: 8,
    links: (f) => (
      <Heftseite lage="links" kolumne="Unsere Häuser" folio={f}>
        <Platte
          name="haeuser-werkbank"
          alt="Eine alte Holzwerkbank vor weißer Wand, darauf gefaltetes Leinen, eine Garnrolle, eine Schere und ein Falzbein."
        />
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite lage="rechts" kolumne="Unsere Häuser" folio={f} weg={{ text: "Deine DNA", zu: `${S}/deine-dna` }}>
        <div className="hx-satz-block">
          <Kicker>Sektion 08 · Unsere Häuser</Kicker>
          <Schlagzeile>Jedes Haus ein eigenes Kapitel.</Schlagzeile>
          {kap.haeuser.length > 0 ? (
            /* X8 — die Kapitel sind da: die Sektionsseite wird ihr Inhaltsverzeichnis. */
            <HausZeilen haeuser={kap.haeuser} aufHaus={aufHaus} />
          ) : (
            /* Der Satz, der erklärt, was ein Haus ist — solange keine Daten da
               sind. Das Kennzeichen unterscheidet für den Prüfstand „keine
               Häuser" von „keine Daten" (dieselbe Regel wie im Verzeichnis). */
            <div {...(kap.laedt || kap.fehler ? { "data-daten-fehlen": "" } : {})}>
              <Fliesstext>
                Ein Haus ist bei PAWN kein Verkäuferkonto, sondern eine Handschrift mit einer Nummer.
                Es bringt seine eigene Farbe, seine eigene Schrift und seinen eigenen Ton mit — und
                behält sie, auch hier im Heft.
              </Fliesstext>
            </div>
          )}
          <Bildunterschrift>Werkbank, Haus in Arbeit.</Bildunterschrift>
        </div>
      </Heftseite>
    ),
  }));

  /* ——— 09 Deine DNA ——— */
  seiten.push(welt({
    schluessel: "deine-dna",
    pfad: `${S}/deine-dna`,
    kolumne: "Deine DNA",
    titel: "Geschmack ist lesbar.",
    ton: "papier",
    nummer: 9,
    platte: "dna-figuren",
    plattenAlt: "Vier schwarze Schachfiguren in einer Reihe auf weißem Grund: Bauer, Läufer, Turm, Dame.",
    kicker: "Sektion 09 · Deine DNA",
    text: "Woran du hängen bleibst, ergibt mit der Zeit ein Muster. PAWN liest dieses Muster, um dir Passendes zu zeigen — und legt offen, was es gespeichert hat. Alles davon kannst du lesen und löschen.",
    unterschrift: "Bauer, Läufer, Turm, Dame.",
    weg: { text: "Frag PAWN", zu: FRAG_PAWN_PFAD },
  }));

  /* ——— 10 Frag PAWN — Nacht ———
     Der Concierge als Doppelseite. Kein Eingabefeld: das Gespräch selbst hängt
     an einer Oberfläche, die das Heft nicht mitbringt (der Hörer sitzt in
     `PalaceHeader`, den X1 löscht). Ein Feld, das nichts auslöst, wäre schlimmer
     als eine ehrliche Seite mit einem Weg dorthin, wo das Gespräch heute läuft. */
  seiten.push(welt({
    schluessel: "frag-pawn",
    pfad: FRAG_PAWN_PFAD,
    kolumne: "Frag PAWN",
    titel: "Sag PAWN, wonach du suchst.",
    ton: "nacht",
    nummer: 10,
    platte: "bauer-monument",
    plattenAlt: "Ein einzelner schwarzer Bauer auf einem hellen Steinsockel in einem leeren, weißen Raum.",
    kicker: "Sektion 10 · Frag PAWN",
    text: "Beschreib es in deinen Worten — ein Gefühl, ein Anlass, ein Raum. Statt Filter zu setzen, sagst du, was du suchst. In diesem Heft ist das die Suche: kein Feld am Rand, sondern ein Gespräch.",
    unterschrift: "Der Bauer, einzeln gestellt.",
    weg: { text: "Für Designer", zu: `${S}/fuer-designer` },
  }));

  /* ——— 11 Für Designer ———
     Ohne Platte: die zehnte (leeres Atelier, 3:4) wird nachgereicht. Deshalb
     trägt diese Sektion Satz statt Bild — und nicht eine Entschuldigung dafür,
     dass ein Bild fehlt. */
  seiten.push(bau({
    schluessel: "fuer-designer",
    pfad: `${S}/fuer-designer`,
    kolumne: "Für Designer",
    titel: "Jeder beginnt als Bauer.",
    sektion: "fuer-designer",
    reiter: "Designer",
    ton: "papier",
    nummer: 11,
    links: (f) => (
      <Heftseite lage="links" kolumne="Für Designer" folio={f}>
        <Kicker>Sektion 11 · Für Designer</Kicker>
        <Schlagzeile>Jeder beginnt als Bauer.</Schlagzeile>
        <Vorspann>Keiner bleibt einer.</Vorspann>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Für Designer" folio={f}
        weg={{ text: "Haus eröffnen", zu: "/apply" }}
      >
        <Fliesstext>
          Der Rang eines Hauses steigt mit dem, was es baut und verkauft — nie mit
          dem, was es zahlt. Ein Plan schaltet Werkzeuge frei, keinen Titel. Wer
          ein Haus eröffnet, fängt beim Bauern an, und der Weg nach oben ist überall
          derselbe.
        </Fliesstext>
        <Bildunterschrift>
          Jede Bewerbung wird von Hand geprüft.
        </Bildunterschrift>
      </Heftseite>
    ),
  }));

  /* ——— 12+ Das Verzeichnis (X6) ———
     Der Katalog: zwölf Stücke je Doppelseite, sechs links, sechs rechts. Jede
     Doppelseite hat ihre eigene Adresse; geblättert wird, nicht nachgeladen.
     Wie viele Blätter es gibt, entscheidet der Bestand — nicht das Gerüst. */
  const kat = verzeichnis ?? LEERES_VERZEICHNIS;
  const blaetter = Math.max(blattZahl(kat.werke.length), kat.mindestBlaetter);

  /*
   * Von der Katalogzeile zur Doppelseite des Werks (X7).
   *
   * Die Tabelle wird erst NACH den Katalogblättern gefüllt — vorher ist nicht
   * bekannt, an welcher Stelle im Heft die Werke beginnen. Der Sprungbefehl
   * liest sie deshalb beim Antippen, nicht beim Bauen; zu diesem Zeitpunkt
   * steht sie. Ohne Eintrag bleibt der Link ein gewöhnlicher Link und lädt die
   * Adresse — das ist der Zustand, solange die Stücke noch geholt werden.
   */
  const werkNummer = new Map<string, number>();
  const aufWerk = (slug: string): boolean => {
    const n = werkNummer.get(slug);
    if (!n) return false;
    aufSprung(n);
    return true;
  };
  for (let n = 1; n <= blaetter; n++) {
    const nummer = seiten.length + 1;
    const von = (n - 1) * STUECKE_JE_DOPPELSEITE;
    const linke = kat.werke.slice(von, von + STUECKE_JE_SEITE);
    const rechte = kat.werke.slice(von + STUECKE_JE_SEITE, von + STUECKE_JE_DOPPELSEITE);
    const alleZwoelf = kat.werke.slice(von, von + STUECKE_JE_DOPPELSEITE);
    /*
     * Der Satz statt der Stücke — und er steht nur auf der RECHTEN Seite.
     *
     * Grund: auf dem Telefon ist die linke Seite nicht zu sehen. Stünde die
     * Erklärung links, wäre das Blatt dort leer und ohne Erklärung — genau das,
     * was X6 verbietet. Die rechte Seite ist die, die es auf jedem Gerät gibt.
     */
    const ueberBestand = !kat.laedt && !kat.fehler && n > blattZahl(kat.werke.length);
    const satz = verzeichnisSatz(kat, alleZwoelf.length === 0, ueberBestand);
    seiten.push(bau({
      schluessel: `verzeichnis-${n}`,
      pfad: `${V}/${n}`,
      kolumne: "Das Verzeichnis",
      titel: "Das Verzeichnis",
      sektion: "verzeichnis",
      reiter: n === 1 ? "Verzeichnis" : undefined,
      ton: "papier",
      nummer,
      links: (f) => (
        <Heftseite lage="links" kolumne="Das Verzeichnis" folio={f}>
          <Kicker>{`Verzeichnis · Blatt ${n} von ${blaetter}`}</Kicker>
          <WerkZeilen werke={linke} aufWerk={aufWerk} />
        </Heftseite>
      ),
      rechts: (f) => (
        <Heftseite
          lage="rechts" kolumne="Das Verzeichnis" folio={f}
          /*
           * Das letzte Blatt trägt den Weg zur Kasse — X6. Seit X9 ist das der
           * Beileger `/kasse`: ein loses Blatt, das nicht mitblättert.
           */
          weg={n === blaetter
            ? { text: "Zur Kasse", zu: "/kasse" }
            : { text: "Weiterblättern", zu: `${V}/${n + 1}` }}
        >
          {satz ? (
            <>
              {/*
                Das Kennzeichen sagt dem Prüfstand: hier fehlen die DATEN, nicht die
                Ware. Ein leerer Katalog ist ein echter Zustand und wird gemessen;
                eine Seite, deren Abfrage gescheitert ist oder noch läuft, ist nicht
                prüfbar. Ohne diesen Unterschied zählte ein Lauf gegen eine lokale
                Vorschau den Fehlersatz als bestandenes Blatt.
              */}
              <div {...(kat.laedt || kat.fehler ? { "data-daten-fehlen": "" } : {})}>
                <Fliesstext>{satz}</Fliesstext>
              </div>
              {n > 1 ? <Bildunterschrift>Blatt 1 liegt am Anfang des Verzeichnisses.</Bildunterschrift> : null}
            </>
          ) : (
            /*
             * Die zweiten sechs — auf jedem Gerät.
             *
             * Hier standen auf dem Telefon einmal alle zwölf, weil die linke
             * Seite dort nicht zu sehen war. Seit der Wendel im
             * Einzelseiten-Modus um EINE Seite wendet, ist sie zu sehen: sechs
             * links, sechs rechts, zwei Züge je Doppelseite.
             */
            <WerkZeilen werke={rechte} aufWerk={aufWerk} />
          )}
        </Heftseite>
      ),
    }));
  }

  /* ——— Die Werke (X7) ———
     Jedes Werk eine Doppelseite: links das Werk, rechts die Angaben. Sie liegen
     hinter dem Verzeichnis, in dessen Reihenfolge — dadurch sind voriges und
     nächstes Werk ein Wendel und brauchen keine eigenen Knöpfe.

     Aus dem UNGEFILTERTEN Bestand (siehe `VerzeichnisStand.alle`): eine Adresse
     darf nicht verschwinden, weil jemand einen Reiter gewählt hat. */
  for (const w of kat.alle) {
    const nummer = seiten.length + 1;
    werkNummer.set(w.slug, nummer);
    const f = folios(nummer);
    seiten.push({
      schluessel: `werk-${w.slug}`,
      pfad: werkPfad(w.slug),
      kolumne: werkKolumne(w),
      /* Der Titel ist die eine `h1` der Adresse (X12) — und genau EINE je Werk.
         Die alte Werkseite hatte gar keine. */
      titel: w.name,
      /* Ein Werk gehört zum Verzeichnis: so bleibt sein Reiter im Griffregister
         markiert, statt dass das Register beim Lesen eines Werks leer aussieht.
         Ein eigener Reiter je Werk wäre bei 200 Stücken ein zweites Verzeichnis
         am Blattrand. */
      sektion: "verzeichnis",
      ton: "papier",
      links: <WerkSeiteLinks werk={w} folio={f.links} />,
      rechts: <WerkSeiteRechts werk={w} folio={f.rechts} />,
    });
  }

  /* ——— Die Häuser als Kapitel (X8) ———
     Hinter den Werken, aus demselben Grund, aus dem die Werke hinter dem
     Verzeichnis liegen: alles Datengetragene liegt hinter den elf festen
     Sektionen, damit deren Nummern stehen bleiben. Jedes Kapitel beginnt mit
     einer Auftakt-Doppelseite; dahinter werden die Bausteine der Hausseite zu
     Heftseiten, zwei je Doppelseite. Sie gehören zur Sektion „haeuser" — der
     Reiter der Sektion 08 bleibt beim Lesen eines Kapitels markiert. */
  for (const h of kap.haeuser) {
    const nummer = seiten.length + 1;
    hausNummer.set(h.slug, nummer);
    const f = folios(nummer);
    seiten.push({
      schluessel: `haus-${h.slug}`,
      pfad: hausPfad(h.slug),
      kolumne: hausKolumne(h),
      titel: h.name,
      sektion: "haeuser",
      ton: "papier",
      links: <HausSeiteLinks haus={h} folio={f.links} />,
      rechts: <HausSeiteRechts haus={h} folio={f.rechts} />,
    });

    /* Die Bausteine — nur die, die auf Papier etwas zeigen. Leere fallen weg,
       bevor gepaart wird: sonst entstünden halbleere Doppelseiten aus
       Bausteinen, die nie Inhalt hatten. */
    const inhalte = h.bausteine
      .map((b) => bausteinInhalt(h, b, kap, aufWerk))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    for (let i = 0; i < inhalte.length; i += 2) {
      const blatt = i / 2 + 2;
      const n2 = seiten.length + 1;
      const f2 = folios(n2);
      seiten.push({
        schluessel: `haus-${h.slug}-${blatt}`,
        pfad: `${hausPfad(h.slug)}/${blatt}`,
        kolumne: hausKolumne(h),
        titel: h.name,
        sektion: "haeuser",
        ton: "papier",
        links: (
          <Heftseite lage="links" kolumne={hausKolumne(h)} folio={f2.links} hausStil={h.stil}>
            {inhalte[i]}
          </Heftseite>
        ),
        rechts: (
          <Heftseite lage="rechts" kolumne={hausKolumne(h)} folio={f2.rechts} hausStil={h.stil}
            weg={i + 2 >= inhalte.length
              ? { text: "Die Stücke des Hauses", zu: `${V}/1?haus=${h.slug}` }
              : undefined}
          >
            {inhalte[i + 1] ?? (
              /* Eine ungerade Zahl von Bausteinen lässt die letzte rechte Seite
                 frei — im Heft ist das eine Vakatseite, kein Fehler. Sie trägt
                 nur den Weg unten. */
              <div aria-hidden />
            )}
          </Heftseite>
        ),
      });
    }
  }

  return seiten;
}


/**
 * Die Wortmarke auf dem Umschlag — monumental über den Bund (Teil Ω).
 *
 * Derselbe Handel wie bei `PlatteBund`: ein Bild kann nicht wirklich über zwei
 * Blattflächen laufen, also steht die Marke zweimal im DOM — jede Kopie doppelt
 * so breit wie ihre Seite und an ihre Bundkante geschoben. Links zeigt die linke
 * Hälfte, rechts die rechte; zusammen ergibt das EIN Wort, dessen Mitte genau
 * im Bund sitzt.
 *
 * Es ist die echte `PawnWordmark` (Designgesetz: nicht nachbauen) — sie bringt
 * den Bauern als SVG mit. Nur Größe und Schnitt kommen vom Umschlag: Fraunces
 * 200 in `clamp(5rem, 16vw, 13rem)`, gesetzt in `heft.css`.
 *
 * `aria-hidden`: der Name des Hefts steht bereits in der einen `h1` der
 * Adresse (X12). Zwei sichtbare Kopien wären für eine Vorlesehilfe „PAWN PAWN".
 */
function CoverMarke({ lage }: { lage: "links" | "rechts" }) {
  return (
    <div className="hx-cover-marke" aria-hidden>
      <span className="hx-cover-band" data-lage={lage}>
        <PawnWordmark className="hx-cover-wort" />
      </span>
    </div>
  );
}

/* ————————————————— Wiederkehrende Formen ————————————————— */

/** Die drei Welten als drei benannte Wege — der Inhalt der Sektion 04. */
function WeltZeilen({ aufSprung }: { aufSprung: (n: number) => void }) {
  const welten = [
    { pfad: `${S}/mode`, nummer: 5, name: "Mode", satz: "Stücke, die eine Handschrift tragen." },
    { pfad: `${S}/interior`, nummer: 6, name: "Interior", satz: "Objekte, an denen man die Verbindung sieht." },
    { pfad: `${S}/kunst`, nummer: 7, name: "Kunst", satz: "Arbeiten, die einen Raum verändern." },
  ];
  return (
    <ul className="hx-welten">
      {welten.map((w) => (
        <li key={w.name}>
          <a
            href={w.pfad}
            className="hx-welt-zeile"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              aufSprung(w.nummer);
            }}
          >
            <span className="hx-welt-name">{w.name}</span>
            <span className="hx-welt-satz">{w.satz}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Eine Weltsektion: Platte links, Satz rechts.
 *
 * Sechs dieser Sektionen sind gleich gebaut — Platte, Kicker, Schlagzeile,
 * Fließtext, Bildunterschrift, ein Weg. Sie stehen deshalb einmal hier und nicht
 * sechsmal ausgeschrieben; wer eine Stufe der Hierarchie ändert, ändert sie für
 * alle sechs und nicht für fünf.
 */
function welt(a: {
  schluessel: string;
  pfad: string;
  kolumne: string;
  titel: string;
  ton: Doppelseite["ton"];
  nummer: number;
  platte: string;
  plattenAlt: string;
  kicker: string;
  text: string;
  unterschrift: string;
  weg: { text: string; zu: string };
}): Doppelseite {
  return bau({
    schluessel: a.schluessel,
    pfad: a.pfad,
    kolumne: a.kolumne,
    titel: a.titel,
    sektion: a.schluessel,
    reiter: a.kolumne,
    ton: a.ton,
    nummer: a.nummer,
    links: (f) => (
      <Heftseite lage="links" kolumne={a.kolumne} folio={f}>
        <Platte name={a.platte} alt={a.plattenAlt} />
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite lage="rechts" kolumne={a.kolumne} folio={f} weg={a.weg}>
        {/* Die Platte steht auf ihrer eigenen Seite (links) — auf jedem Gerät.
            Das Band, das sie auf dem Telefon hier wiederholte, ist mit seiner
            Ursache weg: die linke Seite wird jetzt aufgeschlagen. */}
        <div className="hx-satz-block">
          <Kicker>{a.kicker}</Kicker>
          <Schlagzeile>{a.titel}</Schlagzeile>
          <Fliesstext>{a.text}</Fliesstext>
          <Bildunterschrift>{a.unterschrift}</Bildunterschrift>
        </div>
      </Heftseite>
    ),
  });
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
  titel: string;
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
    titel: a.titel,
    sektion: a.sektion,
    reiter: a.reiter,
    ton: a.ton,
    links: a.links(f.links),
    rechts: a.rechts(f.rechts),
  };
}
