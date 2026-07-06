import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { Package, Megaphone, Receipt, MessageSquare, AlertTriangle, TrendingUp } from "lucide-react";

interface LowStock { id: string; name: string; slug: string; stock_quantity: number }
interface TopProduct { slug: string; name: string; qty: number; revenue: number }

export default function StudioOverview() {
  const { designer, loading } = useMyDesigner();
  const { lines, loading: ordersLoading } = useDesignerOrders(designer?.id);
  const [counts, setCounts] = useState({ products: 0, campaigns: 0, openRequests: 0 });
  const [lowStock, setLowStock] = useState<LowStock[]>([]);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [p, c, low, req] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
        supabase.from("products").select("id, name, slug, stock_quantity")
          .eq("designer_id", designer.id).eq("inventory_mode", "stock").lt("stock_quantity", 3)
          .order("stock_quantity").limit(6),
        supabase.from("message_threads").select("id", { count: "exact", head: true })
          .eq("designer_id", designer.id).eq("category", "produkt").eq("status", "open"),
      ]);
      setCounts({ products: p.count ?? 0, campaigns: c.count ?? 0, openRequests: req.count ?? 0 });
      setLowStock(((low.data ?? []) as LowStock[]));
    })();
  }, [designer]);

  const paid = useMemo(() => lines.filter((l) => l.order_status === "paid"), [lines]);
  const revenueEur = useMemo(() => paid.reduce((s, l) => s + l.unit_price * l.qty, 0), [paid]);
  const orderCount = useMemo(() => new Set(paid.map((l) => l.order_id)).size, [paid]);
  const topProducts: TopProduct[] = useMemo(() => {
    const m = new Map<string, TopProduct>();
    for (const l of paid) {
      const cur = m.get(l.product_slug) ?? { slug: l.product_slug, name: l.product_name, qty: 0, revenue: 0 };
      cur.qty += l.qty; cur.revenue += l.unit_price * l.qty;
      m.set(l.product_slug, cur);
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [paid]);

  if (loading) return <StudioShell title="Studio"><Skeleton /></StudioShell>;

  if (!designer) return (
    <StudioShell title="Studio" eyebrow="Willkommen">
      <div className="mx-auto max-w-xl border border-border bg-card p-10 text-center">
        <p className="editorial-eyebrow">Kein Studio-Zugang</p>
        <h2 className="mt-3 font-serif text-3xl">Dein Studio steht noch nicht.</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Sobald deine Bewerbung angenommen ist, findest du hier deine Brand-Page, Produkte, Kampagnen und Einblicke.
        </p>
        <Link to="/apply" className="mt-6 inline-flex border border-foreground px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
          Zur Bewerbung
        </Link>
      </div>
    </StudioShell>
  );

  return (
    <StudioShell title={designer.brand_name} eyebrow="Studio">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Umsatz (bezahlt)" value={`€ ${revenueEur.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`} icon={TrendingUp} loading={ordersLoading} />
        <KpiCard label="Bestellungen" value={String(orderCount)} link="/studio/bestellungen" icon={Receipt} loading={ordersLoading} />
        <KpiCard label="Produkte" value={String(counts.products)} link="/studio/produkte" icon={Package} />
        <KpiCard label="Offene Anfragen" value={String(counts.openRequests)} link="/studio/nachrichten" icon={MessageSquare} highlight={counts.openRequests > 0} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="editorial-eyebrow">Top-Seller</p>
            <Link to="/studio/bestellungen" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Alle Bestellungen →</Link>
          </div>
          {topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Noch keine bezahlten Bestellungen.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {topProducts.map((p) => (
                <li key={p.slug} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-serif text-base">{p.name}</p>
                    <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{p.qty} verkauft</p>
                  </div>
                  <p className="tabular-nums text-sm">€ {p.revenue.toLocaleString("de-DE")}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="editorial-eyebrow">Bestandswarnungen</p>
            <Link to="/studio/produkte" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Produkte →</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Alles im grünen Bereich.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <p className="font-serif text-base">{p.name}</p>
                  </div>
                  <p className={`tabular-nums text-sm ${p.stock_quantity === 0 ? "text-destructive" : ""}`}>
                    {p.stock_quantity === 0 ? "Ausverkauft" : `Noch ${p.stock_quantity}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 border border-border bg-card p-8">
        <p className="editorial-eyebrow">Nächste Schritte</p>
        <h2 className="mt-2 font-serif text-2xl">Alles bereit für deinen Auftritt</h2>
        <ol className="mt-6 space-y-4 text-sm">
          <Step n={1} label="Brand-Page fertigstellen" link="/studio/brand" done={!!designer.story} />
          <Step n={2} label="Erstes Produkt anlegen" link="/studio/produkte" done={counts.products > 0} />
          <Step n={3} label={counts.campaigns > 0 ? "Kampagnen prüfen" : "Kampagnenvorschläge abwarten"} link="/studio/kampagnen" done={counts.campaigns > 0} />
        </ol>
      </section>
    </StudioShell>
  );
}

function KpiCard({ label, value, link, icon: Icon, loading, highlight }: { label: string; value: string; link?: string; icon: React.ElementType; loading?: boolean; highlight?: boolean }) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="editorial-eyebrow">{label}</p>
          <p className={`mt-3 font-serif text-3xl ${highlight ? "text-foreground" : ""}`}>{loading ? "…" : value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </>
  );
  const cls = `block border ${highlight ? "border-foreground" : "border-border"} bg-card p-6 ${link ? "transition-colors hover:border-foreground" : ""}`;
  return link ? <Link to={link} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function Step({ n, label, link, done }: { n: number; label: string; link: string; done: boolean }) {
  return (
    <li className="flex items-center justify-between border-b border-border pb-3">
      <div className="flex items-center gap-4">
        <span className={`flex h-8 w-8 items-center justify-center border ${done ? "border-accent bg-accent text-accent-foreground" : "border-border"} text-[0.7rem]`}>{done ? "✓" : n}</span>
        <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
      </div>
      <Link to={link} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Öffnen →</Link>
    </li>
  );
}

function Skeleton() {
  return <div className="animate-pulse space-y-6"><div className="h-24 bg-muted"></div><div className="h-64 bg-muted"></div></div>;
}
