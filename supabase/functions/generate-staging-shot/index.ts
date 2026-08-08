/**
 * Inszenierungs-Dienst (Teil 16a): erzeugt aus einem Ausgangsfoto mehrere Inszenierungs-
 * Varianten in einem Lauf (ai_config.staging_templates, je nach erkannter/gewählter Art).
 * Läuft parallel statt nacheinander, damit ein Lauf mit 3-4 Varianten nicht länger dauert
 * als eine einzelne fal.ai-Anfrage. Jede Prompt-Vorlage verankert: Form, Farbe, Material und
 * Zustand des realen Stücks bleiben unverändert — nur Umgebung, Licht und Blickwinkel ändern
 * sich (fest in den Vorlagen aus ai_config.staging_templates, nicht hier hart verdrahtet).
 *
 * Body: { designer_id, product_id?, source_url, art, template_ids: string[] }
 * Response: { ok, run_id, results: [{template_id, label, result_url|null, error|null}], credits_charged }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { schreibePartieZug } from "../_shared/partieZug.ts";

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

const DEFAULT_MODEL = "fal-ai/nano-banana/edit";

interface StagingTemplate {
  id: string; label: string; description?: string; prompt: string;
  preview_url?: string; credits: number; active?: boolean; groessenbezug?: boolean;
}

async function runOneVariant(
  admin: SupabaseClient, falKey: string, model: string,
  params: { designer_id: string; product_id: string | null; user_id: string; source_url: string; art: string; run_id: string; template: StagingTemplate },
): Promise<{ template_id: string; label: string; result_url: string | null; error: string | null; media_asset_id: string | null }> {
  const { designer_id, product_id, user_id, source_url, art, run_id, template } = params;
  const { data: reqRow, error: reqErr } = await admin.from("staging_requests" as never).insert({
    designer_id, product_id, run_id, source_url, art, template_id: template.id, status: "requested",
  } as never).select("id").single();
  if (reqErr || !reqRow) return { template_id: template.id, label: template.label, result_url: null, error: "insert_failed", media_asset_id: null };
  const request_id = (reqRow as unknown as { id: string }).id;

  try {
    const submitResp = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: template.prompt, image_urls: [source_url], num_images: 1, output_format: "jpeg" }),
    });
    const submitJson = await submitResp.json().catch(() => ({})) as Record<string, unknown>;
    if (!submitResp.ok) {
      const msg = String((submitJson?.detail ?? submitJson?.error ?? submitResp.statusText) as string);
      const friendly = submitResp.status === 402 ? "fal.ai-Guthaben fehlt." : msg;
      await admin.from("staging_requests" as never).update({ status: "failed", error: friendly } as never).eq("id", request_id);
      return { template_id: template.id, label: template.label, result_url: null, error: friendly , media_asset_id: null };
    }
    const status_url = (submitJson.status_url ?? submitJson.statusUrl ?? "") as string;
    const response_url = (submitJson.response_url ?? submitJson.responseUrl ?? "") as string;
    await admin.from("staging_requests" as never).update({
      status: "processing",
      request_handle: { status_url, response_url, fal_request_id: submitJson.request_id ?? submitJson.requestId ?? null },
    } as never).eq("id", request_id);

    const deadline = Date.now() + 60_000;
    let imageUrl = "";
    let lastStatus = "IN_QUEUE";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500));
      const sr = await fetch(status_url, { headers: { "Authorization": `Key ${falKey}` } });
      const sj = await sr.json().catch(() => ({})) as { status?: string };
      lastStatus = String(sj.status ?? "").toUpperCase();
      if (lastStatus === "COMPLETED" || lastStatus === "OK") {
        const rr = await fetch(response_url || status_url, { headers: { "Authorization": `Key ${falKey}` } });
        const rj = await rr.json().catch(() => ({})) as { images?: Array<{ url?: string }>; image?: { url?: string }; url?: string };
        imageUrl = rj?.images?.[0]?.url ?? rj?.image?.url ?? rj?.url ?? "";
        break;
      }
      if (lastStatus === "FAILED" || lastStatus === "ERROR") {
        await admin.from("staging_requests" as never).update({ status: "failed", error: `provider_status_${lastStatus}` } as never).eq("id", request_id);
        return { template_id: template.id, label: template.label, result_url: null, error: "Die Inszenierung ist fehlgeschlagen." , media_asset_id: null };
      }
    }
    if (!imageUrl) {
      await admin.from("staging_requests" as never).update({ status: "failed", error: `timeout_${lastStatus}` } as never).eq("id", request_id);
      return { template_id: template.id, label: template.label, result_url: null, error: "Zeitüberschreitung — bitte nochmal versuchen." , media_asset_id: null };
    }

    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      await admin.from("staging_requests" as never).update({ status: "failed", error: `download_${imgResp.status}` } as never).eq("id", request_id);
      return { template_id: template.id, label: template.label, result_url: null, error: "Ergebnis konnte nicht geladen werden." , media_asset_id: null };
    }
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${user_id}/staging/${request_id}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-shots").upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      await admin.from("staging_requests" as never).update({ status: "failed", error: `upload_${upErr.message}` } as never).eq("id", request_id);
      return { template_id: template.id, label: template.label, result_url: null, error: "Ablage fehlgeschlagen." , media_asset_id: null };
    }
    const { data: signed } = await admin.storage.from("product-shots").createSignedUrl(path, 60 * 60 * 24 * 365);
    const finalUrl = signed?.signedUrl ?? "";
    await admin.from("staging_requests" as never).update({ status: "done", result_url: finalUrl, error: null } as never).eq("id", request_id);

    // Landet parallel in der Mediathek, unabhängig davon, ob die Variante später als Produktbild
    // übernommen wird — bestehendes Muster wie bei jedem anderen erzeugten Bild.
    let media_asset_id: string | null = null;
    try {
      const { data: mediaRow } = await admin.from("media_assets" as never).insert({
        designer_id, kind: "bild", origin: "erzeugt", url: finalUrl, title: `Inszenierung · ${template.label}`,
      } as never).select("id").single();
      media_asset_id = (mediaRow as unknown as { id: string } | null)?.id ?? null;
    } catch { /* Mediathek-Eintrag ist best-effort, blockiert nie das Ergebnis */ }

    return { template_id: template.id, label: template.label, result_url: finalUrl, error: null, media_asset_id };
  } catch (e) {
    await admin.from("staging_requests" as never).update({ status: "failed", error: String((e as Error)?.message ?? e) } as never).eq("id", request_id);
    return { template_id: template.id, label: template.label, result_url: null, error: "Unerwarteter Fehler.", media_asset_id: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) return json({ ok: false, error: "provider_not_configured", message: "FAL_KEY fehlt." }, 402);

    const body = await req.json().catch(() => ({})) as {
      designer_id?: string; product_id?: string; source_url?: string; art?: string; template_ids?: string[];
    };
    if (!body.designer_id || !body.source_url || !body.art || !Array.isArray(body.template_ids) || body.template_ids.length === 0) {
      return json({ ok: false, error: "designer_id_source_url_art_and_template_ids_required" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: des } = await admin.from("designers").select("id, user_id").eq("id", body.designer_id).maybeSingle();
    const d = des as { id: string; user_id: string } | null;
    if (!d) return json({ ok: false, error: "designer_not_found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin && d.user_id !== user_id) return json({ ok: false, error: "forbidden" }, 403);

    const { data: templatesCfg } = await admin.from("ai_config").select("value").eq("key", "staging_templates").maybeSingle();
    const allForArt = (((templatesCfg?.value as Record<string, StagingTemplate[]> | null)?.[body.art]) ?? [])
      .filter((t) => t.active !== false);
    const selected = allForArt.filter((t) => body.template_ids!.includes(t.id));
    if (selected.length === 0) return json({ ok: false, error: "no_matching_templates", message: "Keine passenden Inszenierungs-Varianten gefunden." }, 200);

    const totalCredits = selected.reduce((s, t) => s + (t.credits ?? 0), 0);
    if (!isAdmin) {
      const { data: check } = await admin.rpc("book_credit_spend", {
        _designer_id: d.id, _action: "staging_shot", _credits: totalCredits, _check_only: true,
      });
      const c = check as { ok?: boolean; balance?: number } | null;
      if (!c?.ok) {
        return json({
          ok: false, error: "insufficient_credits",
          message: `Dieser Lauf kostet ${totalCredits} Credits — du hast noch ${c?.balance ?? 0}. Mehr Credits gibt es im Plan.`,
        }, 200);
      }
    }

    const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "image_edit_provider").maybeSingle();
    const model = (cfg?.value as { model?: string } | null)?.model ?? DEFAULT_MODEL;

    const run_id = crypto.randomUUID();
    const results = await Promise.all(selected.map((template) =>
      runOneVariant(admin, FAL_KEY, model, {
        designer_id: d.id, product_id: body.product_id ?? null, user_id: d.user_id,
        source_url: body.source_url!, art: body.art!, run_id, template,
      }),
    ));

    const succeeded = results.filter((r) => r.result_url);
    if (succeeded.length === 0) {
      return json({ ok: false, error: "all_failed", run_id, results, message: "Kein Ergebnis fertiggestellt." }, 200);
    }

    const chargedCredits = selected
      .filter((t) => succeeded.some((r) => r.template_id === t.id))
      .reduce((s, t) => s + (t.credits ?? 0), 0);

    try {
      const { data: costsCentsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
      const perShotCents = ((costsCentsCfg?.value as { staging_shot?: number } | null)?.staging_shot) ?? 6;
      await admin.rpc("book_ai_spend", { _designer_id: d.id, _cents: perShotCents * succeeded.length });
    } catch { /* noop */ }
    if (!isAdmin && chargedCredits > 0) {
      try { await admin.rpc("book_credit_spend", { _designer_id: d.id, _action: "staging_shot", _credits: chargedCredits }); } catch { /* noop */ }
    }

    // Teil 28c: eine Inszenierung auf Zuruf ist eine Delegation (du hast genickt, indem du sie
    // gestartet hast) — nie eine Automatik (die läuft nach stehender Freigabe, ohne Zuruf).
    try {
      let produktBezeichnung = "ein eigenständiges Foto";
      if (body.product_id) {
        const { data: prod } = await admin.from("products").select("name").eq("id", body.product_id).maybeSingle();
        if (prod?.name) produktBezeichnung = prod.name;
      }
      await schreibePartieZug(
        admin, d.id,
        `${succeeded.length} ${body.art}-Variante${succeeded.length === 1 ? "" : "n"} für ${produktBezeichnung} erzeugt.`,
        "pawn", "delegation",
      );
    } catch { /* Partie-Buch darf nie das eigentliche Ergebnis blockieren */ }

    return json({ ok: true, run_id, results, credits_charged: chargedCredits }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
