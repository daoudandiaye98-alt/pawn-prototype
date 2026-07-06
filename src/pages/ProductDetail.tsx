import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { toast } from "@/components/ui/sonner";
import {
  useStore, marketplaceSelectors, toProductView,
} from "@/core";
import { useDnaMatch } from "@/features/dna/hooks";
import { useCustomerEvents } from "@/features/events/useCustomerEvents";
import { useCart } from "@/store/cart";
import { useRoomShift } from "@/features/os/roomShift";
import { cn } from "@/lib/utils";

const ProductDetail = () => {
  const params = useParams<{ slug?: string; id?: string }>();
  const slug = params.slug ?? params.id ?? "asymmetric-coat";

  const coreProduct = useStore((s) => marketplaceSelectors.getProductBySlug(s, slug) ?? marketplaceSelectors.getAllProducts(s)[0]);
  const designer = useStore((s) => marketplaceSelectors.getDesignerById(s, coreProduct.designerId as string));
  const cart = useCart();
  const { push } = useRoomShift();

  const product = useMemo(() => toProductView(coreProduct, designer), [coreProduct, designer]);

  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [saved, setSaved] = useState(false);

  const match = useDnaMatch(product.id);
  const { viewProduct, saveProduct } = useCustomerEvents();

  useEffect(() => {
    viewProduct(product.id);
  }, [product.id, viewProduct]);

  useEffect(() => {
    setSize(product.sizes[0]);
    setColor(product.colors[0]);
  }, [product.id, product.sizes, product.colors]);

  function addToBag() {
    cart.add(product, size);
    push(`${product.name} betritt das Brett.`);
    toast.success("Zur Tasche hinzugefügt.");
  }

  function onSave() {
    saveProduct(product.id);
    setSaved(true);
  }

  return (
    <PalaceLayout transparentHeader={false}>
      {/* Banner: hero image always first, directly under the nav */}
      <section className="pt-20 md:pt-24">
        <Reveal>
          <EditorialImage
            seed={`prd-${product.slug}-hero`}
            ratio="21/9"
            className="w-full"
          />
        </Reveal>
      </section>

      <section className="px-6 pt-12 md:px-14 md:pt-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          {/* Left: gallery thumbnails */}
          <Reveal>
            <EditorialImage seed={`prd-${product.slug}`} ratio="4/5" className="w-full" />
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <EditorialImage key={i} seed={`prd-${product.slug}-${i}`} ratio="1/1" />
              ))}
            </div>
          </Reveal>


          {/* Right: sticky detail */}
          <div>
            <div className="md:sticky md:top-28">
              <Reveal>
                <p className="palace-eyebrow">{product.world} · {product.category}</p>
                <h1
                  className="palace-serif mt-6 font-light text-[#0C0C0E]"
                  style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1.02, letterSpacing: "-0.01em" }}
                >
                  {product.name}
                </h1>
                <Link
                  to={`/designer/${product.designerSlug}`}
                  className="palace-eyebrow uline mt-4 inline-block text-[#0C0C0E]"
                >
                  {product.designer} →
                </Link>
                <p className="mt-8 palace-serif text-[1.4rem] tabular-nums text-[#0C0C0E]">
                  €{product.price.toLocaleString("de-DE")}
                </p>

                <p className="mt-8 max-w-md text-[0.98rem] leading-relaxed text-[#0C0C0E]/80">
                  {product.description}
                </p>

                {/* Provenance */}
                {match.percent > 0 && (
                  <div className="mt-10 border-t border-[rgba(12,12,14,.13)] pt-6">
                    <p className="palace-eyebrow">Ausgewählt für dich, weil</p>
                    <p className="mt-3 font-serif italic text-[1.05rem] leading-snug text-[#0C0C0E]/80">
                      {match.rationale}
                    </p>
                  </div>
                )}

                {/* Color */}
                {product.colors.length > 1 && (
                  <div className="mt-10">
                    <p className="palace-eyebrow">Farbe · <span className="text-[#0C0C0E]">{color}</span></p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={cn(
                            "border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300",
                            c === color
                              ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]"
                              : "border-[rgba(12,12,14,.22)] text-[#0C0C0E] hover:border-[#0C0C0E]",
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size */}
                {product.sizes.length > 1 && (
                  <div className="mt-6">
                    <p className="palace-eyebrow">Format · <span className="text-[#0C0C0E]">{size}</span></p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.sizes.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSize(s)}
                          className={cn(
                            "border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300",
                            s === size
                              ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]"
                              : "border-[rgba(12,12,14,.22)] text-[#0C0C0E] hover:border-[#0C0C0E]",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={addToBag}
                    className="palace-btn flex-1 justify-center text-center hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
                  >
                    In die Tasche
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    className={cn(
                      "palace-btn justify-center text-center",
                      saved ? "bg-[#0C0C0E] text-[#F1EEE7]" : "",
                    )}
                  >
                    {saved ? "Gemerkt" : "Merken"}
                  </button>
                </div>

                <p className="mt-10 border-t border-[rgba(12,12,14,.13)] pt-6 text-[0.8rem] leading-relaxed text-[#0C0C0E]/60">
                  Versichert weltweit versendet · Rückgabe innerhalb von 14 Tagen · Direkt aus dem Atelier.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <div className="h-32" />
    </PalaceLayout>
  );
};

export default ProductDetail;
