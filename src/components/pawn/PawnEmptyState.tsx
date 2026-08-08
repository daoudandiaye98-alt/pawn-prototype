import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PawnFigurState } from "./PawnFigur";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 28a: PAWN als Leer-Zustand im Studio — Schlitzaugen, leicht geneigt, "Noch nichts
 * hier. Fangen wir an?" (Default, überschreibbar). Baut auf dem 26b-EmptyState auf; dort
 * bleibt der Icon-Slot weiterhin optional und ornamentfrei für alle Nicht-Studio-Stellen.
 */
export function PawnEmptyState({ title, description, action, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<PawnFigurState pose="shrug" size={42} />}
      title={title ?? t("studio.pawn.empty.title")}
      description={description}
      action={action}
      className={className}
    />
  );
}
