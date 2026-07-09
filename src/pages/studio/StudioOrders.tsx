import { useMemo, useState } from "react";
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
  lines: DesignerOrderLine[];
  total: number;
}

export default function StudioOrders() {
  const { designer, loading } = useMyDesigner();
  const { lines, loading: ordersLoading, refresh } = useDesignerOrders(designer?.id);
  const [filter, setFilter] = useState<StatusFilter>("alle");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shippingOrder, setShippingOrder] = useState<GroupedOrder | null>(null);

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
      if (o) { setShippingOrder(o); return; }
    }
    const patch = next === "delivered"
      ? { fulfillment_status: next, delivered_at: new Date().toISOString() }
      : { fulfillment_status: next };
    const { error } = await supabase.from("orders").update(patch).eq("id", order_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status aktualisiert.");
    refresh();
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
                <StatusPill status={o.order_status} />
                <span className="text-right text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{expanded === o.order_id ? "Zu" : "Auf"}</span>
              </button>
              {expanded === o.order_id && (
                <div className="border-t-[1.5px] border-foreground bg-white px-5 py-5">
                  {o.order_status === "paid" && <FulfillmentChain order={o} onSet={(s) => setFulfillment(o.order_id, s)} />}
                  <ul className="mt-5 space-y-2">
                    {o.lines.map((l, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span>
                          {l.product_name}
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
                  {o.tracking_number && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Tracking: <span className="text-foreground">{o.tracking_number}</span>
                      {o.carrier && <> · {o.carrier}</>}
                    </p>
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
            const patch = {
              fulfillment_status: "shipped" as FulfillmentStatus,
              tracking_number: tracking,
              carrier,
              shipped_at: new Date().toISOString(),
            };
            const { error } = await supabase.from("orders").update(patch).eq("id", shippingOrder.order_id);
            if (error) { toast.error(error.message); return; }
            toast.success("Versendet — der Kunde bekommt eine Nachricht.");
            setShippingOrder(null);
            refresh();
          }}
        />
      )}
    </StudioShell>
  );
}

function FulfillmentChain({ order, onSet }: { order: GroupedOrder; onSet: (s: FulfillmentStatus) => void }) {
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
              disabled={i > currentIdx + 1}
              onClick={() => onSet(step.key)}
              className={`flex items-center gap-2 border-[1.5px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] transition-colors ${
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
                  <option>DHL</option><option>Hermes</option><option>DPD</option><option>UPS</option><option>Deutsche Post</option><option>Andere</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Sendungsnummer</span>
                <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 font-mono text-sm" placeholder="00340…" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                disabled={!tracking.trim()}
                className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-background disabled:opacity-40"
                onClick={() => onDone(tracking.trim(), carrier)}
              >
                Fertig — versenden
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
    paid: "border-emerald-500/60 text-emerald-600",
    pending: "border-amber-500/60 text-amber-600",
    failed: "border-red-500/60 text-red-600",
  };
  return <span className={`inline-block border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em] ${map[status] ?? "border-border text-muted-foreground"}`}>{status}</span>;
}
