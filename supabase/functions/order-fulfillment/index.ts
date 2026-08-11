// Teil 22b: Das Versand-Werkzeug für Häuser. Der Designer ist der Verkäufer — Rechnung
// und Versandbestätigung tragen die Daten des Hauses, PAWN erscheint nur als Vermittler.
// Schlägt der E-Mail-Versand fehl (Domain nicht verifiziert, Kontingent voll), bleibt die
// Bestellung trotzdem korrekt — der Fehler landet sichtbar in orders.last_email_error,
// nie als stiller Abbruch (freundliche Degradierung).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

interface Body {
  order_id: string;
  action: "advance" | "ship" | "retry-email";
  status?: "in_progress" | "packed" | "delivered";
  tracking_number?: string;
  carrier?: string;
}

interface OrderLine { name: string; unit_amount: number; qty: number; size?: string; slug?: string }

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")))?.sub ?? null;
  } catch { return null; }
}

// --- Dependency-free, hand-built single-page PDF (no npm PDF lib — Deno-edge-safe). ---

function winAnsiByte(ch: string): number {
  const cp = ch.codePointAt(0)!;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  const special: Record<number, number> = {
    0x20ac: 0x80, 0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85,
    0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92,
    0x201c: 0x93, 0x201d: 0x94,
  };
  return special[cp] ?? 0x3f;
}
function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function asciiBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0)));
}
function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

interface PdfLine { text: string; size?: number; bold?: boolean; gapBefore?: number; gapAfter?: number }

function buildInvoicePdf(lines: PdfLine[]): Uint8Array {
  const PAGE_W = 595, PAGE_H = 842;
  const marginX = 50;
  let y = PAGE_H - 60;

  const streamParts: string[] = ["BT\n"];
  let curFont: string | null = null;
  let curSize: number | null = null;
  for (const line of lines) {
    const size = line.size ?? 10;
    const font = line.bold ? "F2" : "F1";
    y -= line.gapBefore ?? 0;
    if (font !== curFont || size !== curSize) {
      streamParts.push(`/${font} ${size} Tf\n`);
      curFont = font; curSize = size;
    }
    streamParts.push(`1 0 0 1 ${marginX} ${Math.round(y)} Tm (${pdfEscape(line.text)}) Tj\n`);
    y -= line.gapAfter ?? Math.round(size * 1.4);
  }
  streamParts.push("ET");

  const streamStr = streamParts.join("");
  const streamBytes = Uint8Array.from(Array.from(streamStr).map(winAnsiByte));

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
    const objHead = asciiBytes(`${num} 0 obj\n`);
    const objTail = asciiBytes(`\nendobj\n`);
    chunks.push(objHead, objects[i], objTail);
    pos += objHead.length + objects[i].length + objTail.length;
  }
  {
    const num = 6;
    offsets[num] = pos;
    const objHead = asciiBytes(`${num} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    const objTail = asciiBytes(`\nendstream\nendobj\n`);
    chunks.push(objHead, streamBytes, objTail);
    pos += objHead.length + streamBytes.length + objTail.length;
  }

  const xrefStart = pos;
  const totalObjs = 7;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjs; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  const xrefBytes = asciiBytes(xref);
  chunks.push(xrefBytes);

  chunks.push(asciiBytes(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`));
  return concatBytes(chunks);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

// --- Domain helpers ---

interface BillingProfile {
  legal_name: string | null; address_line1: string | null; address_line2: string | null;
  postal_code: string | null; city: string | null; country: string | null;
  tax_id: string | null; kleinunternehmer: boolean;
}

function billingComplete(b: BillingProfile | null): boolean {
  if (!b) return false;
  return !!(b.legal_name && b.address_line1 && b.postal_code && b.city && b.country && (b.tax_id || b.kleinunternehmer));
}

