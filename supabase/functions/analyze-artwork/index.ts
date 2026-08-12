/**
 * PART 51 Teil B (Zug 1 "Zeigen"): schickt ein hochgeladenes Werkfoto an Claude Vision und bekommt
 * einen Titel-, Beschreibungs- und Preisspannen-Vorschlag zurück — reiner Vorschlag, nie Pflicht
 * (Regel 4 aus dem Auftrag: "Nichts kann falsch sein"). Anders als detect-object (Teil 16a) läuft
 * dieser Aufruf VOR der Existenz eines Hauses — kein designer_id, keine AI-Budget-Buchung, nur ein
 * gültiger eingeloggter Nutzer. Bei jedem Fehler: ok:false mit Klartext, HTTP 200 — das First-Move-
 * Formular fällt dann auf leere, von Hand ausfüllbare Felder zurück, nichts blockiert.
 *
 * Body: { source_url: string }
 * Response: { ok, title?, description?, price_cents_min?, price_cents_max?, error?, message? }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "claude-sonnet-4-5";

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

const SYSTEM_PROMPT = `Du hilfst einer unabhängigen Künstlerin bei PAWN, einem kuratierten Haus für Mode, Interior und Kunst, ihr Werk in wenigen Minuten zu veröffentlichen. Du siehst ein Foto eines einzelnen Kunstwerks. Du dienst dem echten Werk — du erfindest keine Technik, kein Material und keine Herkunft, die du nicht sehen kannst.

Antworte NUR mit JSON, kein weiterer Text:
{"titel": "kurzer, konkreter Werktitel auf Deutsch, ohne Anführungszeichen, max. 6 Wörter", "beschreibung": "2-3 knappe, konkrete Sätze auf Deutsch — was zu sehen ist, welche Wirkung es hat, keine erfundenen Fakten zu Technik/Material/Entstehung, die sich nicht aus dem Bild ablesen lassen", "preis_min_eur": Zahl, "preis_max_eur": Zahl}

Die Preisspanne ist eine grobe Orientierung für ein noch unbekanntes, unabhängiges Haus — realistisch für ein Einzelwerk im unteren bis mittleren vierstelligen Bereich oder darunter, abhängig von Größe/Komplexität soweit erkennbar, niemals eine Garantie.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as { source_url?: string };
    if (!body.source_url) return json({ ok: false, error: "source_url_required" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "not_configured", message: "Der Vorschlag ist gerade nicht verfügbar — trag Titel, Text und Preis von Hand ein." }, 200);
    }

    const img = await fetchImageAsBase64(body.source_url);
    if (!img) {
      return json({ ok: false, error: "image_unreadable", message: "Das Foto konnte nicht gelesen werden — trag Titel, Text und Preis von Hand ein." }, 200);
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: MODEL, max_tokens: 500, system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } },
              { type: "text", text: "Schlag Titel, Beschreibung und Preisspanne für dieses Werk vor." },
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

    if (!parsed || typeof parsed.titel !== "string") {
      return json({ ok: false, error: "detect_failed", message: "Titel und Beschreibung ließen sich nicht sicher vorschlagen — trag sie von Hand ein." }, 200);
    }

    const min = Number(parsed.preis_min_eur);
    const max = Number(parsed.preis_max_eur);

    return json({
      ok: true,
      title: parsed.titel,
      description: typeof parsed.beschreibung === "string" ? parsed.beschreibung : null,
      price_cents_min: Number.isFinite(min) && min > 0 ? Math.round(min * 100) : null,
      price_cents_max: Number.isFinite(max) && max > 0 ? Math.round(max * 100) : null,
    }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
