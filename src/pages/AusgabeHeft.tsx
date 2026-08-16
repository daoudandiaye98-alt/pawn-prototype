/**
 * Teil M2 — die Ordnung des Hefts.
 *
 * Sieben Doppelseiten, sechs Blätter. Die Dramaturgie: erst Haltung, dann
 * Auswahl, dann Handlung.
 *
 *   1  Innenumschlag        | Titel
 *   2  Impressum            | Editorial            ← Haltung
 *   3  Mode                 | Mode                 ← Auswahl
 *   4  Interior             | Interior
 *   5  Kunst                | Kunst
 *   6  Die Häuser           | Die Häuser
 *   7  Das Verzeichnis      | Rückseite            ← Handlung
 *
 * Farbrhythmus: Mode und Kunst kippen auf Nacht, Interior und die Häuser
 * bleiben Papier. So wechselt es dreimal, ohne zu flackern.
 *
 * Jeder Text hängt an `site_content` — ohne Code änderbar. Kein Text behauptet
 * eine Zahl, die nicht gedeckt ist.
 *
 * Bilder: die Platten aus M8 fehlen noch (403 beim Abruf). Die Bildflächen
 * bleiben deshalb leer statt gefüllt mit Ersatz.
 */
import { useParams } from "react-router-dom";
import { Heft, type HeftBlatt } from "@/features/heft/Heft";
import { Seo } from "@/components/palace/Seo";
import { Editable } from "@/components/palace/Editable";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";
import {
  Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile, Vorspann,
} from "@/features/heft/Seitenrahmen";

const AUSGABE = "Ausgabe 001";

/* ————————————————— Die Seiten ————————————————— */

function Innenumschlag() {
  return (
    <Heftseite ton="nacht" aussen="links" kolumne="Umschlag" folio={2}>
      <Bildunterschrift>
        <Editable contentKey="heft.innenumschlag">
          Ein Heft erscheint, wenn genug zu zeigen ist. Nicht wöchentlich, nicht nach Plan.
        </Editable>
      </Bildunterschrift>
    </Heftseite>
  );
}

function Titel() {
  return (
    <Heftseite aussen="rechts" kolumne={AUSGABE} folio={3}
      weg={{ text: "Die Häuser dieser Ausgabe", zu: "/designers/all" }}>
      <PawnWordmark className="heft-titel-marke" />
      <h1 className="heft-titel-ausgabe">{AUSGABE}</h1>
      <div className="heft-titel-haltung">
        <p><Editable contentKey="heft.titel.zeile_1">Der kuratierte Raum</Editable></p>
        <p><Editable contentKey="heft.titel.zeile_2">Mode · Interior · Kunst</Editable></p>
        <p><Editable contentKey="heft.titel.zeile_3">Was hier hängt, hat jemand gemacht.</Editable></p>
      </div>
    </Heftseite>
  );
}

function Impressum() {
  return (
    <Heftseite aussen="links" kolumne="Impressum" folio={4}
      weg={{ text: "Impressum", zu: "/impressum" }}>
      <Kicker>{AUSGABE}</Kicker>
      <Fliesstext>
        <Editable contentKey="heft.impressum.text">
          Herausgegeben von PAWN. Jede Seite dieses Hefts gehört einem Haus; PAWN stellt den
          Raum, nicht die Handschrift. Wer hier erscheint, ist aufgenommen worden — nicht
          eingekauft.
        </Editable>
      </Fliesstext>
      <Bildunterschrift>
        <Editable contentKey="heft.impressum.fuss">
          Die Häuser dieser Ausgabe stehen auf Seite 12.
        </Editable>
      </Bildunterschrift>
    </Heftseite>
  );
}

function Editorial() {
  return (
    <Heftseite aussen="rechts" kolumne="Editorial" folio={5}
      weg={{ text: "Wofür PAWN steht", zu: "/vision" }}>
      <Schlagzeile>
        <Editable contentKey="heft.editorial.schlagzeile">Ein Raum, keine Auslage.</Editable>
      </Schlagzeile>
      <Vorspann>
        <Editable contentKey="heft.editorial.vorspann">
          Ein Marktplatz zeigt, was sich verkauft. Ein Heft zeigt, was jemand gemacht hat —
          und lässt ihm den Platz dafür.
        </Editable>
      </Vorspann>
      <Fliesstext>
        <Editable contentKey="heft.editorial.text">
          Deshalb steht hier kein Raster aus Kacheln, sondern eine Folge von Seiten. Jedes Haus
          bekommt seine eigene. Wer blättert, sieht ein Werk nach dem anderen, nicht dreißig
          nebeneinander.
        </Editable>
      </Fliesstext>
    </Heftseite>
  );
}

interface WeltAngabe {
  name: string;
  pfad: string;
  ton: "papier" | "nacht";
  folioLinks: number;
  schluessel: string;
  schlagzeile: string;
  text: string;
}