const TRACKING_URLS: Record<string, (t: string) => string> = {
  DHL: (t) => `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${encodeURIComponent(t)}`,
  DPD: (t) => `https://tracking.dpd.de/status/de_DE/parcel/${encodeURIComponent(t)}`,
  Hermes: (t) => `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinfo/#${encodeURIComponent(t)}`,
  GLS: (t) => `https://gls-group.eu/DE/de/paket-verfolgen?match=${encodeURIComponent(t)}`,
  UPS: (t) => `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`,
  "Deutsche Post": (t) => `https://www.deutschepost.de/sendung/simpleQuery.html?form.sendungsnummer=${encodeURIComponent(t)}`,
};

const VAT_RATE = 0.19; // Vereinfachung: deutscher Regelsteuersatz — keine länderspezifische Erkennung.

async function resendSend(fromAddr: string, to: string, subject: string, text: string, replyTo?: string | null, attachment?: { filename: string; content: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "Kein RESEND_API_KEY hinterlegt." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: fromAddr, to: [to], reply_to: replyTo ?? undefined, subject, text,
        attachments: attachment ? [attachment] : undefined,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function senderFrom(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
  const v = (data?.value ?? {}) as { email_from?: string };
  return v.email_from || "PAWN <hallo@pawn.vision>";
}

async function designerEmail(admin: SupabaseClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

interface OrderRow {
  id: string; items: OrderLine[]; amount_total: number; buyer_locale: string; customer_email: string | null;
  tracking_number: string | null; carrier: string | null; invoice_number: string | null;
}

/**
 * Versandbestätigung. Die Rechnung selbst kommt aus der gemeinsamen Quelle
 * (_shared/rechnung.ts) — hier wird sie nur noch angefordert und angehängt,
 * damit es keine zweite, abweichende Rechnungswahrheit gibt.
 */
async function sendShippedEmail(admin: SupabaseClient, order: OrderRow, designerId: string, designerName: string, designerUserId: string | null) {
  const locale = order.buyer_locale === "en" ? "en" : "de";

  const rechnung = await erstelleRechnung(admin, order as unknown as OrderForInvoice, designerId);
  if (!rechnung.ok && !order.invoice_number) {
    return { ok: false, error: rechnung.hinweis ?? "Rechnung konnte nicht erstellt werden." };
  }
  const invoiceNumber = rechnung.invoice_number ?? order.invoice_number;

  const pfad = rechnung.path ?? `${order.id}.pdf`;
  const { data: blob } = await admin.storage.from("invoices").download(pfad);
  const pdfBytes = blob ? new Uint8Array(await blob.arrayBuffer()) : null;


  if (!order.customer_email) return { ok: true, emailSent: false, invoiceNumber };

  const trackUrl = order.carrier && order.tracking_number ? TRACKING_URLS[order.carrier]?.(order.tracking_number) : null;
  const subject = locale === "en" ? "Your PAWN order has shipped" : "Deine PAWN-Bestellung ist unterwegs";
  const text = locale === "en"
    ? `Good news — ${designerName} has shipped your order.\n\nCarrier: ${order.carrier ?? "—"}\nTracking number: ${order.tracking_number ?? "—"}${trackUrl ? `\nTrack it here: ${trackUrl}` : ""}\n\nThe invoice is attached.\n\nQuestions? Just reply — it goes straight to ${designerName}.`
    : `Gute Nachricht — ${designerName} hat deine Bestellung versendet.\n\nVersanddienst: ${order.carrier ?? "—"}\nSendungsnummer: ${order.tracking_number ?? "—"}${trackUrl ? `\nVerfolgen: ${trackUrl}` : ""}\n\nDie Rechnung ist angehängt.\n\nFragen? Einfach antworten — die Nachricht geht direkt an ${designerName}.`;

  const from = await senderFrom(admin);
  const replyTo = await designerEmail(admin, designerUserId);
  const sent = await resendSend(from, order.customer_email, subject, text, replyTo, {
    filename: `Rechnung-${invoiceNumber}.pdf`, content: bytesToBase64(pdfBytes),
  });

  await admin.from("orders").update(
    sent.ok ? { shipped_email_sent_at: new Date().toISOString(), last_email_error: null } : { last_email_error: sent.error },
  ).eq("id", order.id);

  return { ok: true, emailSent: sent.ok, invoiceNumber, emailError: sent.ok ? undefined : sent.error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json() as Body;
    const userId = jwtSub(req.headers.get("Authorization"));
    if (!userId) return ok({ ok: false, error: "auth_required", message: "Bitte erneut anmelden." });

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, svc, { auth: { persistSession: false } });

    const { data: order } = await admin.from("orders").select("*").eq("id", body.order_id).maybeSingle();
    if (!order) return ok({ ok: false, error: "not_found", message: "Bestellung nicht gefunden." });

    const items = (order.items ?? []) as OrderLine[];
    const slugs = items.map((i) => i.slug).filter(Boolean) as string[];
    const { data: prods } = slugs.length
      ? await admin.from("products").select("designer_id").in("slug", slugs)
      : { data: [] as { designer_id: string }[] };
    const designerId = prods?.[0]?.designer_id as string | undefined;
    if (!designerId) return ok({ ok: false, error: "no_house", message: "Kein Haus zu dieser Bestellung gefunden." });

    const { data: designer } = await admin.from("designers").select("id, user_id, brand_name").eq("id", designerId).maybeSingle();
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    const isOwner = designer?.user_id === userId || !!roleRow;
    if (!isOwner) return ok({ ok: false, error: "forbidden", message: "Diese Bestellung gehört nicht zu deinem Haus." });

    if (body.action === "advance") {
      const status = body.status;
      if (!status || !["in_progress", "packed", "delivered"].includes(status)) {
        return ok({ ok: false, error: "invalid_status", message: "Unbekannter Status." });
      }
      const patch = status === "delivered"
        ? { fulfillment_status: status, delivered_at: new Date().toISOString() }
        : { fulfillment_status: status };
      const { error } = await admin.from("orders").update(patch).eq("id", order.id);
      if (error) return ok({ ok: false, error: "db_error", message: error.message });
      return ok({ ok: true });
    }

    if (body.action === "ship") {
      if (!body.tracking_number?.trim() || !body.carrier?.trim()) {
        return ok({ ok: false, error: "missing_tracking", message: "Bitte Sendungsnummer und Versanddienst angeben." });
      }
      const { data: billing } = await admin.from("designer_billing_profiles").select("*").eq("designer_id", designerId).maybeSingle();
      if (!billingComplete(billing as BillingProfile | null)) {
        return ok({
          ok: false, error: "billing_incomplete",
          message: "Bitte zuerst deine Rechnungsdaten unter „Auszahlung“ vollständig ausfüllen — ohne sie kann kein Versand abgeschlossen werden.",
        });
      }
      const { error } = await admin.from("orders").update({
        fulfillment_status: "shipped", tracking_number: body.tracking_number.trim(), carrier: body.carrier.trim(),
        shipped_at: new Date().toISOString(),
      }).eq("id", order.id);
      if (error) return ok({ ok: false, error: "db_error", message: error.message });

      const { data: freshOrder } = await admin.from("orders").select("*").eq("id", order.id).maybeSingle();
      const result = await sendShippedEmail(admin, freshOrder as OrderRow, designerId, designer!.brand_name, designer!.user_id);
      return ok(result);
    }

    if (body.action === "retry-email") {
      if (order.fulfillment_status !== "shipped") {
        return ok({ ok: false, error: "not_shipped", message: "Diese Bestellung wurde noch nicht als versendet markiert." });
      }
      const result = await sendShippedEmail(admin, order as OrderRow, designerId, designer!.brand_name, designer!.user_id);
      return ok(result);
    }

    return ok({ ok: false, error: "unknown_action", message: "Unbekannte Aktion." });
  } catch (e) {
    return ok({ ok: false, error: "unexpected", message: (e as Error)?.message ?? "Unbekannter Fehler." });
  }
});
