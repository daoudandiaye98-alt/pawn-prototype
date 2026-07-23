/**
 * Admin-only: übersetzt einen einzelnen site_content-Text ins Englische, als
 * Vorschlag — die Admin-Seite "Texte & Bilder" zeigt ihn im EN-Eingabefeld an,
 * gespeichert wird er erst, wenn der Admin ihn (durch Blur/Speichern) bestätigt.
 * Nie automatisch veröffentlicht.
 *
 * Body: { key: string, text: string }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";
const DEFAULT_HOUSE_STYLE_LAW = "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel.";

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

async function loadHouseStyleLaw(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await admin.from("ai_config").select("value").eq("key", "house_style_law").maybeSingle();
  const text = (data?.value as { text?: string } | null)?.text;
  return text || DEFAULT_HOUSE_STYLE_LAW;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured", message: "Übersetzungsvorschläge sind noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({})) as { key?: string; text?: string };
    const text = (body.text ?? "").trim();
    if (!text) return json({ error: "empty_text", message: "Kein deutscher Text zum Übersetzen." }, 200);

    const styleLaw = await loadHouseStyleLaw(admin);
    const systemPrompt = `Du übersetzt kurze deutsche Oberflächentexte für PAWN (pawn.vision), einen kuratierten Marktplatz für unabhängige Designer, ins Englische — natürlich, nicht wörtlich, gleicher Ton.

Haus-Stilgesetz: ${styleLaw}

Antworte NUR mit der englischen Übersetzung, kein weiterer Text, keine Anführungszeichen drumherum.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) return json({ error: "upstream_error", message: "Übersetzung gerade nicht verfügbar — später erneut versuchen." }, 200);

    const data = await res.json();
    const suggestion = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("\n")
      .trim()
      .replace(/^["„]|["“]$/g, "");

    if (!suggestion) return json({ error: "empty_response", message: "Keine Übersetzung erhalten." }, 200);
    return json({ suggestion, key: body.key ?? null });
  } catch (e) {
    return json({ error: "unexpected", message: e instanceof Error ? e.message : "Unbekannter Fehler." }, 200);
  }
});
