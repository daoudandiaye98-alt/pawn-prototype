// WP2 — Die Rechnung. Eine gemeinsame Wahrheit für beide Webhooks.
//
// Grundsätze:
// - Die Nummer wird über assign_invoice_number vergeben: Nummer und Bestellung werden
//   in einem einzigen DB-Aufruf verheiratet. Zweiter Aufruf → dieselbe Nummer.
//   Kein Aufruf wirft je eine unbehandelte Ausnahme in den Kaufablauf hinein.
// - Kleinunternehmer (§19 UStG): keine Steuer, vat_rate/vat_amount_cents = 0, Hinweis auf der Rechnung.
// - Regelfall: Steuer sauber ausgewiesen, Bruttopreise werden herausgerechnet.
// - OFFENER PUNKT: Lieferungen an Privatkunden im EU-Ausland unterliegen ab der
//   OSS-Schwelle dem Steuersatz des Bestimmungslands. Das ist hier bewusst NICHT
//   umgesetzt — stattdessen wird der Fall erkannt, mit dem Inlandssatz gerechnet und
//   auf der Rechnung sowie in invoice_error als offener Punkt vermerkt.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export interface BillingRow {
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  kleinunternehmer?: boolean | null;
  return_address_line1?: string | null;
  return_address_line2?: string | null;
  return_postal_code?: string | null;
  return_city?: string | null;
  return_country?: string | null;
}

export interface OrderForInvoice {
  id: string;
  items: unknown;
  amount_total: number;
  shipping_amount_cents?: number | null;
  currency?: string | null;
  buyer_locale?: string | null;
  customer_email?: string | null;
  shipping_name?: string | null;
  shipping_address_line1?: string | null;
  shipping_address_line2?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
  invoice_number?: string | null;
  invoice_path?: string | null;
}

export interface RechnungsErgebnis {
  ok: boolean;
  invoice_number: string | null;
  path: string | null;
  hinweis: string | null;
}

const DE_SATZ = 19;
const EU_LAENDER = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

const euro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;

/** Rücksendeadresse mit Rückfall auf die Hauptanschrift, wenn nichts Eigenes hinterlegt ist. */
export function ruecksendeadresse(b: BillingRow): string[] {
  const eigen = (b.return_address_line1 ?? "").trim().length > 0;
  const zeilen = eigen
    ? [b.return_address_line1, b.return_address_line2, `${b.return_postal_code ?? ""} ${b.return_city ?? ""}`.trim(), b.return_country]
    : [b.address_line1, b.address_line2, `${b.postal_code ?? ""} ${b.city ?? ""}`.trim(), b.country];
  return zeilen.map((z) => (z ?? "").trim()).filter((z) => z.length > 0);
}

interface Steuer { rate: number; vat_cents: number; net_cents: number; hinweis: string | null }

/** Bruttobetrag → Netto/Steuer. Kleinunternehmer: keine Steuer, dafür der §19-Hinweis. */
export function berechneSteuer(brutto: number, billing: BillingRow, lieferLand: string | null): Steuer {
  if (billing.kleinunternehmer === true) {
    return {
      rate: 0,
      vat_cents: 0,
      net_cents: brutto,
      hinweis: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).",
    };
  }
  const land = (lieferLand ?? "DE").toUpperCase();
  const auslandEU = land !== "DE" && EU_LAENDER.has(land);
  const net = Math.round(brutto / (1 + DE_SATZ / 100));
  return {
    rate: DE_SATZ,
    vat_cents: brutto - net,
    net_cents: net,
    hinweis: auslandEU
      ? `Lieferung nach ${land}: Bei Privatkunden im EU-Ausland kann der Steuersatz des Bestimmungslands gelten (OSS). Diese Rechnung weist den deutschen Satz aus — bitte prüfen.`
      : null,
  };
}

interface PdfDaten {
  nummer: string;
  datum: string;
  billing: BillingRow;
  order: OrderForInvoice;
  steuer: Steuer;
  brutto: number;
  versand: number;
}

