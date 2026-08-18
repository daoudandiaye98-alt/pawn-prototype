/* @vitest-environment node */
/**
 * Die Wache über die zwei Listen der Welt-Felder.
 *
 * `src/lib/weltFelder.ts` ist die Wahrheit (Formular, Werkseite, Boutique,
 * Zertifikat lesen von dort). `supabase/functions/_shared/weltWissen.ts` ist
 * ihre Kopie für die Edge Functions, die nicht aus `src/` importieren können.
 * Zwei Listen derselben Sache sind nur erlaubt, solange dieser Test sie
 * zusammenhält: ein Feld, das nur in einer von beiden steht, fällt hier auf —
 * nicht erst, wenn die KI ein Feld übersieht, das das Formular längst füllt.
 */
import { describe, it, expect } from "vitest";
import { WELTEN, WELT_FELDER } from "../lib/weltFelder";
import { WELT_SCHLUESSEL, alsWelt, weltFelderZeilen } from "../../supabase/functions/_shared/weltWissen";

describe("weltWissen spiegelt weltFelder", () => {
  it.each(WELTEN.map((w) => [w]))("%s: gleiche Schlüssel, gleiche Reihenfolge, gleiche Labels", (welt) => {
    expect(WELT_SCHLUESSEL[welt].map(([s, l]) => [s, l]))
      .toEqual(WELT_FELDER[welt].map((f) => [f.schluessel, f.label]));
  });

  it("liest nur gefüllte Felder, in Welt-Reihenfolge", () => {
    const zeilen = weltFelderZeilen("Kunst", { jahr: "2026", technik: " Öl auf Leinwand ", zustand: "" });
    expect(zeilen).toEqual(["Technik: Öl auf Leinwand", "Jahr: 2026"]);
  });

  it("eine unbekannte Welt fällt auf Mode zurück, statt zu werfen", () => {
    expect(alsWelt("Schmuck")).toBe("Mode");
    expect(weltFelderZeilen(null, { material: "Wolle" })).toEqual(["Material: Wolle"]);
  });
});
