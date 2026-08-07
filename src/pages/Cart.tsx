import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, X, ShieldCheck } from "lucide-react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { ProductImage } from "@/components/pawn/ProductImage";
import { PaymentLogos } from "@/components/pawn/PaymentLogos";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { useCartWardrobeImpact } from "@/features/dna/hooks";
import { useCartStockLimits } from "@/features/commerce/hooks";
import { CartRecommendations } from "@/features/commerce/CartRecommendations";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";

/**
 * /cart — Palace-Layout, vollweiße Bestellkarte, deutsche Sprache.
 * Leerer Cart lädt in die Ausstellung ein statt einer negativen Botschaft.
 */
const Cart = () => {
  const { items, setQty, remove, subtotal, count } = useCart();
  const { t, locale } = useI18n();
  const impact = useCartWardrobeImpact(items.map((i) => i.product.id));
  const slugs = useMemo(() => items.map((i) => i.product.slug), [items]);
  const limits = useCartStockLimits(slugs);

  const tryIncrement = (slug: string, currentQty: number, id: string, size: string) => {
    const max = limits[slug];
    const cap = max === undefined ? Number.POSITIVE_INFINITY : max;
    if (currentQty + 1 > cap) {
      toast.message(cap === 0 ? t("cart.outOfStock") : t("cart.inStock", { n: cap }));
      return;
    }
    setQty(id, size, currentQty + 1);
  };

  if (items.length === 0) {
    return (
      <PalaceLayout>
        <section className="mx-auto max-w-[1200px] px-6 py-32 pt-40 text-center md:px-14">
          <p className="palace-eyebrow">{t("cart.bag")}</p>
          <h1
            className="palace-serif mt-8 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 0.98, letterSpacing: "-0.02em" }}
          >
            {t("cart.emptyTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[0.98rem] leading-relaxed text-[#000000]/75">
            {t("cart.emptyBody")}
          </p>
          <Button asChild variant="editorial" size="chip" className="mt-10 justify-center border-black bg-black text-white hover:bg-white hover:text-black">
            <Link to="/mode">{t("cart.enter")}</Link>
          </Button>
        </section>
        <section className="mx-auto max-w-[1400px] px-6 pb-24 md:px-14">
          <CartRecommendations variant="empty-cart" title="Deine DNA · Vorschläge" limit={3} />
        </section>
      </PalaceLayout>
    );
  }

  // Jedes Haus wickelt seine Zahlung über sein eigenes Stripe-Konto ab — darum wird der
  // Warenkorb nach Haus gruppiert und je Haus eine eigene Kasse geöffnet.
  const houses = Array.from(
    items.reduce((map, i) => {
      const key = i.product.designerSlug || i.product.designer;
      const entry = map.get(key) ?? { key, name: i.product.designer, subtotal: 0, count: 0 };
      entry.subtotal += i.product.price * i.qty;
      entry.count += i.qty;
      map.set(key, entry);
      return map;
    }, new Map<string, { key: string; name: string; subtotal: number; count: number }>()).values(),
  );


  return (
    <PalaceLayout>
      <div className="mx-auto max-w-[1400px] px-6 pt-32 md:px-14 md:pt-36">
        <p className="palace-eyebrow">{t("cart.bag")} · {count} {count === 1 ? "Stück" : "Stücke"}</p>
        <h1
          className="palace-serif mt-6 font-light text-[#000000]"
          style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", lineHeight: 0.98, letterSpacing: "-0.02em" }}
        >
          {t("cart.bagHeading")}
        </h1>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <ul className="divide-y divide-[rgba(0,0,0,.18)] border-y border-[rgba(0,0,0,.18)]">
            {items.map((i) => {
              const max = limits[i.product.slug];
              const atCap = max !== undefined && Number.isFinite(max) && i.qty >= max;
              return (
                <li key={i.product.id + i.size} className="grid grid-cols-[110px_1fr_auto] items-start gap-6 py-6 md:grid-cols-[140px_1fr_auto]">
                  <ProductImage seed={i.product.slug} className="aspect-[3/4] w-full" />
                  <div>
                    <p className="palace-eyebrow">{i.product.designer}</p>
                    <Link to={`/product/${i.product.slug}`} className="palace-serif mt-2 block text-[1.4rem] italic text-[#000000] hover:underline">
                      {i.product.name}
                    </Link>
                    <p className="mt-1 text-[0.85rem] text-black/70">{t("cart.size")} {i.size}</p>
                    {max !== undefined && Number.isFinite(max) && (
                      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.28em] text-black/50">
                        {max === 0 ? t("cart.outOfStock") : t("cart.inStock", { n: max })}
                      </p>
                    )}
                    <div className="mt-4 inline-flex items-center border border-[rgba(0,0,0,.28)] bg-white">
                      <button className="px-3 py-1.5 text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"
                        onClick={() => setQty(i.product.id, i.size, i.qty - 1)} aria-label={t("cart.less")}>
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-3 text-[0.95rem] tabular-nums text-[#000000]">{i.qty}</span>
                      <button className="px-3 py-1.5 text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF] disabled:opacity-30"
                        disabled={atCap}
                        onClick={() => tryIncrement(i.product.slug, i.qty, i.product.id, i.size)} aria-label={t("cart.more")}>
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="palace-serif italic text-[1.15rem] tabular-nums text-[#000000]">{formatPrice(i.product.price * i.qty, locale)}</p>
                    <button onClick={() => remove(i.product.id, i.size)}
                      className="mt-3 inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.28em] text-black/70 hover:text-[#000000]">
                      <X className="h-3 w-3" /> {t("cart.remove")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="h-fit space-y-6">
            {impact.dominant && (
              <div className="border border-[rgba(0,0,0,.18)] bg-white p-6">
                <p className="palace-eyebrow">Beobachtung</p>
                <p className="mt-2 t-display-sm">{`Diese Auswahl schärft dein ${impact.dominantLabel}.`}</p>
                <p className="mt-3 text-[0.8rem] leading-relaxed text-black/70">
                  {`+${impact.delta} Punkte auf deine ${impact.dominantLabel.toLowerCase()}-Signatur — deine nächste DNA-Lesung nimmt das auf.`}
                </p>
              </div>
            )}
            {houses.length > 1 && (
              <p className="border border-[rgba(0,0,0,.18)] bg-white px-6 py-4 text-[0.85rem] leading-relaxed text-black/70">
                Jedes Haus verkauft selbst — darum eine Zahlung pro Haus. Was du nicht bezahlst, bleibt im Warenkorb liegen.
              </p>
            )}
            {houses.map((house) => (
              <div key={house.key} className="border border-[rgba(0,0,0,.18)] bg-white">
                <div className="border-b border-[rgba(0,0,0,.14)] px-6 py-4">
                  <p className="palace-eyebrow">{house.name || "Bestellung"}</p>
                </div>
                <div className="p-6 md:p-8">
                  <dl className="space-y-3 text-[0.95rem] text-[#000000]">
                    <Row label={t("cart.subtotal")} value={formatPrice(house.subtotal, locale)} />
                    <Row label={t("cart.shipping")} value={<span className="text-[0.8rem] text-black/70">wird beim Bezahlen berechnet</span>} />
                  </dl>
                  <Button asChild variant="editorial" size="chip" className="mt-8 w-full justify-center border-black bg-black text-white hover:bg-white hover:text-black">
                    <Link to={`/checkout?haus=${encodeURIComponent(house.key)}`}>
                      {houses.length > 1 ? "Bei diesem Haus kaufen" : t("cart.checkoutExpress")}
                    </Link>
                  </Button>
                  <PaymentLogos className="mt-4" />
                  <p className="mt-3 flex items-center justify-center gap-2 text-[0.75rem] text-black/70">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#000000]" /> {t("cart.securePayment")}
                  </p>
                </div>
              </div>
            ))}

          </aside>
        </div>

        <CartRecommendations variant="in-cart" title="Passt dazu" limit={3} />
        <div className="h-24" />
      </div>
    </PalaceLayout>
  );
};

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export default Cart;
