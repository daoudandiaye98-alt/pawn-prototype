/**
 * Poll fal.ai queue for pending generation_requests, download completed
 * clips into campaign-assets bucket (same-origin!), notify designer.
 * Body: { request_ids: string[] }
 *
 * Teil 38 AP4: ein einmaliger automatischer Neuversuch bei vermutlich vorübergehenden
 * Fehlern (Zeitüberschreitung, Anbieter-Fehler, fehlende Ergebnis-URL) statt sofort
 * endgültig zu scheitern; ein korrektes video_dna (echte Signatur + echte Länge statt
 * immer null/5s); und "der Regisseur" bewertet jede fertige Aufnahme strukturell gegen
 * die Marken-DNA und aktualisiert video_taste_weights nachvollziehbar.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pickByLang } from "../_shared/locale.ts";

const REGISSEUR_MODEL = "claude-sonnet-4-5";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}

/** Verwandelt technische Fehlercodes in einen Satz, den ein Haus ohne Erklärung versteht. */
function friendlyError(code: string): string {
  if (code === "timeout") return "Die Aufnahme hat zu lange gedauert und wurde einmal automatisch wiederholt — auch der zweite Versuch kam nicht rechtzeitig zurück. Bitte mit einem anderen Bild oder 5s statt 10s erneut versuchen.";
  if (code.startsWith("no_video_url")) return "Der Anbieter hat kein Ergebnis mitgeliefert — auch beim automatischen Neuversuch nicht. Bitte mit einem anderen Bild erneut versuchen.";
  if (code.startsWith("download_")) return "Das fertige Video ließ sich nicht abrufen — auch beim automatischen Neuversuch nicht. Bitte erneut versuchen.";
  if (code.startsWith("upload_")) return "Das fertige Video konnte nicht gespeichert werden. Bitte erneut versuchen — hält der Fehler an, sag PAWN im Studio Bescheid.";
  if (code === "FAILED" || code === "ERROR") return "Der Anbieter konnte diese Aufnahme nicht erzeugen — auch beim automatischen Neuversuch nicht. Bitte mit einem anderen Bild erneut versuchen.";
  return "Diese Aufnahme ist nicht gelungen, auch nicht beim automatischen Neuversuch. Bitte mit einem anderen Bild erneut versuchen.";
}

interface Handles { request_id?: string; status_url?: string; response_url?: string; image_url?: string; model?: string; prompt?: string; negative_prompt?: string; cfg_scale?: number; duration_s?: number }

/** Stößt denselben fal-Auftrag mit denselben Parametern einmal neu an — ohne den
 * Edge-Function-Aufruf generate-broll erneut zu durchlaufen (Credits/Budget wurden schon
 * gebucht, ein zweiter Aufruf würde sie doppelt abbuchen). Gibt null zurück, wenn dafür
 * nicht genug gespeicherte Angaben vorliegen (ältere Aufträge vor Teil 38 AP4).
 */
async function retrySubmission(FAL_KEY: string, handles: Handles): Promise<Handles | null> {
  if (!handles.model || !handles.image_url || !handles.prompt) return null;
  try {
    const r = await fetch(`https://queue.fal.run/${handles.model}`, {
      method: "POST",
      headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: handles.image_url, prompt: handles.prompt, duration: handles.duration_s ?? 5,
        negative_prompt: handles.negative_prompt, cfg_scale: handles.cfg_scale,
      }),
    });
    const rj = await r.json().catch(() => ({}));
    if (!r.ok) return null;
    return {
      ...handles,
      request_id: rj.request_id ?? rj.requestId ?? "",
      status_url: rj.status_url ?? rj.statusUrl ?? "",
      response_url: rj.response_url ?? rj.responseUrl ?? "",
    };
  } catch { return null; }
}

interface RegisseurVerdict { passt: boolean; punkte: string[]; iterationsvorschlag: string }

/** "Der Regisseur" — bewertet eine frische Aufnahme strukturell gegen die Marken-DNA (2-3
 * konkrete Punkte + 1 Iterationsvorschlag) und nudged video_taste_weights nachvollziehbar
 * in Richtung des bewerteten Stils. Darf nie den Aufnahme-Erfolg selbst blockieren. */
