import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders, type DesignerOrderLine, type FulfillmentStatus } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type StatusFilter = "alle" | "paid" | "pending" | "failed";

const STATUS_KEYS: { key: StatusFilter; labelKey: string }[] = [
  { key: "alle", labelKey: "studio.orders.filter.all" },
  { key: "paid", labelKey: "studio.orders.filter.paid" },
  { key: "pending", labelKey: "studio.orders.filter.pending" },
  { key: "failed", labelKey: "studio.orders.filter.failed" },
];

const CHAIN_KEYS: { key: FulfillmentStatus; labelKey: string }[] = [
  { key: "new", labelKey: "studio.orders.chain.new" },
  { key: "in_progress", labelKey: "studio.orders.chain.inProgress" },
  { key: "packed", labelKey: "studio.orders.chain.packed" },
  { key: "shipped", labelKey: "studio.orders.chain.shipped" },
  { key: "delivered", labelKey: "studio.orders.chain.delivered" },
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
  const { t } = useI18n();
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
        toast.error(t("studio.orders.toast.billingRequired"));
        return;
      }
      setShippingOrder(o);
      return;
    }
    setBusy(order_id);
    const res = await callFulfillment({ order_id, action: "advance", status: next });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? t("studio.orders.toast.statusUpdateFailed")); return; }
    toast.success(t("studio.orders.toast.statusUpdated"));
    refresh();
  };

  const retryEmail = async (order_id: string) => {
    setBusy(order_id);
    const res = await callFulfillment({ order_id, action: "retry-email" });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? t("studio.orders.toast.resendFailed")); return; }
    toast.success(res.emailSent ? t("studio.orders.toast.emailResent") : t("studio.orders.toast.invoiceCreatedEmailFailed"));
    refresh();
  };

  const downloadInvoice = async (order_id: string) => {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(`${order_id}.pdf`, 3600);
    if (error || !data?.signedUrl) { toast.error(t("studio.orders.toast.invoiceOpenFailed")); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (loading) return <StudioShell title={t("studio.orders.title")}><PawnLoading className="h-40" /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.orders.title")}><p className="text-muted-foreground">{t("studio.orders.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studio.orders.title")} eyebrow={t("studio.orders.eyebrow")}>
      <HowItWorks
        storageKey="orders"
        title={t("studio.orders.title")}
        intro={t("studio.orders.howItWorks.intro")}
        steps={[
          t("studio.orders.howItWorks.step1"),
          t("studio.orders.howItWorks.step2"),
          t("studio.orders.howItWorks.step3"),
        ]}
      />

      {billingComplete === false && (
        <div className="mb-6 border-[1.5px] border-dashed border-foreground p-4 text-sm">
          <p className="editorial-eyebrow">{t("studio.orders.billingNotice.eyebrow")}</p>
          <p className="mt-1">
            {t("studio.orders.billingNotice.body")}{" "}
            <Link to="/studio/auszahlung" className="underline underline-offset-2">{t("studio.orders.billingNotice.cta")}</Link>.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATUS_KEYS.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`border-[1.5px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] ${filter === s.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {t(s.labelKey)}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{t("studio.orders.count", { n: grouped.length })}</span>
      </div>

      {ordersLoading ? (
        <PawnLoading className="h-40" />
      ) : grouped.length === 0 ? (
        <PawnEmptyState className="p-12" title={t("studio.orders.empty.title")} description={t("studio.orders.empty.body")} />
      ) : (
        <ul className="space-y-3">
          {grouped.map((o) => (
            <li key={o.order_id} className="border-[1.5px] border-foreground bg-white">
              <button onClick={() => setExpanded(expanded === o.order_id ? null : o.order_id)}
                className="grid w-full grid-cols-[110px_1fr_120px_100px_60px] items-center gap-4 px-5 py-4 text-left hover:bg-muted/40">
                <span className="text-xs text-muted-foreground">{new Date(o.order_created_at).toLocaleDateString("de-DE")}</span>
                <span className="font-serif text-base">
                  {o.customer_first_name ?? t("studio.orders.customerFallback")}{o.customer_country ? ` · ${o.customer_country}` : ""}
                  <span className="ml-2 text-xs text-muted-foreground">· {t("studio.orders.lineCount", { n: o.lines.length })}</span>
                </span>
                <span className="tabular-nums text-sm">€ {o.total.toLocaleString("de-DE")}</span>
                <span className="flex flex-wrap items-center gap-1">
                  <StatusPill status={o.order_status} />
                  {o.refunded_amount_cents > 0 && (
                    <span className="inline-block border border-black px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em]">
                      {t("studio.orders.refundedBadge")}
                    </span>
                  )}
                  {o.dispute_status && (
                    <span className="inline-block border border-black bg-black px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em] text-white">
                      {t("studio.orders.disputeBadge")}
                    </span>
                  )}
                </span>
                <span className="text-right text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{expanded === o.order_id ? t("studio.orders.toggle.closed") : t("studio.orders.toggle.open")}</span>
              </button>
              {expanded === o.order_id && (
                <div className="border-t-[1.5px] border-foreground bg-white px-5 py-5">
                  {(o.refunded_amount_cents > 0 || o.dispute_status) && (
                    <div className="mb-5 border-[1.5px] border-black p-4 text-sm">
                      {o.refunded_amount_cents > 0 && (
                        <p>
                          <strong>{t("studio.orders.refundNotice.label")}</strong> {t("studio.orders.refundNotice.body", { amount: (o.refunded_amount_cents / 100).toLocaleString("de-DE") })}
                        </p>
                      )}
                      {o.dispute_status && (
                        <p className="mt-2">
                          <strong>{t("studio.orders.disputeNotice.label")}</strong> {t("studio.orders.disputeNotice.body", { status: o.dispute_status })}
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
                          {l.size && <span className="ml-2 text-xs text-muted-foreground">{t("studio.orders.line.size", { size: l.size })}</span>}
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
                      <p className="editorial-eyebrow mb-1">{t("studio.orders.shipping.addressEyebrow")}</p>
                      <p className="text-foreground">
                        {o.shipping_name && <>{o.shipping_name}<br /></>}
                        {o.shipping_address_line1}{o.shipping_address_line2 ? `, ${o.shipping_address_line2}` : ""}<br />
                        {[o.shipping_postal_code, o.shipping_city].filter(Boolean).join(" ")} {o.shipping_country}
                      </p>
                    </div>
                  )}
                  {o.tracking_number && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {t("studio.orders.shipping.trackingLabel")} <span className="text-foreground">{o.tracking_number}</span>
                      {o.carrier && <> · {o.carrier}</>}
                    </p>
                  )}
                  {o.invoice_number && (
                    <button onClick={() => downloadInvoice(o.order_id)} className="mt-2 text-xs underline underline-offset-2">
                      {t("studio.orders.invoice.downloadButton", { number: o.invoice_number })}
                    </button>
                  )}
                  {o.last_email_error && (
                    <div className="mt-3 border-[1.5px] border-dashed border-foreground p-3 text-xs">
                      <p>{t("studio.orders.emailError.message", { error: o.last_email_error })}</p>
                      <p className="mt-1 text-muted-foreground">{t("studio.orders.emailError.note")}</p>
                      <button
                        disabled={busy === o.order_id}
                        onClick={() => retryEmail(o.order_id)}
                        className="mt-2 border-[1.5px] border-foreground px-3 py-1 text-[0.6rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background disabled:opacity-40"
                      >
                        {t("studio.orders.emailError.retryButton")}
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
            if (!res.ok) { toast.error(res.message ?? t("studio.orders.toast.shippingFailed")); return; }
            toast.success(res.emailSent === false
              ? t("studio.orders.toast.shippedEmailFailed")
              : t("studio.orders.toast.shippedNotified"));
            setShippingOrder(null);
            refresh();
          }}
        />
      )}
    </StudioShell>
  );
}

function FulfillmentChain({ order, onSet, disabled }: { order: GroupedOrder; onSet: (s: FulfillmentStatus) => void; disabled: boolean }) {
  const { t } = useI18n();
  const currentIdx = CHAIN_KEYS.findIndex((c) => c.key === order.fulfillment_status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CHAIN_KEYS.map((step, i) => {
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
              {t(step.labelKey)}
            </button>
            {i < CHAIN_KEYS.length - 1 && <span className={`mx-1 h-px w-4 ${i < currentIdx ? "bg-foreground" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ShippingDialog({ order, onClose, onDone }: { order: GroupedOrder; onClose: () => void; onDone: (tracking: string, carrier: string) => void | Promise<void> }) {
  const { t } = useI18n();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("DHL");
  const [sending, setSending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md border-[1.5px] border-foreground bg-white p-8" onClick={(e) => e.stopPropagation()}>
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.orders.shippingDialog.header", { id: order.order_id.slice(0, 8) })}</p>
        {step === 0 && (
          <div className="mt-6">
            <p className="font-serif text-xl">{t("studio.orders.shippingDialog.step0.title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("studio.orders.shippingDialog.step0.body")}</p>
            <div className="mt-6 flex gap-2">
              <button className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background" onClick={() => setStep(1)}>{t("studio.orders.shippingDialog.continue")}</button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={onClose}>{t("studio.orders.shippingDialog.later")}</button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="mt-6">
            <p className="font-serif text-xl">{t("studio.orders.shippingDialog.step1.title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("studio.orders.shippingDialog.step1.body")}</p>
            <div className="mt-6 flex gap-2">
              <button className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background" onClick={() => setStep(2)}>{t("studio.orders.shippingDialog.continue")}</button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={() => setStep(0)}>{t("common.back")}</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="mt-6">
            <p className="font-serif text-xl">{t("studio.orders.shippingDialog.step2.title")}</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.orders.shippingDialog.carrierLabel")}</span>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm">
                  <option>DHL</option><option>DPD</option><option>Hermes</option><option>GLS</option><option>UPS</option><option>Deutsche Post</option><option>{t("studio.orders.shippingDialog.carrierOther")}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.orders.shippingDialog.trackingNumberLabel")}</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 font-mono text-sm" placeholder="00340…" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                disabled={!tracking.trim() || sending}
                className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background disabled:opacity-40"
                onClick={async () => { setSending(true); await onDone(tracking.trim(), carrier); setSending(false); }}
              >
                {sending ? t("studio.orders.shippingDialog.sending") : t("studio.orders.shippingDialog.submit")}
              </button>
              <button className="px-3 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground" onClick={() => setStep(1)}>{t("common.back")}</button>
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
