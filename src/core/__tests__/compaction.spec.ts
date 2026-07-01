import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { fold, saveSnapshot, loadSnapshot, clearSnapshot, shouldCompact } from "../adapters/compaction";

describe("compaction", () => {
  it("fold with no events returns initial state", () => {
    const s = buildSeedState();
    expect(fold([], s)).toBe(s);
  });

  it("shouldCompact thresholds", () => {
    expect(shouldCompact([], 0)).toBe(false);
    expect(shouldCompact(new Array(600).fill(null), 0)).toBe(true);
    expect(shouldCompact([], 300 * 1024)).toBe(true);
  });

  it("snapshot round-trip preserves product count", () => {
    const s = buildSeedState();
    saveSnapshot(s);
    const restored = loadSnapshot();
    expect(restored).not.toBeNull();
    expect(Object.keys(restored!.marketplace.products)).toEqual(Object.keys(s.marketplace.products));
    clearSnapshot();
    expect(loadSnapshot()).toBeNull();
  });
});
