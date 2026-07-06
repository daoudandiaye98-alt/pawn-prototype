import { useMemo, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders, type DesignerOrderLine } from "@/features/studio/useDesignerOrders";

type StatusFilter = "alle" | "paid" | "pending" | "failed";

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "paid", label: "Bezahlt" },
  { key: "pending", label: "Offen" },
  { key: "failed", label: "Fehlgeschlagen" },
];

interface GroupedOrder {
  order_id: string;
  order_created_at: string;
  order_status: string;
  customer_first_name: string | null;
  customer_country: string | null;
  lines: DesignerOrderLine[];
  total: number;
}

export default function StudioOrders() {
  const { designer, loading } = useMyDesigner();
  const { lines, loading: ordersLoading } = useDesignerOrders(designer?.id);
  const [filter, setFilter] = useState<StatusFilter>("alle");
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped: GroupedOrder[] = useMemo(() => {
    const m = new Map<string, GroupedOrder>();
    for (const l of lines) {
      const cur = m.get(l.order_id) ?? {
        order_id: l.order_id,
        order_created_at: l.order_created_at,
        order_status: l.order_status,
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

  if (loading) return <StudioShell title="Bestellungen"><div className="animate-pulse h-40 bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Bestellungen"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Bestellungen" eyebrow="Handel">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] ${filter === s.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{grouped.length} Bestellungen</span>
      </div>

      {ordersLoading ? (
        <div className="animate-pulse h-40 bg-muted" />
      ) : grouped.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <p className="editorial-eyebrow">Leer</p>
          <p className="mt-3 font-serif text-2xl">Noch keine Bestellungen.</p>
          <p className="mt-2 text-sm text-muted-foreground">Sobald jemand eines deiner Stücke kauft, erscheint es hier.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card">
          {grouped.map((o) => (
            <li key={o.order_id}>
              <button onClick={() => setExpanded(expanded === o.order_id ? null : o.order_id)}
                className="grid w-full grid-cols-[110px_1fr_120px_100px_60px] items-center gap-4 px-5 py-4 text-left hover:bg-secondary/40">
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
                <div className="border-t border-border bg-secondary/20 px-5 py-4">
                  <ul className="space-y-2">
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
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </StudioShell>
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