async function bauePdf(d: PdfDaten): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const schwarz = rgb(0, 0, 0);
  let y = 790;

  const text = (s: string, opts?: { size?: number; fett?: boolean; x?: number; dy?: number }) => {
    const size = opts?.size ?? 10;
    page.drawText(s, { x: opts?.x ?? 56, y, size, font: opts?.fett ? bold : font, color: schwarz });
    y -= opts?.dy ?? size + 5;
  };
  const rechts = (s: string, size = 10, fett = false) => {
    const f = fett ? bold : font;
    const w = f.widthOfTextAtSize(s, size);
    page.drawText(s, { x: 539.28 - w, y, size, font: f, color: schwarz });
  };
  const linie = () => { page.drawLine({ start: { x: 56, y }, end: { x: 539.28, y }, thickness: 1, color: schwarz }); y -= 14; };

  // Absender = das Haus
  text((d.billing.legal_name ?? "").trim() || "—", { size: 14, fett: true, dy: 20 });
  for (const z of [d.billing.address_line1, d.billing.address_line2, `${d.billing.postal_code ?? ""} ${d.billing.city ?? ""}`.trim(), d.billing.country]) {
    if ((z ?? "").trim()) text((z as string).trim(), { size: 9 });
  }
  if ((d.billing.tax_id ?? "").trim()) text(`USt-IdNr./Steuernummer: ${d.billing.tax_id}`, { size: 9 });
  y -= 16;

  text("RECHNUNG", { size: 20, fett: true, dy: 26 });
  text(`Rechnungsnummer: ${d.nummer}`, { size: 10 });
  text(`Rechnungsdatum: ${d.datum}`, { size: 10 });
  text(`Bestellnummer: ${d.order.id}`, { size: 9 });
  y -= 12;

  text("Rechnungs- und Lieferanschrift", { size: 9, fett: true });
  for (const z of [
    d.order.shipping_name,
    d.order.shipping_address_line1,
    d.order.shipping_address_line2,
    `${d.order.shipping_postal_code ?? ""} ${d.order.shipping_city ?? ""}`.trim(),
    d.order.shipping_country,
  ]) {
    if ((z ?? "").trim()) text((z as string).trim(), { size: 10 });
  }
  if (!(d.order.shipping_address_line1 ?? "").trim() && d.order.customer_email) text(d.order.customer_email, { size: 10 });
  y -= 16;

  // Positionen
  page.drawText("Position", { x: 56, y, size: 9, font: bold });
  page.drawText("Menge", { x: 340, y, size: 9, font: bold });
  rechts("Betrag", 9, true);
  y -= 6; linie();

  const items = (Array.isArray(d.order.items) ? d.order.items : []) as { name?: string; qty?: number; unit_amount?: number; size?: string }[];
  for (const it of items) {
    const name = `${it.name ?? "Stück"}${it.size ? ` · ${it.size}` : ""}`.slice(0, 58);
    const qty = Math.max(1, it.qty ?? 1);
    page.drawText(name, { x: 56, y, size: 10, font });
    page.drawText(String(qty), { x: 340, y, size: 10, font });
    rechts(euro((it.unit_amount ?? 0) * qty));
    y -= 16;
  }
  if (d.versand > 0) {
    page.drawText("Versand", { x: 56, y, size: 10, font });
    rechts(euro(d.versand));
    y -= 16;
  }
  y -= 4; linie();

  // Summen
  if (d.steuer.rate > 0) {
    page.drawText("Nettobetrag", { x: 340, y, size: 10, font }); rechts(euro(d.steuer.net_cents)); y -= 16;
    page.drawText(`Umsatzsteuer ${d.steuer.rate} %`, { x: 340, y, size: 10, font }); rechts(euro(d.steuer.vat_cents)); y -= 16;
  }
  page.drawText("Gesamtbetrag", { x: 340, y, size: 11, font: bold });
  rechts(euro(d.brutto), 11, true);
  y -= 28;

  if (d.billing.kleinunternehmer === true) {
    text("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).", { size: 9 });
  }
  if (d.steuer.hinweis && d.steuer.rate > 0) text(d.steuer.hinweis, { size: 8 });
  y -= 10;

  const ret = ruecksendeadresse(d.billing);
  if (ret.length) {
    text("Rücksendungen an:", { size: 9, fett: true });
    for (const z of ret) text(z, { size: 9 });
  }
  y -= 10;
  text("Vermittelt über PAWN — pawn.vision. Verkäufer und Rechnungssteller ist das oben genannte Haus.", { size: 8 });

  return await doc.save();
}

