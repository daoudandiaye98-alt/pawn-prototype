/**
 * Teil M1 — der Prüfstand für den Wendel: vier leere Blätter, sonst nichts.
 *
 * Diese Seite gibt es, damit der Mechanismus aus `features/heft` allein
 * abgenommen werden kann, bevor M2 Inhalt darauf setzt. Sie ersetzt noch nichts:
 * `/ausgabe` bleibt vorerst unverändert.
 */
import { Link, useParams } from "react-router-dom";
import { Heft, type HeftBlatt } from "@/features/heft/Heft";
import { Seo } from "@/components/palace/Seo";
import { Editable } from "@/components/palace/Editable";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/** Zweistellig, mit Tabellenziffern gesetzt (siehe heft.css). */
const folio = (n: number) => String(n).padStart(2, "0");

function Leerseite({ nummer, aussen, kopf }: { nummer: number; aussen: "links" | "rechts"; kopf?: string }) {
  return (
    <div className={`heft-leerseite aussen-${aussen}`}>
      {kopf ? <h1 className="heft-titelzeile">{kopf}</h1> : null}
      <span className="heft-folio">{folio(nummer)}</span>
    </div>
  );
}

/**
 * M4 — der Titel. Die Wortmarke groß, drei Zeilen Haltung, **ein** Weg hinein.
 * Kein zweiter Knopf.
 *
 * Die drei Zeilen und der Weg hängen an `site_content`, sind also ohne Code
 * änderbar. Die Rückfalltexte sind Verdichtungen bestehender, freigegebener
 * PAWN-Zeilen — keine neuen Behauptungen, keine Zahlen.
 *
 * Der Bauer fehlt noch: M4 verlangt dafür die erzeugte Aufnahme `titel-bauer`
 * aus M8, und die ist derzeit nicht abrufbar (403 vom Speicher). Die Fläche
 * dafür ist freigehalten, aber leer — lieber eine Lücke als ein Platzhalter.
 */
function Titelseite({ nummer }: { nummer: number }) {
  return (
    <div className="heft-leerseite heft-titel aussen-rechts">
      {/* Die Wortmarke ist ein Zeichen, keine Überschrift: ihr Klartext lautet
          „PWN", weil der Bauer das A ersetzt. Die Überschrift der Seite ist die
          Ausgabe — die liest auch eine Suchmaschine richtig. */}
      <PawnWordmark className="heft-titel-marke" />
      <h1 className="heft-titel-ausgabe">Ausgabe 001</h1>
      <div className="heft-titel-haltung">
        <p><Editable contentKey="heft.titel.zeile_1">Der kuratierte Raum</Editable></p>
        <p><Editable contentKey="heft.titel.zeile_2">Mode · Interior · Kunst</Editable></p>
        <p><Editable contentKey="heft.titel.zeile_3">Was hier hängt, hat jemand gemacht.</Editable></p>
      </div>
      <Link to="/designers/all" className="heft-weg-hinein">
        <Editable contentKey="heft.titel.weg">Die Häuser dieser Ausgabe</Editable>
        <span aria-hidden> →</span>
      </Link>
      <span className="heft-folio">{folio(nummer)}</span>
    </div>
  );
}

const BLAETTER = 4;

export default function AusgabeHeft() {
  const { seite } = useParams<{ seite?: string }>();
  const startSeite = Math.max(1, Math.min(BLAETTER + 1, Number(seite) || 1));

  // Leserichtung: Grund links (02) · Blatt 0 vorn (03) · Blatt 0 rück (04) · …
  const blaetter: HeftBlatt[] = Array.from({ length: BLAETTER }, (_, i) => ({
    schluessel: `blatt-${i}`,
    vorn: i === 0
      ? <Titelseite nummer={3} />
      : <Leerseite nummer={3 + i * 2} aussen="rechts" />,
    rueck: <Leerseite nummer={4 + i * 2} aussen="links" />,
  }));

  return (
    <>
      <Seo
        title="Ausgabe 001 — PAWN"
        description="Die laufende Ausgabe von PAWN. Ein Heft, das man blättert."
      />
      <Heft
        titel="Ausgabe 001"
        adresse="/ausgabe/001"
        startSeite={startSeite}
        blaetter={blaetter}
        grundLinks={<Leerseite nummer={2} aussen="links" />}
        grundRechts={<Leerseite nummer={3 + BLAETTER * 2} aussen="rechts" />}
      />
    </>
  );
}
