import type { EventId } from "./ids";
import type { GenomeAxis } from "./entities";

export type ReasonCode =
  | "genome_alignment"
  | "saved_similar"
  | "follows_designer"
  | "collection_context"
  | "editorial_pick"
  | "cold_start";

export interface Provenance {
  reason: string;
  reasonCodes: ReasonCode[];
  sourceEventIds: EventId[];
  affectedAxes: GenomeAxis[];
  confidence: number; // 0..1
  at: string;
}
