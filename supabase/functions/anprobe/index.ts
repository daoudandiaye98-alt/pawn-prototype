/**
 * Anprobe — die Kundin sieht ein Stück an sich, in ihrem Raum oder an ihrer Wand.
 *
 * POST { aktion:'bereinigen', bild_id }
 * POST { aktion:'anprobe',    product_id, bild_id? }
 * POST { aktion:'raum',       product_id, bild_id, platz:{x,y,breite} }
 * POST { aktion:'wand',       product_id, bild_id, platz:{x,y,breite} }
 * POST { aktion:'stand',      anprobe_id }
 * POST { aktion:'bewerten',   anprobe_id, bewertung:'passt'|'nicht' }
 *
 * Hier geht es um private Fotos von Personen: die Identität wird über auth.getUser()
 * mit Signaturprüfung festgestellt, nicht über einen dekodierten JWT-Inhalt.
 * Anproben laufen auf PAWNs Rechnung — kein Credit, das Kontingent (10/24 h) begrenzt.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MATTING = "fal-ai/birefnet";
const MATTING_ALT = "fal-ai/imageutils/rembg";
const RAUM_MODELL = "fal-ai/nano-banana/edit";
const KOSTENSTELLE = "kunde_anprobe";

type Platz = { x?: number; y?: number; breite?: number };

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function falSubmitAndPoll(
  FAL_KEY: string, model: string, body: Record<string, unknown>, timeoutMs = 120_000,
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

/** Hintergrund weiterlaufen lassen, nachdem die Antwort raus ist. */
function imHintergrund(p: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p.catch(() => {}));
  else void p.catch(() => {});
}

const WARM_FEHLER = "Das hat diesmal nicht geklappt. Versuch es gleich noch einmal — es kostet dich nichts.";

