/**
 * Teil R8 — das sichtbare Zeichen an einem maschinell erzeugten Bild.
 *
 * Bis hierher stand dieser Aufkleber genau einmal im Code, fest eingebaut im
 * Première-Video der Landing (`PremiereSection.tsx`). Ab jetzt steht er an
 * einer Stelle und wird überall dorthin gehängt, wo ein Bild aus einer
 * Maschine kommt.
 *
 * Das ist NICHT dasselbe wie `AiDisclosureNote`: die sagt „hier spricht eine
 * KI mit dir" und hängt an Gesprächsflächen. Dieses Zeichen sagt „dieses Bild
 * hat eine Maschine gemacht". Zwei Pflichten, zwei Zeichen.
 *
 * Form nach Hausgesetz: harte Kante, kein Radius, Weiß auf Schwarz. Die Lage
 * bestimmt die aufrufende Fläche (`className`) — das Zeichen selbst weiß nicht,
 * wo es hängt.
 */
import { useI18n } from "@/lib/i18n";

export function KiBildZeichen({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title={t("kiBild.titel")}
      className={`pointer-events-none border-[1.5px] border-white bg-black px-2 py-1 text-[0.55rem] uppercase tracking-[0.22em] text-white ${className}`}
    >
      {t("kiBild.zeichen")}
    </span>
  );
}
