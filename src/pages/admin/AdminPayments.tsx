import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string; user_id: string | null; amount_total: number; currency: string;
  status: string; stripe_session_id: string | null; customer_email: string | null;
  created_at: string; items: unknown;
}
interface DesignerLite { id: string; brand_name: string; slug: string; revenue_share_pct: number; house_number: number | null }
interface ProductLite { id: string; slug: string; designer_id: string; price: number; name: string }

interface BusinessProfile {
  account_holder: string; iban: string; bic: string;
  email: string; instagram: string; tiktok: string;
}

export default function AdminPayments() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [designers, setDesigners] = useState<DesignerLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [designerFilter, setDesignerFilter] = useState<string>("alle");
  const [loading, setLoading] = useState(true);

  const [commissionPct, setCommissionPct] = useState<number>(7);
  const [commissionInput, setCommissionInput] = useState<string>("7");
  const [commissionBusy, setCommissionBusy] = useState(false);
  const [payout, setPayout] = useState<BusinessProfile | null>(null);
  const [payoutMasked, setPayoutMasked] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, d, p, cCommission, cBusiness] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("designers").select("id, brand_name, slug, revenue_share_pct, house_number").eq("status", "active").order("brand_name"),
        supabase.from("products").select("id, slug, designer_id, price, name"),
        supabase.from("ai_config").select("value").eq("key", "platform_commission").maybeSingle(),
        supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle(),
      ]);
      setOrders((o.data ?? []) as Order[]);
      setDesigners((d.data ?? []) as DesignerLite[]);
      setProducts((p.data ?? []) as ProductLite[]);
      const pct = Number(((cCommission.data?.value ?? {}) as { pct?: number }).pct ?? 7);
      setCommissionPct(pct); setCommissionInput(String(pct));
      setPayout((cBusiness.data?.value ?? null) as BusinessProfile | null);
      setLoading(false);
    })();
  }, []);

  const productBySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const designerById = useMemo(() => new Map(designers.map((d) => [d.id, d])), [designers]);

  const perDesigner = useMemo(() => {
    const map = new Map<string, { revenue: number; qty: number; orders: Set<string> }>();
    for (const o of orders) {
      if (o.status !== "paid") continue;
      const items = Array.isArray(o.items) ? o.items as Array<Record<string, unknown>> : [];
      for (const it of items) {
        const slug = String(it.slug ?? "");
        const prod = productBySlug.get(slug);
        if (!prod) continue;
        const qty = Number(it.qty ?? 1);
        const unit = Number(it.price ?? prod.price);
        const cur = map.get(prod.designer_id) ?? { revenue: 0, qty: 0, orders: new Set<string>() };
        cur.revenue += unit * qty;
        cur.qty += qty;
        cur.orders.add(o.id);
        map.set(prod.designer_id, cur);
      }
    }
    return map;
  }, [orders, productBySlug]);

  const filteredOrders = useMemo(() => {
    if (designerFilter === "alle") return orders;
    return orders.filter((o) => {
      const items = Array.isArray(o.items) ? o.items as Array<Record<string, unknown>> : [];
      return items.some((it) => productBySlug.get(String(it.slug ?? ""))?.designer_id === designerFilter);
    });
  }, [orders, designerFilter, productBySlug]);

  const totalPaid = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount_total, 0);
  const countPaid = orders.filter((o) => o.status === "paid").length;
  const countPending = orders.filter((o) => o.status === "pending").length;

  const saveCommission = async () => {
    const n = Number(commissionInput);
    if (!Number.isFinite(n) || n < 0 || n > 50) { toast.error("Bitte einen Wert zwischen 0 und 50 %."); return; }
    setCommissionBusy(true);
    const { error } = await supabase.from("ai_config").upsert(
      { key: "platform_commission", value: { pct: n, note: "PAWN-Anteil je Verkauf" } },
      { onConflict: "key" },
    );
    setCommissionBusy(false);
    if (error) { toast.error(error.message); return; }
    setCommissionPct(n);
    toast.success(`Plattform-Provision gespeichert: ${n} %`);
  };

  return (
    <AdminShell title="Zahlungen" eyebrow="Handel">
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Umsatz (bezahlt)" value={`€ ${(totalPaid / 100).toLocaleString("de-DE")}`} />
        <Stat label="Bestellungen bezahlt" value={String(countPaid)} />
        <Stat label="Bestellungen offen" value={String(countPending)} />
      </div>

      {/* Plattform-Provision */}
      <section className="mb-8 border border-border bg-white">
        <div className="border-b border-border px-4 py-3">
          <p className="editorial-eyebrow">Plattform-Provision · PAWN-Anteil je Verkauf</p>
        </div>
        <div className="flex flex-wrap items-end gap-4 p-5">
          <div>
            <label className="editorial-eyebrow block">Prozentsatz</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number" min={0} max={50} step={0.5}
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="w-24 border border-border bg-background px-3 py-2 tabular-nums"
              />
              <span className="text-sm">%</span>
            </div>
          </div>
          <p className="max-w-lg text-sm text-muted-foreground">
            PAWN nimmt bewusst weniger als klassische Galerien oder Marktplätze — der Designer erhält{" "}
            <span className="tabular-nums font-medium text-foreground">{100 - commissionPct} %</span> jedes Verkaufs.
          </p>
          <button
            onClick={saveCommission}
            disabled={commissionBusy || Number(commissionInput) === commissionPct}
            className="ml-auto border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-40"
          >
            {commissionBusy ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </section>

      {/* Payout Account (Platform) */}
      <section className="mb-10 border border-border bg-white">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="editorial-eyebrow">Auszahlungskonto (Plattform) · nur Admin sichtbar</p>
          <button onClick={() => setPayoutMasked((v) => !v)}
            className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground">
            {payoutMasked ? "Anzeigen" : "Verbergen"}
          </button>
        </div>
        {payout ? (
          <div className="grid grid-cols-1 gap-4 p-5 text-sm md:grid-cols-2">
            <Field label="Kontoinhaber" value={payout.account_holder} mono />
            <Field label="IBAN" value={payoutMasked ? mask(payout.iban) : payout.iban} mono />
            <Field label="BIC" value={payout.bic} mono />
            <Field label="E-Mail" value={payout.email} mono />
            <Field label="Instagram" value={"@" + payout.instagram} />
            <Field label="TikTok" value={"@" + payout.tiktok} />
            <p className="md:col-span-2 border-t border-border pt-4 text-xs text-muted-foreground">
              Stripe-Auszahlungen: dieses Konto im Stripe-Dashboard unter <span className="font-medium text-foreground">Auszahlungen</span> hinterlegen.
              Die Handles <span className="font-medium text-foreground">@{payout.instagram}</span> und <span className="font-medium text-foreground">@{payout.tiktok}</span> sind in den Posting-Integrationen vorbelegt.
            </p>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Kein Geschäftsprofil hinterlegt.</p>
        )}
      </section>

      {/* Payout preview per designer */}
      <section className="mb-10 border border-border">
        <div className="border-b border-border bg-secondary px-4 py-3">
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
            Auszahlungsvorschau · Designer erhält {100 - commissionPct} %, PAWN {commissionPct} %
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Lade …</div>
        ) : perDesigner.size === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Noch keine bezahlten Bestellungen.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                <th className="px-4 py-3">Designer</th>
                <th className="px-4 py-3">Bestellungen</th>
                <th className="px-4 py-3">Stück</th>
                <th className="px-4 py-3">Umsatz</th>
                <th className="px-4 py-3">Auszahlung</th>
                <th className="px-4 py-3">PAWN-Anteil</th>
              </tr>
            </thead>
            <tbody>
              {[...perDesigner.entries()]
                .map(([designerId, r]) => ({ designer: designerById.get(designerId), r, designerId }))
                .filter((x) => x.designer)
                .sort((a, b) => b.r.revenue - a.r.revenue)
                .map(({ designer, r, designerId }) => {
                  const share = 100 - commissionPct;
                  const payout = r.revenue * (share / 100);
                  const platform = r.revenue - payout;
                  return (
                    <tr key={designerId} className="border-t border-border">
                      <td className="px-4 py-3 font-serif">
                        {designer!.brand_name}
                        {designer!.house_number != null && (
                          <span className="ml-2 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">Designer {designer!.house_number}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{r.orders.size}</td>
                      <td className="px-4 py-3 tabular-nums">{r.qty}</td>
                      <td className="px-4 py-3 tabular-nums">€ {r.revenue.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 tabular-nums font-medium">€ {payout.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">€ {platform.toLocaleString("de-DE", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>

      {/* Orders list */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Designer-Filter</label>
        <select value={designerFilter} onChange={(e) => setDesignerFilter(e.target.value)}
          className="border border-border bg-background px-3 py-1.5 text-sm">
          <option value="alle">Alle</option>
          {designers.map((d) => <option key={d.id} value={d.id}>{d.brand_name}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{filteredOrders.length} Bestellungen</span>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr className="text-left text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Bestellung</th>
              <th className="px-4 py-3">Betrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3">{new Date(o.created_at).toLocaleString("de-DE")}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3 tabular-nums">€ {(o.amount_total / 100).toLocaleString("de-DE")}</td>
                <td className="px-4 py-3 uppercase tracking-widest text-xs">{o.status}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.stripe_session_id?.slice(0, 20) ?? "—"}</td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Keine Bestellungen im Filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-6">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="editorial-eyebrow">{label}</p>
      <p className={`mt-2 ${mono ? "font-mono text-[0.85rem]" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function mask(s: string): string {
  const t = s.replace(/\s/g, "");
  if (t.length <= 8) return "•".repeat(t.length);
  return t.slice(0, 4) + " •••• •••• " + t.slice(-4);
}
