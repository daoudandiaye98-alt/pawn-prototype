/**
 * Objekterkennung (Teil 16a): schickt ein hochgeladenes Foto an Claude Vision und bekommt eine
 * strukturierte Antwort zurück (Art, Material, Farben, Merkmale, Größenhinweis, Foto-Bewertung).
 * Steuert im Studio, welche Inszenierungs-Varianten (ai_config.staging_templates) angeboten
 * werden, und ob dem Designer ein Hinweis zum Ausgangsfoto gezeigt wird.
 *
 * Erkennt Claude mehrere Objekte oder nichts Eindeutiges, wird "mehrdeutig" gemeldet statt
 * geraten — das Studio fragt dann nach statt eine Art zu erzwingen. Ohne ANTHROPIC_API_KEY oder
 * bei jedem Fehler: ok:false mit ehrlicher Meldung, HTTP 200 — das Studio fällt dann freundlich
 * auf eine manuelle Art-Auswahl zurück, der Rest des Ablaufs bleibt nutzbar.
 *
 * Body: { designer_id: string, source_url: string }
 * Response: { ok, ambiguous?, art?, material?, farben?, merkmale?, groessenhinweis?,
 *             foto?: { schaerfe, licht, hintergrund_stoert, verdeckt }, foto_hinweis?, error?, message? }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";
const ARTEN = ["kleidung", "keramik", "malerei", "skulptur", "moebel", "schmuck", "textil", "objekt", "sonstiges"];

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

const SYSTEM_PROMPT = `Du bewertest für PAWN, einen kuratierten Marktplatz für unabhängige Designer (Mode, Interior, Kunst), ein einzelnes hochgeladenes Produktfoto. Du dienst dem echten Objekt — du erfindest nichts, du beschreibst nur, was auf dem Foto zu sehen ist.

Antworte NUR mit JSON, kein weiterer Text:
{"art": "kleidung|keramik|malerei|skulptur|moebel|schmuck|textil|objekt|sonstiges", "mehrdeutig": true/false, "material": "kurzer Begriff oder null", "farben": ["1-3 dominante Farben"], "merkmale": ["auffällige Merkmale wie Griff, Muster, Fassung, Rahmen — 0-4 Stück"], "groessenhinweis": "kurzer Satz falls die Größe aus dem Bild ableitbar ist, sonst null", "foto": {"schaerfe": "gut|mittel|schlecht", "licht": "gut|mittel|schlecht", "hintergrund_stoert": true/false, "verdeckt": true/false}, "foto_hinweis": "ein kurzer, freundlicher Satz mit einem konkreten Tipp fürs nächste Foto, NUR falls Schärfe/Licht/Hintergrund/Verdeckung wirklich ein besseres Ergebnis verhindern würden — sonst null"}

"mehrdeutig": true, wenn mehrere klar unterschiedliche Objekte im Bild sind, oder wenn keine der Arten wirklich passt — dann sind die übrigen Felder trotzdem so gut wie möglich auszufüllen, aber "art" darf in diesem Fall dennoch die wahrscheinlichste Art enthalten.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as { designer_id?: string; source_url?: string };
    if (!body.designer_id || !body.source_url) return json({ ok: false, error: "designer_id_and_source_url_required" }, 400);

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
      return json({ ok: false, error: "not_configured", message: "Die Objekterkennung ist gerade nicht verfügbar — bitte die Art von Hand wählen." }, 200);
    }

    const img = await fetchImageAsBase64(body.source_url);
    if (!img) {
      return json({ ok: false, error: "image_unreadable", message: "Das Foto konnte nicht gelesen werden — bitte die Art von Hand wählen." }, 200);
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
              { type: "text", text: "Bewerte dieses Produktfoto." },
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

    if (!parsed || typeof parsed.art !== "string" || !ARTEN.includes(parsed.art)) {
      return json({ ok: false, error: "detect_failed", message: "Die Art ließ sich nicht sicher erkennen — bitte von Hand wählen." }, 200);
    }

    try {
      const { data: costsCentsCfg } = await admin.from("ai_config").select("value").eq("key", "ai_action_costs_cents").maybeSingle();
      const cents = ((costsCentsCfg?.value as { staging_detect?: number } | null)?.staging_detect) ?? 3;
      await admin.rpc("book_ai_spend", { _designer_id: d.id, _cents: cents });
    } catch { /* best-effort, blockiert nie die Antwort */ }

    return json({
      ok: true,
      ambiguous: parsed.mehrdeutig === true,
      art: parsed.art,
      material: typeof parsed.material === "string" ? parsed.material : null,
      farben: Array.isArray(parsed.farben) ? parsed.farben.slice(0, 3) : [],
      merkmale: Array.isArray(parsed.merkmale) ? parsed.merkmale.slice(0, 4) : [],
      groessenhinweis: typeof parsed.groessenhinweis === "string" ? parsed.groessenhinweis : null,
      foto: parsed.foto ?? null,
      foto_hinweis: typeof parsed.foto_hinweis === "string" ? parsed.foto_hinweis : null,
    }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
