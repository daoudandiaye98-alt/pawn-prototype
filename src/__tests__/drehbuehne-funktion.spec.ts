/**
 * Die Drehbühne der Function `anprobe` — die reine Logik aus
 * supabase/functions/_shared/drehbuehne.ts.
 *
 * Wichtigste Zusage: Ein nicht-kommerziell lizenziertes Anprobe-Modell (IDM-VTON und
 * Verwandte, CC BY-NC-SA 4.0) wird nie gerufen, auch wenn es in ai_config steht.
 * PAWN verkauft; die Lizenz verbietet genau das.
 */
import { describe, expect, it } from "vitest";
import {
  ansichtAusDatei, ansichtenStand, ansichtPfad, ansichtPrompt, anprobePrompt, AVATAR_PROMPT,
  BILDMODELL, bildParameter, centJeBild, darfAnsichtenStarten, erlaubtesModell, KOLORS, LAUF_GILT_MS, MAX_VERSUCHE,
  NICHT_KOMMERZIELL, notizKurz, stueckeAusAuftrag, stueckeDerAnprobe,
} from "../../supabase/functions/_shared/drehbuehne";

describe("Lizenzwache", () => {
  it("ruft IDM-VTON nie, auch wenn es konfiguriert ist", () => {
    expect(erlaubtesModell("fal-ai/idm-vton", KOLORS)).toBe(KOLORS);
    expect(erlaubtesModell("  FAL-AI/IDM-VTON  ", BILDMODELL)).toBe(BILDMODELL);
    expect(erlaubtesModell("someone/catvton-flux", BILDMODELL)).toBe(BILDMODELL);
    expect(erlaubtesModell("levihsu/ootdiffusion", BILDMODELL)).toBe(BILDMODELL);
  });
  // Prüferfund 24.11.: die Wache kannte nur EINE Schreibweise je Modell.
  it("erkennt jede Schreibweise: Bindestrich, Unterstrich, Leerzeichen", () => {
    for (const m of ["fal-ai/cat-vton", "fal-ai/ootd", "fal-ai/stable-viton", "x/IDM_VTON", "y/stable viton", "z/CatVTON"]) {
      expect(erlaubtesModell(m, BILDMODELL), m).toBe(BILDMODELL);
    }
    expect(erlaubtesModell("fal-ai/fashn/tryon/v1.5", BILDMODELL)).toBe("fal-ai/fashn/tryon/v1.5");
    expect(erlaubtesModell("fal-ai/bootdrop-edit", BILDMODELL)).toBe("fal-ai/bootdrop-edit");   // eng: kein Treffer mitten im Wort
  });
  it("lässt erlaubte Modelle durch und fällt bei Leerem auf den Ersatz", () => {
    expect(erlaubtesModell("fal-ai/nano-banana/edit", BILDMODELL)).toBe("fal-ai/nano-banana/edit");
    expect(erlaubtesModell(undefined, BILDMODELL)).toBe(BILDMODELL);
    expect(erlaubtesModell(42, KOLORS)).toBe(KOLORS);
  });
});

describe("Auftrag", () => {
  it("nimmt bis zu drei verschiedene Stücke, das zuerst genannte zuerst", () => {
    expect(stueckeAusAuftrag({ product_id: "a", product_ids: ["a", "b", "c", "d"] })).toEqual(["a", "b", "c"]);
    expect(stueckeAusAuftrag({ product_ids: [" b ", "", 7, "b"] })).toEqual(["b"]);
    expect(stueckeAusAuftrag({})).toEqual([]);
  });
  it("liest die Stücke einer Anprobe aus dem Auftrag, sonst das eine", () => {
    expect(stueckeDerAnprobe({ stuecke: ["x", "y"] }, "x")).toEqual(["x", "y"]);
    expect(stueckeDerAnprobe(null, "x")).toEqual(["x"]);
    expect(stueckeDerAnprobe({ stuecke: [] }, "x")).toEqual(["x"]);
  });
});

describe("Ansichten im Eimer", () => {
  it("legt Seite und Rücken neben das Hauptbild", () => {
    expect(ansichtPfad("u", "a1", "vorne")).toBe("u/anproben/a1.jpg");
    expect(ansichtPfad("u", "a1", "seite")).toBe("u/anproben/a1-seite.jpg");
    expect(ansichtPfad("u", "a1", "hinten")).toBe("u/anproben/a1-hinten.jpg");
  });
  it("erkennt nur die eigenen Dateien", () => {
    expect(ansichtAusDatei("a1", "a1.jpg")).toBe("vorne");
    expect(ansichtAusDatei("a1", "a1-hinten.jpg")).toBe("hinten");
    expect(ansichtAusDatei("a1", "a10.jpg")).toBeNull();
    expect(ansichtAusDatei("a1", "a1-oben.jpg")).toBeNull();
  });
});

