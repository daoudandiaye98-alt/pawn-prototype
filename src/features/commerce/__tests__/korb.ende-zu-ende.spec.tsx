/**
 * Kontrolle 4.1, Ende zu Ende: **Werk in den Korb → Korb öffnen → das Stück ist
 * noch da, mit Name, Preis und Bild.**
 *
 * „Eine grüne Meldung ist kein Beweis" (ZERA-QA 04). Genau daran ist der Korb
 * gescheitert: „In den Korb" bestätigte, und danach war er leer — der Bestand
 * des Ladens kannte das Stück nicht, also fiel die Zeile beim Anzeigen heraus.
 * Kein Test hat das je bemerkt, weil alle nur die Zeile prüften, nie die Seite.
 *
 * Deshalb rendert dieser Test die **echte Korbseite** mit dem echten Laden, dem
 * echten `useInDenKorb` und dem echten `useCart`. Was ersetzt ist, steht unten
 * einzeln und mit Grund; ersetzt ist nur, was ins Netz greift oder nicht zum
 * Korb gehört.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { CoreProvider } from "@/core";
import { I18nProvider } from "@/lib/i18n";
import { useInDenKorb, type KorbStueck } from "../korb";

/*
 * Die Datenbank. Der Korb fragt sie nach Beständen (`useCartStockLimits`) —
 * ohne Antwort zeigt er keine Obergrenze, und das ist für diesen Test richtig:
 * geprüft wird, ob das Stück da ist, nicht wie viele davon.
 */
vi.mock("@/integrations/supabase/client", () => {
  /*
   * Eine Kette, die auf jedem Glied weitergeht UND selbst abwartbar ist —
   * genau wie die echte: `from().select()` lässt sich sowohl weiter verketten
   * (`.in(...)`) als auch direkt abwarten (`.then(...)`, so macht es die
   * Sprachschicht). Ohne beides bricht die Seite an einer Stelle ab, die mit
   * dem Korb nichts zu tun hat.
   */
  const leer = { data: [] as unknown[], error: null };
  const kette: Record<string, unknown> = {
    then: (aufloesen: (w: typeof leer) => unknown) => Promise.resolve(leer).then(aufloesen),
  };
  for (const glied of ["select", "in", "eq", "order", "limit", "range", "not", "or"]) {
    kette[glied] = () => kette;
  }
  kette.maybeSingle = () => Promise.resolve({ data: null, error: null });
  kette.single = () => Promise.resolve({ data: null, error: null });
  return {
    supabase: {
      from: () => kette,
      rpc: () => Promise.resolve(leer),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    },
  };
});

/* Die Hülle (Kopf, Fuß, Menü). Sie gehört zur Seite, aber nicht zum Korb. */
vi.mock("@/components/palace/PalaceLayout", () => ({
  PalaceLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

/* Die Vorschlagsreihe unter dem Korb — eigene Sache, eigener Test. */
vi.mock("@/features/commerce/CartRecommendations", () => ({
  CartRecommendations: () => null,
}));

const WERK: KorbStueck = {
  id: "db_werk_1",
  slug: "leinenmantel",
  name: "Leinenmantel",
  preis: 480,
  welt: "Mode",
  bild: "https://example.invalid/leinenmantel.jpg",
  groessen: ["M"],
  haus: { id: "haus_1", slug: "haus-eins", name: "Haus Eins" },
};

/** Der Griff: legt beim Zeichnen genau einmal das Werk in den Korb. */
function InDenKorbLegen() {
  const legen = useInDenKorb();
  return (
    <button type="button" data-testid="legen" onClick={() => legen(WERK, "M")}>
      In den Korb
    </button>
  );
}

async function korbMitWerk() {
  const { default: Cart } = await import("@/pages/Cart");
  const stand = render(
    <MemoryRouter>
      <CoreProvider>
        <I18nProvider>
          <InDenKorbLegen />
          <Cart />
        </I18nProvider>
      </CoreProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTestId("legen"));
  return stand;
}

describe("Kontrolle 4.1 — vom Werk in den Korb und zurück", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("zeigt das Stück nach dem Legen im Korb — mit Name, Preis und Bild", async () => {
    await korbMitWerk();

    /* Name — der Link auf das Werk trägt ihn. */
    const name = await screen.findByRole("link", { name: "Leinenmantel" });
    expect(name).toBeInTheDocument();

    /* Preis — irgendwo auf der Seite, in der Schreibweise der Oberfläche. */
    expect(screen.getAllByText(/480/).length).toBeGreaterThan(0);

    /* Bild — das echte Foto des Stücks, keine gezeichnete Silhouette. */
    const bild = screen.getByAltText("Leinenmantel") as HTMLImageElement;
    expect(bild.getAttribute("src")).toBe(WERK.bild);

    /* Und das Haus, weil die Kasse nach Haus gruppiert. */
    expect(screen.getAllByText("Haus Eins").length).toBeGreaterThan(0);
  });

  it("zeigt den leeren Korb, solange nichts drin liegt", async () => {
    const { default: Cart } = await import("@/pages/Cart");
    render(
      <MemoryRouter>
        <CoreProvider>
          <I18nProvider>
            <Cart />
          </I18nProvider>
        </CoreProvider>
      </MemoryRouter>,
    );
    /* Kein Stück, kein Link auf ein Stück — und kein Absturz. */
    expect(screen.queryByRole("link", { name: "Leinenmantel" })).toBeNull();
  });

  it("die Zeile überlebt das Neuladen — Anmeldung und Zeile sind beide dauerhaft", async () => {
    const { unmount } = await korbMitWerk();
    await screen.findByRole("link", { name: "Leinenmantel" });
    unmount();

    /*
     * Neu aufgebaut aus dem, was im Speicher liegt. Wäre die Anmeldung des
     * Stücks nicht dauerhaft, stünde hier wieder eine Zeile ohne Stück — der
     * Korb wäre nach dem Neuladen leer.
     */
    const { default: Cart } = await import("@/pages/Cart");
    render(
      <MemoryRouter>
        <CoreProvider>
          <I18nProvider>
            <Cart />
          </I18nProvider>
        </CoreProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "Leinenmantel" })).toBeInTheDocument();
  });
});
