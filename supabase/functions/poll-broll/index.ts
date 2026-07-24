/**
 * Poll fal.ai queue for pending generation_requests, download completed
 * clips into campaign-assets bucket (same-origin!), notify designer.
 * Body: { request_ids: string[] }
 */
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
    if (!user_id) return json({ error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) return json({ error: "provider_not_configured" }, 402);

    const { request_ids } = await req.json().catch(() => ({})) as { request_ids?: string[] };
    if (!Array.isArray(request_ids) || request_ids.length === 0) return json({ error: "request_ids_required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: rows } = await admin.from("generation_requests")
      .select("id, status, error, provider_handles, tier, campaign_id, created_at, campaigns!inner(designer_id, designers!inner(user_id, media_rights_granted_at))")
      .in("id", request_ids);
    if (!rows) return json({ ok: true, results: [] });

    const results: Array<{ id: string; status: string; result_url?: string; error?: string }> = [];

    for (const r of rows as unknown as Array<{
      id: string; status: string; error: string | null; provider_handles: Record<string, unknown> | null;
      tier: string; campaign_id: string; created_at: string;
      campaigns: { designer_id: string; designers: { user_id: string; media_rights_granted_at: string | null } };
    }>) {
      if (r.status === "done" || r.status === "failed") {
        results.push({ id: r.id, status: r.status });
        continue;
      }
      // Timeout check
      const age = Date.now() - new Date(r.created_at).getTime();
      if (age > 8 * 60 * 1000) {
        await admin.from("generation_requests").update({ status: "failed", error: "timeout" } as never).eq("id", r.id);
        results.push({ id: r.id, status: "failed", error: "timeout" });
        continue;
      }
      // provider_handles trägt die Warteschlangen-Kennungen (Teil 10a) — vorher lagen sie in
      // error und wurden beim Scheitern überschrieben. Alte, so noch nie gepollte Zeilen lesen
      // wir zur Sicherheit auch noch aus error (legacy-Fallback), nie umgekehrt.
      let handles = (r.provider_handles ?? {}) as { request_id?: string; status_url?: string; response_url?: string; image_url?: string };
      if (!handles.status_url && r.error) {
        try { handles = JSON.parse(r.error); } catch { /* noop */ }
      }
      if (!handles.status_url) {
        results.push({ id: r.id, status: r.status });
        continue;
      }
      try {
        const sr = await fetch(handles.status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
        const sj = await sr.json().catch(() => ({})) as { status?: string; response_url?: string };
        const st = String(sj.status ?? "").toUpperCase();
        if (st === "COMPLETED" || st === "OK") {
          // response_url kommt bevorzugt aus der Statusantwort selbst (fal liefert es dort mit),
          // ersatzweise aus den gespeicherten Handles — niemals ein Rückfall auf status_url, das
          // liefert nur den Warteschlangen-Status zurück, nicht das Ergebnis (Ursache von
          // no_video_url_in_response).
          const responseUrl = sj.response_url || handles.response_url;
          if (!responseUrl) {
            results.push({ id: r.id, status: r.status });
            continue;
          }
          const rr = await fetch(responseUrl, {
            headers: { "Authorization": `Key ${FAL_KEY}` },
          });
          const rj = await rr.json().catch(() => ({})) as {
            video?: { url?: string }; videos?: Array<{ url?: string }>; output?: { video?: { url?: string } }; url?: string;
          };
          const videoUrl = rj?.video?.url ?? rj?.videos?.[0]?.url ?? rj?.output?.video?.url ?? rj?.url ?? "";
          if (!videoUrl) {
            await admin.from("generation_requests").update({ status: "failed", error: "no_video_url_in_response" } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: "no_video_url" });
            continue;
          }
          // Fetch → upload to campaign-assets (same-origin!)
          const videoResp = await fetch(videoUrl);
          if (!videoResp.ok) {
            await admin.from("generation_requests").update({ status: "failed", error: `download_${videoResp.status}` } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: `download_${videoResp.status}` });
            continue;
          }
          const bytes = new Uint8Array(await videoResp.arrayBuffer());
          const path = `${r.campaigns.designers.user_id}/broll/${r.id}.mp4`;
          const { error: upErr } = await admin.storage.from("campaign-assets")
            .upload(path, bytes, { contentType: "video/mp4", upsert: true });
          if (upErr) {
            await admin.from("generation_requests").update({ status: "failed", error: `upload_${upErr.message}` } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: upErr.message });
            continue;
          }
          const { data: signed } = await admin.storage.from("campaign-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
          const finalUrl = signed?.signedUrl ?? path;
          await admin.from("generation_requests").update({
            status: "done", result_url: finalUrl, error: null,
          } as never).eq("id", r.id);
          await admin.from("video_assets").insert({
            designer_id: r.campaigns.designer_id,
            campaign_id: r.campaign_id,
            url: finalUrl,
            source: "designer",
            video_dna: {
              provider: "fal", tier: r.tier,
              signatur: null, hook_typ: null, schnittrhythmus: null, palette: null,
              laenge_s: 5, modelltyp: "kinematisch",
            },
            rights_granted: !!r.campaigns.designers.media_rights_granted_at,
          } as never);
          await admin.from("notifications").insert({
            user_id: r.campaigns.designers.user_id,
            type: "campaign.broll_ready",
            title: "Deine Aufnahmen sind fertig",
            body: "PAWN hat einen kinematischen Clip erzeugt.",
            link: "/studio/kampagnen",
          } as never);
          results.push({ id: r.id, status: "done", result_url: finalUrl });
        } else if (st === "FAILED" || st === "ERROR") {
          await admin.from("generation_requests").update({ status: "failed", error: String(sj.status) } as never).eq("id", r.id);
          results.push({ id: r.id, status: "failed", error: String(sj.status) });
        } else {
          results.push({ id: r.id, status: r.status });
        }
      } catch (e) {
        results.push({ id: r.id, status: r.status, error: String((e as Error).message) });
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
