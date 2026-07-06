import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStore, marketplaceSelectors, type ProductView } from "@/core";
import { useCart } from "@/store/cart";
import { usePersonalization, sortByPersonalization } from "@/features/personalization";
import { ProductImage } from "@/components/pawn/ProductImage";
import { toast } from "sonner";

interface Props {
  title?: string;
  limit?: number;
  variant?: "in-cart" | "empty-cart";
}

/**
 * Recommends products that fit the current cart context — same world/tags,
 * personalized-weighted, excluding pieces already in the bag. Falls back to
 * DNA-based suggestions when the cart is empty.
 */
export function CartRecommendations({ title = "Passt dazu", limit = 3, variant = "in-cart" }: Props) {
  const { items, add } = useCart();
  const all = useStore(marketplaceSelectors.getAllProductViews);
  const personalization = usePersonalization();

  const suggestions = useMemo<ProductView[]>(() => {
    const inCartIds = new Set(items.map((i) => i.product.id));
    const cartWorlds = new Set(items.map((i) => i.product.world));
    const cartCategories = new Set(items.map((i) => i.product.category));

    const scored = all
      .filter((p) => !inCartIds.has(p.id) && p.status === "Active")
      .map((p) => {
        let s = 0;
        if (cartWorlds.size && cartWorlds.has(p.world)) s += 6;
        if (cartCategories.size && cartCategories.has(p.category)) s += 2;
        if (personalization.world && p.world === personalization.world) s += 4;
        if (personalization.preferredTags.some((t) => p.category === t)) s += 2;
        return { p, s };
      })
      .sort((a, b) => b.s - a.s);

    // If no cart items, prefer personalization-only sort so empty state feels DNA-driven.
    const base = variant === "empty-cart"
      ? sortByPersonalization(all.filter((p) => p.status === "Active"), personalization)
      : scored.map((x) => x.p);

    return base.slice(0, limit);
  }, [all, items, personalization, variant, limit]);

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <p className="editorial-eyebrow">{title}</p>
      <h3 className="mt-2 font-serif text-2xl">
        {variant === "empty-cart" ? "Ausgesucht für dich." : "Vollende das Ensemble."}
      </h3>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {suggestions.map((p) => (
          <li key={p.id} className="group">
            <Link to={`/product/${p.slug}`} className="block">
              <ProductImage seed={p.slug} className="aspect-[3/4] w-full transition-transform duration-500 group-hover:scale-[1.02]" />
            </Link>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="editorial-eyebrow truncate">{p.designer}</p>
                <Link to={`/product/${p.slug}`} className="mt-1 block truncate font-serif text-[1rem] hover:underline">
                  {p.name}
                </Link>
              </div>
              <span className="shrink-0 text-[0.8rem] tabular-nums">€{p.price.toLocaleString("de-DE")}</span>
            </div>
            <button
              type="button"
              onClick={() => { add(p, p.sizes[0]); toast.success(`${p.name} zur Tasche.`); }}
              className="mt-3 w-full border border-border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background"
            >
              Hinzufügen
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
