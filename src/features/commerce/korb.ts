/**
 * Der eine Weg in den Korb — für Stücke, die aus der Datenbank kommen.
 *
 * **Der Fehler, den diese Datei behebt.** Der Korb speichert Zeilen aus
 * Stück-Kennung und Größe; die Angaben zum Stück holt er sich aus dem Bestand
 * des Ladens (`core`). Dieser Bestand kam ausschließlich aus `seed/products.ts`,
 * und der ist mit Absicht leer — Designgesetz: keine erfundenen Daten, keine
 * fremden Markennamen. Ein echtes Stück aus der Datenbank stand damit nie im
 * Bestand. Die Zeile wurde geschrieben, fand ihr Stück beim Anzeigen nicht und
 * fiel heraus: „In den Korb" bestätigte, und der Korb blieb leer.
 *
 * Gemessen an der Quelle: `src/core/seed/products.ts` (`const raw: RawProduct[] = []`)
 * und `src/store/cart.tsx` (`productById.get(line.productId)` → ohne Treffer
 * fällt die Zeile weg).
 *
 * Hier steht die Behebung, und zwar **einmal**: wer ein Stück in den Korb legt,
 * meldet es vorher im Bestand an. Kein zweiter Korb, kein zweiter Bestand.
 */
import { useCallback } from "react";
import {
  asBrandId, asDesignerId, asProductId, commands, defaultIdentityId, useCommand,
} from "@/core";
import type { Designer, Product } from "@/core";

/** Was ein Stück mitbringen muss, um in den Korb zu dürfen. */
export interface KorbStueck {
  id: string;
  slug: string;
  name: string;
  preis: number;
  welt: string | null;
  /** Das Foto. Ohne es zeigte der Korb eine gezeichnete Silhouette statt des Werks. */
  bild?: string | null;
  beschreibung?: string | null;
  groessen?: string[];
  haus?: { id: string; slug: string; name: string } | null;
}

/**
 * Aus der Datenbankzeile die Gestalt, die der Laden kennt.
 *
 * Die Felder, die es in der Datenbank nicht gibt (`category`, `gender`,
 * `genomeAffinity`), bleiben leer statt geraten. Sie werden im Korb und an der
 * Kasse nicht gelesen — und eine erfundene Kategorie wäre eine Behauptung.
 */
function alsProdukt(s: KorbStueck): Product {
  return {
    id: asProductId(s.id),
    slug: s.slug,
    name: s.name,
    designerId: asDesignerId(s.haus?.id ?? ""),
    brandId: asBrandId(s.haus?.slug ?? ""),
    price: s.preis,
    category: "" as Product["category"],
    gender: "" as Product["gender"],
    world: (s.welt ?? "Mode") as Product["world"],
    colors: [],
    sizes: s.groessen ?? [],
    status: "Active" as Product["status"],
    description: s.beschreibung ?? "",
    genomeAffinity: {},
    imageUrl: s.bild ?? undefined,
  };
}

function alsHaus(haus: NonNullable<KorbStueck["haus"]>): Designer {
  return {
    id: asDesignerId(haus.id),
    slug: haus.slug,
    name: haus.name,
    location: "",
    slogan: "",
    bio: "",
    brandIds: [asBrandId(haus.slug)],
    memberSince: "",
    followers: 0,
    collections: 0,
    productsCount: 0,
    featuredIn: 0,
  };
}

/**
 * Legt ein Stück in den Korb — und meldet es vorher an.
 *
 * Die Größe ist optional: ein Bild hat keine, ein Kleid schon. Ohne Angabe steht
 * eine leere Zeichenkette in der Zeile, genau wie bisher auf der Werkseite.
 */
export function useInDenKorb() {
  const dispatch = useCommand();
  return useCallback((stueck: KorbStueck, groesse = "") => {
    dispatch(commands.registerStueck, {
      identityId: defaultIdentityId,
      product: alsProdukt(stueck),
      designer: stueck.haus ? alsHaus(stueck.haus) : undefined,
    });
    dispatch(commands.addToCart, {
      identityId: defaultIdentityId,
      productId: asProductId(stueck.id),
      size: groesse,
    });
  }, [dispatch]);
}
