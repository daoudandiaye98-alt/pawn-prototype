import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useCart } from "@/store/cart";

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const cart = useCart();

  useEffect(() => { cart.clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <PalaceLayout>
      <section className="mx-auto max-w-2xl px-6 pt-40 pb-32 text-center md:px-14">
        <p className="palace-eyebrow">Danke</p>
        <h1 className="palace-serif mt-6 text-[clamp(2rem,4vw,3.4rem)] font-light leading-[1.02] text-[#000000]">
          Deine Bestellung ist eingegangen.
        </h1>
        <p className="mx-auto mt-8 max-w-md text-[1rem] leading-relaxed text-[#000000]/70">
          Die Designer:in wurde benachrichtigt und bereitet dein Stück vor. Du erhältst eine Bestätigung per
          E-Mail sobald es das Atelier verlässt.
        </p>
        {sessionId && (
          <p className="palace-eyebrow mt-10 text-[#7C7972]">
            Referenz · {sessionId.slice(0, 14)}
          </p>
        )}
        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/account" className="palace-btn">Bestellungen ansehen</Link>
          <Link to="/" className="palace-btn">Weiter entdecken</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