async function runRegisseurLoop(
  admin: SupabaseClient, apiKey: string,
  designer: { id: string; brand_dna: { signals?: string[]; worlds?: Record<string, number> } | null; video_taste_weights: Record<string, number> | null },
  videoAssetId: string, styleKey: string,
): Promise<void> {
  try {
    const signals = (designer.brand_dna?.signals ?? []).slice(0, 6).join(", ") || "noch keine erfassten Signale";
    const worlds = Object.keys(designer.brand_dna?.worlds ?? {}).join(", ") || "unbekannt";
    const system = `Du bist "der Regisseur" bei PAWN. Du hast gerade eine kinematische Aufnahme für ein unabhängiges Designhaus erzeugt und beurteilst jetzt strukturell, ob sie zur Marken-DNA passt — knapp, konkret, ohne Marketing-Floskeln.

Antworte NUR mit JSON: {"passt": true|false, "punkte": ["2-3 kurze, konkrete Beobachtungen"], "iterationsvorschlag": "ein Satz, was beim nächsten Versuch anders sein sollte"}`;
    const user = `Welt(en) des Hauses: ${worlds}. Marken-Signale: ${signals}. Beurteile eine soeben erzeugte kinematische Aufnahme in diesem Stil, ohne das Video selbst zu sehen — anhand dessen, ob eine Aufnahme in diesem Bild-Stil zu diesen Signalen passen würde.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: REGISSEUR_MODEL, max_tokens: 400, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as Partial<RegisseurVerdict>;
    if (typeof parsed.passt !== "boolean") return;
    const verdict: RegisseurVerdict = {
      passt: parsed.passt,
      punkte: Array.isArray(parsed.punkte) ? parsed.punkte.slice(0, 3).map(String) : [],
      iterationsvorschlag: typeof parsed.iterationsvorschlag === "string" ? parsed.iterationsvorschlag : "",
    };
    await admin.from("video_assets").update({ regisseur_verdict: verdict } as never).eq("id", videoAssetId);

    // Nudge, nachvollziehbar: passt die Aufnahme, steigt das Gewicht für diesen Stil leicht,
    // sonst sinkt es leicht — geclampt auf [0.2, 3]. Ergänzt (nicht ersetzt) die wöchentliche
    // Performance-Auswertung in pawn-jarvis (kampagnen_regie), die auf echten Klicks/Views beruht.
    const weights = { ...(designer.video_taste_weights ?? {}) };
    const current = typeof weights[styleKey] === "number" ? weights[styleKey] : 1;
    const nudged = Math.max(0.2, Math.min(3, current + (verdict.passt ? 0.1 : -0.1)));
    weights[styleKey] = Math.round(nudged * 100) / 100;
    await admin.from("designers").update({ video_taste_weights: weights } as never).eq("id", designer.id);
  } catch { /* der Regisseur darf den Aufnahme-Erfolg nie blockieren */ }
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const { data: rows } = await admin.from("generation_requests")
      .select("id, status, error, provider_handles, tier, campaign_id, created_at, retry_count, signature_id, duration_s, campaigns!inner(designer_id, designers!inner(user_id, media_rights_granted_at, preferred_language, brand_dna, video_taste_weights))")
      .in("id", request_ids);
    if (!rows) return json({ ok: true, results: [] });

    const results: Array<{ id: string; status: string; result_url?: string; error?: string }> = [];

    for (const r of rows as unknown as Array<{
      id: string; status: string; error: string | null; provider_handles: Handles | null;
      tier: string; campaign_id: string; created_at: string; retry_count: number;
      signature_id: string | null; duration_s: number | null;
      campaigns: {
        designer_id: string;
        designers: {
          user_id: string; media_rights_granted_at: string | null; preferred_language: string | null;
          brand_dna: { signals?: string[]; worlds?: Record<string, number> } | null;
          video_taste_weights: Record<string, number> | null;
        };
      };
    }>) {
      if (r.status === "done" || r.status === "failed") {
        results.push({ id: r.id, status: r.status });
        continue;
      }

      let handles = (r.provider_handles ?? {}) as Handles;
      if (!handles.status_url && r.error) {
        try { handles = JSON.parse(r.error); } catch { /* noop */ }
      }

      // Teil 38 AP4: vor dem endgültigen Scheitern (Zeitüberschreitung ODER Anbieter-Fehler)
      // genau einen automatischen Neuversuch mit denselben Parametern — nur wenn genug
      // gespeicherte Angaben dafür vorliegen (Aufträge nach Teil 38 AP4).
      const versuchNeustart = async (grund: string): Promise<boolean> => {
        if (r.retry_count >= 1) return false;
        const retried = await retrySubmission(FAL_KEY, handles);
        if (!retried) return false;
        await admin.from("generation_requests").update({
          status: "running", retry_count: 1, error: null,
          provider_handles: retried, created_at: new Date().toISOString(),
        } as never).eq("id", r.id);
        results.push({ id: r.id, status: "running", error: `neu gestartet nach: ${grund}` });
        return true;
      };

      // Zeitüberschreitung — Meisterklasse braucht laut Katalog bis zu 10 Minuten; das Fenster
      // hier muss klar darüber liegen, sonst meldet poll-broll selbst eine noch laufende
      // Aufnahme fälschlich als gescheitert.
      const age = Date.now() - new Date(r.created_at).getTime();
      if (age > 20 * 60 * 1000) {
        if (await versuchNeustart("timeout")) continue;
        const msg = friendlyError("timeout");
        await admin.from("generation_requests").update({ status: "failed", error: msg } as never).eq("id", r.id);
        results.push({ id: r.id, status: "failed", error: msg });
        continue;
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
            if (await versuchNeustart("no_video_url_in_response")) continue;
            const msg = friendlyError("no_video_url_in_response");
            await admin.from("generation_requests").update({ status: "failed", error: msg } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: msg });
            continue;
          }
          // Fetch → upload to campaign-assets (same-origin!)
          const videoResp = await fetch(videoUrl);
          if (!videoResp.ok) {
            if (await versuchNeustart(`download_${videoResp.status}`)) continue;
            const msg = friendlyError(`download_${videoResp.status}`);
            await admin.from("generation_requests").update({ status: "failed", error: msg } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: msg });
            continue;
          }
          const bytes = new Uint8Array(await videoResp.arrayBuffer());
          const path = `${r.campaigns.designers.user_id}/broll/${r.id}.mp4`;
          const { error: upErr } = await admin.storage.from("campaign-assets")
            .upload(path, bytes, { contentType: "video/mp4", upsert: true });
          if (upErr) {
            if (await versuchNeustart(`upload_${upErr.message}`)) continue;
            const msg = friendlyError(`upload_${upErr.message}`);
            await admin.from("generation_requests").update({ status: "failed", error: msg } as never).eq("id", r.id);
            results.push({ id: r.id, status: "failed", error: msg });
            continue;
          }
          const { data: signed } = await admin.storage.from("campaign-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
          const finalUrl = signed?.signedUrl ?? path;
          await admin.from("generation_requests").update({
            status: "done", result_url: finalUrl, error: null,
          } as never).eq("id", r.id);

          // Teil 38 AP4: echtes video_dna statt immer null/5s — liest die tatsächlich verwendete
          // Signatur (falls gewählt) und die tatsächlich angeforderte Länge.
          let signaturName: string | null = null;
          let schnittrhythmus: string | null = null;
          let palette: string | null = null;
          if (r.signature_id) {
            const { data: sig } = await admin.from("house_signatures").select("name, recipe").eq("id", r.signature_id).maybeSingle();
            const sigRow = sig as { name?: string; recipe?: { schnittrhythmus?: string; palette?: string } } | null;
            signaturName = sigRow?.name ?? null;
            schnittrhythmus = sigRow?.recipe?.schnittrhythmus ?? null;
            palette = sigRow?.recipe?.palette ?? null;
          }
          const { data: videoAssetRow } = await admin.from("video_assets").insert({
            designer_id: r.campaigns.designer_id,
            campaign_id: r.campaign_id,
            url: finalUrl,
            source: "designer",
            video_dna: {
              provider: "fal", tier: r.tier,
              signatur: signaturName, hook_typ: null, schnittrhythmus, palette,
              laenge_s: r.duration_s ?? 5, modelltyp: "kinematisch",
            },
            rights_granted: !!r.campaigns.designers.media_rights_granted_at,
          } as never).select("id").single();
          await admin.from("notifications").insert({
            user_id: r.campaigns.designers.user_id,
            type: "campaign.broll_ready",
            title: pickByLang(r.campaigns.designers.preferred_language, "Deine Aufnahmen sind fertig", "Your footage is ready"),
            body: pickByLang(r.campaigns.designers.preferred_language, "PAWN hat einen kinematischen Clip erzeugt.", "PAWN has generated a cinematic clip."),
            link: "/studio/kampagnen",
          } as never);
          results.push({ id: r.id, status: "done", result_url: finalUrl });

          // Der Regisseur bewertet die Aufnahme strukturell — nach dem Erfolg, blockiert ihn nie.
          if (anthropicKey && videoAssetRow) {
            const styleKey = signaturName ?? "standard";
            await runRegisseurLoop(admin, anthropicKey, {
              id: r.campaigns.designer_id,
              brand_dna: r.campaigns.designers.brand_dna,
              video_taste_weights: r.campaigns.designers.video_taste_weights,
            }, (videoAssetRow as { id: string }).id, styleKey);
          }
        } else if (st === "FAILED" || st === "ERROR") {
          if (await versuchNeustart(st)) continue;
          const msg = friendlyError(st);
          await admin.from("generation_requests").update({ status: "failed", error: msg } as never).eq("id", r.id);
          results.push({ id: r.id, status: "failed", error: msg });
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
