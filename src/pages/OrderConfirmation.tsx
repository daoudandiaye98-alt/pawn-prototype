import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { supabase } from "@/integrations/supabase/client";
import { readReferralCode, clearReferralCode } from "@/features/referral";

/**
 * Teil 17d: nach erfolgreicher Zahlung prüfen, ob ein Referral-Code gespeichert ist, und die
 * Gutschrift anstoßen. grant_referral_credit prüft serverseitig alles Sicherheitsrelevante
 * (Bestellung bezahlt, kein Selbstkauf, erste Bestellung) — hier wird nichts vorausgesetzt,
 * nur versucht. Die Bestellung landet per Webhook in der DB, das kann einen Moment dauern —
 * ein paar kurze Versuche statt eines einzigen Checks.
 */
async function findOrderId(sessionId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await supabase.from("orders").select("id, status").eq("stripe_session_id", sessionId).maybeSingle();
    if (data?.status === "paid") return data.id;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const houseKey = params.get("haus");
  const cart = useCart();
  const tried = useRef(false);
  const cleared = useRef(false);

  // Nach der Zahlung nur die Stücke des bezahlten Hauses entfernen — was noch bei anderen
  // Häusern liegt, bleibt im Warenkorb.
  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    if (!houseKey) { cart.clear(); return; }
    for (const line of cart.items) {
      if ((line.product.designerSlug || line.product.designer) === houseKey) {
        cart.remove(line.product.id, line.size);
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);


  useEffect(() => {
    if (tried.current || !sessionId) return;
    const refCode = readReferralCode();
    if (!refCode) return;
    tried.current = true;
    (async () => {
      const orderId = await findOrderId(sessionId);
      if (!orderId) return;
      const { data } = await supabase.rpc("grant_referral_credit" as never, { p_order_id: orderId, p_ref_code: refCode } as never);
      const r = data as unknown as { ok?: boolean } | null;
      if (r?.ok) clearReferralCode();
    })();
  }, [sessionId]);

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
          <p className="palace-eyebrow mt-10 text-black/60">
            Referenz · {sessionId.slice(0, 14)}
          </p>
        )}
        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="editorial" size="chip"><Link to="/account">Bestellungen ansehen</Link></Button>
          <Button asChild variant="editorial" size="chip"><Link to="/">Weiter entdecken</Link></Button>
        </div>
      </section>
    </PalaceLayout>
  );
}
