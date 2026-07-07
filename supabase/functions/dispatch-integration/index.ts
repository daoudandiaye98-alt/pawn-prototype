// Dispatches events to configured integrations (webhook, gmail stub, instagram stub).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Body { integration_id?: string; event_type: string; payload: Record<string, unknown> }

async function signedPost(url: string, body: unknown, secret: string | null) {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-PAWN-Event": String((body as { event_type?: string })?.event_type ?? "") };
  if (secret) {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k, enc.encode(raw));
    headers["X-PAWN-Signature"] = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fetch(url, { method: "POST", headers, body: raw });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { integration_id, event_type, payload } = await req.json() as Body;
    if (!event_type) return new Response(JSON.stringify({ error: "event_type required" }), { status: 400, headers: corsHeaders });
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Resolve integrations to dispatch
    let integrations: { id: string; kind: string; label: string; config: Record<string, unknown>; enabled: boolean; event_types: string[] }[] = [];
    if (integration_id) {
      const { data } = await admin.from("ai_integrations").select("*").eq("id", integration_id).maybeSingle();
      if (data) integrations = [data as never];
    } else {
      const { data } = await admin.from("ai_integrations").select("*").eq("enabled", true).contains("event_types", [event_type]);
      integrations = (data ?? []) as never;
    }

    const results: { id: string; ok: boolean; note?: string }[] = [];
    for (const it of integrations) {
      try {
        if (it.kind === "webhook") {
          const targetUrl = String(it.config.url ?? "");
          if (!targetUrl) throw new Error("missing url");
          const secretKey = String(it.config.secret_env ?? "");
          const secret = secretKey ? Deno.env.get(secretKey) ?? null : null;
          const res = await signedPost(targetUrl, { event_type, payload }, secret);
          const ok = res.ok;
          await admin.from("domain_events").insert({
            id: crypto.randomUUID(), type: ok ? "integration.dispatched" : "integration.failed",
            actor: "system",
            payload: { integration_id: it.id, kind: it.kind, event_type, status: res.status },
            schema_version: 1,
          });
          results.push({ id: it.id, ok, note: `status ${res.status}` });
        } else if (it.kind === "gmail" || it.kind === "instagram") {
          // Stub: log intent; requires TODO wiring of provider SDKs.
          await admin.from("domain_events").insert({
            id: crypto.randomUUID(), type: "integration.dispatched",
            actor: "system",
            payload: { integration_id: it.id, kind: it.kind, event_type, note: "stub — awaiting credentials", config_keys: Object.keys(it.config) },
            schema_version: 1,
          });
          results.push({ id: it.id, ok: true, note: `stub ${it.kind}` });
        } else {
          results.push({ id: it.id, ok: false, note: "unsupported kind" });
        }
      } catch (e) {
        await admin.from("domain_events").insert({
          id: crypto.randomUUID(), type: "integration.failed",
          actor: "system",
          payload: { integration_id: it.id, kind: it.kind, event_type, error: (e as Error).message },
          schema_version: 1,
        });
        results.push({ id: it.id, ok: false, note: (e as Error).message });
      }
    }
    return new Response(JSON.stringify({ dispatched: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
