/**
 * Die Rochade: eine Künstlerin speist ihre bereits existierende Website, ein paar Screenshots
 * oder ihr Instagram-Handle ein — First Move (Zug 1 von /start) kommt vorbefüllt zurück statt
 * mit leerem Blatt. Drei gleichwertige Eingänge: url | screenshots | instagram.
 *
 * Grundprinzip: wir importieren die IDENTITÄT, nicht das CSS. Diese Funktion liest niemals
 * Farbwerte, Schriftarten oder Layout-CSS der Quelle aus und gibt so etwas auch nicht zurück —
 * nur Inhalte (Werk-Kandidaten, Texte) und grobe Wort-Beschreibungen für die Stil-DNA. Fest an
 * das eigene Haus gebunden: erfordert einen eingeloggten Nutzer, der gerade seinen eigenen
 * First-Move-Flow durchläuft — kein generisches "beliebige Seite scrapen"-Werkzeug.
 *
 * Body: { mode: "url"|"screenshots"|"instagram", consent: true,
 *         url?: string, screenshot_urls?: string[], instagram_handle?: string }
 * Response: { ok, brand_name?, about_text?, works?: [{kind, title, description, image_url}],
 *             dna?: {...}, error?, message? }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";
const MAX_IMAGES = 8;
const APIFY_BASE = "https://api.apify.com/v2";

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
function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

interface FetchedImage { url: string; data: string; media_type: string }

async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!contentType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 8_000_000) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { url, data: btoa(binary), media_type: contentType };
  } catch {
    return null;
  }
}

/** Lädt ein extern gefundenes Bild herunter und hostet es dauerhaft im eigenen designer-media-
 * Bucket neu (signierte URL, 1 Jahr) — die Quellseite kann verschwinden, das Werk bleibt. */
async function rehost(admin: ReturnType<typeof createClient>, userId: string, img: FetchedImage): Promise<string | null> {
  try {
    const ext = img.media_type.includes("png") ? "png" : img.media_type.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/rochade/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
    const { error } = await admin.storage.from("designer-media").upload(path, bytes, { contentType: img.media_type, upsert: false });
    if (error) return null;
    const { data: signed } = await admin.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed?.signedUrl ?? null;
  } catch {
    return null;
  }
}

function absoluteUrl(base: string, src: string): string | null {
  try { return new URL(src, base).toString(); } catch { return null; }
}

const IGNORE_IMG_PATTERN = /logo|icon|favicon|sprite|pixel|avatar|badge|button/i;

async function extractFromHtml(pageUrl: string): Promise<{ images: string[]; text: string } | null> {
  let html: string;
  try {
    const res = await fetch(pageUrl, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0 (compatible; PAWN-Rochade/1.0)" } });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";

  const imgSrcs = new Set<string>();
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogImage) { const u = absoluteUrl(pageUrl, ogImage); if (u) imgSrcs.add(u); }
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    if (imgSrcs.size >= MAX_IMAGES * 2) break;
    const raw = m[1];
    if (IGNORE_IMG_PATTERN.test(raw) || raw.startsWith("data:")) continue;
    const abs = absoluteUrl(pageUrl, raw);
    if (abs) imgSrcs.add(abs);
  }

  const text = [ogTitle || title, desc].filter(Boolean).join(" — ");
  return { images: [...imgSrcs].slice(0, MAX_IMAGES * 2), text };
}

