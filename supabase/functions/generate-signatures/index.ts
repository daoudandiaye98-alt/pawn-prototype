/**
 * Der Regisseur — destilliert je Haus 3–5 Signaturen (Licht/Palette/Kamerafahrt/
 * Schnittrhythmus/Typo/Musik-Tempo) aus brand_dna + Ontologie. On-demand beim ersten
 * Öffnen der Kampagnen-Seite, oder als Admin-Massenlauf über alle Häuser.
 *
 * Body: { mode: 'single' | 'bulk' | 'wish', designer_id?: string, wish_name?: string, wish_prompt?: string }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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
function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

interface Recipe {
  licht?: string; palette?: string; kamerafahrt?: string;
  schnittrhythmus?: string; typo?: string; musik_tempo?: string;
}
interface Signature { name: string; recipe: Recipe }

const SYSTEM_PROMPT = `Du bist "der Regisseur" bei PAWN, einem kuratierten Marktplatz für unabhängige Designer. Du entwirfst kurze visuelle "Signaturen" (Stil-Rezepte) für die Kampagnen-Videos eines Hauses.

WICHTIGE EINSCHRÄNKUNG: PAWN-Videos sind strikt monochrom (nur Schwarz/Weiß/Grautöne) — "palette" darf NIEMALS echte Farben nennen, nur Kontrast/Licht-Charakter (z.B. "hoher Kontrast, hartes Licht" oder "weich, viel Weißraum").

Antworte NUR mit einem JSON-Array von Signatur-Objekten, kein weiterer Text:
[{"name": "Kurzer Name (2-4 Wörter, Deutsch)", "recipe": {"licht": "...", "palette": "...", "kamerafahrt": "...", "schnittrhythmus": "...", "typo": "...", "musik_tempo": "ruhig|medium|treibend"}}]`;

async function claudeSignatures(apiKey: string, userPrompt: string, maxTokens = 900): Promise<{ signatures: Signature[]; tokens: number }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) return { signatures: [], tokens: 0 };
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    const parsed = extractJson(text);
    const signatures = Array.isArray(parsed)
      ? (parsed as Signature[]).filter((s) => s?.name && s?.recipe)
      : [];
    return { signatures, tokens };
  } catch {
    return { signatures: [], tokens: 0 };
  }
}

async function generateForDesigner(
  admin: SupabaseClient, apiKey: string,
  designer: { id: string; brand_name: string; brand_dna: Record<string, unknown> | null; video_taste_weights: Record<string, unknown> | null },
  count: number, wish?: { name: string; prompt: string },
): Promise<{ created: number; tokens: number }> {
  const worlds = Object.keys((designer.brand_dna as { worlds?: Record<string, number> } | null)?.worlds ?? {});
  const signals = ((designer.brand_dna as { signals?: string[] } | null)?.signals ?? []).slice(0, 8);

  let ontologyTerms: string[] = [];
  if (worlds.length > 0) {
    const { data: terms } = await admin.from("fashion_ontology")
      .select("term").overlaps("world", worlds).limit(20);
    ontologyTerms = ((terms ?? []) as { term: string }[]).map((t) => t.term);
  }

  const tasteWeights = designer.video_taste_weights && Object.keys(designer.video_taste_weights).length > 0
    ? `\nGelernte Vorlieben aus bisheriger Performance (stärker gewichten): ${JSON.stringify(designer.video_taste_weights)}`
    : "";

  const basePrompt = `Haus: ${designer.brand_name}\nWelten: ${worlds.join(", ") || "unbekannt"}\nStil-Signale: ${signals.join(", ") || "unbekannt"}\nVerwandte Begriffe: ${ontologyTerms.join(", ") || "keine"}${tasteWeights}`;

  if (wish) {
    const { signatures, tokens } = await claudeSignatures(apiKey,
      `${basePrompt}\n\nEntwirf GENAU EINE Wunsch-Signatur mit dem Namen "${wish.name}" nach dieser Beschreibung: "${wish.prompt}". Antworte als JSON-Array mit einem Element.`);
    if (signatures.length === 0) return { created: 0, tokens };
    await admin.from("house_signatures").insert(
      signatures.slice(0, 1).map((s) => ({ designer_id: designer.id, name: s.name, recipe: { ...s.recipe, wunsch: true } })),
    );
    return { created: 1, tokens };
  }

  const { signatures, tokens } = await claudeSignatures(apiKey,
    `${basePrompt}\n\nDestilliere ${count} unterschiedliche, zueinander passende Signaturen für dieses Haus.`);
  if (signatures.length === 0) return { created: 0, tokens };
  await admin.from("house_signatures").insert(
    signatures.slice(0, count).map((s) => ({ designer_id: designer.id, name: s.name, recipe: s.recipe })),
  );
  return { created: signatures.length, tokens };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured", message: "Der Regisseur ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });

    const body = await req.json().catch(() => ({})) as {
      mode?: "single" | "bulk" | "wish"; designer_id?: string; wish_name?: string; wish_prompt?: string;
    };
    const mode = body.mode === "bulk" ? "bulk" : body.mode === "wish" ? "wish" : "single";

    const { data: planLimitsRow } = await admin.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle();
    const planLimits = (planLimitsRow?.value as Record<string, { signature_previews?: number }> | null) ?? {};

    if (mode === "bulk") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const { data: designers } = await admin.from("designers")
        .select("id, brand_name, brand_dna, video_taste_weights, plan")
        .eq("published", true).limit(30);
      let totalCreated = 0, totalTokens = 0, processed = 0;
      for (const d of (designers ?? []) as Array<{ id: string; brand_name: string; brand_dna: Record<string, unknown> | null; video_taste_weights: Record<string, unknown> | null; plan: string }>) {
        const { count: existing } = await admin.from("house_signatures").select("id", { count: "exact", head: true }).eq("designer_id", d.id);
        if ((existing ?? 0) > 0) continue;
        const limit = planLimits[d.plan]?.signature_previews ?? 1;
        const targetCount = limit < 0 ? 5 : Math.max(1, Math.min(5, limit));
        const { created, tokens } = await generateForDesigner(admin, apiKey, d, targetCount);
        totalCreated += created; totalTokens += tokens; processed++;
      }
      return json({ ok: true, processed, created: totalCreated, tokens: totalTokens });
    }

    // single / wish: Designer für sich selbst, oder Admin für einen bestimmten designer_id.
    let designerRow: { id: string; brand_name: string; brand_dna: Record<string, unknown> | null; video_taste_weights: Record<string, unknown> | null; plan: string } | null = null;
    if (isAdmin && body.designer_id) {
      const { data } = await admin.from("designers").select("id, brand_name, brand_dna, video_taste_weights, plan").eq("id", body.designer_id).maybeSingle();
      designerRow = data as typeof designerRow;
    } else {
      const { data } = await admin.from("designers").select("id, brand_name, brand_dna, video_taste_weights, plan").eq("user_id", user_id).maybeSingle();
      designerRow = data as typeof designerRow;
    }
    if (!designerRow) return json({ error: "not_found", message: "Kein Designer-Profil gefunden." }, 200);

    const limit = planLimits[designerRow.plan]?.signature_previews ?? 1;

    if (mode === "wish") {
      if (limit >= 0) return json({ error: "not_available", message: "Wunsch-Signaturen sind ein Maison-Vorteil." }, 200);
      const name = String(body.wish_name ?? "").trim();
      const prompt = String(body.wish_prompt ?? "").trim();
      if (!name || !prompt) return json({ error: "wish_name_and_prompt_required" }, 400);
      const { created, tokens } = await generateForDesigner(admin, apiKey, designerRow, 1, { name, prompt });
      return json({ ok: true, created, tokens });
    }

    const { count: existing } = await admin.from("house_signatures").select("id", { count: "exact", head: true }).eq("designer_id", designerRow.id);
    if ((existing ?? 0) > 0) {
      const { data: sigs } = await admin.from("house_signatures").select("id, name, recipe, preview_url").eq("designer_id", designerRow.id);
      return json({ ok: true, created: 0, signatures: sigs ?? [], message: "Signaturen existieren bereits." });
    }
    const targetCount = limit < 0 ? 5 : Math.max(1, Math.min(5, limit));
    const { created, tokens } = await generateForDesigner(admin, apiKey, designerRow, targetCount);
    const { data: sigs } = await admin.from("house_signatures").select("id, name, recipe, preview_url").eq("designer_id", designerRow.id);
    return json({ ok: true, created, tokens, signatures: sigs ?? [] });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