const WELTEN: WeltAngabe[] = [
  {
    name: "Mode", pfad: "/mode", ton: "nacht", folioLinks: 6, schluessel: "mode",
    schlagzeile: "Was man anzieht, ist eine Entscheidung.",
    text: "Kleidung, die von Menschen entworfen und gefertigt wurde, deren Namen man kennt.",
  },
  {
    name: "Interior", pfad: "/interior", ton: "papier", folioLinks: 8, schluessel: "interior",
    schlagzeile: "Ein Raum wird von wenigen Dingen entschieden.",
    text: "Stücke für Wohnungen, die nicht aussehen wollen wie ein Katalog.",
  },
  {
    name: "Kunst", pfad: "/kunst", ton: "nacht", folioLinks: 10, schluessel: "kunst",
    schlagzeile: "Ein Werk beantwortet nichts.",
    text: "Arbeiten, die an einer Wand hängen und dort bleiben, weil sie es wert sind.",
  },
];

function WeltLinks({ w }: { w: WeltAngabe }) {
  return (
    <Heftseite ton={w.ton} aussen="links" kolumne={w.name.toUpperCase()} folio={w.folioLinks}>
      <Kicker>Welt</Kicker>
      <Schlagzeile>
        <Editable contentKey={`heft.welt.${w.schluessel}.schlagzeile`}>{w.schlagzeile}</Editable>
      </Schlagzeile>
    </Heftseite>
  );
}

function WeltRechts({ w }: { w: WeltAngabe }) {
  return (
    <Heftseite ton={w.ton} aussen="rechts" kolumne={w.name.toUpperCase()} folio={w.folioLinks + 1}
      weg={{ text: `${w.name} ansehen`, zu: w.pfad }}>
      <Vorspann>
        <Editable contentKey={`heft.welt.${w.schluessel}.text`}>{w.text}</Editable>
      </Vorspann>
    </Heftseite>
  );
}

function HaeuserLinks() {
  return (
    <Heftseite aussen="links" kolumne="Die Häuser" folio={12}>
      <Kicker>{AUSGABE}</Kicker>
      <Schlagzeile>
        <Editable contentKey="heft.haeuser.schlagzeile">Die Häuser dieser Ausgabe</Editable>
      </Schlagzeile>
    </Heftseite>
  );
}

function HaeuserRechts() {
  return (
    <Heftseite aussen="rechts" kolumne="Die Häuser" folio={13}
      weg={{ text: "Alle Häuser", zu: "/designers/all" }}>
      <Fliesstext>
        <Editable contentKey="heft.haeuser.text">
          Jedes Haus bekommt in diesem Heft seine eigene Doppelseite. Wer schon eingezogen ist,
          steht im Verzeichnis.
        </Editable>
      </Fliesstext>
    </Heftseite>
  );
}

function Verzeichnis() {
  return (
    <Heftseite aussen="links" kolumne="Das Verzeichnis" folio={14}
      weg={{ text: "In die Boutique", zu: "/shop" }}>
      <Kicker>Übergang</Kicker>
      <Schlagzeile>
        <Editable contentKey="heft.verzeichnis.schlagzeile">Das Verzeichnis</Editable>
      </Schlagzeile>
      <Fliesstext>
        <Editable contentKey="heft.verzeichnis.text">
          Hinter dieser Seite endet das Heft und beginnt der Katalog: dieselbe Sprache,
          nur ohne Drehung.
        </Editable>
      </Fliesstext>
    </Heftseite>
  );
}

function Rueckseite() {
  return (
    <Heftseite ton="nacht" aussen="rechts" kolumne="Für Designer" folio={15}
      weg={{ text: "Ein Haus eröffnen", zu: "/apply" }}>
      <Schlagzeile>
        <Editable contentKey="heft.rueckseite.schlagzeile">Jeder beginnt als Bauer.</Editable>
      </Schlagzeile>
      <Vorspann>
        <Editable contentKey="heft.rueckseite.text">
          Rang entsteht aus dem, was ein Haus baut und verkauft. Er ist nicht käuflich.
        </Editable>
      </Vorspann>
    </Heftseite>
  );
}

/* ————————————————— Das Heft ————————————————— */

export default function AusgabeHeft() {
  const { seite } = useParams<{ seite?: string }>();

  const blaetter: HeftBlatt[] = [
    { schluessel: "titel", vorn: <Titel />, rueck: <Impressum /> },
    { schluessel: "editorial", vorn: <Editorial />, rueck: <WeltLinks w={WELTEN[0]} /> },
    { schluessel: "mode", vorn: <WeltRechts w={WELTEN[0]} />, rueck: <WeltLinks w={WELTEN[1]} /> },
    { schluessel: "interior", vorn: <WeltRechts w={WELTEN[1]} />, rueck: <WeltLinks w={WELTEN[2]} /> },
    { schluessel: "kunst", vorn: <WeltRechts w={WELTEN[2]} />, rueck: <HaeuserLinks /> },
    { schluessel: "haeuser", vorn: <HaeuserRechts />, rueck: <Verzeichnis /> },
  ];
  const startSeite = Math.max(1, Math.min(blaetter.length + 1, Number(seite) || 1));

  return (
    <>
      <Seo
        title={`${AUSGABE} — PAWN`}
        description="Die laufende Ausgabe von PAWN. Ein Heft, das man blättert: Mode, Interior und Kunst aus unabhängigen Häusern."
        // Bis M2 und M8 durch sind: nicht in den Index. Kontrolle 2.7.
        noindex
      />
      <Heft
        titel={AUSGABE}
        adresse="/ausgabe/001"
        startSeite={startSeite}
        blaetter={blaetter}
        grundLinks={<Innenumschlag />}
        grundRechts={<Rueckseite />}
      />
    </>
  );
}
