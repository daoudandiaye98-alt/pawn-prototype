import { Link } from "react-router-dom";
import { Product } from "@/data/mock";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="overflow-hidden">
        <ProductImage seed={product.slug} className="aspect-[3/4] w-full transition-transform duration-700 group-hover:scale-[1.02]" />
      </div>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="editorial-eyebrow">{product.designer}</p>
          <h3 className="mt-1.5 font-serif text-[1.15rem] leading-tight underline-offset-4 group-hover:underline">
            {product.name}
          </h3>
        </div>
        <span className="font-sans text-[0.85rem] tabular-nums tracking-wide">
          €{product.price.toLocaleString("de-DE")}
        </span>
      </div>
    </Link>
  );
}
