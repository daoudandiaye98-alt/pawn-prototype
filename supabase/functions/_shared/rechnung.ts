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


// --- Abhängigkeitsfreier einseitiger PDF-Bauer (bewährt aus dem Versand-Werkzeug,
// bewusst ohne npm-PDF-Bibliothek, damit die Edge-Laufzeit nichts nachladen muss). ---
interface PdfLine { text: string; size?: number; bold?: boolean; gapBefore?: number; rightText?: string; rightX?: number }

function winAnsiByte(ch: string): number {
  const cp = ch.codePointAt(0)!;
  // Zeilenumbrüche müssen durchgereicht werden — sonst zerfällt der PDF-Stream
  // in unlesbare Operatoren (genau daran sind die alten Rechnungen gescheitert).
  if (cp === 0x0a || cp === 0x0d) return cp;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  const special: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85,
    0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92,
    0x201c: 0x93, 0x201d: 0x94,
  };
  return special[cp] ?? 0x3f;
}
const pdfEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const asciiBytes = (s: string) => Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0)));
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function buildPdf(lines: PdfLine[]): Uint8Array {
  const PAGE_W = 595, PAGE_H = 842, marginX = 50;
  let y = PAGE_H - 60;
  const parts: string[] = ["BT\n"];
  let curFont: string | null = null, curSize: number | null = null;
  for (const line of lines) {
    const size = line.size ?? 10;
    const font = line.bold ? "F2" : "F1";
    y -= line.gapBefore ?? 0;
    if (font !== curFont || size !== curSize) { parts.push(`/${font} ${size} Tf\n`); curFont = font; curSize = size; }
    parts.push(`1 0 0 1 ${marginX} ${Math.round(y)} Tm (${pdfEscape(line.text)}) Tj\n`);
    if (line.rightText) {
      parts.push(`1 0 0 1 ${line.rightX ?? 430} ${Math.round(y)} Tm (${pdfEscape(line.rightText)}) Tj\n`);
    }
    y -= Math.round(size * 1.4);
  }
  parts.push("ET");
  const streamBytes = Uint8Array.from(Array.from(parts.join("")).map(winAnsiByte));
  const objects = [
    asciiBytes(`<< /Type /Catalog /Pages 2 0 R >>`),
    asciiBytes(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`),
    asciiBytes(`<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 6 0 R >>`),
    asciiBytes(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`),
    asciiBytes(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`),
  ];
  const head = asciiBytes("%PDF-1.4\n");
  const chunks: Uint8Array[] = [head];
  const offsets: number[] = [0];
  let pos = head.length;
  for (let i = 0; i < objects.length; i++) {
    const num = i + 1;
    offsets[num] = pos;
    const objHead = asciiBytes(`${num} 0 obj\n`), objTail = asciiBytes(`\nendobj\n`);
    chunks.push(objHead, objects[i], objTail);
    pos += objHead.length + objects[i].length + objTail.length;
  }
  offsets[6] = pos;
  const sHead = asciiBytes(`6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
  const sTail = asciiBytes(`\nendstream\nendobj\n`);
  chunks.push(sHead, streamBytes, sTail);
  pos += sHead.length + streamBytes.length + sTail.length;
  const xrefStart = pos;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i < 7; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  chunks.push(asciiBytes(xref));
  chunks.push(asciiBytes(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
  return concatBytes(chunks);
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

export function baueRechnungsPdf(d: PdfDaten): Uint8Array {
  const b = d.billing;
  const L: PdfLine[] = [];
  const zeile = (text: string, opts: Partial<PdfLine> = {}) => { if (text.trim()) L.push({ text, ...opts }); };

  // Absender: das Haus ist der Verkäufer, PAWN nur Vermittler.
  zeile((b.legal_name ?? "").trim() || "-", { size: 15, bold: true });
  zeile((b.address_line1 ?? "").trim(), { size: 9, gapBefore: 4 });
  zeile((b.address_line2 ?? "").trim(), { size: 9 });
  zeile(`${b.postal_code ?? ""} ${b.city ?? ""}`.trim(), { size: 9 });
  zeile((b.country ?? "").trim(), { size: 9 });
  if ((b.tax_id ?? "").trim()) zeile(`USt-IdNr./Steuernummer: ${b.tax_id}`, { size: 9 });

  zeile("RECHNUNG", { size: 16, bold: true, gapBefore: 26 });
  zeile(`Rechnungsnummer: ${d.nummer}`, { gapBefore: 8 });
  zeile(`Rechnungsdatum: ${d.datum}`);
  zeile(`Bestellung: ${d.order.id}`, { size: 9 });

  zeile("Rechnungs- und Lieferanschrift", { size: 9, bold: true, gapBefore: 18 });
  zeile((d.order.shipping_name ?? "").trim(), { size: 10, gapBefore: 4 });
  zeile((d.order.shipping_address_line1 ?? "").trim(), { size: 10 });
  zeile((d.order.shipping_address_line2 ?? "").trim(), { size: 10 });
  zeile(`${d.order.shipping_postal_code ?? ""} ${d.order.shipping_city ?? ""}`.trim(), { size: 10 });
  zeile((d.order.shipping_country ?? "").trim(), { size: 10 });
  if (!(d.order.shipping_address_line1 ?? "").trim()) zeile((d.order.customer_email ?? "").trim(), { size: 10 });

  L.push({ text: "Position", bold: true, size: 9, gapBefore: 22, rightText: "Betrag" });
  const items = (Array.isArray(d.order.items) ? d.order.items : []) as { name?: string; qty?: number; unit_amount?: number; size?: string }[];
  for (const it of items) {
    const qty = Math.max(1, it.qty ?? 1);
    const name = `${it.name ?? "Stueck"}${it.size ? ` - ${it.size}` : ""} x ${qty}`.slice(0, 60);
    L.push({ text: name, gapBefore: 6, rightText: euro((it.unit_amount ?? 0) * qty) });
  }
  if (d.versand > 0) L.push({ text: "Versand", gapBefore: 6, rightText: euro(d.versand) });

  if (d.steuer.rate > 0) {
    L.push({ text: "Nettobetrag", gapBefore: 16, rightText: euro(d.steuer.net_cents) });
    L.push({ text: `Umsatzsteuer ${d.steuer.rate} %`, rightText: euro(d.steuer.vat_cents) });
    L.push({ text: "Gesamtbetrag (brutto)", bold: true, gapBefore: 4, rightText: euro(d.brutto) });
  } else {
    L.push({ text: "Gesamtbetrag", bold: true, gapBefore: 16, rightText: euro(d.brutto) });
    zeile("Gemaess § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).", { size: 9, gapBefore: 12 });
  }
  if (d.steuer.hinweis && d.steuer.rate > 0) zeile(d.steuer.hinweis, { size: 8, gapBefore: 12 });

  const ret = ruecksendeadresse(b);
  if (ret.length) {
    zeile("Ruecksendungen an:", { size: 9, bold: true, gapBefore: 20 });
    for (const z of ret) zeile(z, { size: 9 });
  }
  zeile("Vermittelt ueber PAWN (pawn.vision). Verkaeufer und Rechnungssteller ist das oben genannte Haus.", { size: 8, gapBefore: 20 });

  return buildPdf(L);
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

    const bytes = baueRechnungsPdf({ nummer: nummer as string, datum, billing: b, order, steuer, brutto, versand });
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
