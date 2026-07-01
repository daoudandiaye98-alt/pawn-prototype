import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductImage } from "@/components/pawn/ProductImage";
import { ProductCard } from "@/components/pawn/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Heart } from "lucide-react";
import {
  useStore, marketplaceSelectors, toProductView, defaultIdentityId,
} from "@/core";
import { useCart } from "@/store/cart";
import { cn } from "@/lib/utils";

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const slug = id ?? "asymmetric-coat";

  const coreProduct = useStore((s) => marketplaceSelectors.getProductBySlug(s, slug) ?? marketplaceSelectors.getAllProducts(s)[0]);
  const designer = useStore((s) => marketplaceSelectors.getDesignerById(s, coreProduct.designerId as string));
  const designerProducts = useStore((s) => marketplaceSelectors.getProductsByDesignerId(s, coreProduct.designerId));
  const recommendations = useStore((s) => marketplaceSelectors.getRecommendedProducts(s, defaultIdentityId));
  const allDesigners = useStore(marketplaceSelectors.getAllDesigners);
  const cart = useCart();

  const product = useMemo(() => toProductView(coreProduct, designer), [coreProduct, designer]);

  const related = useMemo(() => {
    const designerById = new Map(allDesigners.map((d) => [d.id as string, d]));
    return designerProducts
      .filter((p) => p.id !== coreProduct.id)
      .slice(0, 3)
      .map((p) => ({ view: toProductView(p, designerById.get(p.designerId as string)), recId: recommendations.find((r) => r.productId === p.id)?.id }));
  }, [designerProducts, allDesigners, coreProduct.id, recommendations]);

  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [activeImg, setActiveImg] = useState(0);

  function addToBag() {
    cart.add(product, size);
    toast.success(`${product.name} added to bag`);
  }

  return (
    <PublicLayout>
      <div className="editorial-container py-10 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Link to="/shop" className="hover:text-foreground">Shop</Link>
        <span className="mx-2">/</span>
        <Link to={`/designer/${product.designerSlug}`} className="hover:text-foreground">{product.designer}</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </div>

      <div className="editorial-container grid gap-12 pb-24 lg:grid-cols-[1fr_1fr]">
        {/* Gallery */}
        <div className="grid grid-cols-[80px_1fr] gap-4">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "aspect-[3/4] border",
                  i === activeImg ? "border-foreground" : "border-border",
                )}
              >
                <ProductImage seed={product.slug + i} className="h-full w-full" />
              </button>
            ))}
          </div>
          <ProductImage seed={product.slug + activeImg} className="aspect-[3/4] w-full" />
        </div>

        {/* Details */}
        <div>
          <p className="editorial-eyebrow">{product.designer}</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight">{product.name}</h1>
          <p className="mt-4 text-xl tabular-nums">€{product.price.toLocaleString("de-DE")}</p>

          <p className="mt-8 max-w-md text-sm text-foreground/70">{product.description}</p>

          <div className="mt-10">
            <p className="editorial-eyebrow">Color · <span className="text-foreground">{color}</span></p>
            <div className="mt-3 flex gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "border px-4 py-2 text-xs uppercase tracking-[0.18em]",
                    c === color ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="editorial-eyebrow">Size · <span className="text-foreground">{size}</span></p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={cn(
                    "border px-3 py-2 text-xs uppercase tracking-[0.18em]",
                    s === size ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <Button size="lg" className="flex-1 rounded-none" onClick={addToBag}>
              Add to bag
            </Button>
            <Button size="lg" variant="outline" className="rounded-none" aria-label="Add to wishlist">
              <Heart className="h-4 w-4" />
            </Button>
          </div>

          <Accordion type="single" collapsible className="mt-12 border-t border-border">
            <AccordionItem value="details">
              <AccordionTrigger className="text-xs uppercase tracking-[0.22em]">Details</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/70">
                Composition and craftsmanship: heavyweight Italian fabric, raw inner edges, made in small batches. Care: dry clean only.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="shipping">
              <AccordionTrigger className="text-xs uppercase tracking-[0.22em]">Shipping & Returns</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/70">
                Insured worldwide shipping. Free returns within 14 days for unworn pieces with original tags.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="designer">
              <AccordionTrigger className="text-xs uppercase tracking-[0.22em]">Designer</AccordionTrigger>
              <AccordionContent className="text-sm text-foreground/70">
                {product.designer} —{" "}
                <Link to={`/designer/${product.designerSlug}`} className="underline underline-offset-4">
                  visit the studio page
                </Link>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-border py-20">
          <div className="editorial-container">
            <p className="editorial-eyebrow">More from {product.designer}</p>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map(({ view, recId }) => (
                <div key={view.id} data-recommendation-id={recId ?? undefined}>
                  <ProductCard product={view} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicLayout>
  );
};

export default ProductDetail;
