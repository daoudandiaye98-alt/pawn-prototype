import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders, type DesignerOrderLine, type FulfillmentStatus } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";

type StatusFilter = "alle" | "paid" | "pending" | "failed";

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "paid", label: "Bezahlt" },
  { key: "pending", label: "Offen" },
  { key: "failed", label: "Fehlgeschlagen" },
];

const CHAIN: { key: FulfillmentStatus; label: string }[] = [
  { key: "new", label: "Neu" },
  { key: "in_progress", label: "In Arbeit" },
  { key: "packed", label: "Verpackt" },
  { key: "shipped", label: "Versendet" },
  { key: "delivered", label: "Zugestellt" },
];

interface GroupedOrder {
  order_id: string;
  order_created_at: string;
  order_status: string;
  fulfillment_status: FulfillmentStatus;
  tracking_number: string | null;
  carrier: string | null;
  customer_first_name: string | null;
  customer_country: string | null;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  invoice_number: string | null;
  last_email_error: string | null;
  refunded_amount_cents: number;
  dispute_status: string | null;
  lines: DesignerOrderLine[];
  total: number;
}

async function callFulfillment(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; message?: string; emailSent?: boolean }> {
  const { data, error } = await supabase.functions.invoke("order-fulfillment", { body });
  if (error) return { ok: false, message: error.message };
  return data as { ok: boolean; error?: string; message?: string; emailSent?: boolean };
}

