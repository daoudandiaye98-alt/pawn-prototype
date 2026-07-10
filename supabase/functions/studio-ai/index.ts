// PAWN Copilot — designer-facing AI assistant.
// Modes: product_text, weekly_mirror, campaign_draft, chat.
// FEHLERTOLERANT: bei internem Fehler immer 200 + fallback-Inhalt, nie non-2xx.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type Mode = "product_text" | "product_note" | "weekly_mirror" | "campaign_draft" | "chat";
type Msg = { role: "user" | "assistant" | "system"; content: string };

const DEFAULT_PROMPT = `Du bist PAWN Copilot — ein leiser, präziser Partner für unabhängige Designer. Antworte auf Deutsch, sachlich, ohne Marketing-Floskeln.`;

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

type Tier = "standard" | "plus" | "max";
const PLAN_TO_TIER: Record<string, Tier> = { haus: "standard", atelier: "plus", maison: "max" };

async function loadModelForTier(admin: SupabaseClient, tier: Tier): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "model_tiers").maybeSingle();
    const v = data?.value as Record<Tier, { model?: string }> | undefined;
    return v?.[tier]?.model ?? (tier === "standard" ? "gpt-4o-mini" : "gpt-4o");
  } catch { return tier === "standard" ? "gpt-4o-mini" : "gpt-4o"; }
}

async function callOpenAI(model: string, system: string, messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.6, messages: [{ role: "system", content: system }, ...messages] }),
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
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: system }, ...messages] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}
async function callAnthropic(system: string, messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.content?.[0]?.text ?? null;
  } catch { return null; }
}
async function ai(model: string, system: string, messages: Msg[], chain?: string[]): Promise<{ text: string | null; provider: string }> {
  const order = chain ?? ["openai", "anthropic", "lovable_gateway"];
  for (const p of order) {
    if (p === "openai") { const t = await callOpenAI(model, system, messages); if (t) return { text: t, provider: "openai" }; }
    else if (p === "anthropic") { const t = await callAnthropic(system, messages); if (t) return { text: t, provider: "anthropic" }; }
    else if (p === "lovable_gateway") { const t = await callGateway(system, messages); if (t) return { text: t, provider: "lovable_gateway" }; }
  }
  return { text: null, provider: "fallback" };
}

async function loadPrompt(admin: SupabaseClient): Promise<string> {
  try {
    const { data: p } = await admin.from("ai_config").select("value").eq("key", "persona_designer").maybeSingle();
    const pv = p?.value as { system_prompt?: string } | undefined;
    if (pv?.system_prompt?.trim()) return pv.system_prompt.trim();
    const { data } = await admin.from("ai_config").select("value").eq("key", "copilot_prompt").maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    return v?.system_prompt?.trim() || DEFAULT_PROMPT;
  } catch { return DEFAULT_PROMPT; }
}

async function logResponse(admin: SupabaseClient, actor: string, mode: Mode, designer_id: string | null, prompt: string, reply: string, provider: string) {
  try {
    await admin.from("domain_events").insert({
      id: crypto.randomUUID(),
      type: "ai.response_logged",
      actor,
      payload: { mode, designer_id, provider, prompt: prompt.slice(0, 400), reply: reply.slice(0, 800) },
      schema_version: 1,
    });
  } catch { /* swallow */ }
}

interface Designer { id: string; brand_name: string; slug: string; story: string | null; tags: string[] | null; user_id: string; plan?: string }

