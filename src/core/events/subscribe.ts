import type { DomainEvent, DomainEventType } from "../types/events";

export type MotionEventType =
  | "dna.updated"
  | "recommendation.reranked"
  | "mutation.proposed"
  | "ai.responding"
  | "chart.constructed"
  | "route.entered";

const MOTION_ALLOWED: ReadonlySet<MotionEventType> = new Set<MotionEventType>([
  "dna.updated", "recommendation.reranked", "mutation.proposed",
  "ai.responding", "chart.constructed", "route.entered",
]);

export interface MotionSignal {
  type: MotionEventType;
  at: string;
  payload?: Record<string, unknown>;
}

type MotionHandler = (signal: MotionSignal) => void;
type EventHandler = (event: DomainEvent) => void;

const motionSubs = new Set<MotionHandler>();
const eventSubs = new Set<EventHandler>();

export function subscribeToMotionEvents(handler: MotionHandler): () => void {
  motionSubs.add(handler);
  return () => motionSubs.delete(handler);
}

export function subscribeToEvents(handler: EventHandler): () => void {
  eventSubs.add(handler);
  return () => eventSubs.delete(handler);
}

/** Publish a UI-originated motion signal (route.entered, chart.constructed, ai.responding). */
export function publishMotion(type: MotionEventType, payload?: Record<string, unknown>) {
  if (!MOTION_ALLOWED.has(type)) return;
  const signal: MotionSignal = { type, at: new Date().toISOString(), payload };
  motionSubs.forEach((h) => h(signal));
}

/** Called internally by emit() — bridges whitelisted domain events onto motion bus. */
export function bridgeDomainToMotion(event: DomainEvent): void {
  const type = event.type as DomainEventType;
  if (type === "dna.updated" || type === "recommendation.reranked" || type === "mutation.proposed") {
    publishMotion(type, { ...event.payload } as Record<string, unknown>);
  }
}

export function notifyEventSubs(event: DomainEvent): void {
  eventSubs.forEach((h) => h(event));
}
