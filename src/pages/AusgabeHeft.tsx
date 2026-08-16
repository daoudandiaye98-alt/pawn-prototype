/**
 * Teil M1 — der Prüfstand für den Wendel: vier leere Blätter, sonst nichts.
 *
 * Diese Seite gibt es, damit der Mechanismus aus `features/heft` allein
 * abgenommen werden kann, bevor M2 Inhalt darauf setzt. Sie ersetzt noch nichts:
 * `/ausgabe` bleibt vorerst unverändert.
 */
import { useParams } from "react-router-dom";
import { Heft, type HeftBlatt } from "@/features/heft/Heft";
import { Seo } from "@/components/palace/Seo";

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

const BLAETTER = 4;

export default function AusgabeHeft() {
  const { seite } = useParams<{ seite?: string }>();
  const startSeite = Math.max(1, Math.min(BLAETTER + 1, Number(seite) || 1));

  // Leserichtung: Grund links (02) · Blatt 0 vorn (03) · Blatt 0 rück (04) · …
  const blaetter: HeftBlatt[] = Array.from({ length: BLAETTER }, (_, i) => ({
    schluessel: `blatt-${i}`,
    vorn: <Leerseite nummer={3 + i * 2} aussen="rechts" kopf={i === 0 ? "Ausgabe 001" : undefined} />,
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
