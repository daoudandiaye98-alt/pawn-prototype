import { describe, it, expect } from "vitest";
import { aufstellerDNA, hatSilhouette } from "./heftAufsteller";

describe("Aufsteller behalten Silhouette und bestehende DNA", () => {
  it("weist weisse Rechtecke und komplett leere Bilder zurueck", () => {
    expect(hatSilhouette(new Uint8Array([255,255,255,255, 255,255,255,255]))).toBe(false);
    expect(hatSilhouette(new Uint8Array(8))).toBe(false);
    expect(hatSilhouette([])).toBe(false);
  });
  it("behaelt auch gruene Kleidung und halbtransparente Kanten", () => {
    expect(hatSilhouette([0,255,0,255, 0,255,0,80, 0,0,0,0])).toBe(true);
  });
  it("veraendert weder Stil-DNA noch Display-Einstellungen", () => {
    const original = { material: "Wolle", heft: { scale: 1.2, position: [1,2], cutout_url: "alt" } };
    expect(aufstellerDNA(original, "neu")).toEqual({ material: "Wolle", heft: { scale: 1.2, position: [1,2], cutout_url: "neu" } });
    expect(original.heft.cutout_url).toBe("alt");
    expect(aufstellerDNA(null, "neu")).toEqual({ heft: { cutout_url: "neu" } });
  });
});
