/**
 * Editionen — erzeugt je teilnehmendem Haus eine eigene Video-Version in dessen Signatur.
 * Admin-only. Body: { edition_id }.
 *
 * Läuft synchron (submit + poll je Haus, parallel über alle Häuser): das Ergebnis landet
 * NICHT sofort in video_assets — erst wenn der Designer im Studio "Umsetzen" wählt
 * (edition_participants.status 'pending' -> 'ready' hier, -> 'approved'/'declined' im Studio).
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const DEFAULT_TEMPLATE =
  "subtle fabric movement, slow cinematic camera push-in, monochrome high-fashion editorial, soft studio light, {designer_prompt}";

async function falSubmitAndPoll(
  falKey: string, model: string, body: Record<string, unknown>, timeoutMs: number,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const sj = await submit.json().catch(() => ({})) as Record<string, unknown>;
  if (!submit.ok) return { ok: false, message: String(sj?.detail ?? sj?.error ?? submit.statusText) };
  const statusUrl = String(sj.status_url ?? sj.statusUrl ?? "");
  const responseUrl = String(sj.response_url ?? sj.responseUrl ?? "");
  if (!statusUrl) return { ok: false, message: "no_status_url" };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const sr = await fetch(statusUrl, { headers: { "Authorization": `Key ${falKey}` } });
    const st = await sr.json().catch(() => ({})) as { status?: string };
    const up = String(st.status ?? "").toUpperCase();
    if (up === "COMPLETED" || up === "OK") {
      const rr = await fetch(responseUrl || statusUrl, { headers: { "Authorization": `Key ${falKey}` } });
      const rj = await rr.json().catch(() => ({})) as { video?: { url?: string }; url?: string };
      const url = rj?.video?.url ?? rj?.url ?? "";
      if (!url) return { ok: false, message: "no_video_url" };
      return { ok: true, url };
    }
    if (up === "FAILED" || up === "ERROR") return { ok: false, message: `provider_${up}` };
  }
  return { ok: false, message: "timeout" };
}

async function processParticipant(
  admin: SupabaseClient, falKey: string, model: string, template: string,
  edition: { id: string; theme: string; world: string | null },
  participant: { id: string; designer_id: string },
): Promise<void> {
  try {
    const { data: designer } = await admin.from("designers")
      .select("id, brand_name, user_id, house_number").eq("id", participant.designer_id).maybeSingle();
    if (!designer) throw new Error("designer_not_found");

    const { data: products } = await admin.from("products")
      .select("image_url").eq("designer_id", participant.designer_id).eq("status", "published")
      .order("created_at", { ascending: false }).limit(1);
    const imageUrl = (products?.[0] as { image_url?: string } | undefined)?.image_url;
    if (!imageUrl) throw new Error("no_product_image");

    const { data: sigs } = await admin.from("house_signatures")
      .select("name, recipe").eq("designer_id", participant.designer_id).limit(5);
    const signature = (sigs ?? [])[0] as { name: string; recipe: Record<string, string> } | undefined;
    const recipeBits = signature ? [signature.recipe?.licht, signature.recipe?.palette, signature.recipe?.kamerafahrt].filter(Boolean).join(", ") : "";

    const { data: campRow } = await admin.from("campaigns").insert({
      designer_id: participant.designer_id,
      title: `${edition.theme} · Edition`,
      kind: "video", status: "draft",
      content: { edition: true, edition_id: edition.id, theme: edition.theme },
    } as never).select("id").single();
    const campaignId = (campRow as { id: string } | null)?.id ?? null;
    await admin.from("edition_participants").update({ campaign_id: campaignId } as never).eq("id", participant.id);

    const designerPrompt = [edition.theme, recipeBits].filter(Boolean).join(", ");
    const prompt = template.replace("{designer_prompt}", designerPrompt);
    const result = await falSubmitAndPoll(falKey, model, { image_url: imageUrl, prompt, duration: 5 }, 120_000);
    if (!result.ok) throw new Error(result.message);

    const videoResp = await fetch(result.url);
    if (!videoResp.ok) throw new Error(`download_${videoResp.status}`);
    const bytes = new Uint8Array(await videoResp.arrayBuffer());
    const path = `${(designer as { user_id: string }).user_id}/editions/${edition.id}/${participant.id}.mp4`;
    const { error: upErr } = await admin.storage.from("campaign-assets").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { data: signed } = await admin.storage.from("campaign-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
    const finalUrl = signed?.signedUrl ?? "";

    await admin.from("edition_participants").update({ status: "ready", video_url: finalUrl, error: null } as never).eq("id", participant.id);
    await admin.from("notifications").insert({
      user_id: (designer as { user_id: string }).user_id,
      type: "edition.ready", title: `Edition „${edition.theme}" bereit`,
      body: "PAWN hat einen Video-Vorschlag in deiner Signatur erzeugt — schau ihn dir im Studio an.",
      link: "/studio/kampagnen",
    } as never);
  } catch (e) {
    await admin.from("edition_participants").update({ status: "failed", error: String((e as Error).message) } as never).eq("id", participant.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const falKey = Deno.env.get("FAL_KEY");
    if (!falKey) return json({ error: "provider_not_configured", message: "FAL_KEY fehlt." }, 200);

    const body = await req.json().catch(() => ({})) as { edition_id?: string };
    if (!body.edition_id) return json({ error: "edition_id_required" }, 400);

    const { data: edition } = await admin.from("editions").select("id, theme, world, status").eq("id", body.edition_id).maybeSingle();
    if (!edition) return json({ error: "edition_not_found" }, 404);

    const { data: participants } = await admin.from("edition_participants")
      .select("id, designer_id").eq("edition_id", body.edition_id).eq("status", "pending");
    if (!participants || participants.length === 0) return json({ ok: true, started: 0, message: "Keine offenen Teilnehmer." });

    const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "video_provider").maybeSingle();
    const videoCfg = (cfg?.value as { model_premium?: string } | null) ?? {};
    const model = videoCfg.model_premium ?? "fal-ai/kling-video/v2.1/standard/image-to-video";
    const { data: tpl } = await admin.from("ai_config").select("value").eq("key", "video_motion_prompt_template").maybeSingle();
    const template = (tpl?.value as { template?: string } | null)?.template ?? DEFAULT_TEMPLATE;

    await admin.from("editions").update({ status: "active" } as never).eq("id", body.edition_id);

    const ed = edition as { id: string; theme: string; world: string | null };
    await Promise.allSettled(
      (participants as { id: string; designer_id: string }[]).map((p) => processParticipant(admin, falKey, model, template, ed, p)),
    );

    return json({ ok: true, started: participants.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
