// PAWN Copilot — designer-facing AI assistant.
// Modes: product_text, weekly_mirror, campaign_draft, chat.
// Ownership: caller must be the designer (RLS-safe via service role + auth.uid check).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Mode = "product_text" | "weekly_mirror" | "campaign_draft" | "chat";
type Msg = { role: "user" | "assistant" | "system"; content: string };

const DEFAULT_PROMPT = `Du bist PAWN Copilot — ein leiser, präziser Partner für unabhängige Designer. Antworte auf Deutsch, sachlich, ohne Marketing-Floskeln. Baue jede Antwort auf den konkreten Store-Daten des Designers auf.`;

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

async function callOpenAI(system: string, messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.6, messages: [{ role: "system", content: system }, ...messages] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}
async function callGateway(system: string, messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: system }, ...messages] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}
async function ai(system: string, messages: Msg[]): Promise<string | null> {
  return (await callOpenAI(system, messages)) ?? (await callGateway(system, messages));
}

async function loadPrompt(admin: SupabaseClient): Promise<string> {
  // Prefer new persona_designer key; fall back to legacy copilot_prompt.
  const { data: p } = await admin.from("ai_config").select("value").eq("key", "persona_designer").maybeSingle();
  const pv = p?.value as { system_prompt?: string } | undefined;
  if (pv?.system_prompt?.trim()) return pv.system_prompt.trim();
  const { data } = await admin.from("ai_config").select("value").eq("key", "copilot_prompt").maybeSingle();
  const v = data?.value as { system_prompt?: string } | undefined;
  return v?.system_prompt?.trim() || DEFAULT_PROMPT;
}

async function loadDirectives(admin: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "directives").maybeSingle();
    const v = data?.value as { items?: string[] } | undefined;
    return Array.isArray(v?.items) ? v!.items.filter((x) => typeof x === "string" && x.trim()) : [];
  } catch { return []; }
}

async function nextMoveHint(admin: SupabaseClient, designer_id: string): Promise<string> {
  try {
    const [ords, camps, msgs] = await Promise.all([
      admin.from("orders").select("id, created_at").eq("status", "paid").in("fulfillment_status", ["new", "in_progress"]).order("created_at", { ascending: true }).limit(1),
      admin.from("campaigns").select("id, title").eq("designer_id", designer_id).eq("status", "proposed").limit(1),
      admin.from("message_threads").select("id, subject").eq("designer_id", designer_id).eq("status", "open").limit(1),
    ]);
    const bits: string[] = [];
    if ((ords.data ?? [])[0]) bits.push("eine bezahlte Bestellung wartet auf Versand");
    if ((camps.data ?? [])[0]) bits.push(`Kampagne „${(camps.data as {title:string}[])[0].title}" wartet auf Freigabe`);
    if ((msgs.data ?? [])[0]) bits.push("eine Kundenanfrage ist offen");
    return bits.length ? `Nächste offene Züge des Designers: ${bits.join("; ")}.` : "";
  } catch { return ""; }
}


async function logResponse(admin: SupabaseClient, actor: string, mode: Mode, designer_id: string | null, prompt: string, reply: string, provider: string) {
  await admin.from("domain_events").insert({
    id: crypto.randomUUID(),
    type: "ai.response_logged",
    actor,
    payload: {
      mode, designer_id, provider,
      prompt: prompt.slice(0, 400),
      reply: reply.slice(0, 800),
    },
    schema_version: 1,
  });
}

interface Designer { id: string; brand_name: string; slug: string; story: string | null; tags: string[] | null; user_id: string }

async function loadDesignerForUser(admin: SupabaseClient, user_id: string): Promise<Designer | null> {
  const { data } = await admin.from("designers").select("id, brand_name, slug, story, tags, user_id").eq("user_id", user_id).maybeSingle();
  return (data as Designer | null) ?? null;
}

