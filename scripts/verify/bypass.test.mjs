import { test } from "node:test";
import assert from "node:assert/strict";
import { bypassOrigin, begrenzeBypass } from "./bypass.mjs";

test("A manual foreign Vercel page cannot grant itself the bypass", () => {
  assert.equal(bypassOrigin("https://foreign.vercel.app", true), "");
  assert.equal(bypassOrigin("https://preview.vercel.app", false), "https://preview.vercel.app");
  assert.equal(bypassOrigin("https://pawn.vision", true), "https://pawn.vision");
  assert.equal(bypassOrigin("https://pawn.vision.evil.test", false), "");
});

test("Browser secret is origin-bound, including redirects and third-party resources", async () => {
  let handler;
  await begrenzeBypass({ route: async (_, h) => { handler = h; } }, "https://pawn.vision", "test-secret");
  const calls = [];
  const route = url => ({
    request: () => ({ url: () => url, headers: () => ({ accept: "*/*", "x-vercel-protection-bypass": "inherited" }) }),
    fetch: async options => { calls.push({ kind: "fetch", ...options }); return { status: 302 }; },
    fulfill: async options => { calls.push({ kind: "fulfill", ...options }); },
    continue: async options => { calls.push({ kind: "continue", ...options }); },
  });
  await handler(route("https://pawn.vision/redirect"));
  assert.equal(calls[0].headers["x-vercel-protection-bypass"], "test-secret");
  assert.equal(calls[0].maxRedirects, 0);
  assert.equal(calls[1].response.status, 302);
  for (const url of ["https://external.test/redirected", "https://db.supabase.co/image", "http://pawn.vision/"]) {
    await handler(route(url));
    assert.equal(calls.at(-1).kind, "continue");
    assert.equal(calls.at(-1).headers["x-vercel-protection-bypass"], undefined);
    assert.equal(calls.at(-1).headers.accept, "*/*");
  }
});

test("Missing gate approval never installs a secret-bearing browser route", async () => {
  let installed = false;
  await begrenzeBypass({ route: async () => { installed = true; } }, "", "test-secret");
  assert.equal(installed, false);
});
