// Erstattungen und Rückbuchungen — eine gemeinsame Wahrheit für beide Webhooks.
// Regel (PART 46): Ein bei Stripe abonniertes Ereignis wird behandelt, nicht verschwiegen.
// Erstattungen sind Normalbetrieb; wird `charge.refunded` verschluckt, gilt eine Bestellung
// bei uns weiter als bezahlt und die Plattformgebühr steht falsch in der Bilanz.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@14";

export interface ErstattungsErgebnis {
  order_id: string | null;
  refunded_amount_cents: number;
  voll: boolean;
  gebuehr_erstattet_cents: number;
  gebuehr_offen_cents: number;
  hinweis: string | null;
}

interface OrderRow {
  id: string;
  amount_total: number | null;
  application_fee_cents: number | null;
  refunded_amount_cents: number | null;
  application_fee_refunded_cents: number | null;
}

async function orderByCharge(admin: SupabaseClient, piId: string | null, chargeId: string | null): Promise<OrderRow | null> {
  const felder = "id, amount_total, application_fee_cents, refunded_amount_cents, application_fee_refunded_cents";
  if (piId) {
    const { data } = await admin.from("orders").select(felder).eq("stripe_payment_intent_id", piId).maybeSingle();
    if (data) return data as OrderRow;
  }
  if (chargeId) {
    const { data } = await admin.from("orders").select(felder).eq("stripe_charge_id", chargeId).maybeSingle();
    if (data) return data as OrderRow;
  }
  return null;
}

export function idVon(ref: string | { id?: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id ?? null;
}

/**
 * Schreibt eine Erstattung fort. Stripe liefert in `amount_refunded` immer die
 * Gesamtsumme aller Erstattungen dieser Zahlung — Teilerstattungen werden also
 * nicht addiert, sondern als neuer Höchststand übernommen (nie kleiner werdend).
 * Die Plattformgebühr wird anteilig zurückgegeben: Stripe erstattet die
 * Application Fee NICHT automatisch, das muss ausdrücklich passieren.
 */
export async function handleChargeRefunded(
  admin: SupabaseClient,
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<ErstattungsErgebnis> {
  const piId = idVon(charge.payment_intent as string | { id?: string } | null);
  const order = await orderByCharge(admin, piId, charge.id ?? null);
  const gesamtErstattet = charge.amount_refunded ?? 0;
  const gesamtBetrag = charge.amount ?? 0;
  const voll = gesamtBetrag > 0 && gesamtErstattet >= gesamtBetrag;

  if (!order) {
    return { order_id: null, refunded_amount_cents: gesamtErstattet, voll, gebuehr_erstattet_cents: 0, gebuehr_offen_cents: 0, hinweis: "Keine passende Bestellung gefunden." };
  }

  const bisher = order.refunded_amount_cents ?? 0;
  const neu = Math.max(bisher, gesamtErstattet);

  // Anteilige Plattformgebühr: bei Vollerstattung die ganze Gebühr, sonst pro rata.
  const gebuehr = order.application_fee_cents ?? 0;
  const gebuehrBisher = order.application_fee_refunded_cents ?? 0;
  const basis = gesamtBetrag || order.amount_total || 0;
  const gebuehrSoll = gebuehr > 0 && basis > 0
    ? (voll ? gebuehr : Math.min(gebuehr, Math.round(gebuehr * (neu / basis))))
    : 0;
  let gebuehrOffen = Math.max(0, gebuehrSoll - gebuehrBisher);
  let gebuehrErstattet = gebuehrBisher;
  let hinweis: string | null = null;

  const feeId = idVon((charge as unknown as { application_fee?: string | { id?: string } }).application_fee ?? null);
  if (gebuehrOffen > 0) {
    if (!feeId) {
      hinweis = `Plattformgebühr von ${(gebuehrOffen / 100).toFixed(2)} € noch offen — Stripe meldet keine application_fee zu dieser Zahlung.`;
    } else {
      try {
        await stripe.applicationFees.createRefund(feeId, { amount: gebuehrOffen });
        gebuehrErstattet += gebuehrOffen;
        gebuehrOffen = 0;
      } catch (e) {
        hinweis = `Rückgabe der Plattformgebühr fehlgeschlagen: ${(e as Error).message}`;
        console.error("[erstattung] fee refund failed:", (e as Error).message);
      }
    }
  }

  await admin.from("orders").update({
    refunded_amount_cents: neu,
    refunded_at: new Date().toISOString(),
    stripe_charge_id: charge.id ?? null,
    application_fee_refunded_cents: gebuehrErstattet,
    ...(voll ? { status: "refunded" } : {}),
  }).eq("id", order.id);

  return { order_id: order.id, refunded_amount_cents: neu, voll, gebuehr_erstattet_cents: gebuehrErstattet, gebuehr_offen_cents: gebuehrOffen, hinweis };
}

/** Rückbuchung: Status und Zeitpunkt festhalten, damit der Vorgang nachvollziehbar bleibt. */
export async function handleDispute(
  admin: SupabaseClient,
  dispute: Stripe.Dispute,
): Promise<string | null> {
  const piId = idVon(dispute.payment_intent as string | { id?: string } | null);
  const chargeId = idVon(dispute.charge as string | { id?: string } | null);
  const order = await orderByCharge(admin, piId, chargeId);
  if (!order) return null;
  await admin.from("orders").update({
    dispute_status: dispute.status,
    dispute_updated_at: new Date().toISOString(),
    ...(chargeId ? { stripe_charge_id: chargeId } : {}),
  }).eq("id", order.id);
  return order.id;
}
