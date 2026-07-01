import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { getAllProducts, getAllDesigners, getCart, getRecommendedProducts, getAlignedDesigners } from "../selectors/marketplace";
import { getPlatformOverview, getGlobalDnaView } from "../selectors/admin";
import { getStudioOverview } from "../selectors/portal";
import { getIdentityDossier, defaultIdentityId } from "../selectors/identity";

describe("selector identity stability", () => {
  it("getAllProducts returns same reference for same state", () => {
    const s = buildSeedState();
    expect(getAllProducts(s)).toBe(getAllProducts(s));
  });
  it("getAllDesigners returns same reference for same state", () => {
    const s = buildSeedState();
    expect(getAllDesigners(s)).toBe(getAllDesigners(s));
  });
  it("getCart returns stable empty ref", () => {
    const s = buildSeedState();
    expect(getCart(s)).toBe(getCart(s));
  });
  it("getRecommendedProducts memoises per identity", () => {
    const s = buildSeedState();
    expect(getRecommendedProducts(s, defaultIdentityId)).toBe(getRecommendedProducts(s, defaultIdentityId));
  });
  it("getAlignedDesigners memoises per identity", () => {
    const s = buildSeedState();
    expect(getAlignedDesigners(s, defaultIdentityId)).toBe(getAlignedDesigners(s, defaultIdentityId));
  });
  it("getPlatformOverview memoises per state", () => {
    const s = buildSeedState();
    expect(getPlatformOverview(s)).toBe(getPlatformOverview(s));
  });
  it("getStudioOverview memoises per (state, designer)", () => {
    const s = buildSeedState();
    expect(getStudioOverview(s, "primary")).toBe(getStudioOverview(s, "primary"));
  });
  it("getGlobalDnaView memoises per state", () => {
    const s = buildSeedState();
    expect(getGlobalDnaView(s)).toBe(getGlobalDnaView(s));
  });
  it("getIdentityDossier memoises per identity", () => {
    const s = buildSeedState();
    expect(getIdentityDossier(s, defaultIdentityId)).toBe(getIdentityDossier(s, defaultIdentityId));
  });
});