function providerName(): string {
  if (Deno.env.get("OPENAI_API_KEY")) return "openai";
  if (Deno.env.get("LOVABLE_API_KEY")) return "lovable_gateway";
  return "fallback";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Parse body up front so fallbacks can reference mode
  let body: { mode?: Mode; product_id?: string; question?: string; messages?: Msg[] } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const mode: Mode = (body.mode ?? "chat") as Mode;

  const fallbackFor = (): Record<string, unknown> => {
    if (mode === "weekly_mirror") {
      return { text: "Ich schaue mir gerade deine Woche an — noch keine belastbaren Signale. Ein neues Stück oder eine Kampagne hilft, den Raum zu füllen.",
        stats: { views_total: 0, wish_total: 0, orders_count: 0, revenue_eur: 0, top: [] },
        provider: "fallback", fallback: true };
    }
    if (mode === "campaign_draft") {
      return { caption: "Ein Stück, das sich langsam liest.", hashtags: ["#pawn", "#independentdesign", "#slowfashion", "#craft"], provider: "fallback", fallback: true };
    }
    if (mode === "product_text" || mode === "product_note") {
      return { text: "Ein Stück, das seine Geschichte selbst erzählt.", provider: "fallback", fallback: true };
    }
    return { reply: "Ich bin gerade kurz still — versuch's in einem Moment noch einmal.", provider: "fallback", fallback: true };
  };

  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return ok({ ...fallbackFor(), error: "auth" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const { data: dRow } = await admin.from("designers").select("id, brand_name, slug, story, tags, user_id, plan").eq("user_id", user_id).maybeSingle();
    const designer = (dRow as Designer | null) ?? null;
    if (!designer) return ok({ ...fallbackFor(), error: "no_designer" });

    const personaText = await loadPrompt(admin);
    const tier: Tier = PLAN_TO_TIER[designer.plan ?? "haus"] ?? "standard";
    const model = await loadModelForTier(admin, tier);
    const system = personaText;
    void providerName; // provider is now derived from ai() return value

    if (mode === "product_text" || mode === "product_note") {
      if (!body.product_id) return ok({ ...fallbackFor(), error: "missing_product_id" });
      const { data: p } = await admin.from("products").select("id, name, world, tags, description, price, designer_note, product_dna").eq("id", body.product_id).eq("designer_id", designer.id).maybeSingle();
      if (!p) return ok({ ...fallbackFor(), error: "not_found" });
      const tags = (p.tags as string[] | null)?.join(", ") ?? "";
      const isNote = mode === "product_note";
      const promptUser = isNote
        ? `Schreibe "Der Gedanke dahinter" — persönlich, erste Person, warum dieses Stück existiert. Auf Deutsch, max. 3 Sätze, ruhig, warm, ohne Marketing.
Marke: ${designer.brand_name}
Story der Marke: ${designer.story ?? "—"}
Produkt: ${p.name} (${p.world})
Tags: ${tags}
Beschreibung (Kontext): ${p.description ?? "—"}`
        : `Schreibe eine kurze editoriale Produktbeschreibung im PAWN-Ton (max. 3 Sätze, deutsch, keine Floskeln).
Marke: ${designer.brand_name}
Story: ${designer.story ?? "—"}
Produkt: ${p.name}
Welt: ${p.world}
Tags: ${tags}`;
      const aiRes = await ai(model, system, [{ role: "user", content: promptUser }]);
      const generated = aiRes.text ?? (isNote
        ? `Dieses Stück ist entstanden, weil ich ${p.name.toLowerCase()} anders denken wollte — leiser, ehrlicher.`
        : `${p.name} — ein ${p.world}-Stück aus dem Atelier ${designer.brand_name}. ${designer.story ?? ""}`.trim());
      await logResponse(admin, user_id, mode, designer.id, promptUser, generated, aiRes.provider);
      return ok({ text: generated, provider: aiRes.provider });
    }

    if (mode === "weekly_mirror") {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [prods, orders, viewsRes, wishRes] = await Promise.all([
        admin.from("products").select("id, name, slug").eq("designer_id", designer.id),
        admin.from("orders").select("id, amount_total, created_at, items").gte("created_at", since),
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
      const revenue = Math.round(relatedOrders.reduce((s, o) => s + Number((o as { amount_total?: number }).amount_total ?? 0), 0) / 100);
      const topViewed = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([slug, n]) => ({ slug, name: products.find((p) => p.slug === slug)?.name ?? slug, views: n, wish: wishAdds.get(slug) ?? 0 }));

      const stats = {
        views_total: [...views.values()].reduce((a, b) => a + b, 0),
        wish_total: [...wishAdds.values()].reduce((a, b) => a + b, 0),
        orders_count: relatedOrders.length,
        revenue_eur: revenue,
        top: topViewed,
      };

      let suggestion = "Der Store läuft ruhig. Eine Kampagne zu einem starken Stück könnte den Blick lenken.";
      if (stats.views_total === 0) suggestion = "Diese Woche noch ohne Signal. Ein neues Stück oder eine Kampagne hilft, den Raum zu füllen.";
      for (const t of topViewed) {
        if (t.views >= 8 && t.wish === 0) { suggestion = `„${t.name}" wird oft gesehen, aber nicht gemerkt — vielleicht fehlt eine zweite Perspektive im Bild.`; break; }
        if (t.wish >= 4 && stats.orders_count === 0) { suggestion = `„${t.name}" wird gemerkt, aber selten gekauft — prüfe den Preis oder die Lieferzeit.`; break; }
      }

      // Trend-Block für atelier/maison
      let trendBlock: { world: string; rising: string[] } | null = null;
      if (tier !== "standard") {
        try {
          const worldKey = ((designer.tags ?? []).find((t) => ["Mode","Interior","Kunst"].includes(t))) ?? "Mode";
          const { data: mo } = await admin.rpc("trend_momentum" as never, { _world: worldKey } as never);
          const rising = (((mo as unknown) as { term: string; momentum: string }[] | null) ?? [])
            .filter((r) => r.momentum === "steigend").slice(0, 3).map((r) => r.term);
          if (rising.length) trendBlock = { world: worldKey, rising };
        } catch { /* soft */ }
      }
      const trendLine = trendBlock ? ` Trend im Blick (${trendBlock.world}): ${trendBlock.rising.join(", ")}.` : "";

      const summary = `Diese Woche: ${stats.views_total} Ansichten, ${stats.wish_total} Merkzettel-Zugänge, ${stats.orders_count} Verkäufe (€${stats.revenue_eur}). ${suggestion}${trendLine}`;
      const aiRes = await ai(model, system, [{ role: "user", content: `Fasse diese Wochendaten in 2 präzisen Sätzen zusammen und gib einen konkreten Vorschlag: ${JSON.stringify(stats)}. Vorschlag-Kern: ${suggestion}.${trendLine}` }]);
      const generated = aiRes.text ?? summary;

      await logResponse(admin, user_id, mode, designer.id, JSON.stringify(stats), generated, aiRes.provider);
      return ok({ text: generated, stats, tier, trend: trendBlock, provider: aiRes.provider });
    }

    if (mode === "campaign_draft") {
      if (!body.product_id) {
        // Ohne Produkt: generischer Fallback ohne DB-Insert
        return ok({ caption: `Ein neues Kapitel aus dem Atelier ${designer.brand_name}.`,
          hashtags: ["#pawn", `#${designer.slug.replace(/-/g, "")}`, "#independentdesign", "#craft"],
          provider: "fallback" });
      }
      let consentOk = true;
      try {
        const { data: consent } = await admin.from("designer_consents").select("granted").eq("designer_id", designer.id).eq("scope", "image_usage").maybeSingle();
        consentOk = !!consent?.granted;
      } catch { /* soft */ }
      if (!consentOk) {
        return ok({ error: "consent_missing", message: "Für Kampagnen wird die Bildnutzungs-Einwilligung benötigt." });
      }
      const { data: p } = await admin.from("products").select("id, name, world, tags, description").eq("id", body.product_id).eq("designer_id", designer.id).maybeSingle();
      if (!p) return ok({ ...fallbackFor(), error: "not_found" });

      const promptUser = `Entwirf eine kurze Kampagnen-Caption (max. 2 Sätze, deutsch, PAWN-Ton) plus 4-6 passende Hashtags für dieses Stück:
Marke: ${designer.brand_name} · Story: ${designer.story ?? "—"}
Produkt: ${p.name} · Welt: ${p.world} · Tags: ${(p.tags as string[] | null)?.join(", ") ?? "—"}
Format: {"caption":"…","hashtags":["#..","#.."]}`;
      const aiRes = await ai(model, system, [{ role: "user", content: promptUser }]);
      const raw = aiRes.text;
      let caption = `${p.name} — aus dem Atelier ${designer.brand_name}.`;
      let hashtags = ["#pawn", `#${designer.slug.replace(/-/g, "")}`, `#${(p.world ?? "").toLowerCase()}`, "#independentdesign"];
      if (raw) {
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]) as { caption?: string; hashtags?: string[] };
            if (parsed.caption) caption = parsed.caption;
            if (Array.isArray(parsed.hashtags) && parsed.hashtags.length) hashtags = parsed.hashtags;
          }
        } catch { /* keep fallback */ }
      }

      // Insert campaign draft — best-effort, never fail the response
      let campaign_id: string | null = null;
      try {
        const { data: campaign, error: cErr } = await admin.from("campaigns").insert({
          designer_id: designer.id,
          product_id: p.id,
          title: `${p.name} · Kampagnen-Entwurf`,
          kind: "text",
          status: "proposed",
          content: { caption, hashtags, source: "copilot" },
          created_by: user_id,
        }).select("id").single();
        if (!cErr && campaign) campaign_id = (campaign as { id: string }).id;
      } catch { /* swallow */ }

      await logResponse(admin, user_id, mode, designer.id, promptUser, caption, aiRes.provider);
      return ok({ campaign_id, caption, hashtags, provider: aiRes.provider });
    }

    if (mode === "chat") {
      const messages = (body.messages ?? []).slice(-12);
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? body.question ?? "";
      let contextHint = "";
      try {
        const { data: pRes } = await admin.from("products").select("id, name, status, world").eq("designer_id", designer.id);
        const products = pRes ?? [];
        const published = products.filter((p) => (p as { status?: string }).status === "published").length;
        contextHint = `Store-Kontext ${designer.brand_name}: ${products.length} Produkte (${published} veröffentlicht). Story: ${designer.story ?? "—"}.`;
      } catch { /* soft */ }
      const aiRes = await ai(model, system + "\n\n" + contextHint, messages.length ? messages : [{ role: "user", content: lastUser }]);
      const reply = aiRes.text ?? `Ich bin da. Erzähl mir kurz, wo du gerade stehst — dann helfe ich beim nächsten Schritt.`;
      await logResponse(admin, user_id, mode, designer.id, lastUser, reply, aiRes.provider);
      return ok({ reply, provider: aiRes.provider });
    }

    return ok({ ...fallbackFor(), error: "unknown_mode" });
  } catch (e) {
    console.error("studio-ai:", (e as Error)?.message ?? e);
    return ok({ ...fallbackFor(), error: "internal", message: String((e as Error)?.message ?? e) });
  }
});
