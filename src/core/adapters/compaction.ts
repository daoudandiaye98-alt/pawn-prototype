// Event-log compaction adapter.
//
// Purpose: prevent the localStorage event log from growing unbounded during
// long sessions. Not wired yet — enable by setting CORE_COMPACTION_ENABLED=true
// once the round-trip round-trip test suite covers snapshot save + restore.

import type { DomainEvent } from "../types/events";
import type { DomainState } from "../reducers/root";
import { rootReducer } from "../reducers/root";

export const CORE_COMPACTION_ENABLED = false;
export const COMPACTION_EVENT_THRESHOLD = 500;
export const COMPACTION_BYTE_THRESHOLD = 256 * 1024;

const SNAPSHOT_KEY = "pawn.core.snapshot.v1";
const SNAPSHOT_VERSION = 1;

export interface Snapshot {
  v: number;
  at: string;
  state: DomainState;
}

export function shouldCompact(events: readonly DomainEvent[], serialisedBytes: number): boolean {
  return events.length >= COMPACTION_EVENT_THRESHOLD || serialisedBytes >= COMPACTION_BYTE_THRESHOLD;
}

export function fold(events: readonly DomainEvent[], initial: DomainState): DomainState {
  let s = initial;
  for (const e of events) s = rootReducer(s, e);
  return s;
}

export function saveSnapshot(state: DomainState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Snapshot = { v: SNAPSHOT_VERSION, at: new Date().toISOString(), state };
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function loadSnapshot(): DomainState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed.v !== SNAPSHOT_VERSION) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(SNAPSHOT_KEY); } catch { /* ignore */ }
}
