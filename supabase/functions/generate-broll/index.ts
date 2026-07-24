/**
 * Kinematischer Modus — Bild-zu-Video via fal.ai Queue-API.
 * Body: { campaign_id, image_urls: string[], motion_prompt?: string }
 * Ohne FAL_KEY → 402 mit klarem Text.
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

// Standard: kostengünstiges Modell (wan-2.2). Premium-Alternative:
//   fal-ai/kling-video/v2.1/standard/image-to-video (in ai_config setzen).
const DEFAULT_MODEL = "fal-ai/wan/v2.2-a14b/image-to-video/lora";

const DEFAULT_TEMPLATE =
  "subtle fabric movement, slow cinematic camera push-in, monochrome high-fashion editorial, soft studio light, {designer_prompt}";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      return json({
        error: "provider_not_configured",
        message: "Der kinematische Modus wird vom Haus aktiviert. Bitte FAL_KEY in Project Settings → Secrets hinterlegen.",
      }, 402);
    }

    const body = await req.json().catch(() => ({})) as {
      campaign_id?: string; image_urls?: string[]; motion_prompt?: string; signature_id?: string;
    };
    if (!body.campaign_id) return json({ error: "campaign_id_required" }, 400);
    const images = (body.image_urls ?? []).filter((u) => typeof u === "string" && u.length > 0).slice(0, 4);
    if (images.length === 0) return json({ error: "image_urls_required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    // Load campaign to verify designer + ownership.
    const { data: camp } = await admin.from("campaigns")
      .select("id, designer_id, designers!inner(id, user_id, brand_dna, plan)")
      .eq("id", body.campaign_id).maybeSingle();
    const designer = (camp as { designers?: { user_id: string; brand_dna?: Record<string, unknown> | null; plan?: string } })?.designers;
    if (!camp || !designer) return json({ error: "campaign_not_found" }, 404);

    // Admin bypass; else designer must own.
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin && designer.user_id !== user_id) return json({ error: "forbidden" }, 403);

    // Config
    const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "video_provider").maybeSingle();
    const videoCfg = (cfg?.value as { model?: string; model_premium?: string } | null) ?? {};
    const { data: tpl } = await admin.from("ai_config").select("value").eq("key", "video_motion_prompt_template").maybeSingle();
    const template = (tpl?.value as { template?: string } | null)?.template ?? DEFAULT_TEMPLATE;

    // Signatur gesetzt → stärkste verfügbare i2v-Klasse + Rezept ins Bewegungs-Prompt falten.
    let model = videoCfg.model ?? DEFAULT_MODEL;
    let designerPrompt = body.motion_prompt ?? "";
    if (body.signature_id) {
      const { data: sig } = await admin.from("house_signatures")
        .select("recipe").eq("id", body.signature_id).maybeSingle();
      const recipe = (sig as { recipe?: Record<string, string> } | null)?.recipe;
      if (recipe) {
        model = videoCfg.model_premium ?? "fal-ai/kling-video/v2.1/standard/image-to-video";
        const bits = [recipe.licht, recipe.palette, recipe.kamerafahrt].filter(Boolean).join(", ");
        designerPrompt = [designerPrompt, bits].filter(Boolean).join(", ");
      }
    }
    const prompt = template.replace("{designer_prompt}", designerPrompt);

    const { data: limits } = await admin.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle();
    const costUnits = ((limits?.value as { accent_cost_units?: number } | null)?.accent_cost_units) ?? 2;

    const { data: costsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
    const brollClipCents = ((costsCfg?.value as { broll_clip?: number } | null)?.broll_clip) ?? 35;

    // Submit each image to fal Queue.
    const submissions = [];
    for (const image_url of images) {
      try {
        const r = await fetch(`https://queue.fal.run/${model}`, {
          method: "POST",
          headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ image_url, prompt, duration: 5 }),
        });
        const rj = await r.json().catch(() => ({}));
        if (!r.ok) {
          const friendly = r.status === 402
            ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
            : (rj?.detail || rj?.error || r.statusText);
          submissions.push({ image_url, error: String(friendly), status: r.status });
          continue;
        }

        const request_id: string = rj.request_id ?? rj.requestId ?? "";
        const status_url: string = rj.status_url ?? rj.statusUrl ?? "";
        const response_url: string = rj.response_url ?? rj.responseUrl ?? "";
        const { data: row } = await admin.from("generation_requests").insert({
          campaign_id: body.campaign_id,
          tier: "accent",
          provider: "fal",
          status: "running",
          cost_estimate: costUnits,
          requested_by: user_id,
          error: null,
          result_url: null,
          provider_handles: { request_id, status_url, response_url, image_url },
        } as never).select("id").single();
        // Bucht die Ist-Kosten gegen das Monatsbudget des Hauses (informativ, blockiert nicht).
        try { await admin.rpc("book_ai_spend", { _designer_id: camp.designer_id, _cents: brollClipCents }); } catch { /* noop */ }
        submissions.push({ id: (row as { id: string }).id, request_id, image_url });
      } catch (e) {
        submissions.push({ image_url, error: String((e as Error).message) });
      }
    }

    return json({ ok: true, model, prompt, cost_units: costUnits * submissions.filter((s) => "id" in s).length, submissions }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
