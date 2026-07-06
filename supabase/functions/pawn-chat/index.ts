// PAWN chat — persona-driven, session-aware, product-recommending.
// - Reads system prompt from ai_config (fallback default).
// - Persists per-session extracted state in ai_sessions.
// - Writes 'ai.taste_signal' domain event only AFTER the first user turn.
// - Returns { reply, cards? } so the client can render product/designer cards.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type World = "Mode" | "Interior" | "Kunst";
type Mood = "ruhig" | "kante";

interface Extracted {
  world?: World;
  mood?: Mood;
  occasion?: string;
  browsing?: boolean;
}

interface Card {
  kind: "product" | "designer";
  title: string;
  subtitle?: string;
  href: string;
  reason?: string;
}

const DEFAULT_SYSTEM = `Du bist PAWN, eine leise, warme und kuratierende Stimme.
Antworte auf Deutsch, in maximal 2 kurzen Sätzen.
Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?).
Erkläre nie Technik oder wie du funktionierst. Keine Floskeln. Nie aufdringlich.
Wenn der Nutzer nur stöbern will, respektiere das: "Sag Bescheid, wenn ich helfen soll."
Wenn du genug weißt (Welt + Stimmung), empfiehl 2-3 konkrete Stücke oder Designer mit einer kurzen Zeile Begründung.
Nutze dazu ausschließlich Namen aus dem Kontext, den du bekommst.`;

function detectWorld(t: string): World | null {
  const s = t.toLowerCase();
  if (/mode|kleid|jacke|anzieh|outfit|hose|mantel|tragen/.test(s)) return "Mode";
  if (/interior|raum|wohn|möbel|moebel|lampe|leuchte|vase|spiegel|zuhause/.test(s)) return "Interior";
  if (/kunst|bild|wand|malerei|skulptur|tapisserie|edition|werk/.test(s)) return "Kunst";
  return null;
}

function detectMood(t: string): Mood | null {
  const s = t.toLowerCase();
  if (/ruhig|weich|leise|zurückhalt|zurueckhalt|still|entspannt|minimal/.test(s)) return "ruhig";
  if (/spannung|kante|hart|edge|dunkel|scharf|statement|kraftvoll/.test(s)) return "kante";
  return null;
}

function detectBrowsing(t: string): boolean {
  const s = t.toLowerCase();
  return /nur (schauen|stöbern|gucken|bummeln)|schau mich um|inspir|umsehen/.test(s);
}

function extractOccasion(t: string): string | undefined {
  // Very lightweight: grab short trailing phrase after "für"
  const m = t.match(/für ([\wäöüß\s]{3,40})/i);
  return m ? m[1].trim().slice(0, 60) : undefined;
}

async function loadSystemPrompt(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    return v?.system_prompt?.trim() || DEFAULT_SYSTEM;
  } catch { return DEFAULT_SYSTEM; }
}

async function loadCandidates(admin: SupabaseClient, world: World | undefined) {
  const [productsRes, designersRes] = await Promise.all([
    admin.from("products").select("name, slug, description, world, designer_id").eq("status", "published").limit(20),
    admin.from("designers").select("brand_name, slug, story, tags").eq("status", "active").limit(20),
  ]);
  const products = (productsRes.data ?? []).filter((p) => !world || p.world === world);
  const designers = (designersRes.data ?? []).filter((d) => {
    if (!world) return true;
    const tags = (d.tags ?? []) as string[];
    return tags.includes(world);
  });
  return { products, designers };
}

function buildCards(
  candidates: Awaited<ReturnType<typeof loadCandidates>>,
  mood: Mood | undefined,
): Card[] {
  const cards: Card[] = [];
  for (const p of candidates.products.slice(0, 2)) {
    cards.push({
      kind: "product",
      title: p.name,
      subtitle: p.world ?? undefined,
      href: `/product/${p.slug}`,
      reason: mood === "kante" ? "Kompromisslose Linie." : mood === "ruhig" ? "Stille Präzision." : "Aus dem Archiv gewählt.",
    });
  }
  for (const d of candidates.designers.slice(0, 1)) {
    cards.push({
      kind: "designer",
      title: d.brand_name,
      href: `/designer/${d.slug}`,
      reason: "Passt zu deiner Richtung.",
    });
  }
  return cards.slice(0, 3);
}

