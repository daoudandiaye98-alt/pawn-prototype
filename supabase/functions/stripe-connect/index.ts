// Stripe Connect — Onboarding, Status und Dashboard-Zugang für die Konten der Häuser.
// Zahlungen entstehen direkt auf dem Konto des Hauses; PAWN erhält eine Application Fee.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) {
      return ok({ error: "not_configured", message: "Zahlungsanbindung wird gerade eingerichtet. Bitte in Kürze erneut versuchen." });
    }
    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });

    const authHeader = req.headers.get("Authorization");
    const user_id = jwtSub(authHeader);
    if (!user_id) return ok({ error: "forbidden" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    // Ownership: der Designer wird ausschließlich über die eigene Session gefunden, nie über eine
    // vom Client mitgeschickte ID — so kann niemand das Konto eines anderen Hauses onboarden/abfragen.
    const { data: designer } = await admin.from("designers")
      .select("id, user_id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_payouts_enabled, stripe_country")
      .eq("user_id", user_id).maybeSingle();
    if (!designer) return ok({ error: "not_found", message: "Kein Designer-Profil gefunden." });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const origin = req.headers.get("origin") ?? "https://pawn.vision";

    if (action === "onboard") {
      let accountId = designer.stripe_account_id as string | null;
      if (!accountId) {
        let email: string | undefined;
        try {
          const { data: userRes } = await admin.auth.admin.getUserById(user_id);
          email = userRes?.user?.email ?? undefined;
        } catch { /* best effort */ }
        const country = (designer.stripe_country as string | null) || "DE";
        // Direct Charges: die Zahlung entsteht auf dem Konto des Hauses. Stripe-Gebühren und
        // Rückbuchungsverluste werden Stripe-seitig diesem Konto zugeordnet, PAWN übernimmt
        // die Zahlungsabwicklung als Plattform (Express-Dashboard bleibt für das Haus offen).
        const account = await stripe.accounts.create({
          type: "express",
          country,
          email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          controller: {
            fees: { payer: "account" },
            losses: { payments: "stripe" },
            stripe_dashboard: { type: "express" },
          },
        } as unknown as Stripe.AccountCreateParams);
        accountId = account.id;
        await admin.from("designers").update({
          stripe_account_id: accountId,
          ...(account.country ? { stripe_country: account.country } : {}),
        }).eq("id", designer.id);
      }
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        return_url: `${origin}/studio/auszahlung?connect=done`,
        refresh_url: `${origin}/studio/auszahlung?connect=retry`,
      });
      return ok({ url: link.url });
    }

    if (action === "status") {
      if (!designer.stripe_account_id) {
        return ok({ connected: false, charges_enabled: false, details_submitted: false, payouts_enabled: false, requirements_due: [] });
      }
      const account = await stripe.accounts.retrieve(designer.stripe_account_id);
      const charges_enabled = !!account.charges_enabled;
      const details_submitted = !!account.details_submitted;
      const payouts_enabled = !!account.payouts_enabled;
      const requirements = (account.requirements ?? {}) as unknown as Record<string, unknown>;
      const requirements_due = (account.requirements?.currently_due ?? []) as string[];
      await admin.from("designers").update({
        stripe_charges_enabled: charges_enabled,
        stripe_details_submitted: details_submitted,
        stripe_payouts_enabled: payouts_enabled,
        stripe_requirements: requirements,
        ...(account.country ? { stripe_country: account.country } : {}),
      }).eq("id", designer.id);
      return ok({ connected: true, charges_enabled, details_submitted, payouts_enabled, requirements_due });
    }

    if (action === "dashboard") {
      if (!designer.stripe_account_id) return ok({ error: "not_connected", message: "Noch kein Konto verbunden." });
      const link = await stripe.accounts.createLoginLink(designer.stripe_account_id);
      return ok({ url: link.url });
    }

    return ok({ error: "unknown_action" });
  } catch (e) {
    // Nie 500 zurückgeben: ein technischer Fehler (Stripe-API, Netzwerk, …) soll nie als rohe
    // "Edge Function returned a non-2xx status code" im Studio auftauchen — immer 200 mit
    // Klartext-Fehlermeldung, echte Ursache landet nur im Server-Log.
    console.error("[stripe-connect] error:", e);
    return ok({ error: "internal_error", message: "Auszahlungen werden gerade eingerichtet — melde dich, sobald es weitergeht." });
  }
});
