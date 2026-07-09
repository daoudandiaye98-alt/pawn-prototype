// Dispatcher-Stub für PAWN-eigene Social-Kanäle. Bis META/TIKTOK-Keys da sind,
// meldet die Function 'not_configured' und markiert den Queue-Eintrag als failed.
// Wenn Keys existieren: hier später den echten Content-Posting-Call implementieren.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { queue_id } = await req.json() as { queue_id?: string };
    if (!queue_id) return new Response(JSON.stringify({ error: "queue_id required" }), { status: 400, headers: corsHeaders });

    const { data: row, error } = await admin.from("posting_queue")
      .select("id, channel, campaign_id, status")
      .eq("id", queue_id).maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: corsHeaders });

    const channel = row.channel as string;
    const providerConfigured =
      (channel === "pawn_instagram" && Deno.env.get("META_ACCESS_TOKEN") && Deno.env.get("IG_BUSINESS_ID")) ||
      (channel === "pawn_tiktok" && Deno.env.get("TIKTOK_CLIENT_KEY") && Deno.env.get("TIKTOK_CLIENT_SECRET")) ||
      (channel === "pawn_youtube" && Deno.env.get("YOUTUBE_ACCESS_TOKEN"));

    if (!providerConfigured) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "integration.dispatched", actor: "system",
        payload: { queue_id, channel, status: "not_configured" }, schema_version: 1,
      });
      return new Response(JSON.stringify({ status: "not_configured", channel }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Provider-spezifischer Content-Post.
    // Instagram Graph API (Business): POST /{ig-user-id}/media → dann /media_publish
    // TikTok Content Posting API:     POST /post/publish/video/init
    // YouTube Shorts:                 POST /upload/youtube/v3/videos
    // Bei Erfolg: posting_queue.status='posted', posted_url, posted_at

    await admin.from("domain_events").insert({
      id: crypto.randomUUID(), type: "integration.dispatched", actor: "system",
      payload: { queue_id, channel, status: "queued_for_provider" }, schema_version: 1,
    });

    return new Response(JSON.stringify({ status: "queued_for_provider", channel }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
