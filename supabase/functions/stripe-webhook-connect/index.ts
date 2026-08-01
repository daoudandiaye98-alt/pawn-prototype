// Connect-Webhook: Ereignisse, die auf den Stripe-Konten der Häuser entstehen.
// Eigener Endpunkt mit eigenem Signing Secret (STRIPE_CONNECT_WEBHOOK_SECRET),
// weil Stripe Konto-Ereignisse getrennt von den Plattform-Ereignissen zustellt.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { handleOrderPaid, type PaidSessionLike } from "../_shared/orderPaid.ts";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return ok({ error: "not_configured" });
    const whSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");

    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });
    const sig = req.headers.get("stripe-signature");
    const raw = await req.text();

    let event: Stripe.Event;
    if (whSecret && !sig) return new Response("missing_signature", { status: 400 });
    if (whSecret && sig) {
      try {
        event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
      } catch (e) {
        console.error("[stripe-webhook-connect] signature invalid:", (e as Error).message);
        return new Response("invalid_signature", { status: 400 });
      }
    } else {
      event = JSON.parse(raw) as Stripe.Event;
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const account = (event.account as string | undefined) ?? null;

    async function orderByPaymentIntent(pi: string | null) {
      if (!pi) return null;
      const { data } = await admin.from("orders")
        .select("id, amount_total, application_fee_cents, user_id, customer_email, buyer_locale, refunded_amount_cents")
        .eq("stripe_payment_intent_id", pi).maybeSingle();
      return data;
    }

    async function notifyHouse(orderId: string, title: string, body: string) {
      const { data: order } = await admin.from("orders").select("items").eq("id", orderId).maybeSingle();
      const items = ((order?.items ?? []) as { slug?: string }[]).map((i) => i.slug).filter(Boolean) as string[];
      if (!items.length) return;
      const { data: prods } = await admin.from("products").select("designer_id").in("slug", items);
      const ids = Array.from(new Set((prods ?? []).map((p) => p.designer_id).filter(Boolean)));
      if (!ids.length) return;
      const { data: designers } = await admin.from("designers").select("user_id").in("id", ids);
      for (const d of designers ?? []) {
        if (!d.user_id) continue;
        await admin.from("notifications").insert({
          user_id: d.user_id, type: "order.payment", title, body, link: "/studio/bestellungen",
        });
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as PaidSessionLike;
        await handleOrderPaid(admin, session, account);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const charge = (pi as unknown as { latest_charge?: string | { id?: string } }).latest_charge;
        const chargeId = typeof charge === "string" ? charge : charge?.id ?? null;
        if (chargeId) {
          await admin.from("orders").update({ stripe_charge_id: chargeId }).eq("stripe_payment_intent_id", pi.id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await admin.from("orders").update({ status: "failed" })
          .eq("stripe_payment_intent_id", pi.id).eq("status", "pending");
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
        const order = await orderByPaymentIntent(piId);
        if (order) {
          const refunded = charge.amount_refunded ?? 0;
          const full = refunded >= (charge.amount ?? 0);
          await admin.from("orders").update({
            refunded_amount_cents: refunded,
            stripe_charge_id: charge.id,
            ...(full ? { status: "refunded" } : {}),
          }).eq("id", order.id);
          // Bei Vollerstattung gibt PAWN die Provision zurück — sie wird auf dem
          // Plattformkonto als Application Fee geführt und kann von dort erstattet werden.
          const feeRef = (charge as unknown as { application_fee?: string | { id?: string } }).application_fee;
          const feeId = typeof feeRef === "string" ? feeRef : feeRef?.id ?? null;
          if (full && feeId) {
            try { await stripe.applicationFees.createRefund(feeId); }
            catch (e) { console.error("[stripe-webhook-connect] fee refund failed:", (e as Error).message); }
          }
          await notifyHouse(
            order.id,
            full ? "Eine Bestellung wurde vollständig erstattet." : "Eine Bestellung wurde teilweise erstattet.",
            `Erstatteter Betrag: € ${(refunded / 100).toFixed(2)}. Details findest du in deinem Stripe-Konto.`,
          );
        }

        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
        const piId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null;
        const order = await orderByPaymentIntent(piId);
        const target = order?.id ?? null;
        if (target) {
          await admin.from("orders").update({ dispute_status: dispute.status, stripe_charge_id: chargeId }).eq("id", target);
          await notifyHouse(
            target,
            event.type === "charge.dispute.created" ? "Zu einer Bestellung gibt es eine Rückbuchung." : "Eine Rückbuchung wurde abgeschlossen.",
            "Die Zahlung läuft über das Stripe-Konto deines Hauses — Nachweise reichst du direkt in deinem Stripe-Dashboard ein.",
          );
        }
        break;
      }

      case "payout.paid":
      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        if (account) {
          const { data: designer } = await admin.from("designers").select("id, user_id").eq("stripe_account_id", account).maybeSingle();
          if (designer?.user_id) {
            await admin.from("notifications").insert({
              user_id: designer.user_id,
              type: event.type === "payout.paid" ? "payout.paid" : "payout.failed",
              title: event.type === "payout.paid" ? "Auszahlung unterwegs." : "Eine Auszahlung ist fehlgeschlagen.",
              body: `Betrag: € ${((payout.amount ?? 0) / 100).toFixed(2)}. Details in deinem Stripe-Konto.`,
              link: "/studio/auszahlung",
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return ok({ received: true });
  } catch (e) {
    // Nie 500: Stripe würde sonst endlos wiederholen. Ursache landet im Log.
    console.error("[stripe-webhook-connect] error:", e);
    return ok({ received: true, error: String((e as Error)?.message ?? e) });
  }
});
