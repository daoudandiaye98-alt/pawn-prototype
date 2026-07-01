import { describe, it, expect } from "vitest";
import { createEventLog } from "../events/log";
import { emit } from "../events/emit";
import { asIdentityId, asProductId } from "../types/ids";

describe("event log", () => {
  it("appends events in order", () => {
    const log = createEventLog();
    emit(log, { type: "cart.item_added", actor: asIdentityId("me"), payload: { identityId: asIdentityId("me"), productId: asProductId("p1"), size: "M" } });
    emit(log, { type: "cart.cleared", actor: asIdentityId("me"), payload: { identityId: asIdentityId("me") } });
    const all = log.all();
    expect(all).toHaveLength(2);
    expect(all[0].type).toBe("cart.item_added");
    expect(all[1].type).toBe("cart.cleared");
  });

  it("stamps id and at on emit", () => {
    const log = createEventLog();
    const e = emit(log, { type: "cart.cleared", actor: asIdentityId("me"), payload: { identityId: asIdentityId("me") } });
    expect(e.id).toBeTruthy();
    expect(e.at).toBeTruthy();
  });

  it("cursor advances", () => {
    const log = createEventLog();
    expect(log.cursor()).toBe(0);
    emit(log, { type: "cart.cleared", actor: asIdentityId("me"), payload: { identityId: asIdentityId("me") } });
    expect(log.cursor()).toBe(1);
  });
});
