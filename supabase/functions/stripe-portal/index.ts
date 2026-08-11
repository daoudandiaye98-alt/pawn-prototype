/**
 * PART 48 AP5 — Stripe Customer Portal: öffnet Stripes gehostete Verwaltungsseite für
 * Zahlungsmittel und Rechnungen eines Hauses mit laufendem Abo.
 *
 * WICHTIG (nicht im Code lösbar, braucht Daoudas Handarbeit im Stripe-Dashboard, bevor diese
 * Funktion irgendwo verlinkt wird): Stripes Portal kann standardmäßig auch Plan-Wechsel und
 * Kündigungen selbst anbieten — das würde die bestehende, bewusste Sicherheitsregel aus
 * StudioPlan.tsx umgehen ("ein Wechsel zwischen zwei laufenden Bezahlplänen läuft nie automatisch
 * über einen zweiten Checkout, sondern als begleitete Anfrage ans Team", Gefahr: zwei parallel
 * laufende Abos) und das bestehende §312k-BGB-Kündigungsbutton-Feature (cancel-subscription,
 * /vertrag-kuendigen) doppeln. Bitte zuerst unter Stripe-Dashboard → Einstellungen → Kundenportal
 * eine Konfiguration anlegen, die NUR Zahlungsmittel und Rechnungen zeigt (Abo-Verwaltung/
 * Plan-Wechsel/Kündigung dort ausschalten), und deren Konfigurations-ID unten eintragen, bevor
 * ein Studio-Knopf hierher verlinkt.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      .select("stripe_customer_id").eq("user_id", user_id).maybeSingle();
    if (!designer?.stripe_customer_id) {
      return json({ error: "no_stripe_customer", message: "Kein Stripe-Kundenkonto gefunden — noch kein Abo abgeschlossen." }, 200);
    }

    const body = await req.json().catch(() => ({})) as { return_url?: string };
    const stripe = new Stripe(secret, { apiVersion: "2024-04-10" });
    const session = await stripe.billingPortal.sessions.create({
      customer: designer.stripe_customer_id,
      return_url: body.return_url ?? `${req.headers.get("origin") ?? ""}/studio/plan`,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