/**
 * Erstellt die Rechnung zu einer bezahlten Bestellung: Nummer vergeben, PDF bauen,
 * in den privaten Bucket 'invoices' legen, Beträge auf der Bestellung festschreiben.
 * Idempotent — ein zweiter Aufruf erzeugt keine zweite Nummer.
 * Wirft nie: Probleme landen in orders.invoice_error und im Rückgabewert.
 */
export async function erstelleRechnung(
  admin: SupabaseClient,
  order: OrderForInvoice,
  designerId: string | null,
): Promise<RechnungsErgebnis> {
  try {
    if (order.invoice_path) {
      return { ok: true, invoice_number: order.invoice_number ?? null, path: order.invoice_path, hinweis: null };
    }
    if (!designerId) {
      return { ok: false, invoice_number: null, path: null, hinweis: "Kein Haus zur Bestellung gefunden." };
    }

    const { data: billing } = await admin.from("designer_billing_profiles")
      .select("legal_name, address_line1, address_line2, postal_code, city, country, tax_id, kleinunternehmer, return_address_line1, return_address_line2, return_postal_code, return_city, return_country")
      .eq("designer_id", designerId).maybeSingle();

    const b = (billing ?? null) as BillingRow | null;
    const basisOk = !!b && ["legal_name", "address_line1", "postal_code", "city", "country"]
      .every((k) => ((b as Record<string, unknown>)[k] as string | null ?? "").toString().trim().length > 0);
    const steuerOk = !!b && (b.kleinunternehmer === true || ((b.tax_id ?? "").trim().length > 0));
    if (!b || !basisOk || !steuerOk) {
      const hinweis = "Rechnungsprofil des Hauses unvollständig — keine Rechnung erstellt.";
      await admin.from("orders").update({ invoice_error: hinweis }).eq("id", order.id);
      return { ok: false, invoice_number: null, path: null, hinweis };
    }

    // Nummer erst jetzt — nach allen Vorprüfungen, damit kein Nummernkreis-Loch entsteht.
    const { data: nummer, error: nrError } = await admin.rpc("assign_invoice_number", {
      _designer_id: designerId, _order_id: order.id,
    });
    if (nrError || !nummer) {
      const hinweis = `Rechnungsnummer konnte nicht vergeben werden: ${nrError?.message ?? "kein Rechnungsprofil"}`;
      await admin.from("orders").update({ invoice_error: hinweis }).eq("id", order.id);
      return { ok: false, invoice_number: null, path: null, hinweis };
    }

    const versand = Math.max(0, order.shipping_amount_cents ?? 0);
    const brutto = (order.amount_total ?? 0) + versand;
    const steuer = berechneSteuer(brutto, b, order.shipping_country ?? null);
    const datum = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    const bytes = await bauePdf({ nummer: nummer as string, datum, billing: b, order, steuer, brutto, versand });
    const pfad = `${order.id}.pdf`;
    const { error: upError } = await admin.storage.from("invoices")
      .upload(pfad, bytes, { contentType: "application/pdf", upsert: true });
    if (upError) throw new Error(upError.message);

    await admin.from("orders").update({
      invoice_path: pfad,
      invoice_issued_at: new Date().toISOString(),
      invoice_kleinunternehmer: b.kleinunternehmer === true,
      vat_rate: steuer.rate,
      vat_amount_cents: steuer.vat_cents,
      net_amount_cents: steuer.net_cents,
      invoice_error: steuer.hinweis,
    }).eq("id", order.id);

    return { ok: true, invoice_number: nummer as string, path: pfad, hinweis: steuer.hinweis };
  } catch (e) {
    const hinweis = `Rechnung fehlgeschlagen: ${(e as Error).message}`;
    // Die Nummer bleibt an der Bestellung hängen — ein erneuter Versuch nutzt sie wieder,
    // statt eine zweite zu ziehen. Damit bleibt der Nummernkreis lückenlos.
    await admin.from("orders").update({ invoice_error: hinweis }).eq("id", order.id).then(() => {}, () => {});
    return { ok: false, invoice_number: null, path: null, hinweis };
  }
}

/** Kurzlebiger Link auf die Rechnung (privater Bucket) — für die Bestätigungsmail. */
export async function rechnungsLink(admin: SupabaseClient, pfad: string, sekunden = 60 * 60 * 24 * 30): Promise<string | null> {
  const { data } = await admin.storage.from("invoices").createSignedUrl(pfad, sekunden);
  return data?.signedUrl ?? null;
}
