/**
 * Virtual Try-On: kombiniert ein Kleidungsstück-Foto mit einem KI-Basis-Model
 * (fal.ai Kolors Virtual Try-On), optional weitergereicht an generate-broll für einen Clip.
 *
 * Body: { product_id, source_image_url, mode: 'shot' | 'clip', model_style: 'weiblich'|'männlich'|'divers' }
 * Config: ai_config.tryon_provider steuert Modelle, Prompts, Pool, Fidelity, Limits.
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

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type TryonConfig = {
  styles?: string[];
  model_pool?: Record<string, string[]>;
  tryon_model?: string;
  tryon_model_alt?: string;
  base_model_image_model?: string;
  base_model_prompt?: string;
  fidelity_rules?: string;
  shot_disclosure?: string;
  clip_motion_suffix?: string;
};

async function falSubmitAndPoll(
  FAL_KEY: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs = 90_000,
): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; status: number; message: string }> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const sj = await submit.json().catch(() => ({})) as Record<string, unknown>;
  if (!submit.ok) {
    const msg = (sj?.detail ?? sj?.error ?? submit.statusText) as string;
    return { ok: false, status: submit.status, message: String(msg) };
  }
  const status_url = (sj.status_url ?? sj.statusUrl ?? "") as string;
  const response_url = (sj.response_url ?? sj.responseUrl ?? "") as string;
  if (!status_url) return { ok: false, status: 500, message: "no_status_url" };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const sr = await fetch(status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
    const st = await sr.json().catch(() => ({})) as { status?: string };
    const up = String(st.status ?? "").toUpperCase();
    if (up === "COMPLETED" || up === "OK") {
      const rr = await fetch(response_url || status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
      const rj = await rr.json().catch(() => ({})) as Record<string, unknown>;
      return { ok: true, result: rj };
    }
    if (up === "FAILED" || up === "ERROR") return { ok: false, status: 502, message: `provider_${up}` };
  }
  return { ok: false, status: 504, message: "timeout" };
}

function extractImageUrl(r: Record<string, unknown>): string {
  const images = r.images as Array<{ url?: string }> | undefined;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  const image = r.image as { url?: string } | undefined;
  if (image?.url) return image.url;
  if (typeof r.url === "string") return r.url;
  const output = r.output as { url?: string } | undefined;
  if (output?.url) return output.url;
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      return json({ error: "provider_not_configured", message: "fal.ai ist nicht eingerichtet. Bitte FAL_KEY hinterlegen." }, 402);
    }

    const body = await req.json().catch(() => ({})) as {
      product_id?: string; source_image_url?: string;
      mode?: "shot" | "clip"; model_style?: string; house_model_id?: string;
    };
    if (!body.product_id || !body.source_image_url) return json({ error: "product_id_and_source_image_url_required" }, 400);
    const mode: "shot" | "clip" = body.mode === "clip" ? "clip" : "shot";
    const style = (body.model_style && ["weiblich","männlich","divers"].includes(body.model_style))
      ? body.model_style : "weiblich";

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, svc, { auth: { persistSession: false } });

    // Ownership check
    const { data: prod } = await admin.from("products")
      .select("id, designer_id, name, designers!inner(user_id, plan)")
      .eq("id", body.product_id).maybeSingle();
    const p = prod as { id: string; designer_id: string; name: string; designers: { user_id: string; plan?: string } } | null;
    if (!p) return json({ error: "product_not_found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin && p.designers.user_id !== user_id) return json({ error: "forbidden" }, 403);

    // Credits prüfen — Kosten je nach mode (shot/clip), aus ai_config.credit_costs.
    const { data: creditCostsCfg } = await admin.from("ai_config").select("value").eq("key", "credit_costs").maybeSingle();
    const creditCosts = (creditCostsCfg?.value as { tryon_shot?: number; tryon_clip?: number } | null) ?? {};
    const tryonCreditCost = mode === "clip" ? (creditCosts.tryon_clip ?? 8) : (creditCosts.tryon_shot ?? 2);
    if (!isAdmin) {
      const { data: check } = await admin.rpc("book_credit_spend", {
        _designer_id: p.designer_id, _action: mode === "clip" ? "tryon_clip" : "tryon_shot", _credits: tryonCreditCost, _check_only: true,
      });
      const c = check as { ok?: boolean; balance?: number } | null;
      if (!c?.ok) {
        return json({
          error: "insufficient_credits",
          message: `${mode === "clip" ? "Dieser Try-On-Clip" : "Dieser Try-On"} kostet ${tryonCreditCost} Credits — du hast noch ${c?.balance ?? 0}. Mehr Credits gibt es im Plan.`,
        }, 200);
      }
    }

    // Load config
    const { data: cfgRow } = await admin.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
    const cfg = ((cfgRow?.value ?? {}) as TryonConfig);
    const tryonModel = cfg.tryon_model ?? "fal-ai/kling/v1-5/kolors-virtual-try-on";
    const tryonModelAlt = cfg.tryon_model_alt ?? "fal-ai/idm-vton";
    const baseImgModel = cfg.base_model_image_model ?? "fal-ai/nano-banana";
    const basePromptTpl = cfg.base_model_prompt ?? "full body studio photograph of a professional fashion model, {style}, plain white background";
    const fidelity = cfg.fidelity_rules ?? "";
    const clipMotionSuffix = cfg.clip_motion_suffix ?? "";

    // Insert request row
    const { data: reqRow, error: reqErr } = await admin.from("product_shot_requests").insert({
      product_id: p.id,
      designer_id: p.designer_id,
      source_url: body.source_image_url,
      status: "processing",
      provider: "fal",
      mode: mode === "clip" ? "tryon_clip" : "tryon",
      model_style: style,
      requested_by: user_id,
    } as never).select("id").single();
    if (reqErr || !reqRow) return json({ error: "insert_failed", message: reqErr?.message }, 500);
    const request_id = (reqRow as { id: string }).id;

    // Haus-Model (Teil 11b): ein designer-eigenes, benanntes Model statt des geteilten Style-Pools —
    // dieselbe Person läuft dann über jede Kampagne dieses Hauses. Hat es schon ein Basisbild, wird
    // das immer wieder verwendet (garantiert dasselbe Gesicht); sonst wird es einmalig erzeugt und
    // auf dem house_models-Datensatz gespeichert (nicht im geteilten ai_config.model_pool).
    let houseModel: { id: string; ausstrahlung: string | null; altersgruppe: string | null; haar: string | null; hautton: string | null; statur: string | null; freitext: string | null; base_image_url?: string | null } | null = null;
    if (body.house_model_id) {
      const { data: hm } = await admin.from("house_models")
        .select("id, designer_id, ausstrahlung, altersgruppe, haar, hautton, statur, freitext, base_image_url")
        .eq("id", body.house_model_id).eq("designer_id", p.designer_id).maybeSingle();
      houseModel = hm as typeof houseModel;
    }

    // 1) Base model image (Haus-Model, geteilter Pool, oder neu erzeugen)
    let pool = cfg.model_pool?.[style] ?? [];
    let baseImageUrl = "";
    if (houseModel?.base_image_url) {
      baseImageUrl = houseModel.base_image_url;
    } else if (houseModel) {
      const descBits = [houseModel.ausstrahlung, houseModel.altersgruppe, houseModel.haar, houseModel.hautton, houseModel.statur, houseModel.freitext]
        .filter(Boolean).join(", ");
      const prompt = basePromptTpl.replace("{style}", descBits ? `${style}, ${descBits}` : style);
      const gen = await falSubmitAndPoll(FAL_KEY, baseImgModel, { prompt, num_images: 1, output_format: "jpeg" }, 60_000);
      if (!gen.ok) {
        const friendly = gen.status === 402
          ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
          : gen.message;
        await admin.from("product_shot_requests").update({ status: "failed", error: `base_model_${friendly}` } as never).eq("id", request_id);
        return json({ error: "provider_error", stage: "base_model", message: friendly, status: gen.status }, 502);
      }
      const providerUrl = extractImageUrl(gen.result);
      if (!providerUrl) {
        await admin.from("product_shot_requests").update({ status: "failed", error: "base_model_no_url" } as never).eq("id", request_id);
        return json({ error: "no_base_url" }, 502);
      }
      const dl = await fetch(providerUrl);
      if (dl.ok) {
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const ct = dl.headers.get("content-type") ?? "image/jpeg";
        const ext = ct.includes("png") ? "png" : "jpg";
        const key = `house-models/${houseModel.id}.${ext}`;
        const { error: upErr } = await admin.storage.from("model-pool").upload(key, bytes, { contentType: ct, upsert: true });
        if (!upErr) {
          const { data: signed } = await admin.storage.from("model-pool").createSignedUrl(key, 60 * 60 * 24 * 365 * 5);
          baseImageUrl = signed?.signedUrl ?? providerUrl;
          await admin.from("house_models").update({ base_image_url: baseImageUrl } as never).eq("id", houseModel.id);
        } else {
          baseImageUrl = providerUrl;
        }
      } else {
        baseImageUrl = providerUrl;
      }
    } else if (pool.length > 0) {
      // seed-based deterministic pick per request id
      const seed = request_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      baseImageUrl = pool[seed % pool.length];
    } else {
      const prompt = basePromptTpl.replace("{style}", style);
      const gen = await falSubmitAndPoll(FAL_KEY, baseImgModel, { prompt, num_images: 1, output_format: "jpeg" }, 60_000);
      if (!gen.ok) {
        const friendly = gen.status === 402
          ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
          : gen.message;
        await admin.from("product_shot_requests").update({ status: "failed", error: `base_model_${friendly}` } as never).eq("id", request_id);
        return json({ error: "provider_error", stage: "base_model", message: friendly, status: gen.status }, 502);
      }
      const providerUrl = extractImageUrl(gen.result);
      if (!providerUrl) {
        await admin.from("product_shot_requests").update({ status: "failed", error: "base_model_no_url" } as never).eq("id", request_id);
        return json({ error: "no_base_url" }, 502);
      }
      // Persist to model-pool bucket, then signed URL
      const dl = await fetch(providerUrl);
      if (dl.ok) {
        const bytes = new Uint8Array(await dl.arrayBuffer());
        const ct = dl.headers.get("content-type") ?? "image/jpeg";
        const ext = ct.includes("png") ? "png" : "jpg";
        const key = `${style}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await admin.storage.from("model-pool").upload(key, bytes, { contentType: ct, upsert: false });
        if (!upErr) {
          const { data: signed } = await admin.storage.from("model-pool").createSignedUrl(key, 60 * 60 * 24 * 365 * 5);
          baseImageUrl = signed?.signedUrl ?? providerUrl;
          // Append to ai_config.model_pool[style]
          const updated: TryonConfig = { ...cfg, model_pool: { ...(cfg.model_pool ?? {}), [style]: [...pool, baseImageUrl] } };
          await admin.from("ai_config").update({ value: updated as never } as never).eq("key", "tryon_provider");
          pool = updated.model_pool![style];
        } else {
          baseImageUrl = providerUrl;
        }
      } else {
        baseImageUrl = providerUrl;
      }
    }

    // 2) Try-On
    const tryonBody = {
      human_image_url: baseImageUrl,
      garment_image_url: body.source_image_url,
      fidelity_prompt: fidelity,
    };
    let tryonResult = await falSubmitAndPoll(FAL_KEY, tryonModel, tryonBody, 90_000);
    if (!tryonResult.ok) {
      // retry with alt using idm-vton schema
      const altBody = {
        human_image_url: baseImageUrl,
        garment_image_url: body.source_image_url,
        person_image_url: baseImageUrl,
        garm_image_url: body.source_image_url,
        description: fidelity,
      };
      tryonResult = await falSubmitAndPoll(FAL_KEY, tryonModelAlt, altBody, 90_000);
    }
    if (!tryonResult.ok) {
      const friendly = tryonResult.status === 402
        ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
        : tryonResult.message;
      await admin.from("product_shot_requests").update({ status: "failed", error: `tryon_${friendly}` } as never).eq("id", request_id);
      return json({ error: "provider_error", stage: "tryon", message: friendly, status: tryonResult.status }, 200);
    }
    const tryonImgUrl = extractImageUrl(tryonResult.result);
    if (!tryonImgUrl) {
      await admin.from("product_shot_requests").update({ status: "failed", error: "tryon_no_url" } as never).eq("id", request_id);
      return json({ error: "no_tryon_url" }, 200);
    }

    // Persist tryon image to product-shots bucket
    const imgResp = await fetch(tryonImgUrl);
    if (!imgResp.ok) {
      await admin.from("product_shot_requests").update({ status: "failed", error: `download_${imgResp.status}` } as never).eq("id", request_id);
      return json({ error: "download_failed" }, 200);
    }
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const ct = imgResp.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : "jpg";
    const path = `${p.designers.user_id}/${p.id}/${request_id}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-shots").upload(path, bytes, { contentType: ct, upsert: true });
    if (upErr) {
      await admin.from("product_shot_requests").update({ status: "failed", error: `upload_${upErr.message}` } as never).eq("id", request_id);
      return json({ error: "upload_failed", message: upErr.message }, 200);
    }
    const { data: signed } = await admin.storage.from("product-shots").createSignedUrl(path, 60 * 60 * 24 * 365);
    const shotUrl = signed?.signedUrl ?? "";

    await admin.from("product_shot_requests").update({
      status: mode === "clip" ? "processing" : "done",
      result_url: shotUrl,
      error: null,
    } as never).eq("id", request_id);

    const { data: costsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
    const costs = (costsCfg?.value as { tryon_shot?: number; tryon_clip?: number } | null) ?? {};

    if (mode === "shot") {
      try { await admin.rpc("book_ai_spend", { _designer_id: p.designer_id, _cents: costs.tryon_shot ?? 12 }); } catch { /* noop */ }
      if (!isAdmin) {
        try { await admin.rpc("book_credit_spend", { _designer_id: p.designer_id, _action: "tryon_shot", _credits: tryonCreditCost }); } catch { /* noop */ }
      }
      return json({ ok: true, request_id, result_url: shotUrl, mode: "shot", model_style: style });
    }

    // 3) Clip: fire generate-broll with the tryon image
    // Need a campaign; find/create a hidden draft for this product+designer.
    const { data: campRow } = await admin.from("campaigns").insert({
      designer_id: p.designer_id,
      product_id: p.id,
      title: `${p.name} · Try-On Clip`,
      kind: "video",
      status: "draft",
      content: { tryon: true, tryon_shot_url: shotUrl } as never,
      created_by: user_id,
    } as never).select("id").single();
    const campaignId = (campRow as { id: string } | null)?.id;
    if (!campaignId) {
      return json({ ok: true, request_id, result_url: shotUrl, mode: "clip", clip_error: "campaign_draft_failed" });
    }

    // Reuse generate-broll internally (same-origin: call queue directly with i2v model).
    const { data: vcfg } = await admin.from("ai_config").select("value").eq("key", "video_provider").maybeSingle();
    const videoModel = ((vcfg?.value as { model?: string } | null)?.model) ?? "fal-ai/wan/v2.2-a14b/image-to-video/lora";
    const { data: mpTpl } = await admin.from("ai_config").select("value").eq("key", "video_motion_prompt_template").maybeSingle();
    const motionTpl = ((mpTpl?.value as { template?: string } | null)?.template) ??
      "subtle fabric movement, slow cinematic camera push-in, monochrome high-fashion editorial";
    const motionPrompt = `${motionTpl.replace("{designer_prompt}", "")} ${clipMotionSuffix}`.trim();

    const submit = await fetch(`https://queue.fal.run/${videoModel}`, {
      method: "POST",
      headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: shotUrl, prompt: motionPrompt, duration: 5 }),
    });
    const submitJson = await submit.json().catch(() => ({})) as Record<string, unknown>;
    if (!submit.ok) {
      const friendly = submit.status === 402 ? "fal.ai-Guthaben fehlt." : String(submitJson?.detail ?? submitJson?.error ?? submit.statusText);
      return json({ ok: true, request_id, result_url: shotUrl, mode: "clip", clip_error: friendly });
    }
    const requestIdFal = (submitJson.request_id ?? submitJson.requestId ?? "") as string;
    const statusUrl = (submitJson.status_url ?? submitJson.statusUrl ?? "") as string;
    const responseUrl = (submitJson.response_url ?? submitJson.responseUrl ?? "") as string;
    const { data: genRow } = await admin.from("generation_requests").insert({
      campaign_id: campaignId,
      tier: "tryon_clip",
      provider: "fal",
      status: "running",
      cost_estimate: 3,
      requested_by: user_id,
      provider_handles: { request_id: requestIdFal, status_url: statusUrl, response_url: responseUrl, image_url: shotUrl },
    } as never).select("id").single();

    try { await admin.rpc("book_ai_spend", { _designer_id: p.designer_id, _cents: costs.tryon_clip ?? 45 }); } catch { /* noop */ }
    if (!isAdmin) {
      try { await admin.rpc("book_credit_spend", { _designer_id: p.designer_id, _action: "tryon_clip", _credits: tryonCreditCost }); } catch { /* noop */ }
    }

    return json({
      ok: true, request_id, result_url: shotUrl, mode: "clip",
      generation_request_id: (genRow as { id: string } | null)?.id ?? null,
      campaign_id: campaignId,
      note: "Clip wird gerendert — via poll-broll pollen.",
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
