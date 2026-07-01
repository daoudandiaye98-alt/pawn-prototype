import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { useStore, selectors } from "@/core";
import { useAuth } from "@/lib/auth";
import { ProductImage } from "@/components/pawn/ProductImage";
import { Panel, PageHeader, Metric, Command, Timeline, Status, Hairline } from "@/components/pawn/primitives";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Orders", "Wishlist", "Addresses", "Payment", "Vouchers", "Returns", "Support", "Settings"] as const;
type Tab = typeof TABS[number];

const Account = () => {
  const [tab, setTab] = useState<Tab>("Overview");
  const { user, profile, loading, signOut, roles } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const displayName = profile?.displayName || user.email?.split("@")[0] || "Guest";
  const memberSince = new Date(user.created_at).getFullYear();

  return (
    <PublicLayout>
      <div className="editorial-container section-y">
        <PageHeader
          eyebrow="Welcome back"
          index="—"
          title={<span className="capitalize">{displayName}</span>}
          lede={
            <>
              {user.email} · Member since {memberSince}
              {roles.length > 0 && <span className="ml-2 t-eyebrow not-italic">· {roles.join(" / ")}</span>}
            </>
          }
          action={<Command variant="paper" onClick={signOut}>Sign out</Command>}
        />

        <Hairline className="mt-10" />

        <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-l-2 px-4 py-2 text-left t-eyebrow motion-micro",
                  tab === t ? "border-[hsl(var(--oxblood))] bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
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
            {tab === "Payment" && <PaymentMethods />}
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
        <Metric label="Lifetime spend" value="€4,820" delta="+€820 YTD" trend="up" />
        <Metric label="Orders" value="9" delta="2 in the last 30d" trend="neutral" />
        <Metric label="DNA score" value="87" delta="top 8%" trend="up" rationale={["Cohesion 92", "Edge 78", "Range 84"]} />
      </div>
      <Orders compact />
    </div>
  );
}

function Orders({ compact = false }: { compact?: boolean }) {
  const customerOrders = useStore(selectors.getCustomerOrders);
  return (
    <div className="space-y-6">
      <h2 className="t-display-md">{compact ? "Recent orders" : "All orders"}</h2>
      <ul className="space-y-4">
        {customerOrders.map((o) => {
          const reached = o.status === "Delivered" ? 4 : o.status === "In transit" ? 3 : 2;
          const steps = ["Placed", "Confirmed", "Shipped", "Delivered"].map((label, i) => ({
            label,
            reached: i < reached,
            current: i === reached - 1,
          }));
          const tone = o.status === "Delivered" ? "live" : o.status === "In transit" ? "watch" : "calm";
          return (
            <Panel key={o.id} eyebrow={`${o.id} · ${o.date}`} title={`€${o.total.toLocaleString("de-DE")}`} action={<Status tone={tone as never} label={o.status} />}>
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-start gap-6">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <ProductImage seed={it.name} className="h-20 w-16" />
                      <div>
                        <p className="t-eyebrow">{it.designer}</p>
                        <p className="t-display-sm">{it.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8"><Timeline steps={steps} /></div>
              </div>
            </Panel>
          );
        })}
      </ul>
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
    <Panel eyebrow={label} padding="md">
      <div className="p-6">
        <p className="t-display-sm">Alex Vogt</p>
        <p className="mt-1 t-body-sm text-muted-foreground">Bergmannstraße 24<br />10961 Berlin, Germany</p>
        <button className="mt-4 t-eyebrow underline-offset-4 hover:underline">Edit</button>
      </div>
    </Panel>
  );
}

function PaymentMethods() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel eyebrow="Default card">
        <div className="p-6">
          <p className="t-display-sm">•••• •••• •••• 4242</p>
          <p className="mt-1 t-body-sm text-muted-foreground">Visa · expires 08/29</p>
        </div>
      </Panel>
      <div className="border border-dashed border-[hsl(var(--border-strong))] p-6 text-center t-body-sm text-muted-foreground">
        + Add new method
      </div>
    </div>
  );
}

function Support() {
  return (
    <Panel eyebrow="Concierge" title="PAWN Concierge">
      <div className="p-6 md:p-8">
        <p className="t-body-md text-muted-foreground">Reach our customer team 24/7. Average response time: 2h.</p>
        <Command className="mt-6">Open a conversation</Command>
      </div>
    </Panel>
  );
}

function Settings() {
  return (
    <Panel eyebrow="Preferences" title="Settings">
      <div className="p-6 md:p-8">
        <p className="t-body-md text-muted-foreground">Notifications, privacy and language preferences.</p>
      </div>
    </Panel>
  );
}

function EmptyState({ title, cta, to }: { title: string; cta: string; to: string }) {
  return (
    <Panel padding="none">
      <div className="p-16 text-center">
        <p className="t-display-md">{title}</p>
        <Command asChild={false} className="mt-6" onClick={() => (window.location.href = to)}>
          <Link to={to}>{cta}</Link>
        </Command>
      </div>
    </Panel>
  );
}

export default Account;
