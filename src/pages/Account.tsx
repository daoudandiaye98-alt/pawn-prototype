import { useState } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { Button } from "@/components/ui/button";
import { customerOrders } from "@/data/mock";
import { ProductImage } from "@/components/pawn/ProductImage";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Orders", "Wishlist", "Addresses", "Payment Methods", "Vouchers", "Returns", "Support", "Settings"] as const;
type Tab = typeof TABS[number];

const Account = () => {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <PublicLayout>
      <div className="editorial-container py-12">
        <p className="editorial-eyebrow">Welcome back</p>
        <h1 className="mt-3 font-serif text-5xl">Alex Vogt</h1>
        <p className="mt-2 text-sm text-muted-foreground">alex@pawn.studio · Member since 2024</p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-l-2 px-4 py-2 text-left text-xs uppercase tracking-[0.22em]",
                  tab === t ? "border-accent bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </nav>

          <section>
            {tab === "Overview" && <Overview />}
            {tab === "Orders" && <Orders />}
            {tab === "Wishlist" && <EmptyState title="Your wishlist is empty." cta="Browse the boutique" to="/shop" />}
            {tab === "Addresses" && <Addresses />}
            {tab === "Payment Methods" && <PaymentMethods />}
            {tab === "Vouchers" && <EmptyState title="No vouchers, yet." cta="Discover the boutique" to="/shop" />}
            {tab === "Returns" && <EmptyState title="No active returns." cta="View orders" to="#" />}
            {tab === "Support" && <Support />}
            {tab === "Settings" && <Settings />}
          </section>
        </div>
      </div>
    </PublicLayout>
  );
};

function Overview() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <KPI label="Lifetime spend" value="€4,820" />
        <KPI label="Orders" value="9" />
        <KPI label="DNA score" value="87" tone="accent" />
      </div>
      <Orders compact />
    </div>
  );
}

function Orders({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <h2 className="font-serif text-2xl">{compact ? "Recent orders" : "All orders"}</h2>
      <ul className="mt-6 space-y-4">
        {customerOrders.map((o) => (
          <li key={o.id} className="border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="editorial-eyebrow">{o.id} · {o.date}</p>
                <p className="mt-1 font-serif text-xl">€{o.total.toLocaleString("de-DE")}</p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div className="mt-6 flex items-start gap-4">
              {o.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  <ProductImage seed={it.name} className="h-20 w-16" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{it.designer}</p>
                    <p className="font-serif text-base">{it.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <Timeline status={o.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timeline({ status }: { status: string }) {
  const steps = ["Placed", "Confirmed", "Shipped", "Delivered"];
  const reached = status === "Delivered" ? 4 : status === "In transit" ? 3 : 2;
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2">
      {steps.map((s, i) => (
        <li key={s} className={cn("border-t-2 pt-3", i < reached ? "border-accent" : "border-border")}>
          <p className={cn("text-[0.65rem] uppercase tracking-[0.22em]", i < reached ? "text-foreground" : "text-muted-foreground")}>{s}</p>
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]">{status}</span>;
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className={cn("border border-border bg-card p-6", tone === "accent" && "border-accent bg-accent/5")}>
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </div>
  );
}

function Addresses() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AddressCard label="Default · Shipping" />
      <AddressCard label="Billing" />
    </div>
  );
}

function AddressCard({ label }: { label: string }) {
  return (
    <div className="border border-border bg-card p-6">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-3 font-serif text-xl">Alex Vogt</p>
      <p className="mt-1 text-sm text-muted-foreground">Bergmannstraße 24<br />10961 Berlin, Germany</p>
      <button className="mt-4 text-xs uppercase tracking-[0.18em] underline-offset-4 hover:underline">Edit</button>
    </div>
  );
}

function PaymentMethods() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="border border-border bg-card p-6">
        <p className="editorial-eyebrow">Default card</p>
        <p className="mt-3 font-serif text-xl">•••• •••• •••• 4242</p>
        <p className="mt-1 text-sm text-muted-foreground">Visa · expires 08/29</p>
      </div>
      <div className="border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
        + Add new method
      </div>
    </div>
  );
}

function Support() {
  return (
    <div className="border border-border bg-card p-8">
      <h2 className="font-serif text-2xl">PAWN Concierge</h2>
      <p className="mt-2 text-sm text-muted-foreground">Reach our customer team 24/7. Average response time: 2h.</p>
      <Button className="mt-6 rounded-none">Open a conversation</Button>
    </div>
  );
}

function Settings() {
  return (
    <div className="border border-border bg-card p-8">
      <h2 className="font-serif text-2xl">Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Notifications, privacy and language preferences.</p>
    </div>
  );
}

function EmptyState({ title, cta, to }: { title: string; cta: string; to: string }) {
  return (
    <div className="border border-border bg-card p-16 text-center">
      <p className="font-serif text-3xl">{title}</p>
      <Button asChild className="mt-6 rounded-none"><Link to={to}>{cta}</Link></Button>
    </div>
  );
}

export default Account;
