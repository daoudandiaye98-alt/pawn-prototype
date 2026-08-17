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
import type { Doppelseite } from "../doppelseiten";
import { folios } from "../doppelseiten";
import {
  Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile, Vorspann,
} from "../satzspiegel";
import { AufPlatte, Platte, PlatteBand, PlatteBund } from "../platte";
import { Inhaltsverzeichnis } from "../inhaltsverzeichnis";

/**
 * Das Präfix der Sektionsadressen. Eine Stelle, damit der Umzug auf die
 * endgültigen Adressen in Schritt 8 eine Zeile ist und keine Suche.
 */
const S = "/heft";

/** Die Adresse der Sektion „Frag PAWN" — die Marke am Blattrand braucht sie. */
export const FRAG_PAWN_PFAD = `${S}/frag-pawn`;

/** Wie viele Katalog-Doppelseiten es in diesem Schritt gibt. */
export const VERZEICHNIS_SEITEN = 3;

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
}

/**
 * Die Doppelseiten in Leserichtung.
 *
 * Eine Funktion und keine Konstante, weil der Katalog in X6 aus Daten entsteht
 * und dann eine wechselnde Zahl von Doppelseiten liefert. Die Reihenfolge hier
 * ist die Reihenfolge im Heft — es gibt keine zweite Liste, die man synchron
 * halten müsste, und das Inhaltsverzeichnis liest dieselbe.
 */
