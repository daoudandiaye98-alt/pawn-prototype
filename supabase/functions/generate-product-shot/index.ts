/**
 * KI-Studio-Foto: nimmt ein Quellbild, sendet zu fal.ai
 * (Gemini-Flash-Image-Edit via fal-ai/nano-banana/edit), pollt Ergebnis,
 * lädt es nach product-shots-Bucket, hinterlegt result_url in product_shot_requests.
 *
 * Synchron: submit + poll bis fertig (typisch 10-25s bei nano-banana), max 60s.
 *
 * Body: { product_id, source_url } — an ein Produkt gebunden (Produkterstellung), ODER
 *       { designer_id, source_url } — freistehend, z.B. ein im Kampagnen-Studio hochgeladenes
 *       Foto ohne Produktbezug (Teil 10b). product_id bleibt dann leer.
 * Response: { ok, request_id, result_url? , error? }
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

const DEFAULT_MODEL = "fal-ai/nano-banana/edit";
const PROMPT =
  "Professional e-commerce product photograph on pure white seamless studio background, soft even diffused lighting, subtle contact shadow, centered composition, no props, no text, no watermark. Preserve the product's exact shape, colors, materials and details — only replace the background and lighting.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      return json({ error: "provider_not_configured", message: "FAL_KEY fehlt." }, 402);
    }

    const body = await req.json().catch(() => ({})) as { product_id?: string; designer_id?: string; source_url?: string };
    if (!body.source_url || (!body.product_id && !body.designer_id)) {
      return json({ error: "product_id_or_designer_id_and_source_url_required" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    let p: { id: string | null; designer_id: string; designers: { user_id: string; plan?: string } } | null = null;
    if (body.product_id) {
      const { data: prod } = await admin.from("products")
        .select("id, designer_id, designers!inner(user_id, plan)")
        .eq("id", body.product_id).maybeSingle();
      p = prod as typeof p;
      if (!p) return json({ error: "product_not_found" }, 404);
    } else {
      const { data: des } = await admin.from("designers")
        .select("id, user_id, plan")
        .eq("id", body.designer_id!).maybeSingle();
      const d = des as { id: string; user_id: string; plan?: string } | null;
      if (!d) return json({ error: "designer_not_found" }, 404);
      p = { id: null, designer_id: d.id, designers: { user_id: d.user_id, plan: d.plan } };
    }

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin && p.designers.user_id !== user_id) return json({ error: "forbidden" }, 403);

    const { data: creditCostsCfg } = await admin.from("ai_config").select("value").eq("key", "credit_costs").maybeSingle();
    const shotCost = ((creditCostsCfg?.value as { product_shot?: number } | null)?.product_shot) ?? 1;

    if (!isAdmin) {
      const { data: check } = await admin.rpc("book_credit_spend", {
        _designer_id: p.designer_id, _action: "product_shot", _credits: shotCost, _check_only: true,
      });
      const c = check as { ok?: boolean; balance?: number } | null;
      if (!c?.ok) {
        return json({
          error: "insufficient_credits",
          message: `Dieser Freisteller kostet ${shotCost} Credits — du hast noch ${c?.balance ?? 0}. Mehr Credits gibt es im Plan.`,
        }, 200);
      }
    }

    const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "image_edit_provider").maybeSingle();
    const model = (cfg?.value as { model?: string } | null)?.model ?? DEFAULT_MODEL;

    const { data: reqRow, error: reqErr } = await admin.from("product_shot_requests").insert({
      product_id: p.id,
      designer_id: p.designer_id,
      source_url: body.source_url,
      status: "requested",
      provider: "fal",
      requested_by: user_id,
    } as never).select("id").single();
    if (reqErr || !reqRow) return json({ error: reqErr?.message ?? "insert_failed" }, 500);
    const request_id = (reqRow as { id: string }).id;

    // Submit — nano-banana/edit erwartet image_urls (Array) + prompt.
    const submitResp = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: PROMPT,
        image_urls: [body.source_url],
        num_images: 1,
        output_format: "jpeg",
      }),
    });
    const submitJson = await submitResp.json().catch(() => ({})) as Record<string, unknown>;
    if (!submitResp.ok) {
      const msg = (submitJson?.detail ?? submitJson?.error ?? submitResp.statusText) as string;
      const friendly = submitResp.status === 402 ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen." : String(msg);
      await admin.from("product_shot_requests").update({ status: "failed", error: friendly } as never).eq("id", request_id);
      return json({ error: "provider_error", message: friendly, status: submitResp.status }, 502);
    }
    const status_url = (submitJson.status_url ?? submitJson.statusUrl ?? "") as string;
    const response_url = (submitJson.response_url ?? submitJson.responseUrl ?? "") as string;
    await admin.from("product_shot_requests").update({
      status: "processing",
      request_handle: { status_url, response_url, fal_request_id: submitJson.request_id ?? submitJson.requestId ?? null },
    } as never).eq("id", request_id);

    // Poll bis 60s
    const deadline = Date.now() + 60_000;
    let imageUrl = "";
    let lastStatus = "IN_QUEUE";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const sr = await fetch(status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
      const sj = await sr.json().catch(() => ({})) as { status?: string };
      lastStatus = String(sj.status ?? "").toUpperCase();
      if (lastStatus === "COMPLETED" || lastStatus === "OK") {
        const rr = await fetch(response_url || status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
        const rj = await rr.json().catch(() => ({})) as {
          images?: Array<{ url?: string }>; image?: { url?: string }; url?: string;
        };
        imageUrl = rj?.images?.[0]?.url ?? rj?.image?.url ?? rj?.url ?? "";
        break;
      }
      if (lastStatus === "FAILED" || lastStatus === "ERROR") {
        await admin.from("product_shot_requests").update({ status: "failed", error: `provider_status_${lastStatus}` } as never).eq("id", request_id);
        return json({ error: "provider_failed", message: lastStatus }, 502);
      }
    }
    if (!imageUrl) {
      await admin.from("product_shot_requests").update({ status: "failed", error: `timeout_${lastStatus}` } as never).eq("id", request_id);
      return json({ error: "timeout", message: "Provider hat nicht rechtzeitig geantwortet." }, 504);
    }

    // Download + upload zu product-shots
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      await admin.from("product_shot_requests").update({ status: "failed", error: `download_${imgResp.status}` } as never).eq("id", request_id);
      return json({ error: "download_failed" }, 502);
    }
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${p.designers.user_id}/${p.id ?? "campaign"}/${request_id}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-shots").upload(path, bytes, {
      contentType, upsert: true,
    });
    if (upErr) {
      await admin.from("product_shot_requests").update({ status: "failed", error: `upload_${upErr.message}` } as never).eq("id", request_id);
      return json({ error: "upload_failed", message: upErr.message }, 500);
    }
    const { data: signed } = await admin.storage.from("product-shots").createSignedUrl(path, 60 * 60 * 24 * 365);
    const finalUrl = signed?.signedUrl ?? "";
    await admin.from("product_shot_requests").update({
      status: "done", result_url: finalUrl, error: null,
    } as never).eq("id", request_id);

    const { data: costsCentsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
    const productShotCents = ((costsCentsCfg?.value as { product_shot?: number } | null)?.product_shot) ?? 6;
    try { await admin.rpc("book_ai_spend", { _designer_id: p.designer_id, _cents: productShotCents }); } catch { /* noop */ }
    if (!isAdmin) {
      try { await admin.rpc("book_credit_spend", { _designer_id: p.designer_id, _action: "product_shot", _credits: shotCost }); } catch { /* noop */ }
    }

    return json({ ok: true, request_id, result_url: finalUrl }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
