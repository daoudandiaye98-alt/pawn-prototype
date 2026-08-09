/**
 * Teil 39 AP4 — UWG §7 Ein-Klick-Abmeldung, ohne Login. Der Lead-Link in jeder Akquise-E-Mail
 * zeigt hierher: https://pawn.vision/akquise-abmelden?lead=<uuid>. Die Lead-ID selbst ist der
 * Token (unratebar als v4-UUID) — kein zusätzliches Geheimnis nötig, kein Konto vorausgesetzt.
 * Setzt opt_out dauerhaft (Sende-Pfade prüfen das bereits) und hält fest, wann.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { lead_id } = (await req.json().catch(() => ({}))) as { lead_id?: string };
    if (!lead_id || !UUID_RE.test(lead_id)) return json({ ok: false, error: "ungueltige_id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: lead } = await admin.from("acquisition_leads").select("id, opt_out").eq("id", lead_id).maybeSingle();
    if (!lead) return json({ ok: true, already: true }); // unbekannte/gelöschte ID: still ok, kein Informationsleck über Existenz nötig

    if (!(lead as { opt_out: boolean }).opt_out) {
      await admin.from("acquisition_leads").update({
        opt_out: true, status: "abgemeldet", unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", lead_id);
      await admin.from("ai_actions_log").insert({
        source: "akquise-abmelden", action: "unsubscribe", params: { lead_id } as never, status: "ok",
      } as never);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
