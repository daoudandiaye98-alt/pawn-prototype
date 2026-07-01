import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import type { ProductView } from "@/core";
import { ProductImage } from "./ProductImage";
import { DnaBadge } from "./DnaBadge";
import { useDnaMatch } from "@/features/dna/hooks";
import { useCustomerEvents } from "@/features/events/useCustomerEvents";
import { toast } from "@/components/ui/sonner";

export function ProductCard({ product, recommendationId }: { product: ProductView; recommendationId?: string }) {
  const match = useDnaMatch(product.id);
  const { viewProduct, saveProduct } = useCustomerEvents();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!ref.current || viewedRef.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          viewProduct(product.id);
          io.disconnect();
        }
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [product.id, viewProduct]);

  return (
    <Link
      ref={ref}
      to={`/product/${product.slug}`}
      className="group block"
      data-recommendation-id={recommendationId}
    >
      <div className="relative overflow-hidden">
        <ProductImage seed={product.slug} className="aspect-[3/4] w-full transition-transform duration-700 group-hover:scale-[1.02]" />
        {match.percent > 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-ivory/90 p-1 backdrop-blur">
            <DnaBadge match={match} size="sm" />
          </div>
        )}
        <button
          type="button"
          aria-label="Save piece"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            saveProduct(product.id);
            toast.success("Saved to your identity");
          }}
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center border border-foreground/20 bg-ivory/80 text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
        >
          <Heart className="h-3.5 w-3.5" strokeWidth={1.4} />
        </button>
      </div>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="editorial-eyebrow">{product.designer}</p>
          <h3 className="mt-1.5 font-serif text-[1.15rem] leading-tight underline-offset-4 group-hover:underline">
            {product.name}
          </h3>
          {match.rationale && (
            <p className="mt-1 text-[0.7rem] italic text-muted-foreground">{match.rationale}</p>
          )}
        </div>
        <span className="font-sans text-[0.85rem] tabular-nums tracking-wide">
          €{product.price.toLocaleString("de-DE")}
        </span>
      </div>
    </Link>
  );
}
