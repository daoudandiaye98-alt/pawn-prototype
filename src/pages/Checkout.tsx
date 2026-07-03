import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PawnMark } from "@/components/pawn/PawnMark";
import { useCart } from "@/store/cart";
import { useCommand, selectors } from "@/core";
import * as commands from "@/core/commands";
import { useAuth } from "@/lib/auth";
import { useRank, usePieceShadow } from "@/features/narrative/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const METHODS = ["Credit Card", "PayPal", "Apple Pay", "Klarna"] as const;

const Checkout = () => {
  const { items, subtotal } = useCart();
  const dispatch = useCommand();
  const { user, profile } = useAuth();
  const rank = useRank();
  const shadow = usePieceShadow();
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
    if (result.ok === false) {
      toast.error(result.reason);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <PublicLayout>
        <section className="editorial-container flex min-h-[70vh] flex-col items-center justify-center py-32 text-center">
          <p className="editorial-eyebrow text-muted-foreground">Ein einzelner Satz</p>
          <h1 className="mt-8 font-serif text-6xl italic leading-[1.05] md:text-7xl">
            Es gehört jetzt dir.
          </h1>
          <div className="mt-16 h-px w-24 bg-foreground/25" />
          <div className="mt-16 flex justify-center gap-8 text-[0.65rem] uppercase tracking-[0.3em]">
            <Link to="/account" className="border-b border-foreground pb-1">Deine Sammlung</Link>
            <Link to="/shop" className="text-muted-foreground hover:text-foreground">Weiter sehen</Link>
          </div>
        </section>
      </PublicLayout>
    );
  }


  return (
    <PublicLayout>
      <div className="editorial-container py-14">
        <p className="editorial-eyebrow">Checkout · Prototype</p>
        <h1 className="mt-3 font-serif text-5xl">Checkout</h1>

        <form onSubmit={placeOrderHandler} className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section className="border border-border bg-card p-8">
              <h2 className="font-serif text-2xl">Shipping</h2>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <FieldL label="First name" value={firstName} onChange={setFirstName} />
                <FieldL label="Last name" value={lastName} onChange={setLastName} />
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

          <aside className="h-fit border border-[hsl(var(--border-strong))] bg-card p-8">
            <p className="t-eyebrow">Summary</p>
            <h2 className="mt-1 t-display-sm">Your order</h2>
            <ul className="mt-6 divide-y divide-[hsl(var(--border))] text-sm">
              {items.map((i) => (
                <li key={i.product.id + i.size} className="flex items-start justify-between py-3">
                  <div>
                    <p>{i.product.name}</p>
                    <p className="t-eyebrow mt-0.5">{i.product.designer} · {i.size} · ×{i.qty}</p>
                  </div>
                  <span className="tabular-nums">€{(i.product.price * i.qty).toLocaleString("de-DE")}</span>
                </li>
              ))}
            </ul>
            <div className="editorial-rule my-4" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">€{subtotal.toLocaleString("de-DE")}</dd></div>
              <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">€{shipping}</dd></div>
              <div className="flex justify-between pt-2 t-display-sm"><dt>Total</dt><dd className="tabular-nums">€{(subtotal + shipping).toLocaleString("de-DE")}</dd></div>
            </dl>
            <Button type="submit" size="lg" className="mt-8 w-full rounded-none bg-[hsl(var(--oxblood))] uppercase tracking-[0.18em] text-[hsl(var(--accent-foreground))] hover:opacity-90" disabled={items.length === 0}>
              Pay now (simulated)
            </Button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--oxblood))]" /> Encrypted, prototype-only
            </p>
          </aside>
        </form>
      </div>
    </PublicLayout>
  );
};

function FieldL({ label, type = "text", className, value, onChange }: { label: string; type?: string; className?: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="editorial-eyebrow">{label}</Label>
      <Input type={type} className="rounded-none" value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />
    </div>
  );
}

export default Checkout;
