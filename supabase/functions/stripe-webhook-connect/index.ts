// Connect-Webhook: Ereignisse, die auf den Stripe-Konten der Häuser entstehen.
// Eigener Endpunkt mit eigenem Signing Secret (STRIPE_CONNECT_WEBHOOK_SECRET),
// weil Stripe Konto-Ereignisse getrennt von den Plattform-Ereignissen zustellt.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { handleOrderPaid, type PaidSessionLike } from "../_shared/orderPaid.ts";
import { pickByLang } from "../_shared/locale.ts";
import { handleAccountUpdated } from "../_shared/accountUpdated.ts";
import { handleChargeRefunded, handleDispute } from "../_shared/erstattung.ts";


interface Bilingual { de: string; en: string }

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


    async function notifyHouse(orderId: string, title: Bilingual, body: Bilingual) {
      const { data: order } = await admin.from("orders").select("items").eq("id", orderId).maybeSingle();
      const items = ((order?.items ?? []) as { slug?: string }[]).map((i) => i.slug).filter(Boolean) as string[];
      if (!items.length) return;
      const { data: prods } = await admin.from("products").select("designer_id").in("slug", items);
      const ids = Array.from(new Set((prods ?? []).map((p) => p.designer_id).filter(Boolean)));
      if (!ids.length) return;
      const { data: designers } = await admin.from("designers").select("user_id, preferred_language").in("id", ids);
      for (const d of designers ?? []) {
        if (!d.user_id) continue;
        await admin.from("notifications").insert({
          user_id: d.user_id, type: "order.payment",
          title: pickByLang(d.preferred_language, title.de, title.en),
          body: pickByLang(d.preferred_language, body.de, body.en),
          link: "/studio/bestellungen",
        });
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as PaidSessionLike;
        await handleOrderPaid(admin, session, account);
        break;
      }

      // Der Käufer hat den Bezahlvorgang nicht abgeschlossen und Stripe hat die Sitzung
      // geschlossen. Ohne diesen Fall bleibt eine Bestellung für immer auf "wartet".
      case "checkout.session.expired": {
        const session = event.data.object as { id?: string; metadata?: Record<string, string> | null };
        const orderId = session.metadata?.order_id ?? null;
        let q = admin.from("orders").update({ status: "expired" });
        q = orderId ? q.eq("id", orderId) : q.eq("stripe_session_id", session.id ?? "");
        await q.eq("status", "pending");
        break;
      }

      // Konto-Status eines Hauses: hält Freischaltung und offene Nachweise dauerhaft aktuell.
      case "account.updated": {
        await handleAccountUpdated(admin, event.data.object as unknown as Parameters<typeof handleAccountUpdated>[1]);
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
        const erg = await handleChargeRefunded(admin, stripe, charge);
        if (erg.order_id) {
          await notifyHouse(
            erg.order_id,
            erg.voll
              ? { de: "Eine Bestellung wurde vollständig erstattet.", en: "An order was fully refunded." }
              : { de: "Eine Bestellung wurde teilweise erstattet.", en: "An order was partially refunded." },
            {
              de: `Erstatteter Betrag: € ${(erg.refunded_amount_cents / 100).toFixed(2)}. Details findest du in deinem Stripe-Konto.`,
              en: `Refunded amount: € ${(erg.refunded_amount_cents / 100).toFixed(2)}. Details are in your Stripe account.`,
            },
          );
        }
        if (erg.hinweis) console.error("[stripe-webhook-connect] Erstattung:", erg.hinweis);
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const target = await handleDispute(admin, dispute);
        if (target) {
          await notifyHouse(
            target,
            event.type === "charge.dispute.created"
              ? { de: "Zu einer Bestellung gibt es eine Rückbuchung.", en: "An order has a chargeback." }
              : { de: "Eine Rückbuchung wurde abgeschlossen.", en: "A chargeback has been resolved." },
            {
              de: "Die Zahlung läuft über das Stripe-Konto deines Hauses — Nachweise reichst du direkt in deinem Stripe-Dashboard ein.",
              en: "The payment runs through your house's Stripe account — submit evidence directly in your Stripe dashboard.",
            },
          );
        }
        break;
      }


      case "payout.paid":
      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        if (account) {
          const { data: designer } = await admin.from("designers").select("id, user_id, preferred_language").eq("stripe_account_id", account).maybeSingle();
          if (designer?.user_id) {
            await admin.from("notifications").insert({
              user_id: designer.user_id,
              type: event.type === "payout.paid" ? "payout.paid" : "payout.failed",
              title: pickByLang(designer.preferred_language,
                event.type === "payout.paid" ? "Auszahlung unterwegs." : "Eine Auszahlung ist fehlgeschlagen.",
                event.type === "payout.paid" ? "Payout on its way." : "A payout has failed."),
              body: pickByLang(designer.preferred_language,
                `Betrag: € ${((payout.amount ?? 0) / 100).toFixed(2)}. Details in deinem Stripe-Konto.`,
                `Amount: € ${((payout.amount ?? 0) / 100).toFixed(2)}. Details are in your Stripe account.`),
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
