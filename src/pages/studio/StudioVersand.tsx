import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders, type DesignerOrderLine, type FulfillmentStatus } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Printer, Truck, Check, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";

type Bucket = "offen" | "unterwegs" | "erledigt";

interface Shipment {
  order_id: string;
  created_at: string;
  fulfillment_status: FulfillmentStatus;
  tracking_number: string | null;
  carrier: string | null;
  invoice_number: string | null;
  name: string;
  address: string[];
  lines: DesignerOrderLine[];
  totalWeight: number;
  total: number;
}

interface Sender {
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  return_address_line1: string | null;
  return_postal_code: string | null;
  return_city: string | null;
  return_country: string | null;
}

const CARRIERS = ["DHL", "DPD", "Hermes", "GLS", "UPS", "Deutsche Post", "Andere"];
const CARRIER_OTHER = "Andere";

function bucketOf(s: FulfillmentStatus): Bucket {
  if (s === "delivered") return "erledigt";
  if (s === "shipped") return "unterwegs";
  return "offen";
}

export default function StudioVersand() {
  const { t, locale } = useI18n();
  const { designer, loading } = useMyDesigner();
  const { lines, loading: ordersLoading, refresh } = useDesignerOrders(designer?.id);
  const [bucket, setBucket] = useState<Bucket>("offen");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sender, setSender] = useState<Sender | null>(null);
  const [draft, setDraft] = useState<Record<string, { carrier: string; tracking: string }>>({});
  const [printing, setPrinting] = useState<Shipment | null>(null);

  useEffect(() => {
    if (!designer?.id) return;
    let alive = true;
    void supabase.from("designer_billing_profiles").select("*").eq("designer_id", designer.id).maybeSingle()
      .then(({ data }) => { if (alive) setSender((data as Sender | null) ?? null); });
    return () => { alive = false; };
  }, [designer?.id]);

  const senderComplete = !!(sender?.legal_name && sender.address_line1 && sender.postal_code && sender.city);

  const shipments: Shipment[] = useMemo(() => {
    const m = new Map<string, Shipment>();
    for (const l of lines) {
      if (l.order_status !== "paid") continue;
      const cur = m.get(l.order_id) ?? {
        order_id: l.order_id,
        created_at: l.order_created_at,
        fulfillment_status: l.fulfillment_status,
        tracking_number: l.tracking_number,
        carrier: l.carrier,
        invoice_number: l.invoice_number,
        name: l.shipping_name ?? l.customer_first_name ?? t("studio.versand.defaultCustomer"),
        address: [
          l.shipping_name ?? "",
          l.shipping_address_line1 ?? "",
          l.shipping_address_line2 ?? "",
          [l.shipping_postal_code, l.shipping_city].filter(Boolean).join(" "),
          l.shipping_country ?? "",
        ].filter((x) => x.trim() !== ""),
        lines: [],
        totalWeight: 0,
        total: 0,
      };
      cur.lines.push(l);
      cur.total += l.unit_price * l.qty;
      cur.totalWeight += (l.weight_grams ?? 0) * l.qty;
      m.set(l.order_id, cur);
    }
    let arr = [...m.values()].filter((s) => bucketOf(s.fulfillment_status) === bucket);
    const needle = q.trim().toLowerCase();
    if (needle) {
      arr = arr.filter((s) =>
        s.name.toLowerCase().includes(needle) ||
        s.order_id.toLowerCase().includes(needle) ||
        (s.invoice_number ?? "").toLowerCase().includes(needle));
    }
    arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return arr;
  }, [lines, bucket, q]);

  const counts = useMemo(() => {
    const seen = new Map<string, FulfillmentStatus>();
    for (const l of lines) if (l.order_status === "paid") seen.set(l.order_id, l.fulfillment_status);
    const all = [...seen.values()];
    return {
      packen: all.filter((s) => s === "new" || s === "in_progress").length,
      bereit: all.filter((s) => s === "packed").length,
      unterwegs: all.filter((s) => s === "shipped").length,
      zugestellt: all.filter((s) => s === "delivered").length,
    };
  }, [lines]);

  const copyAddress = async (s: Shipment) => {
    try {
      await navigator.clipboard.writeText(s.address.join("\n"));
      toast.success(t("studio.versand.addressCopied"));
    } catch {
      toast.error(t("studio.versand.copyFailed"));
    }
  };

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("order-fulfillment", { body });
    if (error) return { ok: false, message: error.message } as { ok: boolean; message?: string };
    return data as { ok: boolean; message?: string; emailSent?: boolean };
  };

  const markShipped = async (s: Shipment) => {
    const d = draft[s.order_id] ?? { carrier: "DHL", tracking: "" };
    if (!d.tracking.trim()) { toast.error(t("studio.versand.trackingRequired")); return; }
    if (!senderComplete) { toast.error(t("studio.versand.billingRequired")); return; }
    setBusy(s.order_id);
    const res = await call({ order_id: s.order_id, action: "ship", tracking_number: d.tracking.trim(), carrier: d.carrier });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? t("studio.versand.shipFailed")); return; }
    toast.success(t("studio.versand.shipSuccess"));
    refresh();
  };

  const advance = async (s: Shipment, next: FulfillmentStatus) => {
    setBusy(s.order_id);
    const res = await call({ order_id: s.order_id, action: "advance", status: next });
    setBusy(null);
    if (!res.ok) { toast.error(res.message ?? t("studio.versand.statusFailed")); return; }
    refresh();
  };

  if (loading) return <StudioShell title={t("studio.versand.title")}><PawnLoading className="h-40" /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.versand.title")}><p className="text-muted-foreground">{t("studio.versand.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studio.versand.title")} eyebrow={t("studio.versand.eyebrow")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("studio.versand.stats.toPack")} value={counts.packen} />
        <Stat label={t("studio.versand.stats.readyToShip")} value={counts.bereit} />
        <Stat label={t("studio.versand.stats.inTransit")} value={counts.unterwegs} />
        <Stat label={t("studio.versand.stats.delivered")} value={counts.zugestellt} />
      </div>

      {senderComplete === false && (
        <div className="mt-6 border-[1.5px] border-dashed border-foreground p-4 text-sm">
          <p className="editorial-eyebrow">{t("studio.versand.senderMissing.title")}</p>
          <p className="mt-1">
            {t("studio.versand.senderMissing.body")}{" "}
            <Link to="/studio/auszahlung" className="underline underline-offset-2">{t("studio.versand.senderMissing.cta")}</Link>.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([["offen", t("studio.versand.bucket.open")], ["unterwegs", t("studio.versand.bucket.inTransit")], ["erledigt", t("studio.versand.bucket.done")]] as [Bucket, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setBucket(k)}
            className={`border-[1.5px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] ${bucket === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("studio.versand.searchPlaceholder")}
          className="ml-auto w-full max-w-xs border-[1.5px] border-border bg-white px-3 py-1.5 text-sm focus:border-foreground focus:outline-none" />
      </div>

      {ordersLoading ? (
        <PawnLoading className="mt-6 h-40" />
      ) : shipments.length === 0 ? (
        <PawnEmptyState className="mt-6 p-12" title={t("studio.versand.empty.title")} description={t("studio.versand.empty.body")} />
      ) : (
        <ul className="mt-6 space-y-4">
          {shipments.map((s) => {
            const d = draft[s.order_id] ?? { carrier: s.carrier ?? "DHL", tracking: s.tracking_number ?? "" };
            const hoursOpen = (Date.now() - new Date(s.created_at).getTime()) / 36e5;
            const overdue = bucketOf(s.fulfillment_status) === "offen" && hoursOpen > 48;
            return (
              <li key={s.order_id} className="border-[1.5px] border-foreground bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
                  <p className="font-serif text-lg">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("de-DE")} · {t("studio.versand.orderShort", { id: s.order_id.slice(0, 8) })} · {formatPrice(s.total, locale)}
                  </p>
                </div>

                {overdue && (
                  <p className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("studio.versand.overdueWarning")}
                  </p>
                )}

                <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
                  <div>
                    <p className="editorial-eyebrow mb-1">{t("studio.versand.deliveryAddress")}</p>
                    <p className="whitespace-pre-line text-sm">{s.address.length ? s.address.join("\n") : t("studio.versand.noAddress")}</p>
                    <button onClick={() => copyAddress(s)} disabled={!s.address.length}
                      className="mt-2 inline-flex items-center gap-1.5 border-[1.5px] border-border px-3 py-1 text-[0.6rem] uppercase tracking-[0.24em] hover:border-foreground disabled:opacity-40">
                      <Copy className="h-3 w-3" /> {t("studio.versand.copyAddressBtn")}
                    </button>
                  </div>

                  <div>
                    <p className="editorial-eyebrow mb-1">{t("studio.versand.contents")}</p>
                    <ul className="space-y-1 text-sm">
                      {s.lines.map((l, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span>
                            {l.product_name}
                            {l.size && <span className="text-muted-foreground"> · {t("studio.versand.sizeLabel", { size: l.size })}</span>}
                            <span className="text-muted-foreground"> × {l.qty}</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">{l.weight_grams ? `${l.weight_grams} g` : t("studio.versand.weightUnknown")}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("studio.versand.totalWeightLabel")} <span className="text-foreground">{s.totalWeight > 0 ? `${s.totalWeight} g` : t("studio.versand.notProvided")}</span>
                      {s.lines[0]?.length_cm && (
                        <> · {t("studio.versand.packageSize", { length: s.lines[0].length_cm, width: s.lines[0].width_cm ?? "?", height: s.lines[0].height_cm ?? "?" })}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-border px-5 py-4">
                  {bucketOf(s.fulfillment_status) === "offen" && (
                    <>
                      <label className="block">
                        <span className="editorial-eyebrow">{t("studio.versand.carrierLabel")}</span>
                        <select value={d.carrier}
                          onChange={(e) => setDraft((p) => ({ ...p, [s.order_id]: { ...d, carrier: e.target.value } }))}
                          className="mt-1 block border-[1.5px] border-foreground bg-white px-3 py-2 text-sm">
                          {CARRIERS.map((c) => <option key={c}>{c === CARRIER_OTHER ? t("studio.versand.carrierOther") : c}</option>)}
                        </select>
                      </label>
                      <label className="block flex-1 min-w-[180px]">
                        <span className="editorial-eyebrow">{t("studio.versand.trackingLabel")}</span>
                        <input value={d.tracking}
                          onChange={(e) => setDraft((p) => ({ ...p, [s.order_id]: { ...d, tracking: e.target.value } }))}
                          className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" placeholder={t("studio.versand.trackingPlaceholder")} />
                      </label>
                      <button disabled={busy === s.order_id} onClick={() => markShipped(s)}
                        className="inline-flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-black disabled:opacity-40">
                        <Truck className="h-3 w-3" /> {t("studio.versand.markShippedBtn")}
                      </button>
                    </>
                  )}
                  {s.fulfillment_status === "shipped" && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t("studio.versand.inTransitWith", { carrier: s.carrier ?? "—" })} <span className="text-foreground">{s.tracking_number ?? t("studio.versand.noTrackingNumber")}</span>
                      </p>
                      <button disabled={busy === s.order_id} onClick={() => advance(s, "delivered")}
                        className="ml-auto inline-flex items-center gap-2 border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background disabled:opacity-40">
                        <Check className="h-3 w-3" /> {t("studio.versand.markDeliveredBtn")}
                      </button>
                    </>
                  )}
                  {s.fulfillment_status === "delivered" && (
                    <p className="text-xs text-muted-foreground">{t("studio.versand.deliveredWith", { carrier: s.carrier ?? "—", tracking: s.tracking_number ?? "" })}</p>
                  )}
                  <button onClick={() => setPrinting(s)} disabled={!senderComplete}
                    className="inline-flex items-center gap-1.5 border-[1.5px] border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.24em] hover:border-foreground disabled:opacity-40">
                    <Printer className="h-3 w-3" /> {t("studio.versand.deliveryNoteBtn")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {printing && sender && (
        <DeliveryNote shipment={printing} sender={sender} house={designer.brand_name} onClose={() => setPrinting(null)} />
      )}
    </StudioShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-[1.5px] border-foreground bg-white px-4 py-3">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
    </div>
  );
}

function DeliveryNote({ shipment, sender, house, onClose }: { shipment: Shipment; sender: Sender; house: string; onClose: () => void }) {
  const { t } = useI18n();
  const senderLines = [
    sender.legal_name,
    sender.return_address_line1 ?? sender.address_line1,
    [sender.return_postal_code ?? sender.postal_code, sender.return_city ?? sender.city].filter(Boolean).join(" "),
    sender.return_country ?? sender.country,
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 print:static print:bg-white print:p-0" onClick={onClose}>
      <div className="w-full max-w-2xl border-[1.5px] border-foreground bg-white p-10 print:border-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="editorial-eyebrow">{t("studio.versand.deliveryNoteEyebrow")}</p>
            <h2 className="mt-1 font-serif text-2xl">{house}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("studio.versand.orderShort", { id: shipment.order_id.slice(0, 8) })}<br />
            {new Date(shipment.created_at).toLocaleDateString("de-DE")}
            {shipment.invoice_number && <><br />{t("studio.versand.invoiceLabel", { invoiceNumber: shipment.invoice_number })}</>}
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="editorial-eyebrow mb-1">{t("studio.versand.senderLabel")}</p>
            <p className="whitespace-pre-line text-sm">{senderLines.join("\n")}</p>
          </div>
          <div>
            <p className="editorial-eyebrow mb-1">{t("studio.versand.recipientLabel")}</p>
            <p className="whitespace-pre-line text-sm">{shipment.address.join("\n")}</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 font-normal editorial-eyebrow">{t("studio.versand.table.item")}</th>
              <th className="py-2 font-normal editorial-eyebrow">{t("studio.versand.table.size")}</th>
              <th className="py-2 text-right font-normal editorial-eyebrow">{t("studio.versand.table.qty")}</th>
            </tr>
          </thead>
          <tbody>
            {shipment.lines.map((l, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-2">{l.product_name}</td>
                <td className="py-2">{l.size ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">{l.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 text-xs text-muted-foreground">
          {t("studio.versand.footerNote", { weight: shipment.totalWeight > 0 ? `${shipment.totalWeight} g` : "—" })}
        </p>

        <div className="mt-8 flex justify-end gap-3 print:hidden">
          <button onClick={onClose} className="border-[1.5px] border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:border-foreground">{t("studio.versand.close")}</button>
          <button onClick={() => window.print()} className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-black">{t("studio.versand.print")}</button>
        </div>
      </div>
    </div>
  );
}
