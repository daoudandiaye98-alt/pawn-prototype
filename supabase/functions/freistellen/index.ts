/**
 * Freistellen — Alphamaske statt Grünschlüssel.
 *
 * Das Heft liest `products.product_dna.heft.cutout_url`: nur Freigestelltes darf auf die
 * 3D-Bühne. Bisher schrieb niemand dieses Feld. Diese Function schließt die Lücke.
 *
 * POST { product_id }             → Freisteller für ein Werk (Haus oder Admin)
 * POST { deko_key, source_url }   → Freisteller für einen Deko-Aufsteller (nur Admin)
 *
 * Provider: echtes Matting-Modell mit Alphakanal (fal-ai/birefnet, Alternative rembg).
 * Niemals Chroma-Key — grüne Kleidung würde zerstört.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { schreibePartieZug } from "../_shared/partieZug.ts";

const DEFAULT_MATTING = "fal-ai/birefnet";
const DEFAULT_MATTING_ALT = "fal-ai/imageutils/rembg";

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

/** PNG-Maße direkt aus dem IHDR-Block lesen — kein Bildmodul nötig. */
function pngMasse(bytes: Uint8Array): { breite: number; hoehe: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { breite: dv.getUint32(16), hoehe: dv.getUint32(20) };
}

async function falSubmitAndPoll(
  FAL_KEY: string, model: string, body: Record<string, unknown>, timeoutMs = 90_000,
): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; status: number; message: string }> {
  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const sj = await submit.json().catch(() => ({})) as Record<string, unknown>;
  if (!submit.ok) return { ok: false, status: submit.status, message: String(sj?.detail ?? sj?.error ?? submit.statusText) };
  const status_url = (sj.status_url ?? sj.statusUrl ?? "") as string;
  const response_url = (sj.response_url ?? sj.responseUrl ?? "") as string;
  if (!status_url) return { ok: false, status: 500, message: "no_status_url" };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const sr = await fetch(status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
    const st = await sr.json().catch(() => ({})) as { status?: string };
    const up = String(st.status ?? "").toUpperCase();
    if (up === "COMPLETED" || up === "OK") {
      const rr = await fetch(response_url || status_url, { headers: { "Authorization": `Key ${FAL_KEY}` } });
      return { ok: true, result: await rr.json().catch(() => ({})) as Record<string, unknown> };
    }
    if (up === "FAILED" || up === "ERROR") return { ok: false, status: 502, message: `provider_${up}` };
  }
  return { ok: false, status: 504, message: "timeout" };
}

function extractImageUrl(r: Record<string, unknown>): string {
  const image = r.image as { url?: string } | undefined;
  if (image?.url) return image.url;
  const images = r.images as Array<{ url?: string }> | undefined;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  if (typeof r.url === "string") return r.url;
  const output = r.output as { url?: string } | undefined;
  return output?.url ?? "";
}

