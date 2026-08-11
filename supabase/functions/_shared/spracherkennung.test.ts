// AUFTRAG "Keine Annahme ohne Beleg" Befund 1 — Regressionstest für harteSpracherkennung().
// Ausführen mit: deno test supabase/functions/_shared/spracherkennung.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { harteSpracherkennung } from "./spracherkennung.ts";

Deno.test("harteSpracherkennung: .nl-Domain ist nicht Deutsch", () => {
  assertEquals(harteSpracherkennung("https://studio-voorbeeld.nl", null, null), "en");
});

Deno.test("harteSpracherkennung: .de-Domain ist Deutsch", () => {
  assertEquals(harteSpracherkennung("https://atelier-beispiel.de", null, null), "de");
});

Deno.test("harteSpracherkennung: brasilianische Bio ohne Website ist Englisch", () => {
  assertEquals(
    harteSpracherkennung(null, "Cerâmica feita à mão em São Paulo, peças únicas.", "São Paulo, Brasilien"),
    "en",
  );
});

Deno.test("harteSpracherkennung: komplett leeres Profil ist Englisch (Befund 1 — kein Beleg, keine Voreinstellung)", () => {
  assertEquals(harteSpracherkennung(null, null, null), "en");
});

Deno.test("harteSpracherkennung: bayerische Bio ohne Website ist Deutsch", () => {
  assertEquals(
    harteSpracherkennung(null, "Handgemachte Keramik aus München – jedes Stück ein Unikat.", null),
    "de",
  );
});

Deno.test("harteSpracherkennung: Domain-Endung schlägt eine abweichende Bio-Sprache (Domain vor Bio)", () => {
  assertEquals(
    harteSpracherkennung("https://beispiel.de", "Handmade jewelry, one-of-a-kind pieces.", null),
    "de",
  );
});

Deno.test("harteSpracherkennung: nur ein DACH-Standort ohne Website/Bio reicht für Deutsch", () => {
  assertEquals(harteSpracherkennung(null, null, "Wien, Österreich"), "de");
});
