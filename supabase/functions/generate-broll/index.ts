// Generative B-Roll (Stufe 2/3) — Provider-Interface. Ohne Key: sauberer Fehler.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });

    const { campaign_id, tier, provider } = await req.json() as { campaign_id?: string; tier?: "accent" | "full"; provider?: string };
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const p = (provider ?? "kling").toLowerCase();
    const key = p === "runway" ? Deno.env.get("RUNWAY_API_KEY") : Deno.env.get("KLING_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({
        error: "provider_not_configured",
        message: `Provider ${p} ist noch nicht eingerichtet. Bitte API-Key hinterlegen.`,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert request row
    const { data: row, error } = await admin.from("generation_requests").insert({
      campaign_id, tier: tier ?? "accent", provider: p, status: "requested", requested_by: user_id,
    } as never).select("id").single();
    if (error) throw error;

    // TODO: Provider-Call:
    //   Kling: POST https://api.kling.ai/v1/videos/generate  (Bearer $KLING_API_KEY)
    //   Runway: POST https://api.runwayml.com/v1/text_to_video
    // Bei Erfolg: generation_requests.status='done', result_url

    return new Response(JSON.stringify({ id: (row as { id: string }).id, status: "requested", provider: p }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
