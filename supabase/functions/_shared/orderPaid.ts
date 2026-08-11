// Gemeinsame Logik für eine bezahlte Bestellung.
// Wird von zwei Endpunkten benutzt: dem Plattform-Webhook (Häuser, die über das
// Plattformkonto verkaufen) und dem Connect-Webhook (Zahlungen, die auf dem
// Stripe-Konto des Hauses entstehen).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { schreibePartieZug } from "./partieZug.ts";

interface Address {
  line1?: string | null;
  line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface PaidSessionLike {
  id: string;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
  shipping_details?: { name?: string | null; address?: Address | null } | null;
  customer_details?: { name?: string | null; address?: Address | null } | null;
  total_details?: { amount_shipping?: number | null } | null;
}

type OrderRow = Record<string, unknown> & {
  id: string;
  user_id: string | null;
  items: unknown;
  amount_total: number;
  currency: string;
  customer_email: string | null;
  buyer_locale: string | null;
};

function paymentIntentId(session: PaidSessionLike): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : (pi.id ?? null);
}

/**
 * Markiert die Bestellung als bezahlt, speichert Lieferanschrift und Stripe-Kennungen,
 * baut Bestand ab, benachrichtigt das Haus und schickt die Bestellbestätigung.
 * Läuft idempotent: eine bereits bezahlte Bestellung wird nicht erneut verarbeitet.
 */
export async function handleOrderPaid(
  admin: SupabaseClient,
  session: PaidSessionLike,
  connectedAccountId: string | null,
): Promise<void> {
  const meta = session.metadata ?? {};
  const shipping = session.shipping_details ?? session.customer_details ?? null;
  const addr = shipping?.address ?? null;

  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: paymentIntentId(session),
    ...(connectedAccountId ? { connected_account_id: connectedAccountId } : {}),
    ...(shipping
      ? {
          shipping_name: shipping.name ?? null,
          shipping_address_line1: addr?.line1 ?? null,
          shipping_address_line2: addr?.line2 ?? null,
          shipping_postal_code: addr?.postal_code ?? null,
          shipping_city: addr?.city ?? null,
          shipping_country: addr?.country ?? null,
        }
      : {}),
  };

  // Zuordnung bevorzugt über order_id aus den Metadaten (Connect-Events tragen die
  // Session-ID des verbundenen Kontos, die Bestellung kennt sie aber ebenfalls).
  let query = admin.from("orders").update(patch);
  query = meta.order_id
    ? query.eq("id", meta.order_id)
    : query.eq("stripe_session_id", session.id);

  const { data: order } = await query.neq("status", "paid").select().maybeSingle();
  if (!order) return; // unbekannt oder bereits verarbeitet

  const o = order as OrderRow;

  await admin.from("domain_events").insert({
    id: crypto.randomUUID(),
    type: "order.placed",
    actor: o.user_id ?? "anon",
    payload: { order_id: o.id, amount: o.amount_total, currency: o.currency },
    schema_version: 1,
  }).then(() => {}, () => {});

  // Bestand abbauen + Haus benachrichtigen
  try {
    const items = (o.items as { slug?: string; qty?: number }[]) ?? [];
    const slugs = items.map((i) => i.slug).filter(Boolean) as string[];
    if (slugs.length) {
      const { data: prods } = await admin.from("products")
        .select("id, designer_id, name, slug, inventory_mode").in("slug", slugs);
      for (const item of items) {
        const prod = (prods ?? []).find((p) => p.slug === item.slug);
        if (!prod || prod.inventory_mode !== "stock") continue;
        await admin.rpc("decrement_stock_for_order", { _product_id: prod.id, _qty: Math.max(1, item.qty ?? 1) });
      }
      const designerIds = Array.from(new Set((prods ?? []).map((p) => p.designer_id).filter(Boolean)));
      if (designerIds.length) {
        const { data: designers } = await admin.from("designers").select("id, user_id").in("id", designerIds);
        for (const d of designers ?? []) {
          if (!d.user_id) continue;
          await admin.from("notifications").insert({
            user_id: d.user_id,
            type: "order.received",
            title: "Ein Stück fand ein Zuhause.",
            body: "Eine Bestellung mit einem deiner Werke ist eingegangen.",
            link: "/studio/bestellungen",
          });
          // Teil 28c: die Halle trägt den Verkauf ins Partie-Buch ein.
          await schreibePartieZug(admin, d.id, "Ein Stück wurde verkauft.", "halle", "verkauf");
        }
      }
    }
  } catch { /* best effort */ }

  // Bestellbestätigung — E-Mail-Fehler dürfen die Bestellung nie anfassen.
  if (o.customer_email) {
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("Kein RESEND_API_KEY hinterlegt.");
      const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
      const cfgv = (cfg?.value ?? {}) as { email_from?: string; email_reply_to?: string };
      const fromAddr = cfgv.email_from || "PAWN <hallo@pawn.vision>";
      const replyTo = cfgv.email_reply_to || "pawnstudio.co@gmail.com";
      const locale = o.buyer_locale === "en" ? "en" : "de";
      const subject = locale === "en" ? "Your PAWN order is confirmed" : "Deine PAWN-Bestellung ist bestätigt";
      const text = locale === "en"
        ? `Thank you — your order (€ ${(o.amount_total / 100).toFixed(2)}) is confirmed and on its way to the house that made it.\n\nYou'll hear from us again the moment it ships, with tracking and invoice attached.`
        : `Danke — deine Bestellung (€ ${(o.amount_total / 100).toFixed(2)}) ist bestätigt und geht an das Haus, das sie gemacht hat.\n\nSobald sie verschickt wird, meldest du dich — mit Sendungsnummer und Rechnung im Anhang.`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: fromAddr, to: [o.customer_email], reply_to: replyTo, subject, text }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      await admin.from("orders").update({ confirmation_email_sent_at: new Date().toISOString(), last_email_error: null }).eq("id", o.id);
    } catch (e) {
      await admin.from("orders").update({ last_email_error: (e as Error).message }).eq("id", o.id);
    }
  }
}

/** Gutschrift für nachgekaufte PAWN-Credits (läuft immer über das Plattformkonto). */
export async function handleCreditsPurchase(admin: SupabaseClient, meta: Record<string, string> | null): Promise<void> {
  if (meta?.kind !== "credits" || !meta.designer_id) return;
  const credits = parseInt(meta.credits ?? "0", 10);
  if (credits <= 0) return;
  try {
    await admin.rpc("grant_credits", { _designer_id: meta.designer_id, _credits: credits, _note: "kauf" });
  } catch { /* best effort */ }
}
