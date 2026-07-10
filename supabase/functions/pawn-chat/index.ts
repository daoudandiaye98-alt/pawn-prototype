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

type PersonaRole = "customer" | "designer" | "admin";

async function loadPersonaForRole(admin: SupabaseClient, role: PersonaRole): Promise<string> {
  const keys: Record<PersonaRole, string> = {
    customer: "persona_customer",
    designer: "persona_designer",
    admin: "persona_admin",
  };
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", keys[role]).maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    if (v?.system_prompt?.trim()) return v.system_prompt.trim();
  } catch { /* ignore */ }
  // Fallback to legacy key for customer role
  if (role === "customer") {
    try {
      const { data } = await admin.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle();
      const v = data?.value as { system_prompt?: string } | undefined;
      if (v?.system_prompt?.trim()) return v.system_prompt.trim();
    } catch { /* ignore */ }
  }
  return DEFAULT_SYSTEM;
}

async function loadDirectives(admin: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "directives").maybeSingle();
    const v = data?.value as { items?: string[] } | undefined;
    return Array.isArray(v?.items) ? v!.items.filter((x) => typeof x === "string" && x.trim().length > 0) : [];
  } catch { return []; }
}

async function resolveRole(admin: SupabaseClient, user_id: string | null): Promise<PersonaRole> {
  if (!user_id) return "customer";
  try {
    const { data } = await admin.from("user_roles").select("role").eq("user_id", user_id);
    const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("designer")) return "designer";
  } catch { /* ignore */ }
  return "customer";
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

