import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { rootReducer } from "../reducers/root";
import type { DomainEvent } from "../types/events";
import { asIdentityId, asProductId, asEventId } from "../types/ids";

const meId = asIdentityId("me");

function makeEvent<T extends DomainEvent["type"]>(
  type: T,
  payload: Extract<DomainEvent, { type: T }>["payload"],
): DomainEvent {
  return { id: asEventId(`t_${Math.random()}`), at: new Date().toISOString(), type, actor: meId, payload } as DomainEvent;
}

describe("marketplace reducer — cart", () => {
  it("adds a line and increments qty on repeat add", () => {
    const s0 = buildSeedState();
    const productId = asProductId("prd_001");
    const s1 = rootReducer(s0, makeEvent("cart.item_added", { identityId: meId, productId, size: "M" }));
    const s2 = rootReducer(s1, makeEvent("cart.item_added", { identityId: meId, productId, size: "M" }));
    expect(s2.marketplace.carts[meId].lines).toHaveLength(1);
    expect(s2.marketplace.carts[meId].lines[0].qty).toBe(2);
  });

  it("removes a line", () => {
    const s0 = buildSeedState();
    const productId = asProductId("prd_001");
    const s1 = rootReducer(s0, makeEvent("cart.item_added", { identityId: meId, productId, size: "M" }));
    const s2 = rootReducer(s1, makeEvent("cart.item_removed", { identityId: meId, productId, size: "M" }));
    expect(s2.marketplace.carts[meId].lines).toHaveLength(0);
  });

  it("setQty of 0 drops the line", () => {
    const s0 = buildSeedState();
    const productId = asProductId("prd_001");
    const s1 = rootReducer(s0, makeEvent("cart.item_added", { identityId: meId, productId, size: "M" }));
    const s2 = rootReducer(s1, makeEvent("cart.qty_set", { identityId: meId, productId, size: "M", qty: 0 }));
    expect(s2.marketplace.carts[meId].lines).toHaveLength(0);
  });

  it("cleared cart is empty", () => {
    const s0 = buildSeedState();
    const productId = asProductId("prd_001");
    const s1 = rootReducer(s0, makeEvent("cart.item_added", { identityId: meId, productId, size: "M" }));
    const s2 = rootReducer(s1, makeEvent("cart.cleared", { identityId: meId }));
    expect(s2.marketplace.carts[meId].lines).toHaveLength(0);
  });
});

describe("product & designer registration is idempotent-ish", () => {
  it("has seeded catalog", () => {
    const s = buildSeedState();
    expect(Object.keys(s.marketplace.products).length).toBeGreaterThan(0);
    expect(Object.keys(s.marketplace.designers).length).toBeGreaterThan(0);
  });
});
