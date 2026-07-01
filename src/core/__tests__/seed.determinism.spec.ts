import { describe, it, expect } from "vitest";
import { buildSeedState, buildSeedEvents } from "../seed";
import { replay } from "../reducers/root";

describe("seed determinism", () => {
  it("produces identical marketplace + identity state across independent builds", () => {
    const a = buildSeedState();
    const b = buildSeedState();
    expect(a.marketplace).toEqual(b.marketplace);
    expect(a.identity).toEqual(b.identity);
  });

  it("replay(seedEvents) reconstructs marketplace + identity", () => {
    const replayed = replay(buildSeedEvents());
    const direct = buildSeedState();
    // AI/plugin defaults are initialized directly (not via events yet); only
    // event-sourced slices must match under replay.
    expect(replayed.marketplace).toEqual(direct.marketplace);
    expect(replayed.identity).toEqual(direct.identity);
  });
});
