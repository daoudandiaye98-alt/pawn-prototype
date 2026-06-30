import { AdminShell } from "@/components/pawn/AdminShell";
import { StatCard } from "@/components/pawn/StatCard";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { adminOrders, revenueSeries, monthsShort } from "@/data/mock";

const AdminOverview = () => {
  return (
    <AdminShell eyebrow="Kontrollhub" title="Übersicht">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gesamtumsatz" value="€482.910" delta="+12.4% vs. Vormonat" trend="up" />
        <StatCard label="Bestellungen" value="1.284" delta="+186 neu" trend="up" />
        <StatCard label="Ø Bestellwert" value="€376" delta="−2.1%" trend="down" />
        <StatCard label="Neue Kunden" value="312" delta="+18%" trend="up" />
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="editorial-eyebrow">Umsatzentwicklung</p>
              <h2 className="mt-1 font-serif text-2xl">12 Monate</h2>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-accent">+18.6%</span>
          </div>
          <ChartPlaceholder series={revenueSeries} labels={monthsShort} className="mt-6" variant="area" />
        </section>
        <section className="space-y-4">
          <div className="border border-border bg-card p-6">
            <p className="editorial-eyebrow">Bestellstatus</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["In Bearbeitung", 184],
                ["Versandt", 412],
                ["Geliefert", 642],
                ["Retoure", 46],
              ].map(([l, v]) => (
                <li key={l} className="flex items-center justify-between">
                  <span>{l}</span>
                  <span className="tabular-nums">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-border bg-card p-6">
            <p className="editorial-eyebrow">Top Designer</p>
            <ol className="mt-4 space-y-2 text-sm">
              {["Y/PROJECT", "Rick Owens", "LEMAIRE", "1017 ALYX 9SM"].map((d, i) => (
                <li key={d} className="flex items-center justify-between">
                  <span>{i + 1}. {d}</span>
                  <span className="tabular-nums text-muted-foreground">€{(120 - i * 14).toFixed(0)}K</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <section className="mt-10 border border-border bg-card">
        <div className="border-b border-border p-6">
          <p className="editorial-eyebrow">Letzte Aktivität</p>
          <h2 className="mt-1 font-serif text-2xl">Aktuelle Bestellungen</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              <th className="px-6 py-3">Bestellung</th>
              <th className="px-6 py-3">Kunde</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Datum</th>
              <th className="px-6 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {adminOrders.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3 font-mono text-xs">{o.id}</td>
                <td className="px-6 py-3">{o.customer}</td>
                <td className="px-6 py-3"><span className="border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em]">{o.status}</span></td>
                <td className="px-6 py-3 text-muted-foreground">{o.date}</td>
                <td className="px-6 py-3 text-right tabular-nums">€{o.total.toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
};

export default AdminOverview;
