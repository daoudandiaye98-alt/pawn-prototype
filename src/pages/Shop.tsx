import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

/**
 * Teil Q — der Preis-Schieber hat eine feste, verlässliche Spanne statt einer, die
 * mit dem Bestand springt: 0 bis 1000 €, Schritt 10 €. Das obere Ende ist offen —
 * steht der rechte Griff am Anschlag, heißt das „1000 €+" und es wird nach oben
 * NICHT gefiltert. Teure Kunst darf nie unsichtbar werden.
 */
const PREIS_MIN = 0;
const PREIS_MAX = 1000;
const PREIS_SCHRITT = 10;

const eur = (n: number) => `${n.toLocaleString("de-DE")} €`;
const preisLabel = (n: number, obenOffen: boolean) => (obenOffen ? `${eur(n)}+` : eur(n));

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

  // Teil Q — die Welt kann von der Landing vorgewählt kommen (/shop?welt=Kunst).
  const [params, setParams] = useSearchParams();
  const weltAusUrl = params.get("welt");
  const [search, setSearch] = useState("");
  const [world, setWorld] = useState<World | null>(
    WORLDS.includes(weltAusUrl as World) ? (weltAusUrl as World) : null,
  );
  useEffect(() => {
    const w = params.get("welt");
    setWorld(WORLDS.includes(w as World) ? (w as World) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weltAusUrl]);
  /** Welt wechseln heißt auch: die Adresse zeigt sie, damit der Stand teilbar bleibt. */
  const waehleWelt = (w: World | null) => {
    setWorld(w);
    const next = new URLSearchParams(params);
    if (w) next.set("welt", w); else next.delete("welt");
    setParams(next, { replace: true });
  };
  const [designer, setDesigner] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  // Teil P — Preis als Spanne [von, bis]. null = volle Spanne, blendet nichts aus.
  const [preisSpanne, setPreisSpanne] = useState<[number, number] | null>(null);
  const [sort, setSort] = useState<SortKey>("curated");

  // Der Zähler und das Raster folgen dem Ziehen leicht verzögert, damit das
  // Schieben flüssig bleibt (die Beschriftung reagiert sofort).
  const [preisSpanneWirksam, setPreisSpanneWirksam] = useState<[number, number] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setPreisSpanneWirksam(preisSpanne), 150);
    return () => clearTimeout(id);
  }, [preisSpanne]);

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

  // Alles außer dem Preis — daraus entstehen die Grenzen des Schiebers. So passt die
  // Spanne immer zu dem, was gerade wirklich im Regal liegt (nicht zu festen 0–100).
  const ohnePreis = useMemo(
    () => products.filter((p) => {
      if (world && p.world !== world) return false;
      if (designer && p.designers?.slug !== designer) return false;
      if (size && !sizesOf(p).includes(size)) return false;
      if (search && !`${p.name} ${p.designers?.brand_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [products, world, designer, size, search],
  );

  // Feste Spanne, unabhängig vom Bestand — kein Springen mehr auf absurde
  // Ausschnitte wie 100 € – 105 €, wenn gerade nur ein Werk gelistet ist.
  const preisVon = PREIS_MIN;
  const preisBis = PREIS_MAX;

  // Ohne Wahl gilt die volle Spanne — der Standard blendet nichts aus.
  const spanne: [number, number] = preisSpanne
    ? [Math.max(preisVon, Math.min(preisSpanne[0], preisBis)), Math.min(preisBis, Math.max(preisSpanne[1], preisVon))]
    : [preisVon, preisBis];
  const spanneWirksam = useMemo<[number, number]>(
    () => (preisSpanneWirksam
      ? [Math.max(preisVon, Math.min(preisSpanneWirksam[0], preisBis)), Math.min(preisBis, Math.max(preisSpanneWirksam[1], preisVon))]
      : [preisVon, preisBis]),
    [preisSpanneWirksam, preisVon, preisBis],
  );
  // Rechter Griff am Anschlag = offenes Ende: nach oben wird nicht gefiltert.
  const obenOffen = spanne[1] >= preisBis;
  const preisGewaehlt = preisSpanne !== null && (spanne[0] > preisVon || spanne[1] < preisBis);

  const filtered = useMemo(() => {
    const obenOffenWirksam = spanneWirksam[1] >= preisBis;
    const list = ohnePreis.filter((p) => {
      const preis = Number(p.price);
      if (preis < spanneWirksam[0]) return false;
      return obenOffenWirksam || preis <= spanneWirksam[1];
    });
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "newest" || sort === "curated") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted;
  }, [ohnePreis, spanneWirksam, sort]);

  // Der Zähler zeigt beim Ziehen die Zahl der wirksamen (kurz verzögerten) Spanne —
  // das ist genau `filtered.length`, also die Zahl, die auch das Raster zeigt.
  const hasFilters = !!(world || designer || size || search || preisGewaehlt);

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
              <FilterPill key={w} active={world === w} onClick={() => waehleWelt(world === w ? null : w)}>{w}</FilterPill>
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

          {(
            <FilterGroup title={`Preis · ${eur(spanne[0])} – ${preisLabel(spanne[1], obenOffen)}`}>
              <PreisSchieber
                von={preisVon}
                bis={preisBis}
                wert={spanne}
                onChange={(neu) => setPreisSpanne(neu)}
              />
            </FilterGroup>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={() => { waehleWelt(null); setDesigner(null); setSize(null); setSearch(""); setPreisSpanne(null); }}
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

/**
 * Teil P — der Preis-Schieber im Ladenstandard: zwei Griffe (von/bis), 5-€-Schritte,
 * Zahlenfelder daneben (in beide Richtungen verbunden), mit der Tastatur bedienbar
 * (die Griffe sind echte Bereichsregler, also gehen Pfeiltasten, Bild-auf/ab, Pos1/Ende).
 * Die Griffe haben eine 44 px große Trefferfläche, sichtbar bleibt ein kleines
 * schwarzes Quadrat — Farbgesetz und harte Kanten bleiben unangetastet.
 */
function PreisSchieber({
  von, bis, wert, onChange,
}: {
  von: number;
  bis: number;
  wert: [number, number];
  onChange: (wert: [number, number]) => void;
}) {
  const [minWert, maxWert] = wert;
  const breite = bis - von || 1;
  const anteil = (n: number) => ((n - von) / breite) * 100;

  // Die Zahlenfelder dürfen beim Tippen kurz „unfertig" sein (leer, halbe Zahl);
  // erst beim Verlassen oder mit Enter wird der Wert übernommen und eingepasst.
  const [minText, setMinText] = useState(String(minWert));
  const [maxText, setMaxText] = useState(String(maxWert));
  useEffect(() => { setMinText(String(minWert)); }, [minWert]);
  useEffect(() => { setMaxText(String(maxWert)); }, [maxWert]);

  const einpassen = (n: number) => {
    const gerundet = Math.round(n / PREIS_SCHRITT) * PREIS_SCHRITT;
    return Math.min(bis, Math.max(von, gerundet));
  };
  const setzeMin = (n: number) => onChange([Math.min(einpassen(n), maxWert), maxWert]);
  const setzeMax = (n: number) => onChange([minWert, Math.max(einpassen(n), minWert)]);

  const uebernehmeMinText = () => {
    const n = Number(minText.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) setzeMin(n); else setMinText(String(minWert));
  };
  const uebernehmeMaxText = () => {
    const n = Number(maxText.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) setzeMax(n); else setMaxText(String(maxWert));
  };

  // Liegen beide Griffe übereinander, muss der greifbar sein, der noch Weg hat:
  // oben am Ende der „von"-Griff (er kann nur nach unten), sonst der „bis"-Griff.
  const minZuOberst = minWert > von + breite / 2;

  return (
    <div className="pawn-preis">
      <style>{`
        .pawn-preis .pawn-preis-regler {
          position: absolute; left: 0; right: 0; top: 0; height: 44px; width: 100%;
          margin: 0; padding: 0; background: transparent; -webkit-appearance: none; appearance: none;
          pointer-events: none;
        }
        .pawn-preis .pawn-preis-regler:focus { outline: none; }
        .pawn-preis .pawn-preis-regler::-webkit-slider-runnable-track { height: 44px; background: transparent; border: 0; }
        .pawn-preis .pawn-preis-regler::-moz-range-track { height: 44px; background: transparent; border: 0; }
        .pawn-preis .pawn-preis-regler::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          height: 44px; width: 44px; border: 0; border-radius: 0; background: transparent;
          background-image: linear-gradient(#000000, #000000);
          background-size: 16px 16px; background-position: center; background-repeat: no-repeat;
          cursor: pointer; pointer-events: auto;
        }
        .pawn-preis .pawn-preis-regler::-moz-range-thumb {
          height: 44px; width: 44px; border: 0; border-radius: 0; background: transparent;
          background-image: linear-gradient(#000000, #000000);
          background-size: 16px 16px; background-position: center; background-repeat: no-repeat;
          cursor: pointer; pointer-events: auto;
        }
        .pawn-preis .pawn-preis-regler:focus-visible::-webkit-slider-thumb { background-size: 22px 22px; }
        .pawn-preis .pawn-preis-regler:focus-visible::-moz-range-thumb { background-size: 22px 22px; }
      `}</style>

      {/* Die Bahn liegt um eine halbe Griffbreite eingerückt, damit die gefüllte
          Strecke genau unter den Griffen sitzt. */}
      <div className="relative h-11">
        <div className="pointer-events-none absolute left-[22px] right-[22px] top-1/2 h-[1.5px] -translate-y-1/2 bg-[rgba(0,0,0,.22)]">
          <div
            className="absolute top-0 h-full bg-[#000000]"
            style={{ left: `${anteil(minWert)}%`, right: `${100 - anteil(maxWert)}%` }}
          />
        </div>
        <input
          type="range"
          className="pawn-preis-regler"
          style={{ zIndex: minZuOberst ? 4 : 3 }}
          min={von}
          max={bis}
          step={PREIS_SCHRITT}
          value={minWert}
          onChange={(e) => setzeMin(Number(e.target.value))}
          aria-label="Preis von"
          aria-valuetext={eur(minWert)}
        />
        <input
          type="range"
          className="pawn-preis-regler"
          style={{ zIndex: minZuOberst ? 3 : 4 }}
          min={von}
          max={bis}
          step={PREIS_SCHRITT}
          value={maxWert}
          onChange={(e) => setzeMax(Number(e.target.value))}
          aria-label="Preis bis"
          aria-valuetext={eur(maxWert)}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={von}
          max={bis}
          step={PREIS_SCHRITT}
          value={minText}
          onChange={(e) => setMinText(e.target.value)}
          onBlur={uebernehmeMinText}
          onKeyDown={(e) => { if (e.key === "Enter") uebernehmeMinText(); }}
          aria-label="Preis von, in Euro"
          className="h-11 w-full min-w-0 border border-[rgba(0,0,0,.28)] bg-transparent px-2 text-sm tabular-nums text-[#000000] focus:border-[#000000] focus:outline-none"
        />
        <span aria-hidden className="text-black/40">–</span>
        <input
          type="number"
          inputMode="numeric"
          min={von}
          max={bis}
          step={PREIS_SCHRITT}
          value={maxText}
          onChange={(e) => setMaxText(e.target.value)}
          onBlur={uebernehmeMaxText}
          onKeyDown={(e) => { if (e.key === "Enter") uebernehmeMaxText(); }}
          aria-label="Preis bis, in Euro"
          className="h-11 w-full min-w-0 border border-[rgba(0,0,0,.28)] bg-transparent px-2 text-sm tabular-nums text-[#000000] focus:border-[#000000] focus:outline-none"
        />
      </div>
    </div>
  );
}

export default Shop;
