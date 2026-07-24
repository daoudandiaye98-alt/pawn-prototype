// Stripe webhook: marks orders paid + emits order.placed event + notifies designers.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

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
    if (whSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(raw, sig, whSecret);
    } else {
      // Development mode: accept unsigned events
      event = JSON.parse(raw) as Stripe.Event;
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Credits nachgekauft (Teil 11a) — Gutschrift direkt anhand der Session-Metadaten, unabhängig
      // von der orders-Tabelle (die ist für Marktplatz-Käufe mit Produkt-Slugs gedacht).
      const meta = session.metadata as Record<string, string> | null;
      if (meta?.kind === "credits" && meta.designer_id) {
        const creditsAmount = parseInt(meta.credits ?? "0", 10);
        if (creditsAmount > 0) {
          try { await admin.rpc("grant_credits", { _designer_id: meta.designer_id, _credits: creditsAmount, _note: "kauf" }); } catch { /* best effort */ }
        }
      }

      const { data: order } = await admin.from("orders")
        .update({ status: "paid" }).eq("stripe_session_id", session.id).select().maybeSingle();

      if (order) {
        await admin.from("domain_events").insert({
          id: crypto.randomUUID(), type: "order.placed", actor: order.user_id ?? "anon",
          payload: { order_id: order.id, amount: order.amount_total, currency: order.currency },
          schema_version: 1,
        });
        // Notify related designers + decrement stock (best-effort based on product slugs in items)
        try {
          const items = (order.items as { slug?: string; qty?: number }[] ?? []);
          const slugs = items.map((i) => i.slug).filter(Boolean) as string[];
          if (slugs.length) {
            const { data: prods } = await admin.from("products").select("id, designer_id, name, slug, inventory_mode").in("slug", slugs);
            // Decrement stock per line item
            for (const item of items) {
              const prod = (prods ?? []).find((p) => p.slug === item.slug);
              if (!prod || prod.inventory_mode !== "stock") continue;
              await admin.rpc("decrement_stock_for_order", { _product_id: prod.id, _qty: Math.max(1, item.qty ?? 1) });
            }
            const designerIds = Array.from(new Set((prods ?? []).map((p) => p.designer_id).filter(Boolean)));
            if (designerIds.length) {
              const { data: designers } = await admin.from("designers").select("user_id, brand_name").in("id", designerIds);
              for (const d of designers ?? []) {
                if (!d.user_id) continue;
                await admin.from("notifications").insert({
                  user_id: d.user_id, type: "order.received",
                  title: "Ein Stück fand ein Zuhause.",
                  body: `Eine Bestellung mit einem deiner Werke ist eingegangen.`,
                  link: "/studio/bestellungen",
                });
              }
            }
          }
        } catch { /* best effort */ }
      }
    } else if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
      const session = event.data.object as { id?: string };
      if (session.id) await admin.from("orders").update({ status: "failed" }).eq("stripe_session_id", session.id);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription & { metadata?: Record<string, string> };
      const plan = (sub.metadata?.plan ?? "").toLowerCase();
      const user_id = sub.metadata?.user_id;
      const cancelled = event.type === "customer.subscription.deleted" || sub.status === "canceled" || sub.status === "incomplete_expired";
      const targetPlan = cancelled ? "haus" : (plan === "atelier" || plan === "maison" ? plan : null);
      if (user_id && targetPlan) {
        const { data: designer } = await admin.from("designers").update({ plan: targetPlan }).eq("user_id", user_id).select("id, user_id").maybeSingle();
        if (designer) {
          await admin.from("notifications").insert({
            user_id: designer.user_id,
            type: "plan.updated",
            title: cancelled ? "Dein Plan wurde beendet." : `Willkommen im Plan ${targetPlan}.`,
            body: cancelled ? "Du bist zurück im Haus-Plan." : "Deine neuen Kontingente sind sofort aktiv.",
            link: "/studio/plan",
          });
          await admin.from("domain_events").insert({
            id: crypto.randomUUID(), type: cancelled ? "plan.downgraded" : "plan.upgraded",
            actor: user_id, payload: { plan: targetPlan, subscription_id: sub.id }, schema_version: 1,
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 400 });
  }
});
