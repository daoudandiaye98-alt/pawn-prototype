// Compute trend snapshots for today.
// Aggregates the last 24h from domain_events (product views, wishlist adds,
// taste_signals) and orders (purchases) into per-term/world scores,
// normalized against the fashion_ontology (synonym-aware).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type World = "Mode" | "Interior" | "Kunst";
type Kind = "category" | "silhouette" | "material" | "color" | "attribute" | "style";
interface OntologyRow { term: string; kind: Kind; world: string[]; synonyms: string[] }

interface Bucket { views: number; likes: number; saves: number; purchases: number }
type Key = string; // `${term}||${world}`
const k = (t: string, w: string) => `${t}||${w}`;

function loadIndex(rows: OntologyRow[]) {
  const byToken = new Map<string, { term: string; worlds: string[] }[]>();
  for (const r of rows) {
    const tokens = new Set<string>([r.term.toLowerCase(), ...r.synonyms.map((s) => s.toLowerCase())]);
    for (const tk of tokens) {
      const arr = byToken.get(tk) ?? [];
      arr.push({ term: r.term, worlds: r.world });
      byToken.set(tk, arr);
    }
  }
  return byToken;
}

function matchTerms(text: string, index: Map<string, { term: string; worlds: string[] }[]>): { term: string; worlds: string[] }[] {
  if (!text) return [];
  const t = text.toLowerCase();
  const out: { term: string; worlds: string[] }[] = [];
  const seen = new Set<string>();
  for (const [token, terms] of index.entries()) {
    if (token.length < 3) continue;
    if (t.includes(token)) {
      for (const term of terms) {
        if (!seen.has(term.term)) { seen.add(term.term); out.push(term); }
      }
    }
  }
  return out;
}

function bump(map: Map<Key, Bucket>, term: string, world: string, field: keyof Bucket, by = 1) {
  const key = k(term, world);
  const b = map.get(key) ?? { views: 0, likes: 0, saves: 0, purchases: 0 };
  b[field] += by;
  map.set(key, b);
}

async function run(admin: SupabaseClient) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [ontRes, evtRes, ordRes, prodRes] = await Promise.all([
    admin.from("fashion_ontology").select("term, kind, world, synonyms"),
    admin.from("domain_events").select("type, payload").gte("at", since).in("type", ["product.viewed", "wishlist.added", "ai.taste_signal"]),
    admin.from("orders").select("items, created_at").gte("created_at", since),
    admin.from("products").select("slug, world, tags, name, description"),
  ]);
  const ontology = (ontRes.data ?? []) as OntologyRow[];
  const index = loadIndex(ontology);
  const products = (prodRes.data ?? []) as { slug: string; world: string; tags: string[] | null; name: string; description: string | null }[];
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  const buckets = new Map<Key, Bucket>();

  // Product views
  for (const e of evtRes.data ?? []) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (e.type === "product.viewed" || e.type === "wishlist.added") {
      const slug = (p.slug ?? p.product_slug) as string | undefined;
      const prod = slug ? productBySlug.get(slug) : undefined;
      if (!prod) continue;
      const world = prod.world;
      const hay = `${prod.name} ${prod.description ?? ""} ${(prod.tags ?? []).join(" ")}`;
      const terms = matchTerms(hay, index);
      // include declared tags directly
      for (const tag of prod.tags ?? []) {
        if (!terms.find((t) => t.term === tag)) terms.push({ term: tag, worlds: [world] });
      }
      const field: keyof Bucket = e.type === "wishlist.added" ? "saves" : "views";
      for (const t of terms) bump(buckets, t.term, world, field);
    }
    if (e.type === "ai.taste_signal") {
      const raw = (p.raw ?? p.message) as string | undefined;
      const world = (p.world as string | undefined) ?? "Mode";
      if (!raw) continue;
      const terms = matchTerms(String(raw), index);
      for (const t of terms) bump(buckets, t.term, world, "likes");
    }
  }

  // Purchases from orders.items
  for (const o of ordRes.data ?? []) {
    const items = (o.items as unknown[] | null) ?? [];
    for (const it of items) {
      const slug = (it as { product_slug?: string; slug?: string })?.product_slug ?? (it as { slug?: string })?.slug;
      const qty = Number((it as { quantity?: number })?.quantity ?? 1);
      const prod = slug ? productBySlug.get(slug) : undefined;
      if (!prod) continue;
      const world = prod.world;
      const hay = `${prod.name} ${(prod.tags ?? []).join(" ")}`;
      const terms = matchTerms(hay, index);
      for (const tag of prod.tags ?? []) {
        if (!terms.find((t) => t.term === tag)) terms.push({ term: tag, worlds: [world] });
      }
      for (const t of terms) bump(buckets, t.term, world, "purchases", qty);
    }
  }

  // Upsert today
  const today = new Date().toISOString().slice(0, 10);
  const rows = [...buckets.entries()].map(([key, b]) => {
    const [term, world] = key.split("||");
    const score = b.views + b.likes * 3 + b.saves * 4 + b.purchases * 10;
    return { day: today, term, world, views: b.views, likes: b.likes, saves: b.saves, purchases: b.purchases, score };
  });

  let upserted = 0;
  if (rows.length) {
    const { error, count } = await admin.from("trend_snapshots")
      .upsert(rows, { onConflict: "day,term,world", count: "exact" });
    if (error) throw error;
    upserted = count ?? rows.length;
  }

  return { day: today, buckets: buckets.size, upserted, sample: rows.slice(0, 8) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const result = await run(admin);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
