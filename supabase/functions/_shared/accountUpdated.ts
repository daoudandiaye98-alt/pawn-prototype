// Ein Haus hat sein Stripe-Konto verändert (Nachweise eingereicht, freigeschaltet, gesperrt).
// Dieselbe Logik wird an zwei Endpunkten gebraucht: am Plattform-Endpunkt (PAWNs eigenes
// Konto) und am Connect-Endpunkt (die Konten der Häuser). Deshalb liegt sie hier gemeinsam.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { pickByLang } from "./locale.ts";

interface AccountLike {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  country?: string | null;
  requirements?: { currently_due?: string[] | null } | null;
}

export async function handleAccountUpdated(admin: SupabaseClient, account: AccountLike): Promise<void> {
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
}
