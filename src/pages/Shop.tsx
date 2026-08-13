import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { supabase } from "@/integrations/supabase/client";
import { Heart } from "lucide-react";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { useCustomerEvents } from "@/features/events/useCustomerEvents";
import { useI18n } from "@/lib/i18n";

type World = "Mode" | "Interior" | "Kunst";

interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  world: World;
  image_url: string | null;
  created_at: string;
  inventory_mode: "stock" | "made_to_order";
  stock_quantity: number | null;
  size_variants: unknown;
  designers: { slug: string; brand_name: string } | null;
}

type SortKey = "curated" | "price_asc" | "price_desc" | "newest";

const WORLDS: World[] = ["Mode", "Interior", "Kunst"];

function sizesOf(product: ShopProduct): string[] {
  const list = Array.isArray(product.size_variants) ? (product.size_variants as Array<{ size?: string }>) : [];
  return list.map((v) => (typeof v?.size === "string" ? v.size.trim() : "")).filter(Boolean);
}

function useShopProducts() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("products")
        .select("id, slug, name, price, world, image_url, created_at, inventory_mode, stock_quantity, size_variants, designers ( slug, brand_name )")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (err) setError("Die Boutique lässt sich gerade nicht laden.");
      setProducts((data ?? []) as unknown as ShopProduct[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}

const Shop = () => {
  const { products, loading, error } = useShopProducts();
  // Teil L3 (L5) — stilles Merken direkt auf der Werkkarte: Merkliste + Taste-Signal,
  // keine Zähler, kein Druck.
  const wishlist = useWishlist();
  const { saveProduct } = useCustomerEvents();
  const { t } = useI18n();

  const [search, setSearch] = useState("");
  const [world, setWorld] = useState<World | null>(null);
  const [designer, setDesigner] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("curated");

  const houses = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.designers?.slug) map.set(p.designers.slug, p.designers.brand_name);
    return Array.from(map, ([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const sizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const s of sizesOf(p)) set.add(s);
    return Array.from(set).sort();
  }, [products]);

  const priceCeiling = useMemo(
    () => (products.length ? Math.ceil(Math.max(...products.map((p) => Number(p.price))) / 50) * 50 : 1000),
    [products],
  );
  const activeMax = maxPrice ?? priceCeiling;

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (world && p.world !== world) return false;
      if (designer && p.designers?.slug !== designer) return false;
      if (size && !sizesOf(p).includes(size)) return false;
      if (Number(p.price) > activeMax) return false;
      if (search && !`${p.name} ${p.designers?.brand_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "newest" || sort === "curated") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted;
  }, [products, world, designer, size, activeMax, search, sort]);

  const hasFilters = !!(world || designer || size || search || maxPrice !== null);

  return (
    <PalaceLayout transparentHeader={false}>
      {/* Hero */}
      <section className="border-b border-[rgba(0,0,0,.18)] px-6 pt-36 pb-16 md:px-14 md:pt-44 md:pb-24">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <Editable as="p" contentKey="shop_eyebrow" className="palace-eyebrow">
              Boutique · Aktuelles Kapitel
            </Editable>
            <h1
              className="palace-serif mt-8 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.94, letterSpacing: "-0.025em" }}
            >
              <Editable as="span" contentKey="shop_headline_a">Alles, was gerade </Editable>
              <Editable as="span" contentKey="shop_headline_b" className="italic">im Raum steht.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="shop_subline"
              className="mt-8 block max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#000000]/70"
              multiline
            >
              Kuratierte Stücke aus den Ateliers, die PAWN sammelt.
            </Editable>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-10 px-6 py-14 md:px-14 md:py-20 lg:grid-cols-[240px_1fr]">
        {/* Filter */}
        <aside className="space-y-10">
          <input
            placeholder="Boutique durchsuchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[rgba(0,0,0,.28)] bg-transparent px-3 py-2 text-sm text-[#000000] placeholder:text-black/60 focus:border-[#000000] focus:outline-none"
          />

          <FilterGroup title="Welt">
            {WORLDS.map((w) => (
              <FilterPill key={w} active={world === w} onClick={() => setWorld(world === w ? null : w)}>{w}</FilterPill>
            ))}
          </FilterGroup>

          {houses.length > 0 && (
            <FilterGroup title="Haus">
              {houses.map((h) => (
                <FilterPill key={h.slug} active={designer === h.slug} onClick={() => setDesigner(designer === h.slug ? null : h.slug)}>
                  {h.name}
                </FilterPill>
              ))}
            </FilterGroup>
          )}

          {sizes.length > 0 && (
            <FilterGroup title="Größe">
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <FilterPill key={s} active={size === s} onClick={() => setSize(size === s ? null : s)}>{s}</FilterPill>
                ))}
              </div>
            </FilterGroup>
          )}

          <FilterGroup title={`Preis · bis €${activeMax.toLocaleString("de-DE")}`}>
            <input
              type="range"
              min={0}
              max={priceCeiling}
              step={50}
              value={activeMax}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#000000]"
            />
          </FilterGroup>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setWorld(null); setDesigner(null); setSize(null); setSearch(""); setMaxPrice(null); }}
              className="palace-eyebrow uline text-black/60 hover:text-[#000000]"
            >
              Filter zurücksetzen
            </button>
          )}
        </aside>

        {/* Raster */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(0,0,0,.18)] pb-4">
            {loading
              ? <p key="loading" className="palace-eyebrow">Wird geladen …</p>
              : <p key="count" className="palace-eyebrow">{filtered.length} {filtered.length === 1 ? "Stück" : "Stücke"}</p>}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="border border-[rgba(0,0,0,.28)] bg-transparent px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-[#000000]"
            >
              <option value="curated">Kurator-Auswahl</option>
              <option value="price_asc">Preis · aufsteigend</option>
              <option value="price_desc">Preis · absteigend</option>
              <option value="newest">Neueste</option>
            </select>
          </div>

          {error && (
            <p className="mt-16 text-center font-serif italic text-[1rem] text-[#000000]/70">{error}</p>
          )}

          {loading && !error && (
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[4/5] w-full animate-pulse border border-[rgba(0,0,0,.12)]" />
              ))}
            </div>
          )}

          {!loading && !error && (
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p, i) => {
                const soldOut = p.inventory_mode === "stock" && Number(p.stock_quantity ?? 0) <= 0;
                const gemerkt = wishlist.has(p.id);
                return (
                  <Reveal key={p.id} delay={Math.min(400, i * 40)}>
                    <Link to={`/product/${p.slug}`} className="group block">
                      <div className="relative">
                        <EditorialImage src={p.image_url} alt={`${p.name} — ${p.designers?.brand_name ?? "PAWN"}`} color seed={`shop-${p.slug}`} ratio="4/5" />
                        {soldOut && (
                          <span className="absolute left-0 top-0 bg-[#000000] px-3 py-1 text-[0.58rem] uppercase tracking-[0.32em] text-[#FFFFFF]">
                            Ausverkauft
                          </span>
                        )}
                        {/* Teil L3 (L5) — stilles Merken: Herz auf der Karte, kein Zähler. */}
                        <button
                          type="button"
                          aria-label={gemerkt ? t("shop.merken.gemerktAria", { name: p.name }) : t("shop.merken.aria", { name: p.name })}
                          aria-pressed={gemerkt}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void wishlist.toggle(p.id);
                            if (!gemerkt) saveProduct(p.id);
                          }}
                          className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center border-[1.5px] border-black transition-colors ${gemerkt ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"}`}
                        >
                          <Heart className={`h-4 w-4 ${gemerkt ? "fill-current" : ""}`} strokeWidth={1.4} />
                        </button>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between gap-4">
                        <div>
                          <p className="palace-serif italic text-[1.1rem] leading-tight text-[#000000]">{p.name}</p>
                          <p className="palace-eyebrow mt-2">{p.designers?.brand_name ?? "PAWN"}</p>
                        </div>
                        <p className="palace-eyebrow text-[#000000]">€{Number(p.price).toLocaleString("de-DE")}</p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="mt-16 text-center font-serif italic text-[1rem] text-[#000000]/70">
              {products.length === 0
                ? "Die ersten Stücke ziehen ein."
                : "Nichts passt zu deinen Filtern — noch."}
            </p>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
};

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="palace-eyebrow mb-3">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterPill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "block border border-[#000000] bg-[#000000] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-[#FFFFFF]"
          : "block border border-[rgba(0,0,0,.22)] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-[#000000] transition-colors hover:border-[#000000]"
      }
    >
      {children}
    </button>
  );
}

export default Shop;
