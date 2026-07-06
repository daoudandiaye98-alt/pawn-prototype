// Stripe Checkout Session. Graceful degrade if STRIPE_SECRET_KEY is missing.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

interface Line { name: string; unit_amount: number; qty: number; product_id?: string; size?: string; slug?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "not_configured", message: "Zahlung wird gerade eingerichtet." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 });
    }
    const body = await req.json() as { items: Line[]; success_url?: string; cancel_url?: string; customer_email?: string };
    const items = (body.items ?? []).filter((i) => i.name && i.unit_amount > 0 && i.qty > 0);
    if (items.length === 0) throw new Error("empty_cart");

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
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: items.map((i) => ({
        price_data: {
          currency: "eur",
          product_data: { name: i.name },
          unit_amount: i.unit_amount,
        },
        quantity: i.qty,
      })),
      success_url: body.success_url ?? `${origin}/account?checkout=success`,
      cancel_url: body.cancel_url ?? `${origin}/cart?checkout=cancelled`,
      customer_email: body.customer_email,
    });

    const amount_total = items.reduce((sum, i) => sum + i.unit_amount * i.qty, 0);
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });
    await admin.from("orders").insert({
      user_id, items: items as unknown as Record<string, unknown>[], amount_total, currency: "eur",
      status: "pending", stripe_session_id: session.id, customer_email: body.customer_email ?? null,
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
