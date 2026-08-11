/**
 * PART 47 Befund 1 "Die Verlorenen" — Resend liefert eingehende Mails (event "email.received")
 * ebenfalls als Svix-signierten Webhook. Bislang gab es dafür keinerlei Verarbeitung im Code —
 * jede Antwort auf eine Akquise-Mail verschwand spurlos (0 von 47 je erfasst).
 *
 * Wichtig, ehrlich gesagt: dieser Endpunkt kann erst feuern, wenn Daouda für die empfangende
 * Domain/Subdomain (z. B. reply.pawn.vision) MX-Einträge bei Resend einrichtet — das ist eine
 * DNS-Entscheidung, die nicht aus einem Code-PR heraus getroffen werden kann. Bis dahin bleibt
 * `inbound_email_events` leer, und die manuelle Zuordnung im Admin-Feldzug (Tab "Im Gespräch")
 * ist der Weg, der schon heute funktioniert, unabhängig von dieser Funktion.
 *
 * Der Webhook-Payload von Resend ist nur Metadaten (from/to/subject/email_id/created_at) — der
 * Volltext bräuchte einen separaten API-Aufruf. Für die Zuordnung reicht die Absenderadresse:
 * genau ein eindeutiger Treffer in acquisition_leads.email wird automatisch verknüpft, alles
 * andere (kein Treffer, mehrdeutig) bleibt unverknüpft für die manuelle Prüfung — keine Schein-
 * Automatik, die nie zuverlässig feuert.
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

/** "Name <adresse@beispiel.de>" oder bloß "adresse@beispiel.de" → die reine Adresse, klein geschrieben. */
function extractEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/);
  const addr = (match ? match[1] : raw).trim().toLowerCase();
  return addr.includes("@") ? addr : null;
}

const TERMINAL_STATUSES = new Set(["beworben", "gewonnen"]);

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

  const payload = JSON.parse(body) as {
    type?: string;
    data?: { email_id?: string; from?: string; to?: string | string[]; subject?: string; created_at?: string };
  };
  const type = payload.type ?? "";
  if (type !== "email.received") return json({ ok: true, ignored: type });

  const data = payload.data ?? {};
  const fromEmail = extractEmail(data.from);
  const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
  const toEmail = extractEmail(toRaw);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (!fromEmail) {
    await admin.from("inbound_email_events").upsert({
      resend_email_id: data.email_id ?? null,
      from_email: data.from ?? "",
      to_email: toEmail,
      subject: data.subject ?? null,
      received_at: data.created_at ?? new Date().toISOString(),
      raw_payload: payload as never,
    }, { onConflict: "resend_email_id" });
    return json({ ok: true, note: "no_from_address" });
  }

  const { data: eventRow, error: insertError } = await admin.from("inbound_email_events").upsert({
    resend_email_id: data.email_id ?? null,
    from_email: fromEmail,
    to_email: toEmail,
    subject: data.subject ?? null,
    received_at: data.created_at ?? new Date().toISOString(),
    raw_payload: payload as never,
  }, { onConflict: "resend_email_id" }).select("id").maybeSingle();

  if (insertError || !eventRow) {
    return json({ ok: false, error: insertError?.message ?? "insert_failed" }, 500);
  }

  const { data: leads } = await admin.from("acquisition_leads").select("id, status, replied_at, reply_channel").ilike("email", fromEmail);
  const matches = (leads ?? []) as { id: string; status: string; replied_at: string | null; reply_channel: string | null }[];

  if (matches.length !== 1) {
    // kein Treffer oder mehrdeutig — bleibt unverknüpft, wartet auf manuelle Zuordnung.
    await admin.from("ai_actions_log").insert({
      source: "resend-inbound-webhook", action: "email_received", status: "ok",
      params: { from: fromEmail, matches: matches.length } as never,
    } as never);
    return json({ ok: true, matched: false, candidate_count: matches.length });
  }

  const lead = matches[0];
  const now = new Date().toISOString();
  if (TERMINAL_STATUSES.has(lead.status)) {
    // schon weiter als eine reine Antwort — nur den Zeitstempel nachtragen, nicht zurückstufen.
    await admin.from("acquisition_leads").update({
      replied_at: lead.replied_at ?? now, reply_channel: lead.reply_channel ?? "email",
    }).eq("id", lead.id);
  } else {
    await admin.from("acquisition_leads").update({
      status: "geantwortet", replied_at: now, reply_channel: "email", updated_at: now,
    }).eq("id", lead.id);
  }
  await admin.from("inbound_email_events").update({ matched_lead_id: lead.id, matched_at: now, matched_by: "auto" }).eq("id", eventRow.id);
  await admin.from("ai_actions_log").insert({
    source: "resend-inbound-webhook", action: "email_received", status: "ok",
    params: { from: fromEmail, lead_id: lead.id, previous_status: lead.status } as never,
  } as never);

  return json({ ok: true, matched: true, lead_id: lead.id });
});