function providerName(): string {
  if (Deno.env.get("OPENAI_API_KEY")) return "openai";
  if (Deno.env.get("LOVABLE_API_KEY")) return "lovable_gateway";
  return "fallback";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const designer = await loadDesignerForUser(admin, user_id);
    if (!designer) return new Response(JSON.stringify({ error: "no designer profile" }), { status: 403, headers: corsHeaders });

    const body = await req.json() as { mode: Mode; product_id?: string; question?: string; messages?: Msg[] };
    const mode = body.mode;
    const personaText = await loadPrompt(admin);
    const directives = await loadDirectives(admin);
    const nextHint = await nextMoveHint(admin, designer.id);
    const directiveBlock = directives.length ? `\n\nDirektiven (immer beachten):\n- ${directives.join("\n- ")}` : "";
    const nextBlock = nextHint ? `\n\nKontext-Signal · ${nextHint}` : "";
    const system = `${personaText}${directiveBlock}${nextBlock}`;
    const provider = providerName();

    if (mode === "product_text") {
      if (!body.product_id) return new Response(JSON.stringify({ error: "product_id required" }), { status: 400, headers: corsHeaders });
      const { data: p } = await admin.from("products").select("id, name, world, tags, description, price").eq("id", body.product_id).eq("designer_id", designer.id).maybeSingle();
      if (!p) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
      const tags = (p.tags as string[] | null)?.join(", ") ?? "";
      const promptUser = `Schreibe eine kurze editoriale Produktbeschreibung im PAWN-Ton (max. 3 Sätze, deutsch, keine Floskeln, keine Ausrufezeichen).
Marke: ${designer.brand_name}
Story: ${designer.story ?? "—"}
Produkt: ${p.name}
Welt: ${p.world}
Tags: ${tags}
Bestehender Text: ${p.description ?? "—"}`;
      const generated = await ai(system, [{ role: "user", content: promptUser }])
        ?? `${p.name} — ein ${p.world}-Stück aus dem Atelier ${designer.brand_name}. ${designer.story ?? ""}`.trim();
      await logResponse(admin, user_id, mode, designer.id, promptUser, generated, provider);
      return new Response(JSON.stringify({ text: generated, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "weekly_mirror") {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [prods, orders, viewsRes, wishRes] = await Promise.all([
        admin.from("products").select("id, name, slug").eq("designer_id", designer.id),
        admin.from("orders").select("id, total_amount, created_at, items").gte("created_at", since),
        admin.from("domain_events").select("payload").gte("at", since).eq("type", "product.viewed"),
        admin.from("domain_events").select("payload").gte("at", since).eq("type", "wishlist.added"),
      ]);
      const products = (prods.data ?? []) as { id: string; name: string; slug: string }[];
      const productIds = new Set(products.map((p) => p.id));
      const productSlugs = new Set(products.map((p) => p.slug));

      const views = new Map<string, number>();
      for (const e of viewsRes.data ?? []) {
        const slug = (e.payload as { slug?: string })?.slug;
        if (slug && productSlugs.has(slug)) views.set(slug, (views.get(slug) ?? 0) + 1);
      }
      const wishAdds = new Map<string, number>();
      for (const e of wishRes.data ?? []) {
        const slug = (e.payload as { product_slug?: string; slug?: string })?.product_slug ?? (e.payload as { slug?: string })?.slug;
        if (slug && productSlugs.has(slug)) wishAdds.set(slug, (wishAdds.get(slug) ?? 0) + 1);
      }
      const relatedOrders = (orders.data ?? []).filter((o) => {
        const items = (o.items as unknown[] | null) ?? [];
        return items.some((it) => productIds.has((it as { product_id?: string })?.product_id ?? ""));
      });
      const revenue = relatedOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
      const topViewed = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([slug, n]) => ({ slug, name: products.find((p) => p.slug === slug)?.name ?? slug, views: n, wish: wishAdds.get(slug) ?? 0 }));

      const stats = {
        views_total: [...views.values()].reduce((a, b) => a + b, 0),
        wish_total: [...wishAdds.values()].reduce((a, b) => a + b, 0),
        orders_count: relatedOrders.length,
        revenue_eur: revenue,
        top: topViewed,
      };

      let suggestion: string | null = null;
      for (const t of topViewed) {
        if (t.views >= 8 && t.wish === 0) { suggestion = `„${t.name}" wird oft gesehen, aber nicht gemerkt — vielleicht fehlt eine zweite Perspektive im Bild.`; break; }
        if (t.wish >= 4 && stats.orders_count === 0) { suggestion = `„${t.name}" wird gemerkt, aber selten gekauft — prüfe den Preis oder die Lieferzeit.`; break; }
      }
      if (!suggestion && stats.views_total === 0) suggestion = "Diese Woche noch ohne Signal. Ein neues Stück oder eine Kampagne hilft, den Raum zu füllen.";
      if (!suggestion) suggestion = "Der Store läuft ruhig. Eine Kampagne zu einem starken Stück könnte den Blick lenken.";

      const summary = `Diese Woche: ${stats.views_total} Ansichten, ${stats.wish_total} Merkzettel-Zugänge, ${stats.orders_count} Verkäufe (€${stats.revenue_eur.toFixed(0)}). ${suggestion}`;
      const generated = (await ai(system, [{ role: "user", content: `Fasse diese Wochendaten in 2 präzisen Sätzen zusammen und gib einen konkreten Vorschlag: ${JSON.stringify(stats)}. Vorschlag-Kern: ${suggestion}` }])) ?? summary;

      await logResponse(admin, user_id, mode, designer.id, JSON.stringify(stats), generated, provider);
      return new Response(JSON.stringify({ text: generated, stats, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "campaign_draft") {
      if (!body.product_id) return new Response(JSON.stringify({ error: "product_id required" }), { status: 400, headers: corsHeaders });
      // Consent check
      const { data: consent } = await admin.from("designer_consents").select("scope, granted").eq("designer_id", designer.id).eq("scope", "image_usage").maybeSingle();
      if (!consent?.granted) {
        return new Response(JSON.stringify({ error: "consent_missing", message: "Für Kampagnen wird die Bildnutzungs-Einwilligung benötigt." }), { status: 400, headers: corsHeaders });
      }
      const { data: p } = await admin.from("products").select("id, name, world, tags, description").eq("id", body.product_id).eq("designer_id", designer.id).maybeSingle();
      if (!p) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
      const promptUser = `Entwirf eine kurze Kampagnen-Caption (max. 2 Sätze, deutsch, PAWN-Ton) plus 4-6 passende Hashtags (englisch, ohne Marketing-Klischees) für dieses Stück:
Marke: ${designer.brand_name} · Story: ${designer.story ?? "—"}
Produkt: ${p.name} · Welt: ${p.world} · Tags: ${(p.tags as string[] | null)?.join(", ") ?? "—"}
Format: {"caption":"…","hashtags":["#..","#.."]}`;
      const raw = await ai(system, [{ role: "user", content: promptUser }]);
      let caption = `${p.name} — aus dem Atelier ${designer.brand_name}.`;
      let hashtags = ["#pawn", `#${designer.slug.replace(/-/g, "")}`, `#${(p.world ?? "").toLowerCase()}`, "#independentdesign"];
      if (raw) {
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]) as { caption?: string; hashtags?: string[] };
            if (parsed.caption) caption = parsed.caption;
            if (Array.isArray(parsed.hashtags)) hashtags = parsed.hashtags;
          }
        } catch { /* keep fallback */ }
      }
      const { data: campaign, error: cErr } = await admin.from("campaigns").insert({
        designer_id: designer.id,
        product_id: p.id,
        title: `${p.name} · Kampagnen-Entwurf`,
        kind: "text",
        status: "proposed",
        content: { caption, hashtags, source: "copilot" },
        created_by: user_id,
      }).select("id").single();
      if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500, headers: corsHeaders });
      await logResponse(admin, user_id, mode, designer.id, promptUser, caption, provider);
      return new Response(JSON.stringify({ campaign_id: campaign.id, caption, hashtags, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "chat") {
      const messages = (body.messages ?? []).slice(-12);
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? body.question ?? "";
      // Load lightweight store stats + trend momentum for designer's worlds
      const [pRes, oRes] = await Promise.all([
        admin.from("products").select("id, name, status, world").eq("designer_id", designer.id),
        admin.from("orders").select("id, created_at").gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
      ]);
      const products = pRes.data ?? [];
      const published = products.filter((p) => p.status === "published").length;
      const worlds = Array.from(new Set(products.map((p) => (p as { world?: string }).world).filter(Boolean))) as string[];
      const trendBits: string[] = [];
      for (const w of worlds.slice(0, 2)) {
        const { data } = await admin.rpc("trend_momentum" as never, { _world: w } as never);
        const top = (((data as unknown) as { term: string; momentum: string }[] | null) ?? [])
          .filter((r) => r.momentum === "steigend")
          .slice(0, 3)
          .map((r) => r.term);
        if (top.length) trendBits.push(`${w}: ${top.join(", ")}`);
      }
      const trendHint = trendBits.length ? `Aktuelle Aufwärtstrends → ${trendBits.join(" | ")}.` : "";
      const contextHint = `Store-Kontext ${designer.brand_name}: ${products.length} Produkte (${published} veröffentlicht), ${(oRes.data ?? []).length} Bestellungen in 30 Tagen. Story: ${designer.story ?? "—"}. ${trendHint}`;
      const reply = (await ai(system + "\n\n" + contextHint, messages))
        ?? `Aktuell: ${products.length} Produkte, ${published} veröffentlicht.${trendHint ? " " + trendHint : ""} Erzähl mir, wo du gerade stehst — dann kann ich helfen.`;
      await logResponse(admin, user_id, mode, designer.id, lastUser, reply, provider);
      return new Response(JSON.stringify({ reply, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown mode" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
