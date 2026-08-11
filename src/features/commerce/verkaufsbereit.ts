/**
 * PART 45 — Verkaufsbereitschaft an genau einer Stelle.
 *
 * Ein Haus kann erst verkaufen, wenn drei Dinge zusammenkommen:
 *   1. Stripe hat Zahlungen freigeschaltet (Geld kann ankommen)
 *   2. ein vollständiges Rechnungsprofil liegt vor (Rechnung ist Pflicht)
 *   3. Versandkosten sind gesetzt (der Preis wächst beim Bezahlen nicht plötzlich)
 *
 * Dieselbe Prüfung läuft in der Datenbank (Spalte `designers.verkaufsbereit`)
 * und serverseitig in der Kasse. Hier liegt nur die Darstellung für das Studio.
 */

export interface BillingProfileLike {
  legal_name?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  kleinunternehmer?: boolean | null;
}

export interface ShippingZoneLike { flat_cents?: number | null; free_from_cents?: number | null }

export interface VerkaufsCheck {
  key: "zahlungen" | "rechnung" | "versand";
  label: string;
  hint: string;
  done: boolean;
  to: string;
}

const gefuellt = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

export function rechnungsprofilVollstaendig(b: BillingProfileLike | null | undefined): boolean {
  if (!b) return false;
  const basis = gefuellt(b.legal_name) && gefuellt(b.address_line1) && gefuellt(b.postal_code)
    && gefuellt(b.city) && gefuellt(b.country);
  return basis && (b.kleinunternehmer === true || gefuellt(b.tax_id));
}

export function versandkostenGesetzt(rates: Record<string, unknown> | null | undefined): boolean {
  if (!rates) return false;
  return Object.values(rates).some((z) => {
    if (!z || typeof z !== "object") return false;
    const zone = z as ShippingZoneLike;
    return Number(zone.flat_cents ?? 0) > 0 || Number(zone.free_from_cents ?? 0) > 0;
  });
}

export function verkaufsChecks(input: {
  chargesEnabled: boolean;
  billing: BillingProfileLike | null | undefined;
  shippingRates: Record<string, unknown> | null | undefined;
}): VerkaufsCheck[] {
  return [
    {
      key: "zahlungen",
      label: "Zahlungen freigeschaltet",
      hint: "Stripe muss dein Konto freigeben, damit Geld bei dir ankommt.",
      done: input.chargesEnabled === true,
      to: "/studio/auszahlung",
    },
    {
      key: "rechnung",
      label: "Rechnungsdaten vollständig",
      hint: "Ohne Rechnungsangaben darf in Deutschland keine Rechnung entstehen.",
      done: rechnungsprofilVollstaendig(input.billing),
      to: "/studio/auszahlung",
    },
    {
      key: "versand",
      label: "Versandkosten gesetzt",
      hint: "Ein Preis, der beim Bezahlen wächst, ist der häufigste Abbruchgrund.",
      done: versandkostenGesetzt(input.shippingRates),
      to: "/studio/versand",
    },
  ];
}

/**
 * Stripe nennt fehlende Angaben in Fachbegriffen. Was hier nicht steht, wird ehrlich
 * im Original gezeigt — geraten wird nie.
 */
export const STRIPE_ANFORDERUNGEN: Record<string, string> = {
  "external_account": "Bankverbindung fehlt",
  "business_type": "Rechtsform noch nicht gewählt (Einzelperson oder Unternehmen)",
  "business_profile.mcc": "Branche noch nicht gewählt",
  "business_profile.url": "Website oder Profil-Link fehlt",
  "business_profile.product_description": "Kurze Beschreibung, was du verkaufst, fehlt",
  "business_profile.support_phone": "Telefonnummer für Rückfragen fehlt",
  "tos_acceptance.date": "Stripe-Bedingungen noch nicht bestätigt",
  "tos_acceptance.ip": "Stripe-Bedingungen noch nicht bestätigt",
  "representative.first_name": "Vorname der vertretungsberechtigten Person fehlt",
  "representative.last_name": "Nachname der vertretungsberechtigten Person fehlt",
  "representative.email": "E-Mail der vertretungsberechtigten Person fehlt",
  "representative.phone": "Telefonnummer der vertretungsberechtigten Person fehlt",
  "representative.address.line1": "Adresse der vertretungsberechtigten Person unvollständig",
  "representative.address.city": "Adresse der vertretungsberechtigten Person unvollständig",
  "representative.address.postal_code": "Adresse der vertretungsberechtigten Person unvollständig",
  "representative.dob.day": "Geburtsdatum der vertretungsberechtigten Person fehlt",
  "representative.dob.month": "Geburtsdatum der vertretungsberechtigten Person fehlt",
  "representative.dob.year": "Geburtsdatum der vertretungsberechtigten Person fehlt",
  "individual.first_name": "Vorname fehlt",
  "individual.last_name": "Nachname fehlt",
  "individual.email": "E-Mail-Adresse fehlt",
  "individual.phone": "Telefonnummer fehlt",
  "individual.address.line1": "Anschrift unvollständig",
  "individual.address.city": "Anschrift unvollständig",
  "individual.address.postal_code": "Anschrift unvollständig",
  "individual.dob.day": "Geburtsdatum fehlt",
  "individual.dob.month": "Geburtsdatum fehlt",
  "individual.dob.year": "Geburtsdatum fehlt",
  "individual.id_number": "Steuer- oder Ausweisnummer fehlt",
  "individual.verification.document": "Ausweisbild fehlt",
  "company.tax_id": "Steuernummer des Unternehmens fehlt",
  "company.name": "Firmenname fehlt",
  "company.address.line1": "Firmenanschrift unvollständig",
};

/** Doppelte Klartexte zusammenfassen — „Geburtsdatum fehlt" braucht niemand dreimal. */
export function anforderungenKlartext(keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const text = STRIPE_ANFORDERUNGEN[k] ?? k;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}
