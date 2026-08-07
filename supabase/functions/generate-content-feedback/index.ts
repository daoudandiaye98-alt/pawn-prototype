/**
 * Content-Begleiter (Teil 16b): PAWN erzeugt keine Beiträge für die Kanäle der Designer —
 * dieser Schritt hilft, eigenes Material (selbst aufgenommenes Foto oder Video) stärker zu
 * machen. Gibt konkretes, kollegiales Feedback (Bildaufbau, Licht, Hintergrund, Verdeckung,
 * Ausschnitt, was gut gelungen ist — nie in Schulnoten, nie belehrend), einen Vorschlag,
 * welche Geschichte das Material trägt, und bei Bedarf einen Hinweis für eine Wiederholung.
 *
 * Body: { designer_id: string, kind: "bild" | "video", source_url?: string (bild),
 *         frames?: string[] (video, 1-3 data-URLs "data:image/jpeg;base64,...", im Browser
 *         per <canvas> aus dem eigenen Video gezogen — Deno kann kein Video dekodieren) }
 * Response: { ok, punkte?: string[], geschichte?: string, wiederholung_tipp?: string|null,
 *             error?, message? }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeLocale, localeInstruction } from "../_shared/locale.ts";

const MODEL = "claude-sonnet-4-5";
const DEFAULT_HOUSE_STYLE_LAW = "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel.";

async function loadHouseStyleLaw(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "house_style_law").maybeSingle();
    const text = (data?.value as { text?: string } | null)?.text;
    return typeof text === "string" && text.trim() ? text.trim() : DEFAULT_HOUSE_STYLE_LAW;
  } catch { return DEFAULT_HOUSE_STYLE_LAW; }
}

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

async function fetchImageAsBase64(url: string): Promise<{ data: string; media_type: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!contentType.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { data: btoa(binary), media_type: contentType };
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl: string): { data: string; media_type: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl.trim());
  if (!m) return null;
  return { media_type: m[1], data: m[2] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as {
      designer_id?: string; kind?: "bild" | "video"; source_url?: string; frames?: string[]; locale?: string;
    };
    const locale = normalizeLocale(body.locale);
    if (!body.designer_id || !body.kind) return json({ ok: false, error: "designer_id_and_kind_required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: des } = await admin.from("designers").select("id, user_id").eq("id", body.designer_id).maybeSingle();
    const d = des as { id: string; user_id: string } | null;
    if (!d) return json({ ok: false, error: "designer_not_found" }, 404);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin && d.user_id !== user_id) return json({ ok: false, error: "forbidden" }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "not_configured", message: "Der Content-Begleiter ist gerade nicht verfügbar." }, 200);
    }

    const images: { data: string; media_type: string }[] = [];
    if (body.kind === "bild" && body.source_url) {
      const img = await fetchImageAsBase64(body.source_url);
      if (img) images.push(img);
    } else if (body.kind === "video" && Array.isArray(body.frames)) {
      for (const f of body.frames.slice(0, 3)) {
        const img = parseDataUrl(f);
        if (img) images.push(img);
      }
    }
    if (images.length === 0) {
      return json({ ok: false, error: "material_unreadable", message: "Das Material konnte nicht gelesen werden." }, 200);
    }

    const styleLaw = await loadHouseStyleLaw(admin);
    const systemPrompt = `Du bist der Content-Begleiter von PAWN, einem kuratierten Marktplatz für unabhängige Designer (Mode, Interior, Kunst). PAWN erzeugt keine Beiträge für die Kanäle der Designer — du hilfst, ihr eigenes, selbst aufgenommenes Material stärker zu machen. Das ist der Unterschied zwischen einer Content-Fabrik und einem Atelier-Begleiter.

Gib konkretes Feedback in wenigen Punkten — Bildaufbau, Licht, Hintergrund, was das Stück verdeckt, welcher Ausschnitt stärker wäre, was gut gelungen ist. Kollegial und konkret, nie belehrend, nie in Schulnoten. Schlage vor, welche Geschichte dieses Material trägt — was hier interessant ist, in einem Satz. Falls eine Wiederholung erkennbar besser würde, gib einen knappen, konkreten Hinweis, sonst lass ihn weg.

Haus-Stilgesetz: ${styleLaw}

${localeInstruction(locale)}

Antworte NUR mit JSON, kein weiterer Text:
{"punkte": ["3-5 kurze, konkrete Feedback-Punkte"], "geschichte": "ein Satz, welche Geschichte dieses Material trägt", "wiederholung_tipp": "ein knapper, konkreter Tipp oder null"}`;

    let parsed: Record<string, unknown> | null = null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 700, system: systemPrompt,
          messages: [{
            role: "user",
            content: [
              ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } })),
              { type: "text", text: body.kind === "video" ? "Das sind Einzelbilder aus meinem eigenen kurzen Video. Gib Feedback dazu." : "Das ist mein eigenes Foto. Gib Feedback dazu." },
            ],
          }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
        parsed = extractJson(text);
      }
    } catch { /* parsed bleibt null */ }

    if (!parsed || !Array.isArray(parsed.punkte)) {
      return json({ ok: false, error: "feedback_failed", message: "Es ließ sich gerade kein Feedback erstellen." }, 200);
    }

    try {
      const { data: costsCentsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
      const cents = ((costsCentsCfg?.value as { content_feedback?: number } | null)?.content_feedback) ?? 3;
      await admin.rpc("book_ai_spend", { _designer_id: d.id, _cents: cents });
    } catch { /* best-effort */ }

    return json({
      ok: true,
      punkte: parsed.punkte.slice(0, 6),
      geschichte: typeof parsed.geschichte === "string" ? parsed.geschichte : null,
      wiederholung_tipp: typeof parsed.wiederholung_tipp === "string" ? parsed.wiederholung_tipp : null,
    }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
