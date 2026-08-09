// Plattform-Webhook: Abos, PAWN-Credits, Konto-Status der Häuser — und Bestellungen von
// Häusern, die weiterhin über das Plattformkonto verkaufen.
// Zahlungen auf den Stripe-Konten der Häuser laufen über `stripe-webhook-connect`.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { handleOrderPaid, handleCreditsPurchase, type PaidSessionLike } from "../_shared/orderPaid.ts";
import { pickByLang } from "../_shared/locale.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret) return new Response("not_configured", { status: 503 });

    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });
    const sig = req.headers.get("stripe-signature");
    const raw = await req.text();

    let event: Stripe.Event;
    if (whSecret) {
      // Ist ein Signing Secret hinterlegt, wird jedes Ereignis geprüft — sonst könnte
      // jeder gefälschte Ereignisse (Plan-Upgrades, Gutschriften) einschleusen.
      if (!sig) return new Response("missing_signature", { status: 400 });
      event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
    } else {
      event = JSON.parse(raw) as Stripe.Event;
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCreditsPurchase(admin, session.metadata as Record<string, string> | null);
      if ((session.metadata as Record<string, string> | null)?.kind !== "credits") {
        await handleOrderPaid(admin, session as unknown as PaidSessionLike, null);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as { id?: string };
      if (session.id) await admin.from("orders").update({ status: "failed" }).eq("stripe_session_id", session.id).eq("status", "pending");
    } else if (event.type === "payment_intent.payment_failed") {
      // Bei einem PaymentIntent-Ereignis ist die ID die des Intents, nicht der Session.
      const pi = event.data.object as { id?: string };
      if (pi.id) await admin.from("orders").update({ status: "failed" }).eq("stripe_payment_intent_id", pi.id).eq("status", "pending");
    } else if (event.type === "account.updated") {
      // Konto-Status eines Hauses hat sich geändert (Nachweise eingereicht, freigeschaltet, gesperrt).
      const account = event.data.object as Stripe.Account;
      const requirements = (account.requirements ?? {}) as unknown as Record<string, unknown>;
      const { data: designer } = await admin.from("designers").update({
        stripe_charges_enabled: !!account.charges_enabled,
        stripe_details_submitted: !!account.details_submitted,
        stripe_payouts_enabled: !!account.payouts_enabled,
        stripe_requirements: requirements,
        ...(account.country ? { stripe_country: account.country } : {}),
      }).eq("stripe_account_id", account.id).select("id, user_id, stripe_charges_enabled, preferred_language").maybeSingle();

      const dueNow = (account.requirements?.currently_due ?? []) as string[];
      if (designer?.user_id && dueNow.length > 0) {
        await admin.from("notifications").insert({
          user_id: designer.user_id,
          type: "payout.requirements",
          title: pickByLang(designer.preferred_language, "Stripe braucht noch Angaben von dir.", "Stripe still needs information from you."),
          body: pickByLang(designer.preferred_language, "Ohne diese Nachweise kann dein Haus keine Zahlungen annehmen. Ein Klick führt dich hin.", "Without this evidence your house can't accept payments. One click takes you there."),
          link: "/studio/auszahlung",
        });
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription & { metadata?: Record<string, string> };
      const plan = (sub.metadata?.plan ?? "").toLowerCase();
      const user_id = sub.metadata?.user_id;
      const cancelled = event.type === "customer.subscription.deleted" || sub.status === "canceled" || sub.status === "incomplete_expired";
      // Teil 38 AP7 (Preisumbau) geprüft: create-checkout nimmt seit diesem Umbau für neue
      // Anmeldungen nur noch 'maison' (Paid) an — 'atelier' bleibt hier trotzdem ein gültiger
      // Zielwert, weil bestehende Atelier-Abos (und ein von Daouda manuell in Stripe begleiteter
      // Wechsel) weiterhin genau diese Metadaten tragen können.
      const targetPlan = cancelled ? "haus" : (plan === "atelier" || plan === "maison" ? plan : null);
      if (user_id && targetPlan) {
        const { data: designer } = await admin.from("designers").update({ plan: targetPlan }).eq("user_id", user_id).select("id, user_id, preferred_language").maybeSingle();
        if (designer) {
          await admin.from("notifications").insert({
            user_id: designer.user_id,
            type: "plan.updated",
            title: pickByLang(designer.preferred_language,
              cancelled ? "Dein Plan wurde beendet." : `Willkommen im Plan ${targetPlan}.`,
              cancelled ? "Your plan has ended." : `Welcome to the ${targetPlan} plan.`),
            body: pickByLang(designer.preferred_language,
              cancelled ? "Du bist zurück im Haus-Plan." : "Deine neuen Kontingente sind sofort aktiv.",
              cancelled ? "You're back on the Haus plan." : "Your new quotas are active immediately."),
            link: "/studio/plan",
          });
          await admin.from("domain_events").insert({
            id: crypto.randomUUID(), type: cancelled ? "plan.downgraded" : "plan.upgraded",
            actor: user_id, payload: { plan: targetPlan, subscription_id: sub.id }, schema_version: 1,
          });
          // Teil 38 AP6: ein neues Maison-Haus bekommt das Sichtbarkeits-Zug-Organ von Anfang an
          // sichtbar an (nicht nur implizit über den Rückwärtskompatibilitäts-Default) — sinnvoller
          // Onboarding-Startwert, kein Zwang (das Haus kann es in "Deine Organe" jederzeit abschalten).
          if (!cancelled && targetPlan === "maison") {
            await admin.from("designer_automations").upsert({
              designer_id: designer.id, automation_key: "sichtbarkeitszug", enabled: true,
            } as never, { onConflict: "designer_id,automation_key", ignoreDuplicates: true });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 400 });
  }
});
