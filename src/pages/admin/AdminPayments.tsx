import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string; user_id: string | null; amount_total: number; currency: string;
  status: string; stripe_session_id: string | null; customer_email: string | null; created_at: string;
}

export default function AdminPayments() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    void supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setOrders((data ?? []) as Order[]));
  }, []);

  const totalPaid = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount_total, 0);
  const countPaid = orders.filter((o) => o.status === "paid").length;
  const countPending = orders.filter((o) => o.status === "pending").length;

  return (
    <AdminShell title="Zahlungen" eyebrow="Handel">
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Umsatz (bezahlt)" value={`€ ${(totalPaid / 100).toLocaleString("de-DE")}`} />
        <Stat label="Bestellungen bezahlt" value={String(countPaid)} />
        <Stat label="Bestellungen offen" value={String(countPending)} />
      </div>
      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr className="text-left text-[0.68rem] uppercase tracking-[0.24em] text-muted-foreground">
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Kunde</th>
              <th className="px-4 py-3">Betrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3">{new Date(o.created_at).toLocaleString("de-DE")}</td>
                <td className="px-4 py-3">{o.customer_email ?? o.user_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">€ {(o.amount_total / 100).toLocaleString("de-DE")}</td>
                <td className="px-4 py-3 uppercase tracking-widest text-xs">{o.status}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.stripe_session_id?.slice(0, 20) ?? "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Noch keine Bestellungen.</td></tr>
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
