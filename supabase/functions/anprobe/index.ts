/**
 * Anprobe — die Kundin sieht ein Stück an sich, in ihrem Raum oder an ihrer Wand.
 *
 * POST { aktion:'bereinigen', bild_id }
 * POST { aktion:'anprobe',    product_id, product_ids?: [bis zu 3], bild_id? }
 * POST { aktion:'ansichten',  anprobe_id }            — Seite und Rücken zur fertigen Vorderansicht
 * POST { aktion:'raum',       product_id, bild_id, platz:{x,y,breite} }
 * POST { aktion:'wand',       product_id, bild_id, platz:{x,y,breite} }
 * POST { aktion:'stand',      anprobe_id }            — mit `ansichten` {vorne, seite, hinten}
 * POST { aktion:'bewerten',   anprobe_id, bewertung:'passt'|'nicht' }
 *
 * DIE DREHBÜHNE (nach dem Vorbild von Mira, trymira.style): Mode wird mit einem
 * Bildmodell angezogen — bis zu drei Stücke als ein Outfit —, und die fertige
 * Vorderansicht lässt sich danach von der Seite und von hinten zeigen. Die Logik
 * dafür steht rein und getestet in ../_shared/drehbuehne.ts. Die Ansichten liegen als
 * Geschwisterdateien neben dem Hauptbild (<id>-seite.jpg, <id>-hinten.jpg); der
 * Auftrag (Stücke, Modell, Stand der Ansichten) steht in `request_handle`.
 * Keine neue Spalte, keine Migration.
 *
 * Hier geht es um private Fotos von Personen: die Identität wird über auth.getUser()
 * mit Signaturprüfung festgestellt, nicht über einen dekodierten JWT-Inhalt.
 * Anproben laufen auf PAWNs Rechnung — kein Credit, das Kontingent (10/24 h) begrenzt.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  anprobePrompt, ansichtAusDatei, ansichtenStand, ansichtPfad, ansichtPrompt, AVATAR_PROMPT, BILDMODELL, bildParameter, centJeBild, darfAnsichtenStarten, erlaubtesModell, KOLORS, NACHANSICHTEN, notizKurz, stueckeAusAuftrag, stueckeDerAnprobe, type Ansicht, type Nachansicht, type Stueck,
} from "../_shared/drehbuehne.ts";

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

/** Das Bild, das ein Werk in die Anprobe bringt: die Freistellung, sonst das Hauptbild. */
function werkBildVon(w: { image_url: string | null; product_dna: Record<string, unknown> | null }): string {
  const heftDna = (w.product_dna?.heft ?? {}) as { cutout_url?: string };
  return heftDna.cutout_url ?? w.image_url ?? "";
}

/** Welche Ansichten einer Anprobe schon im Eimer liegen — gelesen aus dem Ordner der Kundin. */
async function vorhandeneAnsichten(admin: SupabaseClient, userId: string, anprobeId: string): Promise<Ansicht[]> {
  const { data } = await admin.storage.from("kunden-bilder").list(`${userId}/anproben`, { search: anprobeId, limit: 20 });
  const gefunden = new Set<Ansicht>();
  for (const d of data ?? []) {
    const a = ansichtAusDatei(anprobeId, d.name);
    if (a) gefunden.add(a);
  }
  return (["vorne", "seite", "hinten"] as Ansicht[]).filter((a) => gefunden.has(a));
}

/* K1 — Anproben laufen auf PAWNs Rechnung, nie gegen ein Haus. Ein Haus darf keine
   KI-Ausgaben in seiner Abrechnung sehen, die eine Kundin ausgelöst hat (sonst wird ein
   beliebtes Stück für den Designer teuer). book_ai_spend und ai_budget_ledger sind beide
   hausgebunden (ai_budget_ledger.designer_id ist NOT NULL) — es gibt dort keine Zeile ohne
   Haus. Deshalb wird die Plattform-Ausgabe in ai_logs geschrieben, Kostenstelle kunde_anprobe.
   Je gerechnetem Bild eine Buchung: die Drehbühne kostet drei Bilder, nicht eines. */
