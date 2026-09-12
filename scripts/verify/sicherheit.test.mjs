import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("Stillgelegte Testkonten veraendern bei keiner Anfrage Daten", async () => {
  let handler;
  const source = readFileSync(new URL("../../supabase/functions/seed-testaccounts/index.ts", import.meta.url), "utf8");
  // Keine DB, kein Netz und keine Umgebungsvariablen: schon ein Zugriff darauf scheitert.
  runInNewContext(source, { Deno: { serve: h => { handler = h; } }, Response, JSON });
  assert.equal(typeof handler, "function");
  for (const method of ["GET", "POST", "OPTIONS"]) {
    const response = await handler(new Request("https://test.invalid", { method }));
    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), { error: "endpoint_retired" });
  }
  const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
  assert.match(config, /\[functions\.seed-testaccounts\]\s*verify_jwt\s*=\s*true/);
});