function fallbackReply(ex: Extracted, cards: Card[], turns: number): string {
  if (turns <= 1) return "Schön, dass du hier bist. Suchst du gerade eher etwas für dich zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?";
  if (ex.browsing) return "Alles klar, schau dich in Ruhe um. Sag Bescheid, wenn ich helfen soll.";
  if (!ex.world) return "Verstanden. Klingt das eher nach Mode, Interior oder Kunst?";
  if (!ex.mood) return `Und in ${ex.world} — eher ruhig und leise, oder darf es Spannung haben?`;
  if (cards.length > 0) {
    const names = cards.map((c) => c.title).join(", ");
    return `Dann würde ich dir ${names} zeigen. Möchtest du eines davon näher sehen?`;
  }
  return `Alles klar, ${ex.world} mit ${ex.mood === "ruhig" ? "ruhiger" : "kantiger"} Handschrift. Erzähl mir kurz: wofür?`;
}

async function callGateway(system: string, messages: Msg[], contextHint: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          ...(contextHint ? [{ role: "system", content: contextHint }] : []),
          ...messages,
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

function extractUserIdFromJWT(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const parts = auth.slice(7).split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" && payload.sub.length > 8 ? payload.sub : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as { messages: Msg[]; session_id?: string };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const session_id = body.session_id ?? crypto.randomUUID();
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const user_id = extractUserIdFromJWT(req.headers.get("Authorization"));

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

    // Load or create session state
    let extracted: Extracted = {};
    let turns = 0;
    if (admin && session_id) {
      const { data } = await admin.from("ai_sessions").select("extracted, turns").eq("session_id", session_id).maybeSingle();
      if (data) {
        extracted = (data.extracted as Extracted) ?? {};
        turns = data.turns ?? 0;
      }
    }

    // Update extracted from the latest user turn
    if (lastUser) {
      const w = detectWorld(lastUser);
      const m = detectMood(lastUser);
      const o = extractOccasion(lastUser);
      const b = detectBrowsing(lastUser);
      if (w) extracted.world = w;
      if (m) extracted.mood = m;
      if (o) extracted.occasion = o;
      if (b) extracted.browsing = true;
    }
    turns += 1;

    // Persist session + taste signal (only when there is actual user content)
    if (admin && lastUser) {
      await admin.from("ai_sessions").upsert({
        session_id,
        user_id,
        extracted: extracted as unknown as Record<string, unknown>,
        turns,
      });
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(),
        type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: {
          raw: lastUser,
          session_id,
          world: extracted.world ?? null,
          mood: extracted.mood ?? null,
          occasion: extracted.occasion ?? null,
          ...(user_id ? { user_id } : {}),
        },
        schema_version: 1,
      });
    }

    // Load candidates + build recommendation cards when we know enough
    const cards: Card[] = [];
    let contextHint = "";
    if (admin && extracted.world && extracted.mood && !extracted.browsing) {
      const cand = await loadCandidates(admin, extracted.world);
      cards.push(...buildCards(cand, extracted.mood));
      if (cand.products.length || cand.designers.length) {
        const names = [
          ...cand.products.slice(0, 4).map((p) => p.name),
          ...cand.designers.slice(0, 2).map((d) => d.brand_name),
        ].join(", ");
        contextHint = `Empfehlungs-Kontext (nutze nur diese Namen, ${extracted.world}, Stimmung ${extracted.mood}): ${names}`;
      }
    }

    // Load persona from DB
    const system = admin ? await loadSystemPrompt(admin) : DEFAULT_SYSTEM;

    const reply =
      (await callGateway(system, messages, contextHint)) ??
      fallbackReply(extracted, cards, turns);

    return new Response(JSON.stringify({ reply, cards, session_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir gern noch einmal, wonach dir ist.", cards: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