async function kostenBuchen(admin: SupabaseClient, bilder: number, info: Record<string, unknown>) {
  if (bilder <= 0) return;
  try {
    const { data: costsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
    const satz = (costsCfg?.value as Record<string, number> | null)?.[KOSTENSTELLE];
    const cents = centJeBild(info.modell, satz, info.aufloesung);
    await admin.from("ai_logs").insert({
      agent_id: KOSTENSTELLE,
      model: String(info.modell ?? "tryon"),
      status: "ok",
      latency_ms: typeof info.ms === "number" ? info.ms : null,
      request: { kostenstelle: KOSTENSTELLE, traeger: "plattform", cents: cents * bilder, bilder, ...info },
      response: { result_path: info.result_path ?? null },
    } as never);
  } catch { /* informativ, blockiert nie */ }
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
      aktion?: string; bild_id?: string; product_id?: string; product_ids?: unknown; anprobe_id?: string;
      platz?: Platz; bewertung?: string;
    };
    const aktion = body.aktion ?? "";

    // ---------- stand ----------
    if (aktion === "stand") {
      if (!body.anprobe_id) return json({ ok: false, grund: "anprobe_id_fehlt" }, 400);
      const { data: a } = await admin.from("anproben")
        .select("status, result_path, fehler, dauer_ms, user_id, art, product_id, request_handle").eq("id", body.anprobe_id).maybeSingle();
      const row = a as {
        status: string; result_path: string | null; fehler: string | null; dauer_ms: number | null; user_id: string;
        art: string; product_id: string; request_handle: unknown;
      } | null;
      if (!row || row.user_id !== user_id) return json({ ok: false, grund: "nicht_gefunden" }, 404);
      let result_url: string | null = null;
      const ansichten: Partial<Record<Ansicht, string>> = {};
      if (row.result_path && row.art === "anprobe") {
        // Alle Ansichten derselben Anprobe liegen nebeneinander im Ordner der Kundin.
        const vorhanden = await vorhandeneAnsichten(admin, user_id, body.anprobe_id);
        if (vorhanden.length) {
          const { data: signiert } = await admin.storage.from("kunden-bilder")
            .createSignedUrls(vorhanden.map((v) => ansichtPfad(user_id, body.anprobe_id!, v)), 60 * 60);
          (signiert ?? []).forEach((s, i) => { if (s?.signedUrl) ansichten[vorhanden[i]] = s.signedUrl; });
        }
        result_url = ansichten.vorne ?? null;
      }
      if (row.result_path && !result_url) {
        const { data: signed } = await admin.storage.from("kunden-bilder").createSignedUrl(row.result_path, 60 * 60);
        result_url = signed?.signedUrl ?? null;
        if (result_url && row.art === "anprobe") ansichten.vorne = result_url;
      }
      return json({
        ok: true, status: row.status, result_url, fehler: row.fehler, dauer_ms: row.dauer_ms,
        ansichten, ansichten_status: row.art === "anprobe" ? ansichtenStand(row.request_handle).status : null,
        stuecke: row.art === "anprobe" ? stueckeDerAnprobe(row.request_handle, row.product_id) : [row.product_id],
      });
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
        prompt: AVATAR_PROMPT,
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

    // ---------- ansichten — Seite und Rücken zur fertigen Vorderansicht ----------
    if (aktion === "ansichten") {
      if (!body.anprobe_id) return json({ ok: false, grund: "anprobe_id_fehlt" }, 400);
      const anprobeId = body.anprobe_id;
      const { data: a } = await admin.from("anproben")
        .select("id, user_id, art, status, result_path, product_id, request_handle").eq("id", anprobeId).maybeSingle();
      const row = a as {
        id: string; user_id: string; art: string; status: string; result_path: string | null;
        product_id: string; request_handle: Record<string, unknown> | null;
      } | null;
      if (!row || row.user_id !== user_id) return json({ ok: false, grund: "nicht_gefunden" }, 404);
      if (row.art !== "anprobe" || row.status !== "fertig" || !row.result_path) {
        return json({ ok: false, grund: "nicht_bereit", satz: "Erst steht die Vorderansicht, dann dreht sich die Bühne." }, 200);
      }
      const vorhanden = new Set(await vorhandeneAnsichten(admin, user_id, anprobeId));
      const fehlend = NACHANSICHTEN.filter((v) => !vorhanden.has(v));
      const handle = (row.request_handle ?? {}) as Record<string, unknown>;
      const stand = ansichtenStand(handle);
      if (!fehlend.length) {
        if (stand.status !== "fertig") {
          await admin.from("anproben").update({ request_handle: { ...handle, ansichten: { ...stand, status: "fertig", fehlend: undefined } } } as never).eq("id", anprobeId);
        }
        return json({ ok: true, status: "fertig", fehlend: [] });
      }
      if (!darfAnsichtenStarten(stand, Date.now())) {
        return stand.status === "laeuft"
          ? json({ ok: true, status: "laeuft", fehlend })
          : json({ ok: false, grund: "versuche_aufgebraucht", satz: "Mehr Ansichten gibt es für diese Anprobe nicht." }, 200);
      }

      const stueckIds = stueckeDerAnprobe(handle, row.product_id);
      const { data: prods } = await admin.from("products")
        .select("id, name, image_url, product_dna, designer_note").in("id", stueckIds);
      const werke = stueckIds
        .map((id) => (prods as Array<{ id: string; name: string; image_url: string | null; product_dna: Record<string, unknown> | null; designer_note: string | null }> | null)?.find((x) => x.id === id))
        .filter((x): x is { id: string; name: string; image_url: string | null; product_dna: Record<string, unknown> | null; designer_note: string | null } => !!x);
      const bilder = werke.map(werkBildVon).filter(Boolean);
      const stuecke: Stueck[] = werke.map((w) => ({ name: w.name, notiz: w.designer_note }));
      const { data: vorneSigniert } = await admin.storage.from("kunden-bilder").createSignedUrl(row.result_path, 900);
      const vorneUrl = vorneSigniert?.signedUrl ?? "";
      if (!vorneUrl || !bilder.length) {
        return json({ ok: false, grund: "quelle_fehlt", satz: WARM_FEHLER }, 200);
      }

      const { data: cfgRow } = await admin.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
      const cfg = (cfgRow?.value ?? {}) as { edit_model?: string; ansichten_modell?: string; aufloesung?: string };
      const modell = erlaubtesModell(cfg.ansichten_modell ?? cfg.edit_model, BILDMODELL);
      const neuerStand = { status: "laeuft" as const, seit: new Date().toISOString(), versuche: stand.versuche + 1 };
      /* Sperre ohne Migration (Prüferfund 24.11.): geschrieben wird nur, wenn der gespeicherte
         Zähler noch der gelesene ist. Zwei gleichzeitige Aufrufe starten so nicht doppelt — und
         bezahlen nicht doppelt. Postgres prüft die Bedingung nach der Zeilensperre neu. */
      const gespeichert = (handle.ansichten ?? null) as { versuche?: unknown } | null;
      let sperre = admin.from("anproben").update({ request_handle: { ...handle, ansichten: neuerStand } } as never).eq("id", anprobeId);
      sperre = gespeichert && typeof gespeichert.versuche === "number"
        ? sperre.eq("request_handle->ansichten->>versuche", String(gespeichert.versuche))
        : sperre.is("request_handle->ansichten", null);
      const { data: gewonnen, error: sperrFehler } = await sperre.select("id");
      if (sperrFehler) {
        // Kennt die Datenbank den Filter nicht, geht es ohne Sperre weiter — lieber einmal zu viel als nie.
        console.warn("[anprobe] ansichten-sperre:", sperrFehler.message);
        await admin.from("anproben").update({ request_handle: { ...handle, ansichten: neuerStand } } as never).eq("id", anprobeId);
      } else if (!gewonnen || !(gewonnen as unknown[]).length) {
        return json({ ok: true, status: "laeuft", fehlend });
      }

      const start = Date.now();
      const lauf = (async () => {
        const ergebnisse = await Promise.all(fehlend.map(async (ansicht: Nachansicht) => {
          const r = await falSubmitAndPoll(FAL_KEY, modell, {
            prompt: ansichtPrompt(ansicht, stuecke),
            image_urls: [vorneUrl, ...bilder],
            num_images: 1, output_format: "jpeg", ...bildParameter(modell, cfg.aufloesung),
          }, 150_000);
          const url = r.ok ? extractImageUrl(r.result) : "";
          const bytes = url ? await ladeBytes(url) : null;
          if (!bytes) return { ansicht, ok: false };
          const { error } = await admin.storage.from("kunden-bilder")
            .upload(ansichtPfad(user_id, anprobeId, ansicht), bytes, { contentType: "image/jpeg", upsert: true });
          return { ansicht, ok: !error };
        }));
        const gescheitert = ergebnisse.filter((e) => !e.ok).map((e) => e.ansicht);
        const gelungen = ergebnisse.length - gescheitert.length;
        await admin.from("anproben").update({
          request_handle: {
            ...handle,
            ansichten: { ...neuerStand, status: gelungen === 0 ? "fehler" : "fertig", ...(gescheitert.length ? { fehlend: gescheitert } : {}) },
          },
        } as never).eq("id", anprobeId);
        await kostenBuchen(admin, gelungen, { art: "ansichten", anprobe_id: anprobeId, modell, aufloesung: cfg.aufloesung, ms: Date.now() - start });
      })();
      imHintergrund(lauf);
      return json({ ok: true, status: "laeuft", fehlend });
    }

    if (!["anprobe", "raum", "wand"].includes(aktion)) return json({ ok: false, grund: "aktion_unbekannt" }, 400);
    const stueckIds = stueckeAusAuftrag(body);
    if (!stueckIds.length) return json({ ok: false, grund: "product_id_fehlt" }, 400);

    // Kontingent — über den Nutzer-Client, denn die Funktion rechnet mit auth.uid().
    const { data: kont } = await alsNutzer.rpc("anprobe_kontingent");
    const frei = (kont as { frei?: number } | null)?.frei ?? (Array.isArray(kont) ? (kont[0] as { frei?: number })?.frei : undefined);
    if (typeof frei === "number" && frei <= 0) {
      return json({ ok: false, grund: "kontingent", satz: "Für heute sind deine zehn Anproben aufgebraucht. Morgen geht es weiter." }, 200);
    }

    // Werke + Welt. Mode darf ein Outfit aus bis zu drei Stücken sein; Raum und Wand nehmen eines.
    const ids = aktion === "anprobe" ? stueckIds : stueckIds.slice(0, 1);
    const { data: prods } = await admin.from("products")
      .select("id, name, world, image_url, product_dna, designer_note, height_cm, length_cm, width_cm")
      .in("id", ids);
    type Werk = {
      id: string; name: string; world: string | null; image_url: string | null; product_dna: Record<string, unknown> | null;
      designer_note: string | null; height_cm: number | null; length_cm: number | null; width_cm: number | null;
    };
    const werke = ids.map((id) => (prods as Werk[] | null)?.find((x) => x.id === id)).filter((x): x is Werk => !!x);
    if (werke.length !== ids.length) return json({ ok: false, grund: "werk_nicht_gefunden" }, 404);
    const p = werke[0];
    const erwarteteWelt = aktion === "anprobe" ? "Mode" : aktion === "raum" ? "Interior" : "Kunst";
    const fremd = werke.find((w) => w.world !== erwarteteWelt);
    if (fremd) {
      return json({ ok: false, grund: "welt_passt_nicht", satz: `${notizKurz(fremd.name, 60) || "Dieses Stück"} gehört zu ${fremd.world ?? "einer anderen Welt"} — dafür gibt es diese Ansicht nicht.` }, 200);
    }
    const werkBilder = werke.map(werkBildVon);
    const ohneBild = werke.find((_, i) => !werkBilder[i]);
    if (ohneBild) return json({ ok: false, grund: "werk_ohne_bild", satz: `Von ${notizKurz(ohneBild.name, 60) || "diesem Stück"} gibt es noch kein Bild.` }, 200);
    const werkBild = werkBilder[0];

    // Bild der Kundin
    // D1 legt Ganzkörperbilder als art='avatar' an; ältere Zeilen heißen 'ganzkoerper'.
    const erwarteteArten = aktion === "anprobe" ? ["ganzkoerper", "avatar"] : aktion === "raum" ? ["raum"] : ["wand"];
    let bildQuery = admin.from("kunden_bilder")
      .select("id, user_id, art, quelle_path, basis_path, masse, aktiv")
      .eq("user_id", user_id).eq("aktiv", true).in("art", erwarteteArten);
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
    const { data: cfgRow } = await admin.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
    const cfg = (cfgRow?.value ?? {}) as { edit_model?: string; tryon_model?: string; aufloesung?: string; fidelity_rules?: string };
    const anprobeModell = erlaubtesModell(cfg.edit_model, BILDMODELL);
    const { data: row, error: insErr } = await admin.from("anproben").insert({
      user_id, product_id: p.id, bild_id: bild.id, art: aktion,
      platz: { ...platz, ziel_anteil: zielAnteil, groesse_geschaetzt } as never,
      status: "laeuft", provider: "fal",
      request_handle: aktion === "anprobe"
        ? { stuecke: werke.map((w) => w.id), modell: anprobeModell, ansichten: { status: "offen", versuche: 0 } }
        : null,
    } as never).select("id").single();
    if (insErr || !row) return json({ ok: false, grund: "insert_failed", satz: WARM_FEHLER }, 500);
    const anprobe_id = (row as { id: string }).id;

    const start = Date.now();
    const lauf = (async () => {
      let ergebnisUrl = "";
      let fehler = "";
      let gerechnetMit = RAUM_MODELL;
      if (aktion === "anprobe") {
        // Erst das Bildmodell: es zieht auch Taschen, Schuhe, Schmuck und ganze Outfits an.
        const stuecke: Stueck[] = werke.map((w) => ({ name: w.name, notiz: w.designer_note }));
        gerechnetMit = anprobeModell;
        let r = await falSubmitAndPoll(FAL_KEY, anprobeModell, {
          prompt: anprobePrompt(stuecke, cfg.fidelity_rules),
          image_urls: [personenBild, ...werkBilder],
          num_images: 1, output_format: "jpeg", ...bildParameter(anprobeModell, cfg.aufloesung),
        }, 150_000);
        // Ersatz nur für EIN Stück: Kolors kennt kein Outfit. IDM-VTON wird nie gerufen —
        // CC BY-NC-SA 4.0, nicht kommerziell (erlaubtesModell in ../_shared/drehbuehne.ts).
        if (!r.ok && werke.length === 1) {
          gerechnetMit = erlaubtesModell(cfg.tryon_model, KOLORS);
          r = await falSubmitAndPoll(FAL_KEY, gerechnetMit, {
            human_image_url: personenBild, garment_image_url: werkBild,
            fidelity_prompt: cfg.fidelity_rules ?? "Do not change the face, body or proportions of the person.",
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

      /* K1 — Anproben laufen auf PAWNs Rechnung, nie gegen ein Haus. Ein Haus darf keine
         KI-Ausgaben in seiner Abrechnung sehen, die eine Kundin ausgelöst hat (sonst wird ein
         beliebtes Stück für den Designer teuer). book_ai_spend und ai_budget_ledger sind beide
         hausgebunden (ai_budget_ledger.designer_id ist NOT NULL) — es gibt dort keine Zeile ohne
         Haus. Deshalb wird die Plattform-Ausgabe in ai_logs geschrieben, Kostenstelle kunde_anprobe. */
      await kostenBuchen(admin, 1, {
        art: aktion, anprobe_id, product_id: p.id, result_path: pfad,
        modell: gerechnetMit, aufloesung: cfg.aufloesung, ms: Date.now() - start,
      });
    })();
    imHintergrund(lauf);

    return json({ ok: true, anprobe_id, groesse_geschaetzt });
  } catch (e) {
    return json({ ok: false, grund: String((e as Error)?.message ?? e), satz: WARM_FEHLER }, 500);
  }
});