async function callOpenAI(system: string, messages: Msg[], contextHint: string, imageUrl?: string, model = "gpt-4o-mini"): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const wire: unknown[] = [
      { role: "system", content: system },
      ...(contextHint ? [{ role: "system", content: contextHint }] : []),
      ...messages,
    ];
    if (imageUrl) {
      wire.push({
        role: "user",
        content: [
          { type: "text", text: "Beschreibe Stil, Farbpalette, Silhouetten und Stimmung dieses Bildes als 4-8 kurze Ontologie-Terme, kommagetrennt. Danach ein warmer, empathischer Satz auf Deutsch." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      });
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.7, messages: wire }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function callGateway(system: string, messages: Msg[], contextHint: string, model = "google/gemini-3-flash-preview"): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
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

async function callAnthropic(system: string, messages: Msg[], contextHint: string): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  try {
    const sys = [system, contextHint].filter(Boolean).join("\n\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: sys,
        messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text ?? null;
  } catch { return null; }
}

async function callProvider(system: string, messages: Msg[], contextHint: string, imageUrl?: string, model?: string, chain?: string[]): Promise<{ text: string | null; provider: string }> {
  const order = chain ?? ["openai", "anthropic", "lovable_gateway", "fallback"];
  for (const p of order) {
    if (p === "openai") { const t = await callOpenAI(system, messages, contextHint, imageUrl, model); if (t) return { text: t, provider: "openai" }; }
    else if (p === "anthropic") { const t = await callAnthropic(system, messages, contextHint); if (t) return { text: t, provider: "anthropic" }; }
    else if (p === "lovable_gateway") { const t = await callGateway(system, messages, contextHint); if (t) return { text: t, provider: "lovable_gateway" }; }
  }
  return { text: null, provider: "fallback" };
}

type Tier = "standard" | "plus" | "max";
const PLAN_TIER: Record<string, Tier> = { haus: "standard", atelier: "plus", maison: "max" };
async function loadModelForTier(admin: SupabaseClient, tier: Tier): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "model_tiers").maybeSingle();
    const v = data?.value as Record<Tier, { model?: string }> | undefined;
    return v?.[tier]?.model ?? (tier === "standard" ? "gpt-4o-mini" : "gpt-4o");
  } catch { return tier === "standard" ? "gpt-4o-mini" : "gpt-4o"; }
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
    const body = (await req.json()) as { messages: Msg[]; session_id?: string; probe?: boolean; image_url?: string; pinterest_board?: string };

    // Provider probe (used by /admin/ki status badge) — no side effects.
    if (body.probe) {
      const providers = {
        openai: !!Deno.env.get("OPENAI_API_KEY"),
        anthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
        lovable_gateway: !!Deno.env.get("LOVABLE_API_KEY"),
      };
      const chain = ["openai","anthropic","lovable_gateway"].filter((p) => providers[p as keyof typeof providers]);
      const provider = chain[0] ?? "fallback";
      return new Response(JSON.stringify({ provider, providers, chain }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // --- Ontology-aware term extraction from user message -----------------
    let ontologyTerms: { term: string; kind: string }[] = [];
    if (admin && lastUser) {
      const { data: ont } = await admin
        .from("fashion_ontology")
        .select("term, kind, synonyms")
        .limit(400);
      const rows = (ont ?? []) as { term: string; kind: string; synonyms: string[] | null }[];
      const t = lastUser.toLowerCase();
      const seen = new Set<string>();
      for (const r of rows) {
        const tokens = [r.term, ...(r.synonyms ?? [])].filter(Boolean).map((s) => s.toLowerCase());
        for (const tok of tokens) {
          if (tok.length >= 3 && t.includes(tok) && !seen.has(r.term)) {
            seen.add(r.term);
            ontologyTerms.push({ term: r.term, kind: r.kind });
            break;
          }
        }
        if (ontologyTerms.length >= 8) break;
      }
    }

    // --- Load user_memory for signed-in users -----------------------------
    interface UserMemory { preferences: Record<string, unknown>; facts: string[] }
    let memory: UserMemory = { preferences: {}, facts: [] };
    if (admin && user_id) {
      const { data: mem } = await admin.from("user_memory").select("preferences, facts").eq("user_id", user_id).maybeSingle();
      if (mem) {
        memory = {
          preferences: (mem.preferences as Record<string, unknown>) ?? {},
          facts: Array.isArray(mem.facts) ? (mem.facts as string[]) : [],
        };
      }
    }

    if (admin && lastUser) {
      await admin.from("ai_sessions").upsert({ session_id, user_id, extracted: extracted as unknown as Record<string, unknown>, turns });
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: {
          raw: lastUser,
          session_id,
          world: extracted.world ?? null,
          mood: extracted.mood ?? null,
          occasion: extracted.occasion ?? null,
          terms: ontologyTerms,
          ...(user_id ? { user_id } : {}),
        },
        schema_version: 1,
      });
    }

    // Load candidates always (needed for nav-fuzzy)
    let action: Action | null = null;
    const cards: Card[] = [];
    let contextHint = "";
    let trendCards: Card[] = [];
    let trendReplyPrefix = "";
    if (admin) {
      const cand = await loadCandidates(admin, extracted.world);
      action = detectNavAction(lastUser, { designers: cand.allDesigners, products: cand.allProducts });

      // Trend intent: "was ist im trend / trends / momentum"
      const trendIntent = /\b(trend|trends|im trend|momentum|angesagt|gerade beliebt)\b/i.test(lastUser);
      if (trendIntent) {
        const worldForTrends = extracted.world ?? "Mode";
        const { data: mo } = await admin.rpc("trend_momentum" as never, { _world: worldForTrends } as never);
        const top3 = (((mo as unknown) as { term: string; momentum: string; latest_score: number }[] | null) ?? [])
          .filter((r) => r.momentum === "steigend")
          .slice(0, 3);
        if (top3.length) {
          // Grab 2 products whose tags overlap with any of these terms
          const wantedTerms = new Set(top3.map((r) => r.term.toLowerCase()));
          const matches = cand.products.filter((p) => (p as unknown as { tags?: string[] }).tags?.some((tag) => wantedTerms.has(tag.toLowerCase()))).slice(0, 2);
          for (const p of matches) {
            trendCards.push({ kind: "product", title: p.name, subtitle: p.world ?? undefined, href: `/product/${p.slug}`, reason: "Gerade im Aufwärtstrend." });
          }
          trendReplyPrefix = `Aktuell im Aufwärtstrend in ${worldForTrends}: ${top3.map((r) => r.term).join(", ")}.`;
        }
      }

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

    // Weave memory into the system prompt
    let memoryHint = "";
    if (memory.facts.length || Object.keys(memory.preferences).length) {
      const factList = memory.facts.slice(-4).join(" · ");
      const prefList = Object.entries(memory.preferences).slice(0, 6).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
      memoryHint = `Was PAWN sich über diese Person merkt${factList ? ` · Notizen: ${factList}` : ""}${prefList ? ` · Präferenzen: ${prefList}` : ""}. Verbinde deine Antwort dezent damit, ohne es explizit vorzulesen.`;
    }
    if (trendReplyPrefix) contextHint = `${trendReplyPrefix} ${contextHint}`.trim();

    const role = admin ? await resolveRole(admin, user_id) : "customer";
    const persona = admin ? await loadPersonaForRole(admin, role) : DEFAULT_SYSTEM;
    const directives = admin ? await loadDirectives(admin) : [];
    const directiveBlock = directives.length ? `Direktiven (immer beachten):\n- ${directives.join("\n- ")}` : "";
    const system = [persona, directiveBlock].filter(Boolean).join("\n\n");
    const fullContextHint = [memoryHint, contextHint].filter(Boolean).join("\n\n");

    // Model tier je nach Rolle/Plan
    let tier: Tier = "standard";
    if (admin && user_id && role === "designer") {
      try {
        const { data: d } = await admin.from("designers").select("plan").eq("user_id", user_id).maybeSingle();
        const p = (d as { plan?: string } | null)?.plan;
        if (p && PLAN_TIER[p]) tier = PLAN_TIER[p];
      } catch { /* soft */ }
    }
    const model = admin ? await loadModelForTier(admin, tier) : "gpt-4o-mini";

    // Pinterest board pickup
    if (admin && user_id && body.pinterest_board) {
      try {
        const nextPrefs = { ...(memory.preferences ?? {}), pinterest_board: body.pinterest_board };
        await admin.from("user_memory").upsert({ user_id, preferences: nextPrefs, facts: memory.facts, updated_at: new Date().toISOString() });
        await admin.from("domain_events").insert({
          id: crypto.randomUUID(), type: "ai.taste_signal", actor: "user",
          payload: { source: "pinterest", session_id, user_id, board: body.pinterest_board },
          schema_version: 1,
        });
      } catch { /* soft */ }
    }

    // Vision-Aufruf bei Bild
    let imageTerms: string[] = [];
    if (body.image_url && Deno.env.get("OPENAI_API_KEY")) {
      const visionRaw = await callOpenAI(
        "Du bist PAWN. Analysiere Modebilder/Moodboards: extrahiere 4-8 kurze Terme zu Silhouette, Material, Farbpalette, Stimmung (kommagetrennt), dann EIN warmer Satz auf Deutsch.",
        [], "", body.image_url, "gpt-4o-mini"
      );
      if (visionRaw) {
        const line = visionRaw.split(/[\n.]/)[0] ?? "";
        imageTerms = line.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3 && s.length <= 40).slice(0, 8);
      }
    }
    if (admin && body.image_url) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: { source: "image", session_id, user_id: user_id ?? null, image_url: body.image_url, terms: imageTerms },
        schema_version: 1,
      });
    }

    // Load provider chain from ai_config (default: openai → anthropic → lovable → fallback)
    let chain: string[] | undefined;
    if (admin) {
      try {
        const { data } = await admin.from("ai_config").select("value").eq("key", "provider_priority").maybeSingle();
        const c = (data?.value as { chain?: string[] } | undefined)?.chain;
        if (Array.isArray(c) && c.length) chain = c;
      } catch { /* soft */ }
    }
    const providerResult = await callProvider(system, messages, fullContextHint, body.image_url, model, chain);
    const rawReply = providerResult.text ?? fallbackReply(extracted, cards, turns, action);
    const reply = trendReplyPrefix && !rawReply.toLowerCase().includes("trend") ? `${trendReplyPrefix} ${rawReply}` : rawReply;

    // --- Upsert user_memory: extract simple facts / preferences -----------
    if (admin && user_id && lastUser) {
      const nextPrefs = { ...memory.preferences };
      if (extracted.world) nextPrefs.welt = extracted.world;
      if (extracted.mood) nextPrefs.stimmung = extracted.mood;
      if (extracted.occasion) nextPrefs.anlass = extracted.occasion;
      for (const t of ontologyTerms.slice(0, 3)) {
        const key = `mag:${t.kind}`;
        nextPrefs[key] = t.term;
      }
      // Simple fact extraction: "ich bin/heiße/arbeite/wohne … " sentences
      const newFacts: string[] = [];
      const factRegex = /(ich (?:bin|heiße|arbeite als|wohne in|mag|liebe|hasse|trage|suche)[^.!?\n]{3,80})/gi;
      let m;
      while ((m = factRegex.exec(lastUser)) !== null && newFacts.length < 2) {
        newFacts.push(m[1].trim().slice(0, 120));
      }
      const mergedFacts = [...memory.facts, ...newFacts].slice(-20);
      await admin.from("user_memory").upsert({
        user_id,
        preferences: nextPrefs,
        facts: mergedFacts,
        updated_at: new Date().toISOString(),
      });
    }

    const provider = Deno.env.get("OPENAI_API_KEY") ? "openai" : (Deno.env.get("LOVABLE_API_KEY") ? "lovable_gateway" : "fallback");
    if (admin) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.response_logged",
        actor: user_id ? "user" : "anon",
        payload: { mode: "chat", provider, session_id, prompt: lastUser.slice(0, 400), reply: reply.slice(0, 800), ...(action ? { action: action.path } : {}) },
        schema_version: 1,
      });
    }
    const allCards = [...cards, ...trendCards].slice(0, 4);
    return new Response(JSON.stringify({ reply, cards: allCards, action, session_id, provider, tier, image_terms: imageTerms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir noch einmal, wonach dir ist.", cards: [], action: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
