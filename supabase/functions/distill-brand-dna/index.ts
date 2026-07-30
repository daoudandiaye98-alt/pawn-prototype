/**
 * Erstbefüllung der Haus-DNA (Teil 14c): destilliert aus vorhandenem Material — Produkte
 * (Name, Beschreibung, Tags, product_dna), Story/Manifest, Bewerbungstext — eine erste
 * designers.brand_dna ({worlds: Record<World,number>, signals: string[]}), im selben
 * Format, das generate-signatures und die Kuratierung (src/features/personalization)
 * bereits lesen. Read-safe: ohne jedes Material wird nichts erfunden, sondern ehrlich
 * gemeldet, dass es an Grundlage fehlt.
 *
 * Body: { designer_id?: string } — Admin darf ein Haus angeben, sonst gilt der aufrufende Designer.
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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

const SYSTEM_PROMPT = `Du destillierst für PAWN, einen kuratierten Marktplatz für unabhängige Designer (Mode, Interior, Kunst), aus dem Material eines Hauses eine erste Marken-DNA.

Antworte NUR mit JSON, kein weiterer Text:
{"worlds": {"Mode": 0.0-1.0, "Interior": 0.0-1.0, "Kunst": 0.0-1.0}, "signals": ["kurzer Stil-Begriff", "..."]}

"worlds" ist eine Gewichtung, wie stark das Haus in jeder Welt steht (nur Welten mit echtem Beleg im Material nennen, Rest weglassen). "signals" sind 5 bis 12 kurze, konkrete Stil-Begriffe (Deutsch, ein bis zwei Wörter), die aus dem Material selbst hervorgehen — keine generischen Marketing-Wörter wie "hochwertig" oder "einzigartig".`;

async function claudeDistill(apiKey: string, material: string): Promise<{ worlds: Record<string, number>; signals: string[] } | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: SYSTEM_PROMPT, messages: [{ role: "user", content: material }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    const parsed = extractJson(text) as { worlds?: Record<string, number>; signals?: string[] } | null;
    if (!parsed || typeof parsed !== "object") return null;
    return { worlds: parsed.worlds ?? {}, signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 12) : [] };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured", message: "Die DNA-Destillation ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
    const body = await req.json().catch(() => ({})) as { designer_id?: string; correction?: string };
    const correction = typeof body.correction === "string" ? body.correction.trim().slice(0, 800) : "";

    let designerRow: { id: string; brand_name: string; story: string | null; manifesto: string | null; quote: string | null; brand_dna: Record<string, unknown> | null; application_id: string | null } | null = null;
    if (isAdmin && body.designer_id) {
      const { data } = await admin.from("designers").select("id, brand_name, story, manifesto, quote, brand_dna, application_id").eq("id", body.designer_id).maybeSingle();
      designerRow = data as typeof designerRow;
    } else {
      const { data } = await admin.from("designers").select("id, brand_name, story, manifesto, quote, brand_dna, application_id").eq("user_id", user_id).maybeSingle();
      designerRow = data as typeof designerRow;
    }
    if (!designerRow) return json({ error: "not_found", message: "Kein Studio-Zugang gefunden." }, 200);

    const { data: products } = await admin.from("products")
      .select("name, world, description, tags, product_dna")
      .eq("designer_id", designerRow.id).limit(20);
    const productRows = (products ?? []) as Array<{ name: string; world: string; description: string | null; tags: string[] | null; product_dna: Record<string, unknown> | null }>;

    let applicationStory: string | null = null;
    let applicationTags: string[] = [];
    if (designerRow.application_id) {
      const { data: app } = await admin.from("designer_applications").select("story, tags").eq("id", designerRow.application_id).maybeSingle();
      applicationStory = (app as { story?: string } | null)?.story ?? null;
      applicationTags = (app as { tags?: string[] } | null)?.tags ?? [];
    }

    const materialParts: string[] = [];
    if (designerRow.story) materialParts.push(`Story: ${designerRow.story}`);
    if (designerRow.manifesto) materialParts.push(`Manifest: ${designerRow.manifesto}`);
    if (designerRow.quote) materialParts.push(`Zitat: ${designerRow.quote}`);
    if (applicationStory) materialParts.push(`Bewerbungstext: ${applicationStory}`);
    if (applicationTags.length) materialParts.push(`Bewerbungs-Tags: ${applicationTags.join(", ")}`);
    for (const p of productRows) {
      const dnaBits = p.product_dna
        ? Object.values(p.product_dna as Record<string, string[]>).flat().filter(Boolean).join(", ")
        : "";
      materialParts.push(`Produkt (${p.world}): ${p.name}${p.description ? ` — ${p.description}` : ""}${p.tags?.length ? ` [${p.tags.join(", ")}]` : ""}${dnaBits ? ` {${dnaBits}}` : ""}`);
    }

    if (correction) {
      materialParts.unshift(`Korrektur des Designers (hat Vorrang vor allem anderen Material, muss die DNA sichtbar verändern): ${correction}`);
    }

    if (materialParts.length === 0) {
      return json({
        ok: false, error: "no_material",
        message: `Noch kein Material für ${designerRow.brand_name} — Story, Manifest oder erste Produkte anlegen, dann lässt sich eine DNA destillieren.`,
      }, 200);
    }

    const material = `Haus: ${designerRow.brand_name}\n\n${materialParts.join("\n")}`;
    const distilled = await claudeDistill(apiKey, material);
    if (!distilled || (Object.keys(distilled.worlds).length === 0 && distilled.signals.length === 0)) {
      return json({ ok: false, error: "distill_failed", message: "Aus dem vorhandenen Material ließ sich keine DNA destillieren." }, 200);
    }

    const prevDna = (designerRow.brand_dna ?? {}) as Record<string, unknown>;
    const prevWorlds = (prevDna.worlds ?? {}) as Record<string, number>;
    const prevSignals = (prevDna.signals ?? []) as string[];
    const hadPrevious = Object.keys(prevWorlds).length > 0 || prevSignals.length > 0;
    const prevHistory = Array.isArray(prevDna.history) ? (prevDna.history as unknown[]) : [];
    // Jede Neu-Destillation legt den vorherigen Stand ins Verlaufsprotokoll — so bleibt sichtbar,
    // wie sich die DNA über Zeit verändert hat (Teil 19a, "Die Entwicklung").
    const history = hadPrevious
      ? [{ at: new Date().toISOString(), worlds: prevWorlds, signals: prevSignals, reason: correction ? "Korrektur" : "Neu destilliert" }, ...prevHistory].slice(0, 10)
      : prevHistory;
    const nextDna = { ...prevDna, worlds: distilled.worlds, signals: distilled.signals, distilled_at: new Date().toISOString(), history };
    const { error: updErr } = await admin.from("designers").update({ brand_dna: nextDna } as never).eq("id", designerRow.id);
    if (updErr) return json({ error: "save_failed", message: updErr.message }, 500);

    return json({ ok: true, brand_dna: nextDna, material_count: materialParts.length });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
