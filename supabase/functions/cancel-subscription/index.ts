/**
 * Teil 39 AP1 — der Kündigungsbutton (§312k BGB): ein Haus im Plan Paid beendet sein Abo zum
 * Ende der laufenden Periode. Kein Sofort-Abbruch mitten im bezahlten Monat (fair, entspricht
 * "Kündigung jederzeit zum Monatsende" aus der AGB) — Stripe berechnet cancel_at_period_end,
 * das Haus behält seine Kontingente bis zum Ende der bereits bezahlten Periode.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { pickByLang } from "../_shared/locale.ts";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "not_configured", message: "Zahlung wird gerade eingerichtet. Bitte in Kürze erneut versuchen." }, 200);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: designer } = await admin.from("designers")
      .select("id, plan, stripe_subscription_id, preferred_language")
      .eq("user_id", user_id).maybeSingle();
    if (!designer) return json({ error: "designer_not_found" }, 404);
    if (!designer.stripe_subscription_id) {
      return json({ error: "no_active_subscription", message: "Kein laufendes Abo gefunden — du bist bereits im Plan Frei." }, 200);
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });
    const sub = await stripe.subscriptions.update(designer.stripe_subscription_id, { cancel_at_period_end: true });

    await admin.from("domain_events").insert({
      id: crypto.randomUUID(), type: "subscription.cancel_requested",
      actor: user_id, payload: { subscription_id: sub.id, period_end: sub.current_period_end }, schema_version: 1,
    });
    await admin.from("notifications").insert({
      user_id,
      type: "plan.cancel_scheduled",
      title: pickByLang(designer.preferred_language, "Kündigung bestätigt.", "Cancellation confirmed."),
      body: pickByLang(designer.preferred_language,
        "Dein Abo endet zum Ende der aktuellen Abrechnungsperiode. Bis dahin bleiben deine Kontingente aktiv.",
        "Your subscription ends at the end of the current billing period. Your quotas stay active until then."),
      link: "/studio/plan",
    });

    return json({ ok: true, period_end: sub.current_period_end });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