async function ladeBytes(url: string): Promise<Uint8Array | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Signaturgeprüfte Identität — nicht der dekodierte sub.
    const alsNutzer = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: userData } = await alsNutzer.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ ok: false, grund: "auth_required" }, 401);
    const user_id = user.id;

    const admin: SupabaseClient = createClient(supaUrl, svc, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({})) as {
      aktion?: string; bild_id?: string; product_id?: string; anprobe_id?: string;
      platz?: Platz; bewertung?: string;
    };
    const aktion = body.aktion ?? "";

    // ---------- stand ----------
    if (aktion === "stand") {
      if (!body.anprobe_id) return json({ ok: false, grund: "anprobe_id_fehlt" }, 400);
      const { data: a } = await admin.from("anproben")
        .select("status, result_path, fehler, dauer_ms, user_id").eq("id", body.anprobe_id).maybeSingle();
      const row = a as { status: string; result_path: string | null; fehler: string | null; dauer_ms: number | null; user_id: string } | null;
      if (!row || row.user_id !== user_id) return json({ ok: false, grund: "nicht_gefunden" }, 404);
      let result_url: string | null = null;
      if (row.result_path) {
        const { data: signed } = await admin.storage.from("kunden-bilder").createSignedUrl(row.result_path, 60 * 60);
        result_url = signed?.signedUrl ?? null;
      }
      return json({ ok: true, status: row.status, result_url, fehler: row.fehler, dauer_ms: row.dauer_ms });
    }

    // ---------- bewerten ----------
    if (aktion === "bewerten") {
      if (!body.anprobe_id || !["passt", "nicht"].includes(String(body.bewertung))) {
        return json({ ok: false, grund: "bewertung_ungueltig" }, 400);
      }
      const { error } = await admin.from("anproben")
        .update({ bewertung: body.bewertung } as never)
        .eq("id", body.anprobe_id).eq("user_id", user_id);
      if (error) return json({ ok: false, grund: error.message }, 500);
      return json({ ok: true });
    }

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) return json({ ok: false, grund: "provider_not_configured", satz: "Die Anprobe ist gerade nicht eingerichtet." }, 402);

    // Einwilligung gilt für alles, was ein Foto der Person anfasst.
    const { data: prof } = await admin.from("profiles").select("consent_avatar").eq("id", user_id).maybeSingle();
    if (!(prof as { consent_avatar?: boolean } | null)?.consent_avatar) {
      return json({ ok: false, grund: "keine_einwilligung", satz: "Dafür brauchen wir dein Einverständnis, dein Foto zu verwenden." }, 200);
    }

    // ---------- bereinigen ----------
    if (aktion === "bereinigen") {
      if (!body.bild_id) return json({ ok: false, grund: "bild_id_fehlt" }, 400);
      const { data: b } = await admin.from("kunden_bilder")
        .select("id, user_id, art, quelle_path, aktiv").eq("id", body.bild_id).maybeSingle();
      const bild = b as { id: string; user_id: string; art: string; quelle_path: string; aktiv: boolean } | null;
      if (!bild || bild.user_id !== user_id) return json({ ok: false, grund: "bild_nicht_gefunden" }, 404);

      await admin.from("kunden_bilder").update({ status: "wird_bereinigt" } as never).eq("id", bild.id);
      const { data: signed } = await admin.storage.from("kunden-bilder").createSignedUrl(bild.quelle_path, 600);
      if (!signed?.signedUrl) return json({ ok: false, grund: "quelle_nicht_lesbar" }, 500);

      let m = await falSubmitAndPoll(FAL_KEY, MATTING, { image_url: signed.signedUrl, output_format: "png" });
      if (!m.ok) m = await falSubmitAndPoll(FAL_KEY, MATTING_ALT, { image_url: signed.signedUrl, output_format: "png" });
      const freigestellt = m.ok ? extractImageUrl(m.result) : "";
      if (!freigestellt) {
        await admin.from("kunden_bilder").update({ status: "fehler", fehler: m.ok ? "no_url" : m.message } as never).eq("id", bild.id);
        return json({ ok: false, grund: "provider_fehler", satz: WARM_FEHLER }, 200);
      }
      // Nur der Hintergrund: das Freigestellte auf weißen Grund setzen, Körper unangetastet.
      const auf_weiss = await falSubmitAndPoll(FAL_KEY, RAUM_MODELL, {
        prompt: "Place this exact person on a plain seamless white studio background with soft even light. Do not change the person's face, body, proportions, pose or clothing in any way.",
        image_urls: [freigestellt], num_images: 1, output_format: "jpeg",
      });
      const endUrl = auf_weiss.ok ? (extractImageUrl(auf_weiss.result) || freigestellt) : freigestellt;
      const bytes = await ladeBytes(endUrl);
      if (!bytes) {
        await admin.from("kunden_bilder").update({ status: "fehler", fehler: "download" } as never).eq("id", bild.id);
        return json({ ok: false, grund: "download", satz: WARM_FEHLER }, 200);
      }
      const pfad = `${user_id}/avatar/${bild.id}-basis.jpg`;
      const { error: upErr } = await admin.storage.from("kunden-bilder").upload(pfad, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        await admin.from("kunden_bilder").update({ status: "fehler", fehler: upErr.message } as never).eq("id", bild.id);
        return json({ ok: false, grund: "upload", satz: WARM_FEHLER }, 200);
      }
      await admin.from("kunden_bilder").update({ basis_path: pfad, status: "bereit", fehler: null } as never).eq("id", bild.id);
      const { data: sig } = await admin.storage.from("kunden-bilder").createSignedUrl(pfad, 60 * 60);
      return json({ ok: true, bild_id: bild.id, basis_url: sig?.signedUrl ?? null });
    }

    if (!["anprobe", "raum", "wand"].includes(aktion)) return json({ ok: false, grund: "aktion_unbekannt" }, 400);
    if (!body.product_id) return json({ ok: false, grund: "product_id_fehlt" }, 400);

    // Kontingent
    const { data: kont } = await admin.rpc("anprobe_kontingent");
    const frei = (kont as { frei?: number } | null)?.frei ?? (Array.isArray(kont) ? (kont[0] as { frei?: number })?.frei : undefined);
    if (typeof frei === "number" && frei <= 0) {
      return json({ ok: false, grund: "kontingent", satz: "Für heute sind deine zehn Anproben aufgebraucht. Morgen geht es weiter." }, 200);
    }

    // Werk + Welt
    const { data: prod } = await admin.from("products")
      .select("id, name, world, image_url, product_dna, height_cm, length_cm, width_cm")
      .eq("id", body.product_id).maybeSingle();
    const p = prod as {
      id: string; name: string; world: string | null; image_url: string | null;
      product_dna: Record<string, unknown> | null; height_cm: number | null; length_cm: number | null; width_cm: number | null;
    } | null;
    if (!p) return json({ ok: false, grund: "werk_nicht_gefunden" }, 404);
    const erwarteteWelt = aktion === "anprobe" ? "Mode" : aktion === "raum" ? "Interior" : "Kunst";
    if (p.world !== erwarteteWelt) {
      return json({ ok: false, grund: "welt_passt_nicht", satz: `Dieses Stück gehört zu ${p.world ?? "einer anderen Welt"} — dafür gibt es diese Ansicht nicht.` }, 200);
    }
    const heftDna = (p.product_dna?.heft ?? {}) as { cutout_url?: string };
    const werkBild = heftDna.cutout_url ?? p.image_url ?? "";
    if (!werkBild) return json({ ok: false, grund: "werk_ohne_bild", satz: "Von diesem Stück gibt es noch kein Bild." }, 200);

    // Bild der Kundin
    const erwarteteArt = aktion === "anprobe" ? "ganzkoerper" : aktion === "raum" ? "raum" : "wand";
    let bildQuery = admin.from("kunden_bilder")
      .select("id, user_id, art, quelle_path, basis_path, masse, aktiv")
      .eq("user_id", user_id).eq("aktiv", true).eq("art", erwarteteArt);
    if (body.bild_id) bildQuery = bildQuery.eq("id", body.bild_id);
    const { data: b } = await bildQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
    const bild = b as { id: string; art: string; quelle_path: string; basis_path: string | null; masse: Record<string, unknown> | null } | null;
    if (!bild) return json({ ok: false, grund: "bild_nicht_gefunden", satz: "Dazu fehlt uns noch dein Foto." }, 404);

    const quellPfad = aktion === "anprobe" ? (bild.basis_path ?? bild.quelle_path) : bild.quelle_path;
    const { data: signed } = await admin.storage.from("kunden-bilder").createSignedUrl(quellPfad, 600);
    if (!signed?.signedUrl) return json({ ok: false, grund: "bild_nicht_lesbar", satz: WARM_FEHLER }, 500);
    const personenBild = signed.signedUrl;

    // Echte Größe: aus der genannten Referenz (z. B. Tür = 200 cm) und ihrem Bildanteil
    // ergibt sich, wie breit das Werk im Bild sein muss. Ohne Referenz bleibt platz.breite.
    const platz: Platz = body.platz ?? {};
    const masse = (bild.masse ?? {}) as { referenz?: string; wert_cm?: number; referenz_anteil?: number };
    const werkBreiteCm = p.width_cm ?? p.length_cm ?? p.height_cm ?? null;
    let zielAnteil = typeof platz.breite === "number" ? platz.breite : 0.3;
    let groesse_geschaetzt = true;
    if (masse.wert_cm && masse.referenz_anteil && werkBreiteCm) {
      // Referenz belegt referenz_anteil der Bildbreite und ist wert_cm breit/hoch.
      const cmProAnteil = masse.wert_cm / masse.referenz_anteil;
      zielAnteil = Math.min(0.95, Math.max(0.02, werkBreiteCm / cmProAnteil));
      groesse_geschaetzt = false;
    }

    // Zeile anlegen und sofort antworten — die Kundin pollt mit 'stand'.
    const { data: row, error: insErr } = await admin.from("anproben").insert({
      user_id, product_id: p.id, bild_id: bild.id, art: aktion,
      platz: { ...platz, ziel_anteil: zielAnteil, groesse_geschaetzt } as never,
      status: "laeuft", provider: "fal",
    } as never).select("id").single();
    if (insErr || !row) return json({ ok: false, grund: "insert_failed", satz: WARM_FEHLER }, 500);
    const anprobe_id = (row as { id: string }).id;

    const start = Date.now();
    const lauf = (async () => {
      let ergebnisUrl = "";
      let fehler = "";
      if (aktion === "anprobe") {
        const { data: cfgRow } = await admin.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
        const cfg = (cfgRow?.value ?? {}) as { tryon_model?: string; tryon_model_alt?: string; fidelity_rules?: string };
        const fidelity = cfg.fidelity_rules ?? "Do not change the face, body or proportions of the person.";
        let r = await falSubmitAndPoll(FAL_KEY, cfg.tryon_model ?? "fal-ai/kling/v1-5/kolors-virtual-try-on", {
          human_image_url: personenBild, garment_image_url: werkBild, fidelity_prompt: fidelity,
        });
        if (!r.ok) {
          r = await falSubmitAndPoll(FAL_KEY, cfg.tryon_model_alt ?? "fal-ai/idm-vton", {
            human_image_url: personenBild, garment_image_url: werkBild,
            person_image_url: personenBild, garm_image_url: werkBild, description: fidelity,
          });
        }
        if (r.ok) ergebnisUrl = extractImageUrl(r.result); else fehler = r.message;
      } else {
        const ort = aktion === "wand" ? "on the wall" : "in the room";
        const stelle = `at the marked area around x=${Math.round((platz.x ?? 0.5) * 100)}% and y=${Math.round((platz.y ?? 0.5) * 100)}% of the photo`;
        const groesse = `The object must occupy about ${Math.round(zielAnteil * 100)}% of the photo width${
          groesse_geschaetzt ? "" : ` (its real size is ${werkBreiteCm} cm)`}.`;
        const prompt = `Place this exact object ${ort} ${stelle}, matching the perspective and light of the photo. ${groesse} Keep everything else in the photo untouched. Do not alter the object's shape, color or proportions.`;
        const r = await falSubmitAndPoll(FAL_KEY, RAUM_MODELL, {
          prompt, image_urls: [personenBild, werkBild], num_images: 1, output_format: "jpeg",
        });
        if (r.ok) ergebnisUrl = extractImageUrl(r.result); else fehler = r.message;
      }

      if (!ergebnisUrl) {
        await admin.from("anproben").update({ status: "fehler", fehler: fehler || "no_url", dauer_ms: Date.now() - start } as never).eq("id", anprobe_id);
        return;
      }
      const bytes = await ladeBytes(ergebnisUrl);
      if (!bytes) {
        await admin.from("anproben").update({ status: "fehler", fehler: "download", dauer_ms: Date.now() - start } as never).eq("id", anprobe_id);
        return;
      }
      const pfad = `${user_id}/anproben/${anprobe_id}.jpg`;
      const { error: upErr } = await admin.storage.from("kunden-bilder").upload(pfad, bytes, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        await admin.from("anproben").update({ status: "fehler", fehler: upErr.message, dauer_ms: Date.now() - start } as never).eq("id", anprobe_id);
        return;
      }
      await admin.from("anproben").update({
        status: "fertig", result_path: pfad, fehler: null, dauer_ms: Date.now() - start,
      } as never).eq("id", anprobe_id);

      // Auf PAWNs Rechnung: nur der Ledger, kein Credit der Kundin.
      const { data: costsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
      const cents = ((costsCfg?.value as Record<string, number> | null)?.[KOSTENSTELLE]) ?? 12;
      try {
        const { data: des } = await admin.from("products").select("designer_id").eq("id", p.id).maybeSingle();
        const designerId = (des as { designer_id?: string } | null)?.designer_id;
        if (designerId) await admin.rpc("book_ai_spend", { _designer_id: designerId, _cents: cents });
      } catch { /* informativ, blockiert nie */ }
    })();
    imHintergrund(lauf);

    return json({ ok: true, anprobe_id, groesse_geschaetzt });
  } catch (e) {
    return json({ ok: false, grund: String((e as Error)?.message ?? e), satz: WARM_FEHLER }, 500);
  }
});
