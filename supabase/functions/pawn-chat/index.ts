// PAWN chat — persona-driven, session-aware, product-recommending, navigation-capable.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type World = "Mode" | "Interior" | "Kunst";
type Mood = "ruhig" | "kante";

interface Extracted { world?: World; mood?: Mood; occasion?: string; browsing?: boolean }
interface Card { kind: "product" | "designer"; title: string; subtitle?: string; href: string; reason?: string }
interface Action { type: "navigate"; path: string; label: string }

const DEFAULT_SYSTEM = `Du bist PAWN, eine leise, warme und kuratierende Stimme.
Antworte auf Deutsch, in maximal 2 kurzen Sätzen.
Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?).
Erkläre nie Technik. Wenn der Nutzer nur stöbern will, respektiere das.
Wenn du empfehlen kannst, nenne 2-3 konkrete Namen aus dem Kontext, den du bekommst.`;

function detectWorld(t: string): World | null {
  const s = t.toLowerCase();
  if (/mode|kleid|jacke|mantel|hose|anzieh|outfit|tragen/.test(s)) return "Mode";
  if (/interior|raum|wohn|möbel|moebel|lampe|leuchte|vase|spiegel|zuhause/.test(s)) return "Interior";
  if (/kunst|bild|wand|malerei|skulptur|tapisserie|edition|werk/.test(s)) return "Kunst";
  return null;
}
function detectMood(t: string): Mood | null {
  const s = t.toLowerCase();
  if (/ruhig|weich|leise|zurückhalt|still|minimal/.test(s)) return "ruhig";
  if (/spannung|kante|hart|edge|dunkel|scharf|statement|kraftvoll|skulptural/.test(s)) return "kante";
  return null;
}
function detectBrowsing(t: string): boolean {
  return /nur (schauen|stöbern|gucken|bummeln)|schau mich um|inspir|umsehen/.test(t.toLowerCase());
}
function extractOccasion(t: string): string | undefined {
  const m = t.match(/für ([\wäöüß\s]{3,40})/i);
  return m ? m[1].trim().slice(0, 60) : undefined;
}
function detectNavIntent(t: string): boolean {
  return /(zeig(e)? mir|bring mich|öffne|oeffne|zur kollektion|zur seite|geh zu|navigier|führ mich|fuehr mich|show me|open|go to)/i.test(t);
}
function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9äöüß ]/g, "").trim(); }
function fuzzyIncludes(hay: string, needle: string) {
  const h = normalize(hay), n = normalize(needle);
  return n.length >= 3 && (h.includes(n) || n.includes(h));
}

interface DBDesigner { brand_name: string; slug: string; story?: string | null; tags?: string[] | null }
interface DBProduct { name: string; slug: string; description?: string | null; world?: string | null; designer_id?: string | null }

async function loadSystemPrompt(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    return v?.system_prompt?.trim() || DEFAULT_SYSTEM;
  } catch { return DEFAULT_SYSTEM; }
}
async function loadCandidates(admin: SupabaseClient, world: World | undefined) {
  const [prod, des] = await Promise.all([
    admin.from("products").select("name, slug, description, world, designer_id").eq("status", "published").limit(40),
    admin.from("designers").select("brand_name, slug, story, tags").eq("status", "active").limit(40),
  ]);
  const products = (prod.data ?? []) as DBProduct[];
  const designers = (des.data ?? []) as DBDesigner[];
  const fp = products.filter((p) => !world || p.world === world);
  const fd = designers.filter((d) => {
    if (!world) return true;
    return (d.tags ?? []).includes(world);
  });
  return { products: fp, designers: fd, allProducts: products, allDesigners: designers };
}
function buildCards(cand: { products: DBProduct[]; designers: DBDesigner[] }, mood: Mood | undefined): Card[] {
  const cards: Card[] = [];
  for (const p of cand.products.slice(0, 2)) {
    cards.push({
      kind: "product", title: p.name, subtitle: p.world ?? undefined,
      href: `/product/${p.slug}`,
      reason: mood === "kante" ? "Kompromisslose Linie." : mood === "ruhig" ? "Stille Präzision." : "Aus dem Archiv gewählt.",
    });
  }
  for (const d of cand.designers.slice(0, 1)) {
    cards.push({ kind: "designer", title: d.brand_name, href: `/designer/${d.slug}`, reason: "Passt zu deiner Richtung." });
  }
  return cards.slice(0, 3);
}
function detectNavAction(text: string, all: { designers: DBDesigner[]; products: DBProduct[] }): Action | null {
  const t = text.toLowerCase();
  // Explicit intents
  if (/\b(dna|geschmack|profil)\b/.test(t)) return { type: "navigate", path: "/dna", label: "Zu deiner DNA" };
  if (/\b(warenkorb|bag|cart|tasche)\b/.test(t)) return { type: "navigate", path: "/cart", label: "Zum Warenkorb" };
  if (/\b(neu|neuheit|newest|latest)\b/.test(t)) return { type: "navigate", path: "/neu", label: "Was neu ist" };
  if (detectNavIntent(text)) {
    if (/\bmode\b|kleidung/.test(t)) return { type: "navigate", path: "/mode", label: "Zur Welt Mode" };
    if (/\binterior\b|raum|wohn/.test(t)) return { type: "navigate", path: "/interior", label: "Zur Welt Interior" };
    if (/\bkunst\b|wand/.test(t)) return { type: "navigate", path: "/kunst", label: "Zur Welt Kunst" };
    if (/designer(:innen)?( übersicht| overview)?/.test(t)) return { type: "navigate", path: "/designers", label: "Zur Designer-Übersicht" };
  }
  // Fuzzy designer match
  for (const d of all.designers) {
    if (d.brand_name && fuzzyIncludes(t, d.brand_name)) {
      return { type: "navigate", path: `/designer/${d.slug}`, label: `Zur Kollektion von ${d.brand_name}` };
    }
  }
  // Fuzzy product match (needs nav intent to avoid false positives)
  if (detectNavIntent(text)) {
    for (const p of all.products) {
      if (p.name && fuzzyIncludes(t, p.name)) {
        return { type: "navigate", path: `/product/${p.slug}`, label: `Zu „${p.name}"` };
      }
    }
  }
  return null;
}

