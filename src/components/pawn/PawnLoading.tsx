import { PawnFigurState } from "./PawnFigur";
import { useI18n } from "@/lib/i18n";

/** Teil 28a: ersetzt die generische animate-pulse-Fläche beim Laden einer Studio-Seite. */
export function PawnLoading({ className = "h-64" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-col items-center justify-center gap-3 bg-muted ${className}`}>
      <PawnFigurState pose="load" size={42} />
      <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.pawn.loading")}</p>
    </div>
  );
}
