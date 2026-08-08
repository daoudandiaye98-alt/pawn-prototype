import { useMemo, useState } from "react";

/**
 * Teil 31 — die Stimmungs-Maschine. Fünf Stimmungen, nirgends im Interface benannt: sie
 * zeigen sich ausschließlich in Bewegungscharakter (PawnFigur) und Wortwahl (Begrüßung/
 * Antipp-Zeilen). Berechnung deterministisch aus bereits geladenen Hub-Daten — kein
 * KI-Aufruf, keine Kosten. Priorität bei Konflikt: strahlend > sehnsucht > neugierig >
 * tatendrang > ruhig.
 */
export type PawnMood = "strahlend" | "tatendrang" | "neugierig" | "ruhig" | "sehnsucht";

export interface PawnMoodSignals {
  /** Stunden seit letztem Verkauf/Meilenstein, oder null wenn keiner bekannt ist. */
  saleOrMilestoneHoursAgo: number | null;
  /** Ein unerledigter, von PAWN vorbereiteter Zug wartet (z.B. eine vorgeschlagene Kampagne). */
  hasPendingMove: boolean;
  /** Blicke/Aktivität steigen gerade sichtbar gegenüber der Vorperiode. */
  activityRising: boolean;
  /** Alter des ältesten wartenden Elements in Tagen (Nachricht, Bestellung, Anfrage …). */
  oldestWaitingDays: number | null;
  /** Tage seit dem letzten Studio-Besuch vor diesem hier. */
  lastVisitDays: number | null;
}

const ALL_MOODS: PawnMood[] = ["strahlend", "tatendrang", "neugierig", "ruhig", "sehnsucht"];

function computeMood(s: PawnMoodSignals): PawnMood {
  if (s.saleOrMilestoneHoursAgo != null && s.saleOrMilestoneHoursAgo < 48) return "strahlend";
  if ((s.oldestWaitingDays != null && s.oldestWaitingDays > 7) || (s.lastVisitDays != null && s.lastVisitDays > 7)) return "sehnsucht";
  if (s.hasPendingMove) return "neugierig";
  if (s.activityRising) return "tatendrang";
  return "ruhig";
}

/** Debug-Override nur über ?pawnmood= in der URL — in Produktion nirgends beschriftet oder sichtbar. */
function debugMoodFromQuery(): PawnMood | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("pawnmood");
  return v && (ALL_MOODS as string[]).includes(v) ? (v as PawnMood) : null;
}

export interface PawnMoodResult {
  mood: PawnMood;
  /** Eine von fünf Idle-Varianten derselben Stimmung, einmal je Seitenaufruf gewählt. */
  variant: number;
}

export function usePawnMood(signals: PawnMoodSignals): PawnMoodResult {
  const debugMood = useMemo(() => debugMoodFromQuery(), []);
  const mood = debugMood ?? computeMood(signals);
  const [variant] = useState(() => Math.floor(Math.random() * 5));
  return { mood, variant };
}
