import { Link } from "react-router-dom";
import type { DesignerView } from "@/core";
import { ProductImage } from "./ProductImage";

export function DesignerCard({ designer }: { designer: DesignerView }) {
  return (
    <Link to={`/designer/${designer.slug}`} className="group block">
      <ProductImage seed={designer.slug + "_d"} className="aspect-[4/5] w-full" label={designer.location} />
      <div className="mt-4">
        <h3 className="font-serif text-2xl">{designer.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{designer.slogan}</p>
      </div>
    </Link>
  );
}
