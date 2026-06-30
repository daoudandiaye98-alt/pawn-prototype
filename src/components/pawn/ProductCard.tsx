import { Link } from "react-router-dom";
import { Product } from "@/data/mock";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <ProductImage seed={product.slug} className="aspect-[3/4] w-full" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="editorial-eyebrow">{product.designer}</p>
          <h3 className="mt-1 font-serif text-xl leading-tight">{product.name}</h3>
        </div>
        <span className="font-sans text-sm tabular-nums">€{product.price.toLocaleString("de-DE")}</span>
      </div>
    </Link>
  );
}
