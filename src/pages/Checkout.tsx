import { useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useCart } from "@/store/cart";
import { useCommand, selectors } from "@/core";
import * as commands from "@/core/commands";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const METHODS = [
  { key: "card", label: "Kreditkarte" },
  { key: "paypal", label: "PayPal" },
  { key: "apple", label: "Apple Pay" },
  { key: "klarna", label: "Klarna" },
] as const;

type MethodKey = typeof METHODS[number]["key"];

const Checkout = () => {
  const { items, subtotal } = useCart();
  const dispatch = useCommand();
  const { user, profile } = useAuth();
  const [method, setMethod] = useState<MethodKey>("card");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [done, setDone] = useState(false);

  const shipping = 25;

  async function placeOrderHandler(e: React.FormEvent) {
    e.preventDefault();
    const label = [firstName, lastName].filter(Boolean).join(" ") || profile?.displayName || user?.email || "Gast";

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((i) => ({
            name: `${i.product.name} · ${i.size}`,
            unit_amount: Math.round(i.product.price * 100),
            qty: i.qty,
            slug: i.product.slug,
          })),
          customer_email: user?.email,
        },
      });
      if (!error && data?.url) {
        window.location.href = data.url as string;
        return;
      }
      // mixed_cart / designer_not_ready sind bewusste Sperren, kein technischer Ausfall —
      // hier NICHT auf das interne Ledger zurückfallen, sondern die Meldung zeigen.
      if (!error && (data?.error === "mixed_cart" || data?.error === "designer_not_ready")) {
        toast.error(data.message ?? "Kauf gerade nicht möglich.");
        return;
      }
      if (error) toast.message("Zahlung wird gerade eingerichtet — deine Bestellung wird direkt vermerkt.");
    } catch { /* fall through to internal ledger */ }

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
    if (result.ok === false) { toast.error(result.reason); return; }
    setDone(true);
  }

  if (done) {
    return (
      <PalaceLayout>
        <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-32 text-center md:px-14">
          <p className="palace-eyebrow">Danke</p>
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Bestellung bestätigt.
          </h1>
          <p className="mx-auto mt-8 max-w-md font-serif italic text-[1.05rem] text-[#000000]/70">
            Das Haus wurde benachrichtigt und bereitet deine Bestellung vor.
          </p>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            <Link to="/account" className="palace-btn">Deine Sammlung</Link>
            <Link to="/" className="palace-btn">Weiter entdecken</Link>
          </div>
        </section>
      </PalaceLayout>
    );
  }

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[1400px] px-6 pt-36 pb-24 md:px-14 md:pt-44">
        <p className="palace-eyebrow">Kasse · Prototyp</p>
        <h1
          className="palace-serif mt-6 font-light text-[#000000]"
          style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
        >
          Zur <span className="italic">Kasse.</span>
        </h1>

        <form onSubmit={placeOrderHandler} className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            <section className="border border-[rgba(0,0,0,.16)] bg-white p-8 md:p-10">
              <p className="palace-eyebrow">Versand</p>
              <h2 className="palace-serif mt-3 text-[1.6rem] font-light text-[#000000]">Wohin?</h2>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <Field label="Vorname" value={firstName} onChange={setFirstName} />
                <Field label="Nachname" value={lastName} onChange={setLastName} />
                <Field label="E-Mail" type="email" className="col-span-2" />
                <Field label="Adresse" className="col-span-2" />
                <Field label="Stadt" />
                <Field label="Postleitzahl" />
                <Field label="Land" className="col-span-2" />
              </div>
            </section>

            <section className="border border-[rgba(0,0,0,.16)] bg-white p-8 md:p-10">
              <p className="palace-eyebrow">Zahlung</p>
              <h2 className="palace-serif mt-3 text-[1.6rem] font-light text-[#000000]">Wie?</h2>
              <p className="mt-2 text-[0.62rem] uppercase tracking-[0.28em] text-[#7C7972]">
                Keine echte Zahlung — Prototyp.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                {METHODS.map((m) => (
                  <button
                    type="button"
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={
                      m.key === method
                        ? "border border-[#000000] bg-[#000000] p-4 text-left text-[0.6rem] uppercase tracking-[0.28em] text-[#FFFFFF]"
                        : "border border-[rgba(0,0,0,.22)] p-4 text-left text-[0.6rem] uppercase tracking-[0.28em] text-[#000000] transition-colors hover:border-[#000000]"
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit border border-[rgba(0,0,0,.28)] bg-white p-8 md:p-10">
            <p className="palace-eyebrow">Zusammenfassung</p>
            <h2 className="palace-serif mt-3 text-[1.6rem] font-light text-[#000000]">Deine Bestellung</h2>
            <ul className="mt-6 divide-y divide-[rgba(0,0,0,.18)] text-sm">
              {items.map((i) => (
                <li key={i.product.id + i.size} className="flex items-start justify-between py-3">
                  <div>
                    <p className="text-[#000000]">{i.product.name}</p>
                    <p className="palace-eyebrow mt-1 text-[#7C7972]">{i.product.designer} · {i.size} · ×{i.qty}</p>
                  </div>
                  <span className="tabular-nums text-[#000000]">€{(i.product.price * i.qty).toLocaleString("de-DE")}</span>
                </li>
              ))}
              {items.length === 0 && (
                <li className="py-6 text-center font-serif italic text-[#000000]/60">Dein Warenkorb ist leer.</li>
              )}
            </ul>
            <div className="my-5 h-px w-full bg-[rgba(0,0,0,.18)]" />
            <dl className="space-y-2 text-sm text-[#000000]">
              <div className="flex justify-between"><dt className="text-[#55534E]">Zwischensumme</dt><dd className="tabular-nums">€{subtotal.toLocaleString("de-DE")}</dd></div>
              <div className="flex justify-between"><dt className="text-[#55534E]">Versand</dt><dd className="tabular-nums">€{shipping}</dd></div>
              <div className="flex justify-between pt-3 palace-serif text-[1.15rem]"><dt>Gesamt</dt><dd className="tabular-nums">€{(subtotal + shipping).toLocaleString("de-DE")}</dd></div>
            </dl>
            <button
              type="submit"
              className="mt-8 w-full border border-[#000000] bg-[#000000] px-6 py-4 text-[0.7rem] uppercase tracking-[0.32em] text-[#FFFFFF] transition-colors hover:bg-transparent hover:text-[#000000] disabled:opacity-40"
              disabled={items.length === 0}
            >
              Jetzt bezahlen
            </button>
            <p className="mt-4 text-center text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">
              Verschlüsselt · nur zur Vorschau
            </p>
          </aside>
        </form>
      </section>
    </PalaceLayout>
  );
};

function Field({ label, type = "text", className, value, onChange }: { label: string; type?: string; className?: string; value?: string; onChange?: (v: string) => void }) {
  return (
    <label className={`space-y-2 ${className ?? ""}`}>
      <span className="palace-eyebrow text-[#55534E]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-2 block w-full border border-[rgba(0,0,0,.22)] bg-transparent px-3 py-2.5 text-sm text-[#000000] focus:border-[#000000] focus:outline-none"
      />
    </label>
  );
}

export default Checkout;
