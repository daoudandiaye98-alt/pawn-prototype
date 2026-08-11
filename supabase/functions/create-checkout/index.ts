// Stripe Checkout Session — Express-Modus mit Apple Pay / Google Pay / PayPal / Klarna / Karte.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { fehlendeVerkaufsbedingungen } from "../_shared/verkaufsbereit.ts";

interface Line { name: string; unit_amount: number; qty: number; product_id?: string; size?: string; slug?: string }
interface Body {
  items?: Line[];
  success_url?: string;
  cancel_url?: string;
  customer_email?: string;
  mode?: "payment" | "subscription" | "credits";
  price_id?: string;
  plan?: "atelier" | "maison";
  credits?: number;
  locale?: "de" | "en";
}

interface ShippingZone { flat_cents?: number; free_from_cents?: number | null }
interface ShippingRates { inland?: ShippingZone; eu?: ShippingZone; world?: ShippingZone }

// Teil 22b: Stripe kennt die Zielanschrift erst nach der Adresseingabe im Checkout selbst —
// darum bieten wir alle drei Zonen als Auswahl an, statt sie serverseitig zu erraten
// (freundliche Degradierung: fehlt eine Zone in shipping_rates, ist sie kostenlos).
function buildShippingOptions(rates: ShippingRates, amountTotal: number, locale: "de" | "en") {
  const labels: Record<keyof ShippingRates, [string, string]> = {
    inland: ["Inland (DE)", "Domestic (DE)"],
    eu: ["EU", "EU"],
    world: ["Weltweit", "Worldwide"],
  };
  return (Object.keys(labels) as (keyof ShippingRates)[]).map((zone) => {
    const z = rates[zone] ?? {};
    const flat = Math.max(0, Math.round(z.flat_cents ?? 0));
    const free = z.free_from_cents != null && amountTotal >= z.free_from_cents;
    return {
      shipping_rate_data: {
        type: "fixed_amount" as const,
        fixed_amount: { amount: free ? 0 : flat, currency: "eur" },
        display_name: labels[zone][locale === "en" ? 1 : 0],
      },
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({
        error: "not_configured",
        message: "Zahlung wird gerade eingerichtet. Bitte in Kürze erneut versuchen."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
    const body = await req.json() as Body;
    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });

    // Extract user
    const auth = req.headers.get("Authorization");
    let user_id: string | null = null;
    if (auth?.startsWith("Bearer ")) {
      try {
        const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (typeof p?.sub === "string") user_id = p.sub;
      } catch { /* ignore */ }
    }

    const origin = req.headers.get("origin") ?? "http://localhost";
    const locale: "de" | "en" = body.locale === "en" ? "en" : "de";

    // === Subscription mode === (Abos: immer direkt an PAWN, unverändert)
    if (body.mode === "subscription") {
      if (!body.price_id) throw new Error("price_id required");
      // PART 38 WP7: Atelier ist wieder ein regulärer, neu abschließbarer Plan — beide
      // Konfigurationsschlüssel ('atelier' und 'maison') sind gültige Ziele.
      if (body.plan && body.plan !== "atelier" && body.plan !== "maison") {
        return new Response(JSON.stringify({
          error: "plan_not_available",
          message: "Unbekannter Plan.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: body.price_id, quantity: 1 }],
        success_url: body.success_url ?? `${origin}/studio/plan?upgraded=1`,
        cancel_url: body.cancel_url ?? `${origin}/studio/plan`,
        customer_email: body.customer_email,
        locale,

        metadata: { plan: body.plan ?? "", user_id: user_id ?? "" },
        subscription_data: { metadata: { plan: body.plan ?? "", user_id: user_id ?? "" } },
      });
      return new Response(JSON.stringify({ url: session.url, id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Credits nachkaufen (Teil 11a): eigener Kauf ohne Connect-Aufteilung, läuft direkt an PAWN.
    // Gutschrift passiert im stripe-webhook bei checkout.session.completed anhand der Metadaten. ===
    if (body.mode === "credits") {
      if (!body.price_id) throw new Error("price_id required");
      if (!user_id) throw new Error("auth_required");
      const url = Deno.env.get("SUPABASE_URL")!;
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(url, svc, { auth: { persistSession: false } });
      const { data: designer } = await admin.from("designers").select("id").eq("user_id", user_id).maybeSingle();
      if (!designer) {
        return new Response(JSON.stringify({ error: "designer_not_found", message: "Kein Designer-Profil gefunden." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: body.price_id, quantity: 1 }],
        success_url: body.success_url ?? `${origin}/studio/plan?credits=1`,
        cancel_url: body.cancel_url ?? `${origin}/studio/plan`,
        customer_email: body.customer_email,
        locale,
        metadata: { kind: "credits", designer_id: designer.id, credits: String(body.credits ?? "") },
      });
      return new Response(JSON.stringify({ url: session.url, id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Einzelkauf (Express-Checkout) ===
    // Zielarchitektur: die Zahlung entsteht auf dem Stripe-Konto des Hauses (Direct Charge),
    // PAWN erhält automatisch eine Application Fee. Grundlage der Fee ist ausschließlich der
    // Warenwert — Versandkosten bleiben vollständig beim Haus.
    const items = (body.items ?? []).filter((i) => i.name && i.unit_amount > 0 && i.qty > 0);
    if (items.length === 0) throw new Error("empty_cart");

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    // Regel: ein Checkout = ein Haus, damit die Zahlung eindeutig einem Stripe-Konto gehört.
    const slugs = items.map((i) => i.slug).filter(Boolean) as string[];
    const amount_total = items.reduce((sum, i) => sum + i.unit_amount * i.qty, 0);
    let connectedAccountId: string | null = null;
    let applicationFeeCents: number | null = null;
    let shippingRates: ShippingRates = {};

    if (slugs.length) {
      const { data: prods } = await admin.from("products").select("slug, designer_id").in("slug", slugs);
      const designerIds = new Set((prods ?? []).map((p) => p.designer_id).filter(Boolean));

      if (designerIds.size > 1) {
        return new Response(JSON.stringify({
          error: "mixed_cart",
          message: "Stücke verschiedener Häuser bitte getrennt bestellen — jedes Haus wickelt seine Zahlung selbst ab.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }

      if (designerIds.size === 1) {
        const designerId = [...designerIds][0] as string;
        const { data: designer } = await admin.from("designers")
          .select("id, user_id, stripe_account_id, stripe_charges_enabled, shipping_rates")
          .eq("id", designerId).maybeSingle();

        if (designer) {
          shippingRates = (designer.shipping_rates ?? {}) as ShippingRates;
          const { data: roleRow } = await admin.from("user_roles")
            .select("role").eq("user_id", designer.user_id).eq("role", "admin").maybeSingle();
          const isAdminHouse = !!roleRow;

          if (!isAdminHouse) {
            const { data: billing } = await admin.from("designer_billing_profiles")
              .select("legal_name, address_line1, postal_code, city, country, tax_id, kleinunternehmer")
              .eq("designer_id", designerId).maybeSingle();
            const offen = fehlendeVerkaufsbedingungen({
              chargesEnabled: !!designer.stripe_account_id && !!designer.stripe_charges_enabled,
              billing,
              shippingRates: shippingRates as Record<string, unknown>,
            });
            if (offen.length > 0) {
              return new Response(JSON.stringify({
                error: "designer_not_ready",
                fehlt: offen,
                message: "Dieses Haus schließt gerade seine Einrichtung ab — versuch es in Kürze wieder.",
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
            }
            const { data: cfg } = await admin.from("ai_config").select("value").eq("key", "platform_commission").maybeSingle();
            const commissionPct = Number(((cfg?.value ?? {}) as { pct?: number }).pct ?? 7);
            connectedAccountId = designer.stripe_account_id;
            // Nur Warenwert, ohne Versand.
            applicationFeeCents = Math.round(amount_total * (commissionPct / 100));
          }
          // isAdminHouse: Zahlung läuft wie bisher über das Plattformkonto.
        }
      }
    }

    // Bestellung zuerst anlegen — nur so kann die order_id in die Stripe-Metadaten,
    // was bei Direct Charges die einzige verlässliche Zuordnung zwischen Konto und Bestellung ist.
    const { data: orderRow, error: orderError } = await admin.from("orders").insert({
      user_id, items: items as unknown as Record<string, unknown>[], amount_total, currency: "eur",
      status: "pending", customer_email: body.customer_email ?? null,
      application_fee_cents: applicationFeeCents, destination_account: connectedAccountId,
      connected_account_id: connectedAccountId, buyer_locale: locale,
    }).select("id").single();
    if (orderError || !orderRow) throw new Error(orderError?.message ?? "order_insert_failed");

    const metadata: Record<string, string> = {
      order_id: orderRow.id,
      platform: "pawn",
      ...(connectedAccountId ? { connected_account: connectedAccountId } : {}),
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      // KEIN payment_method_types — dann greift automatic_payment_methods (Apple/Google Pay, PayPal, Klarna, Karte)
      locale,
      shipping_address_collection: { allowed_countries: ["DE", "AT", "CH", "FR", "IT", "NL", "BE", "LU", "ES", "DK", "SE", "FI", "IE", "PT"] },
      shipping_options: buildShippingOptions(shippingRates, amount_total, locale),
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      line_items: items.map((i) => ({
        price_data: { currency: "eur", product_data: { name: i.name }, unit_amount: i.unit_amount },
        quantity: i.qty,
      })),
      success_url: body.success_url ?? `${origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url ?? `${origin}/cart?checkout=cancelled`,
      customer_email: body.customer_email,
      metadata,
      payment_intent_data: {
        metadata,
        ...(connectedAccountId ? { application_fee_amount: applicationFeeCents ?? 0 } : {}),
      },
    };

    let session: Stripe.Checkout.Session;
    try {
      session = connectedAccountId
        ? await stripe.checkout.sessions.create(sessionParams, { stripeAccount: connectedAccountId })
        : await stripe.checkout.sessions.create(sessionParams);
    } catch (e) {
      await admin.from("orders").update({ status: "failed" }).eq("id", orderRow.id);
      throw e;
    }

    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", orderRow.id);

    return new Response(JSON.stringify({ url: session.url, id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});

