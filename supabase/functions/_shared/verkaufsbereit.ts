// PART 45 — dieselbe Prüfung wie im Studio und in der Datenbank, nur serverseitig.
// Drei Bedingungen, sonst entsteht keine Zahlung: Stripe frei, Rechnungsprofil, Versandkosten.
export interface BillingProfileRow {
  legal_name?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  kleinunternehmer?: boolean | null;
}

const gefuellt = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

export function rechnungsprofilVollstaendig(b: BillingProfileRow | null | undefined): boolean {
  if (!b) return false;
  const basis = gefuellt(b.legal_name) && gefuellt(b.address_line1) && gefuellt(b.postal_code)
    && gefuellt(b.city) && gefuellt(b.country);
  return basis && (b.kleinunternehmer === true || gefuellt(b.tax_id));
}

export function versandkostenGesetzt(rates: Record<string, unknown> | null | undefined): boolean {
  if (!rates) return false;
  return Object.values(rates).some((z) => {
    if (!z || typeof z !== "object") return false;
    const zone = z as { flat_cents?: number | null; free_from_cents?: number | null };
    return Number(zone.flat_cents ?? 0) > 0 || Number(zone.free_from_cents ?? 0) > 0;
  });
}

export function fehlendeVerkaufsbedingungen(input: {
  chargesEnabled: boolean;
  billing: BillingProfileRow | null | undefined;
  shippingRates: Record<string, unknown> | null | undefined;
}): string[] {
  const offen: string[] = [];
  if (!input.chargesEnabled) offen.push("zahlungen");
  if (!rechnungsprofilVollstaendig(input.billing)) offen.push("rechnung");
  if (!versandkostenGesetzt(input.shippingRates)) offen.push("versand");
  return offen;
}
