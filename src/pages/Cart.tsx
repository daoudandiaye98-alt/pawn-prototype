import { Link } from "react-router-dom";
import { Minus, Plus, X, ShieldCheck, Sparkles } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/pawn/ProductImage";
import { useCart } from "@/store/cart";
import { useCartWardrobeImpact } from "@/features/dna/hooks";

const Cart = () => {
  const { items, setQty, remove, subtotal, count } = useCart();
  const impact = useCartWardrobeImpact(items.map((i) => i.product.id));

  if (items.length === 0) {
    return (
      <PublicLayout>
        <section className="editorial-container py-32 text-center">
          <p className="editorial-eyebrow">Your bag</p>
          <h1 className="mt-3 font-serif text-5xl md:text-6xl">An empty stage.</h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">Nothing here yet. The boutique is waiting.</p>
          <Button asChild className="mt-8 rounded-none">
            <Link to="/shop">Enter the boutique</Link>
          </Button>
        </section>
      </PublicLayout>
    );
  }

  const shipping = 25;

  return (
    <PublicLayout>
      <div className="editorial-container py-14">
        <p className="editorial-eyebrow">Your bag · {count} {count === 1 ? "piece" : "pieces"}</p>
        <h1 className="mt-3 font-serif text-5xl">Bag</h1>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <ul className="divide-y divide-border border-y border-border">
            {items.map((i) => (
              <li key={i.product.id + i.size} className="grid grid-cols-[120px_1fr_auto] items-start gap-6 py-6">
                <ProductImage seed={i.product.slug} className="aspect-[3/4] w-[120px]" />
                <div>
                  <p className="editorial-eyebrow">{i.product.designer}</p>
                  <Link to={`/product/${i.product.slug}`} className="mt-1 block font-serif text-2xl hover:underline">
                    {i.product.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">Size {i.size}</p>
                  <div className="mt-4 inline-flex items-center border border-border">
                    <button
                      className="px-2 py-1 hover:bg-secondary"
                      onClick={() => setQty(i.product.id, i.size, i.qty - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-3 text-sm tabular-nums">{i.qty}</span>
                    <button
                      className="px-2 py-1 hover:bg-secondary"
                      onClick={() => setQty(i.product.id, i.size, i.qty + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">€{(i.product.price * i.qty).toLocaleString("de-DE")}</p>
                  <button
                    onClick={() => remove(i.product.id, i.size)}
                    className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit space-y-6">
            {impact.dominant && (
              <div className="border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <p className="editorial-eyebrow">Wardrobe impact</p>
                </div>
                <p className="mt-3 font-serif text-2xl leading-tight">
                  This bag pushes you toward <span className="italic">{impact.dominantLabel}</span>.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dominant axis · +{impact.delta} pts to your {impact.dominantLabel.toLowerCase()} signature.
                </p>
              </div>
            )}
            <div className="border border-border bg-card p-8">
              <h2 className="font-serif text-2xl">Order summary</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <Row label="Subtotal" value={`€${subtotal.toLocaleString("de-DE")}`} />
                <Row label="Shipping" value={`€${shipping}`} />
                <div className="editorial-rule my-3" />
                <Row label={<span className="font-serif text-lg">Total</span>} value={<span className="font-serif text-lg">€{(subtotal + shipping).toLocaleString("de-DE")}</span>} />
              </dl>
              <Button asChild size="lg" className="mt-8 w-full rounded-none">
                <Link to="/checkout">Proceed to checkout</Link>
              </Button>
              <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Secure payment · encrypted checkout
              </p>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
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
