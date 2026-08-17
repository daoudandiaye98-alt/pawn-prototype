import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { rootReducer } from "../reducers/root";
import type { DomainEvent } from "../types/events";
import type { Product } from "../types/entities";
import { asDesignerId, asIdentityId, asProductId, asEventId } from "../types/ids";

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

/**
 * Hier stand einmal `has seeded catalog`: der Bestand des Ladens müsse nach dem
 * Aufbau der Saat nicht leer sein. Der Test war nach dem Designgesetz falsch —
 * `src/core/seed/*` hat leere Arrays, und so bleibt es (keine erfundenen Daten,
 * keine fremden Markennamen).
 *
 * **Er hat trotzdem auf etwas Echtes gezeigt, nur aus der falschen Richtung.**
 * Was er absichern wollte, war nicht „die Saat ist voll", sondern „der Korb kann
 * seine Stücke auflösen". Genau das ging kaputt: die Saat wurde geleert, der
 * Test blieb rot, niemand las ihn mehr — und darunter verschwand still, dass
 * eine Korbzeile ohne angemeldetes Stück beim Anzeigen herausfällt.
 *
 * Deshalb ist er ersetzt und nicht gelöscht. Die neue Fassung prüft dieselbe
 * Sorge gegen die richtige Quelle: ein leerer Bestand ist erlaubt, ein Korb, der
 * Stücke verliert, nicht.
 */
describe("Bestand und Korb — was die Saat garantiert und was nicht", () => {
  it("darf leer starten: die Saat ist kein Katalog", () => {
    const s = buildSeedState();
    expect(Object.keys(s.marketplace.products)).toHaveLength(0);
    expect(Object.keys(s.marketplace.designers)).toHaveLength(0);
  });

  it("löst jede Korbzeile im Bestand auf — sonst verliert der Korb Stücke", () => {
    const s0 = buildSeedState();
    const produkt: Product = {
      id: asProductId("db_1"), slug: "leinenmantel", name: "Leinenmantel",
      designerId: asDesignerId("haus_1"), price: 480,
      category: "" as Product["category"], gender: "" as Product["gender"],
      world: "Mode", colors: [], sizes: ["M"],
      status: "Active" as Product["status"], description: "", genomeAffinity: {},
    };
    const s1 = rootReducer(s0, makeEvent("product.registered", { product: produkt }));
    const s2 = rootReducer(s1, makeEvent("cart.item_added", {
      identityId: meId, productId: produkt.id, size: "M",
    }));

    /* Die eigentliche Zusicherung: JEDE Zeile findet ihr Stück. Genau diese
       Prüfung fehlte — die alte Fassung sah nur auf die Zeile. */
    for (const zeile of s2.marketplace.carts[meId].lines) {
      expect(s2.marketplace.products[zeile.productId as string]).toBeDefined();
    }
    expect(s2.marketplace.carts[meId].lines).toHaveLength(1);
  });
});