function fallbackReply(ex: Extracted, cards: Card[], turns: number, action: Action | null): string {
  if (action) return `Gerne — ich bringe dich hin.`;
  if (turns <= 1) return "Schön, dass du hier bist. Suchst du eher etwas zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?";
  if (ex.browsing) return "Alles klar, schau dich in Ruhe um. Sag Bescheid, wenn ich helfen soll.";
  if (!ex.world) return "Verstanden. Klingt das eher nach Mode, Interior oder Kunst?";
  if (!ex.mood) return `Und in ${ex.world} — eher ruhig, oder darf es Spannung haben?`;
  if (cards.length) return `Dann würde ich dir ${cards.map((c) => c.title).join(", ")} zeigen. Möchtest du eines näher sehen?`;
  return `Alles klar, ${ex.world} mit ${ex.mood === "ruhig" ? "ruhiger" : "kantiger"} Handschrift. Wofür?`;
}

async function callOpenAI(system: string, messages: Msg[], contextHint: string): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
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

async function callProvider(system: string, messages: Msg[], contextHint: string): Promise<string | null> {
  // Prefer OpenAI when configured, silently fall back to the Lovable gateway.
  const openai = await callOpenAI(system, messages, contextHint);
  if (openai) return openai;
  return await callGateway(system, messages, contextHint);
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
    const body = (await req.json()) as { messages: Msg[]; session_id?: string; probe?: boolean };

    // Provider probe (used by /admin/ki status badge) — no side effects.
    if (body.probe) {
      const provider = Deno.env.get("OPENAI_API_KEY") ? "openai" : (Deno.env.get("LOVABLE_API_KEY") ? "lovable_gateway" : "fallback");
      return new Response(JSON.stringify({ provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const session_id = body.session_id ?? crypto.randomUUID();
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const user_id = extractUserIdFromJWT(req.headers.get("Authorization"));


    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

    let extracted: Extracted = {};
    let turns = 0;
    if (admin && session_id) {
      const { data } = await admin.from("ai_sessions").select("extracted, turns").eq("session_id", session_id).maybeSingle();
      if (data) { extracted = (data.extracted as Extracted) ?? {}; turns = data.turns ?? 0; }
    }
    if (lastUser) {
      const w = detectWorld(lastUser); const m = detectMood(lastUser);
      const o = extractOccasion(lastUser); const b = detectBrowsing(lastUser);
      if (w) extracted.world = w; if (m) extracted.mood = m;
      if (o) extracted.occasion = o; if (b) extracted.browsing = true;
    }
    turns += 1;

    if (admin && lastUser) {
      await admin.from("ai_sessions").upsert({ session_id, user_id, extracted: extracted as unknown as Record<string, unknown>, turns });
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: { raw: lastUser, session_id, world: extracted.world ?? null, mood: extracted.mood ?? null, occasion: extracted.occasion ?? null, ...(user_id ? { user_id } : {}) },
        schema_version: 1,
      });
    }

    // Load candidates always (needed for nav-fuzzy)
    let action: Action | null = null;
    const cards: Card[] = [];
    let contextHint = "";
    if (admin) {
      const cand = await loadCandidates(admin, extracted.world);
      action = detectNavAction(lastUser, { designers: cand.allDesigners, products: cand.allProducts });
      // Designer-Kontext: Studio-Fragen an den Copilot verweisen
      if (!action && user_id && /\b(mein store|studio|copilot|kollektion|meine produkte|umsatz|verkäufe|kampagne)\b/i.test(lastUser)) {
        const { data: d } = await admin.from("designers").select("id").eq("user_id", user_id).maybeSingle();
        if (d) action = { type: "navigate", path: "/studio/copilot", label: "Zum Copilot im Studio" };
      }
      if (!action && extracted.world && extracted.mood && !extracted.browsing) {
        cards.push(...buildCards(cand, extracted.mood));
        if (cand.products.length || cand.designers.length) {
          const names = [...cand.products.slice(0, 4).map((p) => p.name), ...cand.designers.slice(0, 2).map((d) => d.brand_name)].join(", ");
          contextHint = `Empfehlungs-Kontext (nutze nur diese Namen, ${extracted.world}, Stimmung ${extracted.mood}): ${names}`;
        }
      }
    }
    if (action) contextHint = `Der Nutzer hat gerade nach Navigation gefragt: ${action.label}. Antworte in EINEM kurzen warmen Satz, bestätige dass du ihn hinbringst. Keine Fragen.`;

    const system = admin ? await loadSystemPrompt(admin) : DEFAULT_SYSTEM;
    const reply = (await callProvider(system, messages, contextHint)) ?? fallbackReply(extracted, cards, turns, action);

    const provider = Deno.env.get("OPENAI_API_KEY") ? "openai" : (Deno.env.get("LOVABLE_API_KEY") ? "lovable_gateway" : "fallback");
    return new Response(JSON.stringify({ reply, cards, action, session_id, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir noch einmal, wonach dir ist.", cards: [], action: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
