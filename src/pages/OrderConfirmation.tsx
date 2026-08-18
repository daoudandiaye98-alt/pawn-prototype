import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { supabase } from "@/integrations/supabase/client";
import { readReferralCode, clearReferralCode } from "@/features/referral";

/**
 * Die Bestellzeile zu dieser Sitzung suchen.
 *
 * **Warum überhaupt, und nicht nur fürs Empfehlungsguthaben.** Diese Seite sagte
 * „Deine Bestellung ist eingegangen", ohne je in die Datenbank zu sehen — sie
 * sagte es allein deshalb, weil Stripe hierher zurückgeleitet hat. Das ist die
 * Sorte grüne Meldung, die einen Fehler zudeckt statt ihn zu zeigen. Seit X9
 * wird nachgesehen und das Ergebnis benannt.
 *
 * `create-checkout` legt die Zeile mit `status: "pending"` an, BEVOR es
 * umleitet, und trägt danach die Sitzungsnummer nach; auf `paid` setzt sie erst
 * der Webhook. Zwischen Rückkehr und Webhook liegen Sekunden — deshalb ein paar
 * kurze Versuche statt eines einzigen Blicks.
 *
 * Findet die Abfrage nichts, heißt das NICHT „kein Kauf": ein Gast ohne Konto
 * darf die Zeile womöglich gar nicht lesen. Dieser Fall wird unten als das
 * benannt, was er ist — ungewiss —, und nicht als Erfolg ausgegeben.
 */
type Bestellstand = { id: string; status: string } | "unbekannt";

async function findeBestellung(sessionId: string): Promise<Bestellstand> {
  let letzte: { id: string; status: string } | null = null;
  for (let versuch = 0; versuch < 5; versuch++) {
    const { data } = await supabase
      .from("orders").select("id, status").eq("stripe_session_id", sessionId).maybeSingle();
    if (data) {
      letzte = data as { id: string; status: string };
      if (letzte.status === "paid") return letzte;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return letzte ?? "unbekannt";
}

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const houseKey = params.get("haus");
  const cart = useCart();
  const tried = useRef(false);
  /* `null` = wird noch nachgesehen. Kein Vorab-Erfolg, kein Vorab-Fehler. */
  const [bestellung, setBestellung] = useState<Bestellstand | null>(null);
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
    tried.current = true;
    (async () => {
      const stand = await findeBestellung(sessionId);
      setBestellung(stand);

      /* Teil 17d — das Empfehlungsguthaben. `grant_referral_credit` prüft
         serverseitig alles Sicherheitsrelevante (bezahlt, kein Selbstkauf, erste
         Bestellung); hier wird nichts vorausgesetzt, nur versucht. */
      const refCode = readReferralCode();
      if (!refCode || stand === "unbekannt" || stand.status !== "paid") return;
      const { data } = await supabase.rpc("grant_referral_credit" as never, { p_order_id: stand.id, p_ref_code: refCode } as never);
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
        {/*
          Was WIRKLICH in der Datenbank steht — kein Ersatz für die Zeile, aber
          ihr Abbild. Drei ehrliche Zustände statt einer pauschalen Zusage:

            bezahlt   → die Bestellnummer, die auch das Haus sieht
            angelegt  → die Zahlung ist noch nicht bestätigt, das steht da
            ungewiss  → wir konnten nicht nachsehen; dann wird nichts behauptet
        */}
        {bestellung === null ? (
          <p className="palace-eyebrow mt-10 text-black/60">Wir sehen kurz nach…</p>
        ) : bestellung === "unbekannt" ? (
          <p className="mx-auto mt-10 max-w-md text-[0.9rem] leading-relaxed text-[#000000]/70">
            Deine Bestellnummer liegt in deinem Konto. Ohne Anmeldung können wir sie hier nicht
            anzeigen — die Bestätigung per E-Mail trägt sie.
          </p>
        ) : bestellung.status === "paid" ? (
          <p className="palace-eyebrow mt-10 text-black/60">
            Bestellung · {bestellung.id.slice(0, 8)}
          </p>
        ) : (
          <p className="mx-auto mt-10 max-w-md text-[0.9rem] leading-relaxed text-[#000000]/70">
            Deine Bestellung ist angelegt (· {bestellung.id.slice(0, 8)}). Die Zahlung wird noch
            bestätigt; das dauert meist nur Sekunden.
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
