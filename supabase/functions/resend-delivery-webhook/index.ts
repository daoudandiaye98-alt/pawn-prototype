/**
 * Teil 34b — Offene Türen: Zustellungs-Status zurück an die Karte. Resend signiert Webhooks
 * im svix-Format (svix-id/svix-timestamp/svix-signature Header, HMAC-SHA256 über
 * "${id}.${timestamp}.${body}" mit dem in Resend angezeigten Signing-Secret). Ohne gültige
 * Signatur wird nichts verarbeitet — sonst könnte jeder falsche Zustellungsstände einspielen.
 *
 * Einmalige Einrichtung durch Daouda: in Resend unter Webhooks einen Endpoint auf diese
 * Funktions-URL anlegen (Events: email.delivered, email.bounced, email.complained), das dort
 * gezeigte Signing-Secret als RESEND_WEBHOOK_SECRET in Supabase hinterlegen.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function verifySvix(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): Promise<boolean> {
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = `${id}.${timestamp}.${body}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(sigBuf);
  return signatureHeader.split(" ").some((entry) => entry.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!secret) return json({ ok: false, error: "not_configured" }, 200);

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    const rawBody = await req.text();
    if (!svixId || !svixTimestamp || !svixSignature) return json({ ok: false, error: "missing_signature" }, 401);

    const valid = await verifySvix(secret, svixId, svixTimestamp, rawBody, svixSignature);
    if (!valid) return json({ ok: false, error: "invalid_signature" }, 401);

    const event = JSON.parse(rawBody) as { type?: string; data?: { email_id?: string; error?: { message?: string } } };
    const emailId = event.data?.email_id;
    if (!emailId) return json({ ok: true, ignored: true });

    let patch: Record<string, unknown> | null = null;
    if (event.type === "email.delivered") patch = { delivery_status: "zugestellt", delivery_error: null };
    else if (event.type === "email.bounced" || event.type === "email.complained") {
      patch = { delivery_status: "fehler", delivery_error: event.data?.error?.message ?? event.type };
    }
    if (!patch) return json({ ok: true, ignored: true });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });
    await admin.from("designer_opportunities" as never).update(patch as never).eq("resend_message_id", emailId);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