/** Läuft das Matting über das Hauptmodell, sonst über die Alternative. */
async function matten(FAL_KEY: string, modelle: string[], sourceUrl: string) {
  let letzter = { ok: false as const, status: 502, message: "kein_modell" };
  for (const model of modelle) {
    const r = await falSubmitAndPoll(FAL_KEY, model, { image_url: sourceUrl, output_format: "png" });
    if (r.ok) {
      const url = extractImageUrl(r.result);
      if (url) return { ok: true as const, url, model };
      letzter = { ok: false, status: 502, message: "no_image_url" };
      continue;
    }
    letzter = { ok: false, status: r.status, message: r.message };
  }
  return letzter;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) return json({ error: "provider_not_configured", message: "fal.ai ist nicht eingerichtet." }, 402);

    const body = await req.json().catch(() => ({})) as { product_id?: string; deko_key?: string; source_url?: string };
    if (!body.product_id && !body.deko_key) return json({ error: "product_id_or_deko_key_required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });

    const { data: mattingCfg } = await admin.from("ai_config").select("value").eq("key", "matting_provider").maybeSingle();
    const mCfg = (mattingCfg?.value as { model?: string; model_alt?: string } | null) ?? {};
    const modelle = [mCfg.model ?? DEFAULT_MATTING, mCfg.model_alt ?? DEFAULT_MATTING_ALT];

    // ---------- Admin-Zweig: Deko-Aufsteller fürs Heft ----------
    if (body.deko_key) {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      if (!body.source_url) return json({ error: "source_url_required" }, 400);
      const m = await matten(FAL_KEY, modelle, body.source_url);
      if (!m.ok) return json({ error: "provider_error", message: m.message, status: m.status }, 502);
      const dl = await fetch(m.url);
      if (!dl.ok) return json({ error: "download_failed", status: dl.status }, 502);
      const bytes = new Uint8Array(await dl.arrayBuffer());
      const pfad = `deko/${body.deko_key}.png`;
      const { error: upErr } = await admin.storage.from("site-assets").upload(pfad, bytes, { contentType: "image/png", upsert: true });
      if (upErr) return json({ error: "upload_failed", message: upErr.message }, 500);
      const oeffentlich = admin.storage.from("site-assets").getPublicUrl(pfad).data.publicUrl;
      const masse = pngMasse(bytes);
      const verhaeltnis = masse ? Number((masse.breite / masse.hoehe).toFixed(6)) : null;
      const { error: updErr } = await admin.from("heft_deko")
        .update({ cutout_url: oeffentlich, seitenverhaeltnis: verhaeltnis, aktiv: true } as never)
        .eq("key", body.deko_key);
      if (updErr) return json({ error: "update_failed", message: updErr.message }, 500);
      return json({ ok: true, deko_key: body.deko_key, cutout_url: oeffentlich, seitenverhaeltnis: verhaeltnis, model: m.model });
    }

    // ---------- Werk-Zweig ----------
    const { data: prod } = await admin.from("products")
      .select("id, name, designer_id, image_url, product_dna, designers!inner(user_id)")
      .eq("id", body.product_id!).maybeSingle();
    const p = prod as unknown as {
      id: string; name: string; designer_id: string; image_url: string | null;
      product_dna: Record<string, unknown> | null; designers: { user_id: string };
    } | null;
    if (!p) return json({ error: "product_not_found" }, 404);
    if (!isAdmin && p.designers.user_id !== user_id) return json({ error: "forbidden" }, 403);

    // Quelle: bevorzugt ein fertiger Freisteller-auf-Weiß, sonst das Werkbild.
    const { data: shot } = await admin.from("product_shot_requests")
      .select("result_url").eq("product_id", p.id).eq("status", "done")
      .not("result_url", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const sourceUrl = (shot as { result_url?: string } | null)?.result_url ?? p.image_url ?? "";
    if (!sourceUrl) return json({ error: "kein_quellbild", message: "Dieses Werk hat noch kein Bild." }, 400);

    const { data: creditCostsCfg } = await admin.from("ai_config").select("value").eq("key", "credit_costs").maybeSingle();
    const kosten = ((creditCostsCfg?.value as { product_shot?: number } | null)?.product_shot) ?? 1;
    if (!isAdmin) {
      const { data: check } = await admin.rpc("book_credit_spend", {
        _designer_id: p.designer_id, _action: "product_shot", _credits: kosten, _check_only: true,
      });
      const c = check as { ok?: boolean; balance?: number } | null;
      if (!c?.ok) {
        return json({
          error: "insufficient_credits",
          message: `Dieser Freisteller kostet ${kosten} Credits — du hast noch ${c?.balance ?? 0}. Mehr Credits gibt es im Plan.`,
        }, 200);
      }
    }

    const m = await matten(FAL_KEY, modelle, sourceUrl);
    if (!m.ok) {
      const freundlich = m.status === 402 ? "fal.ai-Guthaben fehlt." : m.message;
      return json({ error: "provider_error", message: freundlich, status: m.status }, 502);
    }
    const dl = await fetch(m.url);
    if (!dl.ok) return json({ error: "download_failed", status: dl.status }, 502);
    const bytes = new Uint8Array(await dl.arrayBuffer());
    const pfad = `${p.designers.user_id}/cutouts/${p.id}.png`;
    const { error: upErr } = await admin.storage.from("product-shots").upload(pfad, bytes, { contentType: "image/png", upsert: true });
    if (upErr) return json({ error: "upload_failed", message: upErr.message }, 500);
    // Dauerhafte öffentliche Adresse (product-shots ist ein öffentlicher Eimer) — keine
    // signierte URL mit Ablaufdatum, dieselbe Regel wie bei designer-media seit PR #163.
    const cutoutUrl = admin.storage.from("product-shots").getPublicUrl(pfad).data.publicUrl;
    const masse = pngMasse(bytes);
    const verhaeltnis = masse ? Number((masse.breite / masse.hoehe).toFixed(6)) : null;

    // Das vorhandene heft-Objekt bleibt erhalten, nur die zwei Felder kommen hinzu.
    const dna = (p.product_dna ?? {}) as Record<string, unknown>;
    const heft = { ...((dna.heft as Record<string, unknown> | undefined) ?? {}), cutout_url: cutoutUrl, seitenverhaeltnis: verhaeltnis };
    const { error: dnaErr } = await admin.from("products")
      .update({ product_dna: { ...dna, heft } as never } as never).eq("id", p.id);
    if (dnaErr) return json({ error: "dna_update_failed", message: dnaErr.message }, 500);

    const { data: costsCentsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
    const cents = ((costsCentsCfg?.value as { product_shot?: number } | null)?.product_shot) ?? 6;
    try { await admin.rpc("book_ai_spend", { _designer_id: p.designer_id, _cents: cents }); } catch { /* informativ */ }
    if (!isAdmin) {
      try { await admin.rpc("book_credit_spend", { _designer_id: p.designer_id, _action: "product_shot", _credits: kosten }); } catch { /* noop */ }
    }
    try { await schreibePartieZug(admin, p.designer_id, `${p.name} steht jetzt frei auf der Bühne.`, "pawn", "freistellen"); } catch { /* noop */ }

    return json({ ok: true, product_id: p.id, cutout_url: cutoutUrl, seitenverhaeltnis: verhaeltnis, model: m.model });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
