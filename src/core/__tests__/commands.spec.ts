import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { addToCart, clearCart, proposeMutation } from "../commands";
import { asIdentityId, asProductId } from "../types/ids";

const meId = asIdentityId("me");
const productId = asProductId("prd_001");

describe("commands", () => {
  it("addToCart returns a cart.item_added event", () => {
    const s = buildSeedState();
    const result = addToCart(s, { identityId: meId, productId, size: "M" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("cart.item_added");
    }
  });

  it("clearCart returns a cart.cleared event", () => {
    const s = buildSeedState();
    const result = clearCart(s, { identityId: meId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.events[0].type).toBe("cart.cleared");
  });

  it("proposeMutation rejects unknown identity", () => {
    const s = buildSeedState();
    const result = proposeMutation(s, { identityId: asIdentityId("nope"), to: { structure: 0.9 }, rationale: "test" });
    expect(result.ok).toBe(false);
  });
});
