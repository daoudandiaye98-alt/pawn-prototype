import { test } from "node:test";
import assert from "node:assert/strict";
import { fertigesDeployment, gleicherBau, sichereAdresse, warteAufBau } from "./deployment.mjs";
const sha = "a".repeat(40);
test("Ein alter Erfolg darf einen neueren Fehler nicht verdecken", () => {
  const d = [{ id: 1, sha, production_environment: false }];
  const s = { 1: [
    { id: 1, state: "success", created_at: "2026-09-11T10:00:00Z", environment_url: "https://pawn-test.vercel.app" },
    { id: 2, state: "failure", created_at: "2026-09-11T11:00:00Z" },
  ] };
  assert.equal(fertigesDeployment(d, s, sha, false), null);
});
test("Vorschau muss Commit und Umgebung treffen", () => {
  const d = [{ id: 1, sha, production_environment: false }];
  const s = { 1: [{ id: 1, state: "success", created_at: "2026-09-11T10:00:00Z", environment_url: "https://pawn-test.vercel.app" }] };
  assert.equal(fertigesDeployment(d, s, sha, false), "https://pawn-test.vercel.app");
  assert.equal(fertigesDeployment(d, s, "b".repeat(40), false), null);
  assert.equal(fertigesDeployment(d, s, sha, true), null);
});
test("Unbekannte Ziele erhalten kein Umgehungsgeheimnis", () => {
  for (const u of ["http://pawn.vision", "https://pawn.vision.evil.test", "https://user:pass@pawn.vision", "https://evil.test"]) {
    assert.throws(() => sichereAdresse(u));
  }
});
test("Nur ein unveraenderter Bau dieses Commits zaehlt", () => {
  assert.equal(gleicherBau({ commit: sha, dirty: false }, sha), true);
  for (const m of [{ commit: sha }, { commit: sha, dirty: true }, { commit: "b".repeat(40), dirty: false }]) {
    assert.equal(gleicherBau(m, sha), false);
  }
});
test("Wartet ueber alten Bau und SPA-Fallback hinweg auf die richtige Version", async () => {
  let calls = 0;
  const adresse = await warteAufBau({ adresse: "https://pawn.vision", sha, versuche: 3, pause: async () => {},
    fetcher: async () => {
      calls++;
      return { ok: true, json: async () => {
        if (calls === 1) throw new Error("HTML");
        return { commit: calls === 2 ? "b".repeat(40) : sha, dirty: false };
      } };
    },
  });
  assert.equal(adresse, "https://pawn.vision");
  assert.equal(calls, 3);
});
test("Eine alte Live-Version erzeugt einen Fehler statt eines gruenen Tests", async () => {
  await assert.rejects(warteAufBau({ adresse: "https://pawn.vision", sha, versuche: 2, pause: async () => {},
    fetcher: async () => ({ ok: true, json: async () => ({ commit: "b".repeat(40), dirty: false }) }),
  }), /Kein erreichbarer Bau/);
});
