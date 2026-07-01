import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/store/cart";
import { useCommand, selectors } from "@/core";
import * as commands from "@/core/commands";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const METHODS = ["Credit Card", "PayPal", "Apple Pay", "Klarna"] as const;

const Checkout = () => {
  const { items, subtotal } = useCart();
  const dispatch = useCommand();
  const { user, profile } = useAuth();
  const [method, setMethod] = useState<typeof METHODS[number]>("Credit Card");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [done, setDone] = useState(false);

  const shipping = 25;

  function placeOrderHandler(e: React.FormEvent) {
    e.preventDefault();
    const label = [firstName, lastName].filter(Boolean).join(" ") || profile?.displayName || user?.email || "Guest";
    const result = dispatch(commands.placeOrder, {
      identityId: selectors.defaultIdentityId,
      customerLabel: label,
      items: items.map((i) => ({
        productId: i.product.id as never,
        size: i.size,
        qty: i.qty,
        unitPrice: i.product.price,
      })),
      total: subtotal + shipping,
    });
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <PublicLayout>
        <section className="editorial-container py-32 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border border-accent text-accent">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-6 font-serif text-5xl">Order placed.</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            This is a prototype confirmation. A real PAWN order will arrive insured and tracked.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild className="rounded-none"><Link to="/account">View my orders</Link></Button>
            <Button asChild variant="outline" className="rounded-none"><Link to="/shop">Continue browsing</Link></Button>
          </div>
        </section>
      </PublicLayout>
    );
  }

  const shipping = 25;

  return (
    <PublicLayout>
      <div className="editorial-container py-14">
        <p className="editorial-eyebrow">Checkout · Prototype</p>
        <h1 className="mt-3 font-serif text-5xl">Checkout</h1>

        <form onSubmit={placeOrder} className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section className="border border-border bg-card p-8">
              <h2 className="font-serif text-2xl">Shipping</h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <FieldL label="First name" />
                <FieldL label="Last name" />
                <FieldL label="Email" type="email" className="col-span-2" />
                <FieldL label="Address" className="col-span-2" />
                <FieldL label="City" />
                <FieldL label="Postal code" />
                <FieldL label="Country" className="col-span-2" />
              </div>
            </section>

            <section className="border border-border bg-card p-8">
              <h2 className="font-serif text-2xl">Payment</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">No real payment is processed.</p>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {METHODS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn(
                      "border p-4 text-left text-sm uppercase tracking-[0.18em]",
                      m === method ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit border border-border bg-card p-8">
            <h2 className="font-serif text-2xl">Summary</h2>
            <ul className="mt-6 divide-y divide-border text-sm">
              {items.map((i) => (
                <li key={i.product.id + i.size} className="flex items-start justify-between py-3">
                  <div>
                    <p>{i.product.name}</p>
                    <p className="text-xs text-muted-foreground">{i.product.designer} · {i.size} · ×{i.qty}</p>
                  </div>
                  <span className="tabular-nums">€{(i.product.price * i.qty).toLocaleString("de-DE")}</span>
                </li>
              ))}
            </ul>
            <div className="editorial-rule my-4" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">€{subtotal.toLocaleString("de-DE")}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">€{shipping}</dd></div>
              <div className="flex justify-between pt-2 font-serif text-lg"><dt>Total</dt><dd className="tabular-nums">€{(subtotal + shipping).toLocaleString("de-DE")}</dd></div>
            </dl>
            <Button type="submit" size="lg" className="mt-8 w-full rounded-none" disabled={items.length === 0}>
              Pay now (simulated)
            </Button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Encrypted, prototype-only
            </p>
          </aside>
        </form>
      </div>
    </PublicLayout>
  );
};

function FieldL({ label, type = "text", className }: { label: string; type?: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="editorial-eyebrow">{label}</Label>
      <Input type={type} className="rounded-none" />
    </div>
  );
}

export default Checkout;
