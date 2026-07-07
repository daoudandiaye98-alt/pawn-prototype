import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { useStore, marketplaceSelectors, toProductView } from "@/core";
import type { GenomeAxis } from "@/core";

const CATEGORIES = ["Mäntel", "Oberteile", "Hosen", "Taschen", "Accessoires"] as const;
const COLORS = ["Bone", "Tinte", "Onyx", "Obsidian", "Sand", "Asche", "Roh-Indigo", "Cognac"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const DNA_DIRECTIONS: { key: GenomeAxis; label: string }[] = [
  { key: "structure", label: "Struktur" },
  { key: "edge", label: "Kante" },
  { key: "elegance", label: "Eleganz" },
  { key: "darkness", label: "Schatten" },
  { key: "sensuality", label: "Sinnlichkeit" },
  { key: "utility", label: "Funktion" },
];

// Map original English categories → German equivalents for filter compatibility.
const CATEGORY_MAP: Record<string, string> = {
  "Mäntel": "Outerwear",
  "Oberteile": "Tops",
  "Hosen": "Bottoms",
  "Taschen": "Bags",
  "Accessoires": "Accessories",
};

const Shop = () => {
  const coreProducts = useStore(marketplaceSelectors.getAllProducts);
  const coreDesigners = useStore(marketplaceSelectors.getAllDesigners);

  const products = useMemo(() => {
    const designerById = new Map(coreDesigners.map((d) => [d.id as string, d]));
    return coreProducts.map((p) => toProductView(p, designerById.get(p.designerId as string)));
  }, [coreProducts, coreDesigners]);

  const designerNames = useMemo(() => Array.from(new Set(products.map((p) => p.designer))), [products]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [designer, setDesigner] = useState<string | null>(null);
  const [dnaAxis, setDnaAxis] = useState<GenomeAxis | null>(null);
  const [maxPrice, setMaxPrice] = useState(2000);

  const filtered = products.filter((p) => {
    if (cat) {
      const original = CATEGORY_MAP[cat] ?? cat;
      if (p.category !== original) return false;
    }
    if (designer && p.designer !== designer) return false;
    if (dnaAxis && (p.genomeAffinity[dnaAxis] ?? 0) < 0.5) return false;
    if (p.price > maxPrice) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PalaceLayout transparentHeader={false}>
      {/* Hero */}
      <section className="border-b border-[rgba(12,12,14,.13)] px-6 pt-36 pb-16 md:px-14 md:pt-44 md:pb-24">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <Editable as="p" contentKey="shop_eyebrow" className="palace-eyebrow">
              Boutique · Aktuelles Kapitel
            </Editable>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.94, letterSpacing: "-0.025em" }}
            >
              <Editable as="span" contentKey="shop_headline_a">Alles, was gerade </Editable>
              <Editable as="span" contentKey="shop_headline_b" className="italic">im Raum steht.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="shop_subline"
              className="mt-8 block max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/70"
              multiline
            >
              Kuratierte Stücke aus den Ateliers, die PAWN sammelt.
            </Editable>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-10 px-6 py-14 md:px-14 md:py-20 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="space-y-10">
          <input
            placeholder="Boutique durchsuchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[rgba(12,12,14,.28)] bg-transparent px-3 py-2 text-sm text-[#0C0C0E] placeholder:text-[#7C7972] focus:border-[#0C0C0E] focus:outline-none"
          />
          <FilterGroup title="DNA-Richtung">
            {DNA_DIRECTIONS.map((d) => (
              <FilterPill key={d.key} active={dnaAxis === d.key} onClick={() => setDnaAxis(dnaAxis === d.key ? null : d.key)}>{d.label}</FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup title="Kategorien">
            {CATEGORIES.map((c) => (
              <FilterPill key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup title="Designer">
            {designerNames.map((d) => (
              <FilterPill key={d} active={designer === d} onClick={() => setDesigner(designer === d ? null : d)}>{d}</FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup title="Farben">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => <FilterPill key={c}>{c}</FilterPill>)}
            </div>
          </FilterGroup>
          <FilterGroup title="Größen">
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => <FilterPill key={s}>{s}</FilterPill>)}
            </div>
          </FilterGroup>
          <FilterGroup title={`Preis · bis €${maxPrice}`}>
            <input
              type="range"
              min={100}
              max={3000}
              step={50}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#0C0C0E]"
            />
          </FilterGroup>
        </aside>

        {/* Grid */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(12,12,14,.13)] pb-4">
            <p className="palace-eyebrow">{filtered.length} Stücke</p>
            <select className="border border-[rgba(12,12,14,.28)] bg-transparent px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-[#0C0C0E]">
              <option>Kurator-Auswahl</option>
              <option>Preis · aufsteigend</option>
              <option>Preis · absteigend</option>
              <option>Neueste</option>
            </select>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => (
              <Reveal key={p.id} delay={Math.min(400, i * 40)}>
                <Link to={`/product/${p.slug}`} className="group block">
                  <EditorialImage seed={`shop-${p.slug}`} ratio="4/5" />
                  <div className="mt-4 flex items-baseline justify-between gap-4">
                    <div>
                      <p className="palace-serif italic text-[1.1rem] leading-tight text-[#0C0C0E]">{p.name}</p>
                      <p className="palace-eyebrow mt-2">{p.designer}</p>
                    </div>
                    <p className="palace-eyebrow text-[#0C0C0E]">€{p.price.toLocaleString("de-DE")}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="mt-16 text-center font-serif italic text-[1rem] text-[#0C0C0E]/70">Nichts passt zu deinen Filtern — noch.</p>
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
          ? "block border border-[#0C0C0E] bg-[#0C0C0E] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-[#F1EEE7]"
          : "block border border-[rgba(12,12,14,.22)] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.28em] text-[#0C0C0E] transition-colors hover:border-[#0C0C0E]"
      }
    >
      {children}
    </button>
  );
}

export default Shop;
