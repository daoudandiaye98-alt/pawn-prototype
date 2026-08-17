/**
 * Der Korb hält ein echtes Stück aus der Datenbank.
 *
 * **Der Fehler, den dieser Test festhält.** Der Korb speichert Zeilen aus
 * Stück-Kennung und Größe; angezeigt wird eine Zeile nur, wenn das Stück im
 * Bestand des Ladens steht. Dieser Bestand kam ausschließlich aus der Saat, und
 * die ist mit Absicht leer (keine erfundenen Daten, keine fremden Markennamen).
 * Ein Stück aus der Datenbank stand also nie darin: die Zeile wurde geschrieben
 * und fiel beim Anzeigen heraus. „In den Korb" bestätigte, und der Korb blieb
 * leer.
 *
 * Deshalb prüft dieser Test beides zusammen — die Anmeldung UND die Zeile. Ein
 * Test nur auf die Zeile hätte den Fehler nie gesehen; genau das war der Fall.
 */
import { describe, it, expect } from "vitest";
import { buildSeedState } from "../seed";
import { rootReducer } from "../reducers/root";
import * as commands from "../commands";
import type { DomainEvent } from "../types/events";
import type { Designer, Product } from "../types/entities";
import { asBrandId, asDesignerId, asEventId, asIdentityId, asProductId } from "../types/ids";

const meId = asIdentityId("me");

/** Befehle liefern rohe Ereignisse; der Laden braucht sie gestempelt. */
function stempeln(rohe: { type: string; actor: unknown; payload: unknown }[]): DomainEvent[] {
  return rohe.map((e, i) => ({
    ...e, id: asEventId(`t_${i}_${Math.random()}`), at: new Date().toISOString(),
  })) as DomainEvent[];
}

const stueck: Product = {
  id: asProductId("db_stueck_1"),
  slug: "leinenmantel",
  name: "Leinenmantel",
  designerId: asDesignerId("db_haus_1"),
  brandId: asBrandId("haus-eins"),
  price: 480,
  category: "" as Product["category"],
  gender: "" as Product["gender"],
  world: "Mode",
  colors: [],
  sizes: ["M"],
  status: "Active" as Product["status"],
  description: "",
  genomeAffinity: {},
};

const haus: Designer = {
  id: asDesignerId("db_haus_1"),
  slug: "haus-eins",
  name: "Haus Eins",
  location: "", slogan: "", bio: "",
  brandIds: [asBrandId("haus-eins")],
  memberSince: "", followers: 0, collections: 0, productsCount: 0, featuredIn: 0,
};

function laden() {
  let s = buildSeedState();
  const anmeldung = commands.registerStueck(s, { identityId: meId, product: stueck, designer: haus });
  expect(anmeldung.ok).toBe(true);
  if (!anmeldung.ok) return s;
  for (const e of stempeln(anmeldung.events)) s = rootReducer(s, e);
  const legen = commands.addToCart(s, { identityId: meId, productId: stueck.id, size: "M" });
  expect(legen.ok).toBe(true);
  if (!legen.ok) return s;
  for (const e of stempeln(legen.events)) s = rootReducer(s, e);
  return s;
}

describe("Korb — echte Stücke aus der Datenbank", () => {
  it("kennt das Stück nach dem Anmelden", () => {
    const s = laden();
    expect(s.marketplace.products[stueck.id as string]?.name).toBe("Leinenmantel");
  });

  it("kennt auch sein Haus — sonst gruppiert die Kasse ins Leere", () => {
    const s = laden();
    expect(s.marketplace.designers[haus.id as string]?.name).toBe("Haus Eins");
  });

  it("die Korbzeile findet ihr Stück", () => {
    const s = laden();
    const zeilen = s.marketplace.carts[meId].lines;
    expect(zeilen).toHaveLength(1);
    /* Genau die Prüfung, die vorher fehlte: die Zeile allein genügt nicht. */
    expect(s.marketplace.products[zeilen[0].productId as string]).toBeDefined();
  });

  it("ohne Anmeldung bliebe die Zeile eine Zeile ohne Stück", () => {
    let s = buildSeedState();
    const legen = commands.addToCart(s, { identityId: meId, productId: stueck.id, size: "M" });
    if (legen.ok) for (const e of stempeln(legen.events)) s = rootReducer(s, e);
    expect(s.marketplace.carts[meId].lines).toHaveLength(1);
    expect(s.marketplace.products[stueck.id as string]).toBeUndefined();
  });
});
