import { describe, it, expect, beforeEach } from "vitest";
import { CORE_EVENT_SCHEMA, createLocalStorageAdapter } from "../adapters/localStorage";
import type { DomainEvent } from "../types/events";

const anyEvent = (): DomainEvent =>
  ({
    id: "evt_test_1",
    at: new Date().toISOString(),
    actor: "system",
    type: "cart.cleared",
    payload: { identityId: "ident_default" },
  }) as DomainEvent;

describe("localStorage adapter round-trip", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists and reloads durable events", () => {
    const a = createLocalStorageAdapter("test", () => true);
    a.append([anyEvent()]);
    const b = createLocalStorageAdapter("test", () => true);
    expect(b.load()).toHaveLength(1);
  });

  it("discards payloads with mismatched schema", () => {
    window.localStorage.setItem(
      "pawn-eventlog-v1:test",
      JSON.stringify({ schema: CORE_EVENT_SCHEMA + 99, events: [anyEvent()] }),
    );
    const a = createLocalStorageAdapter("test", () => true);
    expect(a.load()).toEqual([]);
  });

  it("discards legacy unversioned array payloads", () => {
    window.localStorage.setItem("pawn-eventlog-v1:test", JSON.stringify([anyEvent()]));
    const a = createLocalStorageAdapter("test", () => true);
    expect(a.load()).toEqual([]);
  });
});
