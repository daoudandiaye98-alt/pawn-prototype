import { useMemo, useState } from "react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { useStore, marketplaceSelectors, toProductView } from "@/core";
import type { GenomeAxis } from "@/core";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Outerwear", "Tops", "Bottoms", "Bags", "Accessories"] as const;
const COLORS = ["Bone", "Ink", "Onyx", "Obsidian", "Sand", "Ash", "Raw Indigo", "Cognac"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const DNA_DIRECTIONS: { key: GenomeAxis; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "edge", label: "Edge" },
  { key: "elegance", label: "Elegance" },
  { key: "darkness", label: "Shadow" },
  { key: "sensuality", label: "Sensuality" },
  { key: "utility", label: "Utility" },
];

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
    if (cat && p.category !== cat) return false;
    if (designer && p.designer !== designer) return false;
    if (dnaAxis && (p.genomeAffinity[dnaAxis] ?? 0) < 0.5) return false;
    if (p.price > maxPrice) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PublicLayout>
      <section className="border-b border-border">
        <div className="editorial-container py-14">
          <p className="editorial-eyebrow">Boutique</p>
          <h1 className="mt-3 font-serif text-5xl md:text-7xl">The current chapter.</h1>
          <p className="mt-4 max-w-xl text-muted-foreground">Curated pieces from the studios PAWN collects.</p>
        </div>
      </section>

      <section className="editorial-container grid gap-10 py-12 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="space-y-8">
          <Input
            placeholder="Search the boutique"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-none"
          />
          <FilterGroup title="Categories">
            {CATEGORIES.map((c) => (
              <FilterPill key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c}</FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup title="Designers">
            {designerNames.map((d) => (
              <FilterPill key={d} active={designer === d} onClick={() => setDesigner(designer === d ? null : d)}>{d}</FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup title="Colors">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => <FilterPill key={c}>{c}</FilterPill>)}
            </div>
          </FilterGroup>
          <FilterGroup title="Sizes">
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => <FilterPill key={s}>{s}</FilterPill>)}
            </div>
          </FilterGroup>
          <FilterGroup title={`Price · up to €${maxPrice}`}>
            <Slider value={[maxPrice]} min={100} max={3000} step={50} onValueChange={(v) => setMaxPrice(v[0])} />
          </FilterGroup>
        </aside>

        {/* Grid */}
        <div>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{filtered.length} pieces</p>
            <select className="border border-border bg-card px-3 py-1.5 text-xs uppercase tracking-[0.18em]">
              <option>Curator's pick</option>
              <option>Price · low to high</option>
              <option>Price · high to low</option>
              <option>Newest</option>
            </select>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {filtered.length === 0 && (
            <p className="mt-16 text-center text-sm text-muted-foreground">No pieces match your filters.</p>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="editorial-eyebrow mb-3">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterPill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition-colors",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default Shop;