export default function StudioOrders() {
  const { designer, loading } = useMyDesigner();
  const { lines, loading: ordersLoading, refresh } = useDesignerOrders(designer?.id);
  const [filter, setFilter] = useState<StatusFilter>("alle");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<GroupedOrder | null>(null);
  const [billingComplete, setBillingComplete] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!designer?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from("designer_billing_profiles").select("*").eq("designer_id", designer.id).maybeSingle();
      if (!alive) return;
      const b = data as { legal_name: string | null; address_line1: string | null; postal_code: string | null; city: string | null; country: string | null; tax_id: string | null; kleinunternehmer: boolean } | null;
      setBillingComplete(!!(b?.legal_name && b.address_line1 && b.postal_code && b.city && b.country && (b.tax_id || b.kleinunternehmer)));
    })();
    return () => { alive = false; };
  }, [designer?.id]);

  const grouped: GroupedOrder[] = useMemo(() => {
    const m = new Map<string, GroupedOrder>();
    for (const l of lines) {
      const cur = m.get(l.order_id) ?? {
        order_id: l.order_id,
        order_created_at: l.order_created_at,
        order_status: l.order_status,
        fulfillment_status: l.fulfillment_status,
        tracking_number: l.tracking_number,
        carrier: l.carrier,
        customer_first_name: l.customer_first_name,
        customer_country: l.customer_country,
        shipping_name: l.shipping_name,
        shipping_address_line1: l.shipping_address_line1,
        shipping_address_line2: l.shipping_address_line2,
        shipping_postal_code: l.shipping_postal_code,
        shipping_city: l.shipping_city,
        shipping_country: l.shipping_country,
        invoice_number: l.invoice_number,
        last_email_error: l.last_email_error,
        refunded_amount_cents: l.refunded_amount_cents,
        dispute_status: l.dispute_status,
        lines: [],
        total: 0,
      };
      cur.lines.push(l);
      cur.total += l.unit_price * l.qty;
      m.set(l.order_id, cur);
    }
    let arr = [...m.values()];
    if (filter !== "alle") arr = arr.filter((o) => o.order_status === filter);
    arr.sort((a, b) => (a.order_created_at < b.order_created_at ? 1 : -1));
    return arr;
  }, [lines, filter]);

  const setFulfillment = async (order_id: string, next: FulfillmentStatus) => {
    if (next === "shipped") {
      const o = grouped.find((g) => g.order_id === order_id);
      if (!o) return;
      if (billingComplete === false) {
        toast.error("Bitte zuerst deine Rechnungsdaten unter „Auszahlung“ ausfüllen — ohne sie kann kein Versand abgeschlossen werden.");
        return;
      }
      setShippingOrder(o);
      return;
    }
    setBusy(order_id);
    const res = await callFulfillment({ order_id, action: "advance", status: next });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? "Status konnte nicht aktualisiert werden."); return; }
    toast.success("Status aktualisiert.");
    refresh();
  };

  const retryEmail = async (order_id: string) => {
    setBusy(order_id);
    const res = await callFulfillment({ order_id, action: "retry-email" });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? "Erneuter Versand fehlgeschlagen."); return; }
    toast.success(res.emailSent ? "E-Mail erneut gesendet." : "Rechnung erstellt — E-Mail-Versand hat aber wieder nicht geklappt.");
    refresh();
  };

  const downloadInvoice = async (order_id: string) => {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(`${order_id}.pdf`, 3600);
    if (error || !data?.signedUrl) { toast.error("Rechnung konnte nicht geöffnet werden."); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (loading) return <StudioShell title="Bestellungen"><div className="animate-pulse h-40 bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Bestellungen"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Bestellungen" eyebrow="Handel">
      <HowItWorks
        storageKey="orders"
        title="Bestellungen"
        intro="Jede bezahlte Bestellung durchläuft fünf Schritte: neu, in Arbeit, verpackt, versendet, zugestellt. Klick den nächsten Schritt an, wenn du dort bist — Käufer:innen sehen dieselbe Kette."
        steps={[
          "Bereite das Stück vor — Karton, Papier, Etikett.",
          "Beim Versand fragen wir dich nach Trackingnummer und Dienst.",
          'Ist der Empfang bestätigt, markiere „Zugestellt". Fertig.',
        ]}
      />

      {billingComplete === false && (
        <div className="mb-6 border-[1.5px] border-dashed border-foreground p-4 text-sm">
          <p className="editorial-eyebrow">Vor dem ersten Versand</p>
          <p className="mt-1">
            Deine Rechnungsdaten fehlen noch — ohne sie kann keine Bestellung als „versendet" markiert werden.{" "}
            <Link to="/studio/auszahlung" className="underline underline-offset-2">Jetzt ausfüllen</Link>.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`border-[1.5px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] ${filter === s.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{grouped.length} Bestellungen</span>
      </div>

      {ordersLoading ? (
        <div className="animate-pulse h-40 bg-muted" />
      ) : grouped.length === 0 ? (
        <div className="border-[1.5px] border-dashed border-foreground p-12 text-center">
          <p className="editorial-eyebrow">Leer</p>
          <p className="mt-3 font-serif text-2xl">Noch keine Bestellungen.</p>
          <p className="mt-2 text-sm text-muted-foreground">Sobald jemand eines deiner Stücke kauft, erscheint es hier.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {grouped.map((o) => (
            <li key={o.order_id} className="border-[1.5px] border-foreground bg-white">
              <button onClick={() => setExpanded(expanded === o.order_id ? null : o.order_id)}
                className="grid w-full grid-cols-[110px_1fr_120px_100px_60px] items-center gap-4 px-5 py-4 text-left hover:bg-muted/40">
                <span className="text-xs text-muted-foreground">{new Date(o.order_created_at).toLocaleDateString("de-DE")}</span>
                <span className="font-serif text-base">
                  {o.customer_first_name ?? "Kund:in"}{o.customer_country ? ` · ${o.customer_country}` : ""}
                  <span className="ml-2 text-xs text-muted-foreground">· {o.lines.length} Position(en)</span>
                </span>
                <span className="tabular-nums text-sm">€ {o.total.toLocaleString("de-DE")}</span>
                <span className="flex flex-wrap items-center gap-1">
                  <StatusPill status={o.order_status} />
                  {o.refunded_amount_cents > 0 && (
                    <span className="inline-block border border-black px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em]">
                      Erstattet
                    </span>
                  )}
                  {o.dispute_status && (
                    <span className="inline-block border border-black bg-black px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em] text-white">
                      Zahlungsstreit
                    </span>
                  )}
                </span>
                <span className="text-right text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{expanded === o.order_id ? "Zu" : "Auf"}</span>
              </button>
              {expanded === o.order_id && (
                <div className="border-t-[1.5px] border-foreground bg-white px-5 py-5">
                  {(o.refunded_amount_cents > 0 || o.dispute_status) && (
                    <div className="mb-5 border-[1.5px] border-black p-4 text-sm">
                      {o.refunded_amount_cents > 0 && (
                        <p>
                          <strong>Erstattet:</strong> € {(o.refunded_amount_cents / 100).toLocaleString("de-DE")} wurden
                          an die Kund:in zurückgezahlt. Die PAWN-Gebühr wurde anteilig mit erstattet.
                        </p>
                      )}
                      {o.dispute_status && (
                        <p className="mt-2">
                          <strong>Zahlungsstreit:</strong> Die Bank der Kund:in prüft diese Zahlung ({o.dispute_status}).
                          Reiche in deinem Stripe-Konto Belege ein — Versandnachweis und Fotos helfen am meisten.
                        </p>
                      )}
                    </div>
                  )}
                  {o.order_status === "paid" && (
                    <FulfillmentChain order={o} disabled={busy === o.order_id} onSet={(s) => setFulfillment(o.order_id, s)} />
                  )}
                  <ul className="mt-5 space-y-2">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>
                          {l.product_name}
                          {l.size && <span className="ml-2 text-xs text-muted-foreground">Größe: {l.size}</span>}
                          {l.variant && Object.keys(l.variant).length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {Object.entries(l.variant).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </span>
                          )}
                          <span className="ml-2 text-xs text-muted-foreground">× {l.qty}</span>
                        </span>
                        <span className="tabular-nums">€ {(l.unit_price * l.qty).toLocaleString("de-DE")}</span>
                      </li>
                    ))}
                  </ul>
                  {(o.shipping_address_line1 || o.shipping_name) && (
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                      <p className="editorial-eyebrow mb-1">Lieferanschrift</p>
                      <p className="text-foreground">
                        {o.shipping_name && <>{o.shipping_name}<br /></>}
                        {o.shipping_address_line1}{o.shipping_address_line2 ? `, ${o.shipping_address_line2}` : ""}<br />
                        {[o.shipping_postal_code, o.shipping_city].filter(Boolean).join(" ")} {o.shipping_country}
                      </p>
                    </div>
                  )}
                  {o.tracking_number && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Tracking: <span className="text-foreground">{o.tracking_number}</span>
                      {o.carrier && <> · {o.carrier}</>}
                    </p>
                  )}
                  {o.invoice_number && (
                    <button onClick={() => downloadInvoice(o.order_id)} className="mt-2 text-xs underline underline-offset-2">
                      Rechnung {o.invoice_number} herunterladen
                    </button>
                  )}
                  {o.last_email_error && (
                    <div className="mt-3 border-[1.5px] border-dashed border-foreground p-3 text-xs">
                      <p>E-Mail an den Kunden ist fehlgeschlagen: {o.last_email_error}</p>
                      <p className="mt-1 text-muted-foreground">Die Bestellung selbst ist davon nicht betroffen.</p>
                      <button
                        disabled={busy === o.order_id}
                        onClick={() => retryEmail(o.order_id)}
                        className="mt-2 border-[1.5px] border-foreground px-3 py-1 text-[0.6rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background disabled:opacity-40"
                      >
                        Erneut senden
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {shippingOrder && (
        <ShippingDialog
          order={shippingOrder}
          onClose={() => setShippingOrder(null)}
          onDone={async (tracking, carrier) => {
            setBusy(shippingOrder.order_id);
            const res = await callFulfillment({ order_id: shippingOrder.order_id, action: "ship", tracking_number: tracking, carrier });
            setBusy(null);
            if (!res.ok) { toast.error(res.message ?? "Versand konnte nicht abgeschlossen werden."); return; }
            toast.success(res.emailSent === false
              ? "Versendet — die Bestätigungs-Mail an den Kunden ist aber fehlgeschlagen (siehe unten)."
              : "Versendet — der Kunde bekommt eine Nachricht.");
            setShippingOrder(null);
            refresh();
          }}
        />
      )}
    </StudioShell>
  );
}

function FulfillmentChain({ order, onSet, disabled }: { order: GroupedOrder; onSet: (s: FulfillmentStatus) => void; disabled: boolean }) {
  const currentIdx = CHAIN.findIndex((c) => c.key === order.fulfillment_status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CHAIN.map((step, i) => {
        const done = i <= currentIdx;
        const isNext = i === currentIdx + 1;
        return (
          <div key={step.key} className="flex items-center">
            <button
              type="button"
              disabled={disabled || i > currentIdx + 1}
              onClick={() => onSet(step.key)}
              className={`flex items-center gap-2 border-[1.5px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] transition-colors disabled:opacity-40 ${
                done
                  ? "border-foreground bg-foreground text-background"
                  : isNext
                    ? "border-foreground bg-white text-foreground hover:bg-foreground hover:text-background"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done && <Check className="h-3 w-3" />}
              {step.label}
            </button>
            {i < CHAIN.length - 1 && <span className={`mx-1 h-px w-4 ${i < currentIdx ? "bg-foreground" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ShippingDialog({ order, onClose, onDone }: { order: GroupedOrder; onClose: () => void; onDone: (tracking: string, carrier: string) => void | Promise<void> }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("DHL");
  const [sending, setSending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md border-[1.5px] border-foreground bg-white p-8" onClick={(e) => e.stopPropagation()}>
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Versand · Bestellung {order.order_id.slice(0, 8)}</p>
        {step === 0 && (
          <div className="mt-6">
            <p className="font-serif text-xl">Karton bereit?</p>
            <p className="mt-2 text-sm text-muted-foreground">Ist das Stück gut verpackt, mit deiner Karte oder Notiz?</p>
            <div className="mt-6 flex gap-2">
              <button className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background" onClick={() => setStep(1)}>Ja, weiter</button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={onClose}>Später</button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="mt-6">
            <p className="font-serif text-xl">Etikett gedruckt?</p>
            <p className="mt-2 text-sm text-muted-foreground">Klebe es fest an, keine Falten über dem Barcode.</p>
            <div className="mt-6 flex gap-2">
              <button className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background" onClick={() => setStep(2)}>Ja, weiter</button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={() => setStep(0)}>Zurück</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="mt-6">
            <p className="font-serif text-xl">Tracking eintragen.</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Dienst</span>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm">
                  <option>DHL</option><option>DPD</option><option>Hermes</option><option>GLS</option><option>UPS</option><option>Deutsche Post</option><option>Andere</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Sendungsnummer</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 font-mono text-sm" placeholder="00340…" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                disabled={!tracking.trim() || sending}
                className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background disabled:opacity-40"
                onClick={async () => { setSending(true); await onDone(tracking.trim(), carrier); setSending(false); }}
              >
                {sending ? "Wird versendet…" : "Fertig — versenden"}
              </button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={() => setStep(1)}>Zurück</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "border-foreground text-foreground",
    pending: "border-border text-muted-foreground",
    failed: "border-foreground bg-foreground text-background",
  };
  return <span className={`inline-block border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em] ${map[status] ?? "border-border text-muted-foreground"}`}>{status}</span>;
}