interface ApifyRun { runId: string; datasetId: string | null }
async function apifyStartRun(token: string, actorId: string, input: Record<string, unknown>): Promise<ApifyRun | null> {
  try {
    const res = await fetch(`${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { runId: data?.data?.id, datasetId: data?.data?.defaultDatasetId ?? null };
  } catch {
    return null;
  }
}
async function apifyPollDataset(token: string, runId: string, maxWaitMs: number): Promise<Record<string, unknown>[] | null> {
  const deadline = Date.now() + maxWaitMs;
  let datasetId: string | null = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        datasetId = data?.data?.defaultDatasetId ?? datasetId;
        const status = data?.data?.status;
        if (status === "SUCCEEDED" && datasetId) {
          const items = await fetch(`${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&limit=1&clean=true`);
          if (items.ok) return await items.json();
          return null;
        }
        if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") return null;
      }
    } catch { /* weiter versuchen */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

const DNA_SYSTEM_PROMPT = `Du hilfst PAWN, einem kuratierten Haus für Mode, Interior und Kunst, das bereits bestehende Portfolio einer Künstlerin (Website, Screenshots oder Instagram-Profil) in eine erste Werkliste, eine Selbst­beschreibung und ein paar Stil-Kennzahlen zu übersetzen — damit sie ihr neues PAWN-Haus nicht bei null beginnen muss.

WICHTIG: Du übernimmst NIEMALS konkrete Farbwerte, Schriftarten oder Layout-CSS der Quelle — nur Inhalte (welche Werke gezeigt werden, welche Texte über die Person stehen) und grobe Wort-Beschreibungen der Stiltendenz. Erfinde nichts, was sich nicht aus dem Material ablesen lässt.

Dir werden nummerierte Bilder (Werkfotos, Screenshots oder Instagram-Beiträge) und ein Text-Auszug gegeben. Antworte NUR mit JSON, kein weiterer Text:
{
  "marke_vorschlag": "kurzer Name-Vorschlag falls aus dem Material ableitbar, sonst null",
  "about_text": "2-3 Sätze auf Deutsch im Ton der Quelle, als Selbstvorstellung formuliert",
  "werke": [{"bildindex": 0, "titel": "kurzer Titel", "beschreibung": "1-2 Sätze", "art_vorschlag": "original|print|auftragsarbeit|live_portrait"}],
  "dna": {
    "typo_gefuehl": "serif|sans|gemischt",
    "hell_dunkel": "hell|dunkel|gemischt",
    "bildlastig": true,
    "tonalitaet": "ein bis zwei Worte, z.B. \\"ruhig, poetisch\\"",
    "angebotsstruktur": "ein bis zwei Worte, z.B. \\"viele Einzelstücke\\" oder \\"wenige große Arbeiten\\"",
    "layout_muster": "vollbild_sektionen|raster|liste|gemischt"
  }
}
"bildindex" ist die Position (0-basiert) im gesendeten Bilder-Array — nur Bilder aufnehmen, die wirklich ein einzelnes Werk zeigen (keine Logos, Icons, UI-Elemente, Portraits der Person selbst). Wenn kein Bild eindeutig ein Werk zeigt, "werke" leer lassen statt zu raten.`;

async function distill(apiKey: string, images: FetchedImage[], text: string): Promise<Record<string, unknown> | null> {
  const content: Record<string, unknown>[] = images.map((img) => ({
    type: "image", source: { type: "base64", media_type: img.media_type, data: img.data },
  }));
  content.push({ type: "text", text: text ? `Text-Auszug von der Quelle: ${text.slice(0, 2000)}` : "Kein Text-Auszug verfügbar." });
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: DNA_SYSTEM_PROMPT, messages: [{ role: "user", content }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    return extractJson(out);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as {
      mode?: "url" | "screenshots" | "instagram"; consent?: boolean;
      url?: string; screenshot_urls?: string[]; instagram_handle?: string;
    };
    if (body.consent !== true) {
      return json({ ok: false, error: "consent_required", message: "Bitte bestätige zuerst, dass es deine eigene Seite/dein Profil ist." }, 200);
    }
    if (!body.mode || !["url", "screenshots", "instagram"].includes(body.mode)) {
      return json({ ok: false, error: "mode_required" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "not_configured", message: "Die Rochade ist gerade nicht verfügbar — leg deine Werke von Hand an." }, 200);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, svc, { auth: { persistSession: false } });

    let candidateUrls: string[] = [];
    let text = "";
    let sourceRef = "";

    if (body.mode === "url") {
      const url = (body.url ?? "").trim();
      if (!/^https?:\/\//i.test(url)) return json({ ok: false, error: "invalid_url", message: "Das sieht nicht nach einer erreichbaren Adresse aus." }, 200);
      const extracted = await extractFromHtml(url);
      if (!extracted || extracted.images.length === 0) {
        return json({ ok: false, error: "unreachable", message: "Diese Seite ist noch privat — zeig sie uns per Screenshot." }, 200);
      }
      candidateUrls = extracted.images;
      text = extracted.text;
      sourceRef = url;
    } else if (body.mode === "screenshots") {
      const urls = (body.screenshot_urls ?? []).filter(Boolean).slice(0, MAX_IMAGES);
      if (urls.length === 0) return json({ ok: false, error: "no_screenshots" }, 200);
      candidateUrls = urls;
      sourceRef = `${urls.length} Screenshot(s)`;
    } else {
      const handle = (body.instagram_handle ?? "").trim().replace(/^@/, "");
      if (!handle) return json({ ok: false, error: "handle_required" }, 200);
      const token = Deno.env.get("APIFY_TOKEN");
      if (!token) return json({ ok: false, error: "not_configured", message: "Instagram-Import ist gerade nicht verfügbar — zeig uns dein Profil per Screenshot." }, 200);
      const run = await apifyStartRun(token, "apify~instagram-profile-scraper", { usernames: [handle], resultsLimit: 1 });
      if (!run?.runId) return json({ ok: false, error: "apify_start_failed", message: "Instagram-Import ist gerade nicht verfügbar — zeig uns dein Profil per Screenshot." }, 200);
      const items = await apifyPollDataset(token, run.runId, 40_000);
      const profile = items?.[0] as { biography?: string; latestPosts?: { displayUrl?: string; caption?: string }[]; fullName?: string } | undefined;
      if (!profile) {
        return json({ ok: false, error: "apify_timeout", message: "Das dauert gerade länger — zeig uns dein Profil stattdessen per Screenshot." }, 200);
      }
      candidateUrls = (profile.latestPosts ?? []).map((p) => p.displayUrl).filter((u): u is string => !!u).slice(0, MAX_IMAGES);
      text = [profile.fullName, profile.biography, ...(profile.latestPosts ?? []).map((p) => p.caption)].filter(Boolean).join(" — ");
      sourceRef = `@${handle}`;
    }

    if (candidateUrls.length === 0) {
      return json({ ok: false, error: "no_images", message: "Da ließ sich nichts Brauchbares finden — leg deine Werke lieber von Hand an." }, 200);
    }

    const fetched = (await Promise.all(candidateUrls.slice(0, MAX_IMAGES).map((u) => fetchImageAsBase64(u)))).filter((i): i is FetchedImage => !!i);
    if (fetched.length === 0) {
      return json({ ok: false, error: "images_unreadable", message: "Die Bilder ließen sich nicht lesen — leg deine Werke lieber von Hand an." }, 200);
    }

    const distilled = await distill(apiKey, fetched, text);
    const werke = Array.isArray(distilled?.werke) ? (distilled!.werke as { bildindex?: number; titel?: string; beschreibung?: string; art_vorschlag?: string }[]) : [];
    if (werke.length === 0) {
      return json({ ok: false, error: "distill_failed", message: "Aus dem Material ließ sich kein Werk sicher erkennen — leg deine Werke lieber von Hand an." }, 200);
    }

    const needsRehost = body.mode !== "screenshots";
    const works: { kind: string; title: string; description: string; image_url: string }[] = [];
    for (const w of werke) {
      const idx = typeof w.bildindex === "number" ? w.bildindex : -1;
      const img = fetched[idx];
      if (!img) continue;
      const imageUrl = needsRehost ? await rehost(admin, user_id, img) : img.url;
      if (!imageUrl) continue;
      works.push({
        kind: ["original", "print", "auftragsarbeit", "live_portrait"].includes(w.art_vorschlag ?? "") ? w.art_vorschlag! : "original",
        title: w.titel ?? "",
        description: w.beschreibung ?? "",
        image_url: imageUrl,
      });
    }
    if (works.length === 0) {
      return json({ ok: false, error: "rehost_failed", message: "Die Werke ließen sich nicht übernehmen — leg sie lieber von Hand an." }, 200);
    }

    return json({
      ok: true,
      brand_name: typeof distilled?.marke_vorschlag === "string" ? distilled.marke_vorschlag : null,
      about_text: typeof distilled?.about_text === "string" ? distilled.about_text : null,
      works,
      dna: distilled?.dna ?? null,
      source_type: body.mode,
      source_ref: sourceRef,
    }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