export function heftSeiten({ aufSprung, ohneInhalt }: HeftSeitenOptionen): Doppelseite[] {
  const seiten: Doppelseite[] = [];

  /* ——— 01 Umschlag ———
     Wortmarke, Bauer, drei Zeilen, ein Weg hinein. Die Wortmarke trägt den
     Bauern als SVG — sie wird nicht nachgebaut, das ist Designgesetz. */
  seiten.push(bau({
    schluessel: "umschlag",
    pfad: S,
    kolumne: "Umschlag",
    titel: "YOUR MOVE.",
    sektion: "umschlag",
    reiter: "Umschlag",
    ton: "papier",
    nummer: 1,
    links: (f) => (
      <Heftseite lage="links" kolumne="Umschlag" folio={f}>
        <Kicker>Der kuratierte Raum</Kicker>
        <Schlagzeile>YOUR MOVE.</Schlagzeile>
        <Vorspann>PAWN macht aus kreativem Potenzial echte Gelegenheiten.</Vorspann>
        <Bildunterschrift>Was hier hängt, hat jemand gemacht.</Bildunterschrift>
      </Heftseite>
    ),
    rechts: (f) => (
      <Heftseite
        lage="rechts" kolumne="Umschlag" folio={f}
        weg={{ text: "Aufschlagen", zu: "/inhalt" }}
      >
        <Kicker>Ausgabe 001</Kicker>
        <Vorspann>Mode · Interior · Kunst</Vorspann>
        <Fliesstext>
          Ein Heft, eine Hülle. Jede Sektion eine Doppelseite. Geblättert wird mit
          dem Rad, dem Balken, der Leertaste oder dem Griffregister an der Kante —
          und jede Doppelseite hat ihre eigene Adresse.
        </Fliesstext>
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
            seiten={heftSeiten({ aufSprung, ohneInhalt: true })}
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
          Auf breiten Geräten der Vorspann dieser Doppelseite; auf dem Telefon
          das Verzeichnis selbst. Grund: die linke Seite — und damit die
          Navigation aus X5 — ist bei ≤ 820 px nicht zu sehen (siehe
          `PlatteBand`). Lieber die Navigation als der Satz darüber: das
          Verzeichnis ist der Zweck dieser Seite, der Satz ihre Begleitung.
        */}
        <div className="hx-nur-breit">
          <Fliesstext>
            Das ist die Ordnung dieses Hefts. Wer wissen will, was PAWN ist, liest
            vorn. Wer kaufen will, blättert nach hinten — dort liegt das Verzeichnis.
            Beides ist einen Griff entfernt, und keines drängt sich vor.
          </Fliesstext>
        </div>
        <div className="hx-nur-schmal">
          {ohneInhalt ? null : (
            <Inhaltsverzeichnis
              seiten={heftSeiten({ aufSprung, ohneInhalt: true })}
              aufSprung={aufSprung}
            />
          )}
        </div>
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
  seiten.push(welt({
    schluessel: "haeuser",
    pfad: `${S}/haeuser`,
    kolumne: "Unsere Häuser",
    titel: "Jedes Haus ein eigenes Kapitel.",
    ton: "nacht",
    nummer: 8,
    platte: "haeuser-werkbank",
    plattenAlt: "Eine alte Holzwerkbank vor weißer Wand, darauf gefaltetes Leinen, eine Garnrolle, eine Schere und ein Falzbein.",
    kicker: "Sektion 08 · Unsere Häuser",
    text: "Ein Haus ist bei PAWN kein Verkäuferkonto, sondern eine Handschrift mit einer Nummer. Es bringt seine eigene Farbe, seine eigene Schrift und seinen eigenen Ton mit — und behält sie, auch hier im Heft.",
    unterschrift: "Werkbank, Haus in Arbeit.",
    weg: { text: "Deine DNA", zu: `${S}/deine-dna` },
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

  /* ——— 12+ Das Verzeichnis ———
     Der Katalog. In diesem Schritt drei Doppelseiten ohne Stücke: die zwölf je
     Doppelseite kommen mit X6, und sie brauchen die Datenbank. Der leere Zustand
     ist ausgeschrieben und nicht weggelassen — eine Doppelseite ohne Erklärung
     gibt es im Heft nicht. */
  for (let n = 1; n <= VERZEICHNIS_SEITEN; n++) {
    const nummer = seiten.length + 1;
    seiten.push(bau({
      schluessel: `verzeichnis-${n}`,
      pfad: `/verzeichnis/${n}`,
      kolumne: "Das Verzeichnis",
      titel: "Das Verzeichnis",
      sektion: "verzeichnis",
      reiter: n === 1 ? "Verzeichnis" : undefined,
      ton: "papier",
      nummer,
      links: (f) => (
        <Heftseite lage="links" kolumne="Das Verzeichnis" folio={f}>
          {/* Die Platte trägt nur das erste Blatt des Katalogs. Auf den übrigen
              steht der Satz ohne den schwarzen Block — der Block ist die Lösung
              für Text ÜBER einem Bild, und ohne Bild wäre er nur eine Fläche. */}
          {n === 1 ? (
            <>
              <Platte
                name="boutique-objekte"
                alt="Eine Marmorplatte mit einer hellen Vase, einer schwarzen Schale, zwei gestapelten Büchern und einem bernsteinfarbenen Glas."
              />
              <AufPlatte>
                <Kicker>{`Verzeichnis · Blatt ${n} von ${VERZEICHNIS_SEITEN}`}</Kicker>
                <Schlagzeile>Zwölf Stücke je Doppelseite.</Schlagzeile>
              </AufPlatte>
            </>
          ) : (
            <Kicker>{`Verzeichnis · Blatt ${n} von ${VERZEICHNIS_SEITEN}`}</Kicker>
          )}
        </Heftseite>
      ),
      rechts: (f) => (
        <Heftseite
          lage="rechts" kolumne="Das Verzeichnis" folio={f}
          weg={n === VERZEICHNIS_SEITEN
            ? { text: "Zurück zum Inhalt", zu: "/inhalt" }
            : { text: "Weiterblättern", zu: `/verzeichnis/${n + 1}` }}
        >
          <Fliesstext>
            Sechs links, sechs rechts, auf dem Telefon vier je Seite. Geblättert
            wird, nicht nachgeladen. Dieses Blatt ist leer, weil die Datenbank
            gerade nicht antwortet — nicht, weil kein Stück da wäre.
          </Fliesstext>
          <Bildunterschrift>
            Der Katalog wächst mit den Stücken, nicht mit dem Gerüst.
          </Bildunterschrift>
        </Heftseite>
      ),
    }));
  }

  return seiten;
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
        {/* Auf dem Telefon steht die Platte hier als Band — die linke Seite ist
            dort nicht zu sehen (siehe `PlatteBand`). Auf breiten Geräten ist
            dieses Band ausgeblendet und die Platte füllt die linke Seite. */}
        <PlatteBand name={a.platte} alt={a.plattenAlt} />
        {/* Auf dem Telefon ein Block über der Platte, auf breiten Geräten nur
            eine Gruppe ohne eigenen Grund — siehe `hx-satz-block` in heft.css. */}
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
