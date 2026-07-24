// Stripe Connect — Onboarding + Status für Designer-Auszahlungskonten (Express-Accounts).
// Geld fließt direkt vom Käufer auf das Konto des Designers; PAWN berührt es nie.
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
      .select("id, user_id, stripe_account_id, stripe_charges_enabled, stripe_details_submitted")
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
        const account = await stripe.accounts.create({
          type: "express",
          country: "DE",
          email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        });
        accountId = account.id;
        await admin.from("designers").update({ stripe_account_id: accountId }).eq("id", designer.id);
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
        return ok({ connected: false, charges_enabled: false, details_submitted: false });
      }
      const account = await stripe.accounts.retrieve(designer.stripe_account_id);
      const charges_enabled = !!account.charges_enabled;
      const details_submitted = !!account.details_submitted;
      await admin.from("designers").update({
        stripe_charges_enabled: charges_enabled, stripe_details_submitted: details_submitted,
      }).eq("id", designer.id);
      return ok({ connected: true, charges_enabled, details_submitted });
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