describe("Anweisungen an das Bildmodell", () => {
  it("nennt jedes Stück mit seiner Bildnummer und schützt die Person", () => {
    const t = anprobePrompt([{ name: "Mantel Ilse", notiz: "Wolle, handgewebt" }, { name: "Tasche Oda" }]);
    expect(t).toContain("Image 2: Mantel Ilse (Wolle, handgewebt)");
    expect(t).toContain("Image 3: Tasche Oda");
    expect(t).toContain("as one outfit");
    expect(t).toMatch(/same face, skin tone, hair, body shape/);
    expect(t).toMatch(/Do not invent logos/);
  });
  it("hält Hausnotizen einzeilig und kurz", () => {
    expect(notizKurz("Zeile eins\nZeile zwei\tTab")).toBe("Zeile eins Zeile zwei Tab");
    expect(notizKurz("x".repeat(400)).length).toBe(160);
    expect(notizKurz(null)).toBe("");
  });
  it("dreht für Seite und Rücken und folgt den Produktbildern", () => {
    expect(ansichtPrompt("hinten", [{ name: "Mantel" }])).toMatch(/turned 180 degrees/);
    expect(ansichtPrompt("seite", [{ name: "Mantel" }])).toMatch(/turned 90 degrees/);
    expect(ansichtPrompt("hinten", [{ name: "Mantel" }])).toMatch(/show the back of a piece/);
  });
  it("gibt dem Avatar einen festen Rahmen", () => {
    expect(AVATAR_PROMPT).toMatch(/head to toe/);
  });
  it("schickt Seitenverhältnis und Auflösung nur an Modelle, die sie kennen", () => {
    expect(bildParameter(BILDMODELL)).toEqual({ aspect_ratio: "4:5", resolution: "2K" });
    expect(bildParameter(BILDMODELL, "4K")).toEqual({ aspect_ratio: "4:5", resolution: "4K" });
    expect(bildParameter(BILDMODELL, "8K")).toEqual({ aspect_ratio: "4:5", resolution: "2K" });
    expect(bildParameter("fal-ai/nano-banana/edit")).toEqual({});
  });
});

describe("Stand der Nachansichten", () => {
  it("liest einen leeren oder fremden Auftrag als offen", () => {
    expect(ansichtenStand(null)).toEqual({ status: "offen", seit: undefined, versuche: 0 });
    expect(ansichtenStand({ ansichten: { status: "quatsch", versuche: -2 } }).status).toBe("offen");
  });
  it("startet nicht doppelt und nicht endlos", () => {
    const jetzt = Date.parse("2026-11-24T12:00:00Z");
    const frisch = { status: "laeuft" as const, seit: "2026-11-24T11:59:00Z", versuche: 1 };
    expect(darfAnsichtenStarten(frisch, jetzt)).toBe(false);
    expect(darfAnsichtenStarten({ ...frisch, seit: new Date(jetzt - LAUF_GILT_MS - 1).toISOString() }, jetzt)).toBe(true);
    expect(darfAnsichtenStarten({ status: "fehler", versuche: MAX_VERSUCHE }, jetzt)).toBe(false);
    expect(darfAnsichtenStarten({ status: "offen", versuche: 0 }, jetzt)).toBe(true);
  });
  it("behält nur bekannte fehlende Ansichten", () => {
    expect(ansichtenStand({ ansichten: { status: "fertig", fehlend: ["hinten", "oben"] } }).fehlend).toEqual(["hinten"]);
  });
});

/*
 * Keine Function darf ein nicht-kommerziell lizenziertes Anprobe-Modell als festen Wert
 * tragen. Belegter Anlass (24.11.2026): `fal-ai/idm-vton` stand als Ersatzmodell in
 * `anprobe` UND `generate-tryon` — beide erzeugen Bilder für verkaufte Ware.
 * Eng gefasst: nur Modell-Kennungen in Anführungszeichen, keine Kommentare.
 */
describe("Lizenz — kein Nicht-kommerziell-Modell in den Functions", () => {
  it("keine Function nennt idm-vton, catvton, ootd oder stableviton als Modell", async () => {
    const { readdirSync, readFileSync, existsSync } = await import("node:fs");
    const basis = "supabase/functions";
    const funde: string[] = [];
    for (const ordner of readdirSync(basis)) {
      const datei = `${basis}/${ordner}/index.ts`;
      if (!existsSync(datei)) continue;
      const text = readFileSync(datei, "utf8");
      // Jede Modellkennung in Anführungszeichen, gegen dieselbe Wache wie zur Laufzeit.
      for (const m of text.matchAll(/["'`]((?:fal-ai|fal|fashn|replicate)\/[^"'`\s]+)["'`]/g)) {
        if (NICHT_KOMMERZIELL.test(m[1])) funde.push(`${datei}: ${m[1]}`);
      }
    }
    expect(funde).toEqual([]);
  });
});

describe("Kosten je Bild", () => {
  it("bucht, was fal berechnet — und ai_config gewinnt", () => {
    expect(centJeBild(BILDMODELL)).toBe(15);
    expect(centJeBild(BILDMODELL, undefined, "4K")).toBe(30);
    expect(centJeBild("fal-ai/nano-banana/edit")).toBe(4);
    expect(centJeBild(KOLORS)).toBe(12);
    expect(centJeBild(BILDMODELL, 9)).toBe(9);
    expect(centJeBild(BILDMODELL, -1)).toBe(15);
  });
});
