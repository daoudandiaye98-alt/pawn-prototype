/**
 * Teil 39 AP4 — Resend sendet Bounce-/Beschwerde-Ereignisse als Svix-signierte Webhooks.
 * Ein harter Bounce oder eine Beschwerde ("complained") setzt den betroffenen Akquise-Lead
 * dauerhaft auf opt_out — kein weiterer Versand, egal welcher Kanal/Lauf.
 *
 * Verifikation: Svix-Standard (svix-id.svix-timestamp.body, HMAC-SHA256 mit dem Secret aus
 * RESEND_WEBHOOK_SECRET, Format "whsec_<base64>"). Ohne konfiguriertes Secret wird abgelehnt —
 * sonst könnte jeder beliebige Leads als "abgemeldet" markieren.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySvix(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): Promise<boolean> {
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = `${id}.${timestamp}.${body}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(new Uint8Array(mac));
  return signatureHeader.split(" ").some((entry) => {
    const [, sig] = entry.split(",");
    return sig ? timingSafeEqual(sig, expected) : false;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ ok: false, error: "not_configured" }, 501);

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  const body = await req.text();
  if (!svixId || !svixTimestamp || !svixSignature) return json({ ok: false, error: "missing_signature_headers" }, 400);

  const valid = await verifySvix(secret, svixId, svixTimestamp, body, svixSignature).catch(() => false);
  if (!valid) return json({ ok: false, error: "invalid_signature" }, 401);

  const payload = JSON.parse(body) as { type?: string; data?: { to?: string[]; bounce?: { type?: string } } };
  const type = payload.type ?? "";
  const isBounce = type === "email.bounced";
  const isComplaint = type === "email.complained";
  if (!isBounce && !isComplaint) return json({ ok: true, ignored: type });

  const recipients = (payload.data?.to ?? []).filter(Boolean);
  if (!recipients.length) return json({ ok: true, note: "no_recipients" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const bounceType = isComplaint ? "complaint" : (payload.data?.bounce?.type === "Transient" ? "soft" : "hard");
  // Ein weicher Bounce (voll, temporär) bekommt nur eine Notiz — kein dauerhafter Ausschluss.
  const shouldOptOut = isComplaint || bounceType === "hard";

  let touched = 0;
  for (const email of recipients) {
    const { data: leads } = await admin.from("acquisition_leads").select("id, opt_out").eq("email", email);
    for (const lead of (leads ?? []) as { id: string; opt_out: boolean }[]) {
      await admin.from("acquisition_leads").update({
        bounce_type: bounceType,
        ...(shouldOptOut ? { opt_out: true, status: "abgemeldet", unsubscribed_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      touched++;
    }
  }
  await admin.from("ai_actions_log").insert({
    source: "resend-webhook", action: type, params: { recipients, bounce_type: bounceType, touched } as never, status: "ok",
  } as never);
  return json({ ok: true, touched });
});
