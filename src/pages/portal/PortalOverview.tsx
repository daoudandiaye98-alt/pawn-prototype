import { PortalShell } from "@/components/pawn/PortalShell";
import { StatCard } from "@/components/pawn/StatCard";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { useStore, portalSelectors, adminSelectors } from "@/core";

const PortalOverview = () => {
  const studio = useStore((s) => portalSelectors.getStudioOverview(s, "primary"));
  const { orders: adminOrders } = useStore(adminSelectors.getPlatformOverview);
  const { products, revenueSeries, months: monthsShort } = studio;
  return (
    <PortalShell eyebrow="Y/PROJECT · Studio" title="Übersicht">
      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">Willkommen zurück</p>
        <h2 className="mt-2 font-serif text-4xl">Guten Abend, Studio Y/PROJECT.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hier ist eine Übersicht über deine Performance und ausstehende Aufgaben.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gesamtumsatz" value="€128.460" delta="+8.2%" trend="up" />
        <StatCard label="Bestellungen" value="284" delta="+24" trend="up" />
        <StatCard label="Offener Betrag" value="€18.420" delta="Auszahlung Mo." trend="neutral" />
        <StatCard label="Ausgezahlt" value="€110.040" trend="neutral" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Umsatzentwicklung</p>
          <ChartPlaceholder series={revenueSeries} labels={monthsShort} className="mt-4" variant="area" />
        </div>
        <div className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Umsatz nach Land</p>
          <ChartPlaceholder variant="bars" series={[42, 28, 22, 16, 12, 8]} labels={["DE", "FR", "UK", "US", "JP", "IT"]} className="mt-4" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Auszahlungen</p>
          <p className="mt-3 font-serif text-3xl">€18.420</p>
          <p className="text-xs text-muted-foreground">Nächste Auszahlung: Montag, 6. Juli 2026</p>
          <ul className="mt-4 divide-y divide-border text-sm">
            {[["Juni 2026", "€18.420"], ["Mai 2026", "€21.900"], ["Apr 2026", "€19.180"]].map(([m, v]) => (
              <li key={m} className="flex justify-between py-2"><span>{m}</span><span className="tabular-nums">{v}</span></li>
            ))}
          </ul>
        </div>
        <div className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Verkäufe nach Produkt</p>
          <ul className="mt-4 space-y-3 text-sm">
            {products.slice(0, 4).map((p, i) => (
              <li key={p.id}>
                <div className="flex justify-between"><span>{p.name}</span><span className="tabular-nums">{84 - i * 14}</span></div>
                <div className="mt-1 h-1 w-full bg-secondary">
                  <div className="h-full bg-accent" style={{ width: `${100 - i * 18}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Bankverbindung</p>
          <p className="mt-3 font-serif text-xl">DE89 3704 0044 0532 0130 00</p>
          <p className="mt-1 text-xs text-muted-foreground">Commerzbank · verifiziert</p>
          <button className="mt-4 text-xs uppercase tracking-[0.18em] underline-offset-4 hover:underline">Bearbeiten</button>
        </div>
      </div>

      <section className="mt-8 border border-border bg-card">
        <div className="border-b border-border p-6">
          <p className="editorial-eyebrow">Letzte Bestellungen</p>
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
    </PortalShell>
  );
};

export default PortalOverview;
