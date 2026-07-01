import { describe, it, expect } from "vitest";
import { buildSeedState, buildSeedEvents } from "../seed";
import { replay } from "../reducers/root";
import type { DomainState } from "../reducers/root";

// Audit IDs use a mutable counter + wall clock and are deliberately non-deterministic.
// Everything else must be bit-identical across builds.
const withoutAudit = (s: DomainState) => {
  const { audit: _audit, ...rest } = s;
  return rest;
};

describe("seed determinism", () => {
  it("produces identical domain state across independent builds", () => {
    const a = buildSeedState();
    const b = buildSeedState();
    expect(withoutAudit(a)).toEqual(withoutAudit(b));
  });

  it("replay(seedEvents) equals buildSeedState()", () => {
    const events = buildSeedEvents();
    const replayed = replay(events);
    const direct = buildSeedState();
    expect(withoutAudit(replayed)).toEqual(withoutAudit(direct));
  });
});
