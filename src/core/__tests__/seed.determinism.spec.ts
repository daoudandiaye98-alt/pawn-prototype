import { describe, it, expect } from "vitest";
import { buildSeedState, buildSeedEvents } from "../seed";
import { replay } from "../reducers/root";

describe("seed determinism", () => {
  it("produces identical state across independent builds", () => {
    const a = buildSeedState();
    const b = buildSeedState();
    expect(a).toEqual(b);
  });

  it("replay(seedEvents) equals buildSeedState()", () => {
    const events = buildSeedEvents();
    const replayed = replay(events);
    const direct = buildSeedState();
    expect(replayed).toEqual(direct);
  });
});
