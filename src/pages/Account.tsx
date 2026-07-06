import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useStore, selectors } from "@/core";
import { useAuth } from "@/lib/auth";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { cn } from "@/lib/utils";

const TABS = ["Übersicht", "Bestellungen", "Merkzettel", "Adressen", "Zahlung", "Einstellungen"] as const;
type Tab = typeof TABS[number];

const Account = () => {
  const [tab, setTab] = useState<Tab>("Übersicht");
  const { user, profile, loading, signOut, roles } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const displayName = profile?.displayName || user.email?.split("@")[0] || "Gast";
  const memberSince = new Date(user.created_at).getFullYear();

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1400px]">
          <p className="palace-eyebrow">Konto · Mitglied seit {memberSince}</p>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
            <h1
              className="palace-serif font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.2rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              <span className="capitalize">{displayName}</span>.
            </h1>
            <div className="flex items-center gap-6">
              <p className="palace-eyebrow">
                {user.email}
                {roles.length > 0 && <span className="ml-3 text-[#0C0C0E]">· {roles.join(" / ")}</span>}
              </p>
              <button type="button" onClick={signOut} className="palace-eyebrow uline text-[#0C0C0E]">
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-14 md:py-24">
        <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-row flex-wrap gap-2 border-t border-[rgba(12,12,14,.13)] pt-6 lg:flex-col lg:border-t-0 lg:pt-0">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "palace-eyebrow py-2 text-left transition-colors duration-300",
                  tab === t ? "text-[#0C0C0E]" : "text-[#7C7972] hover:text-[#0C0C0E]",
                )}
              >
                {t}
              </button>
            ))}
          </nav>

          <div>
            {tab === "Übersicht" && <Overview name={displayName} />}
            {tab === "Bestellungen" && <Orders />}
            {tab === "Merkzettel" && <Empty title="Dein Merkzettel ist noch leer." to="/neu" cta="Ausstellung ansehen" />}
            {tab === "Adressen" && <Addresses />}
            {tab === "Zahlung" && <Payment />}
            {tab === "Einstellungen" && <Settings />}
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
};

function Overview({ name }: { name: string }) {
  return (
    <div className="space-y-16">
      <div className="grid gap-8 md:grid-cols-3">
        {[
          { label: "Gesehen", value: "42", note: "in den letzten 30 Tagen" },
          { label: "Gemerkt", value: "8", note: "Stücke" },
          { label: "Bestellt", value: "3", note: "Ateliers" },
        ].map((m) => (
          <div key={m.label} className="border-t border-[rgba(12,12,14,.13)] pt-6">
            <p className="palace-eyebrow">{m.label}</p>
            <p className="palace-serif mt-4 text-[2.4rem] font-light leading-none tabular-nums text-[#0C0C0E]">
              {m.value}
            </p>
            <p className="mt-2 font-serif italic text-[#0C0C0E]/70">{m.note}</p>
          </div>
        ))}
      </div>
      <p className="palace-serif italic text-[1.15rem] text-[#0C0C0E]/80">
        Willkommen zurück, {name}. Der Raum hat sich gemerkt, wo du zuletzt warst.
      </p>
    </div>
  );
}

function Orders() {
  const customerOrders = useStore(selectors.getCustomerOrders);
  if (customerOrders.length === 0) {
    return <Empty title="Noch keine Bestellungen." to="/neu" cta="Ausstellung ansehen" />;
  }
  return (
    <ul className="divide-y divide-[rgba(12,12,14,.13)]">
      {customerOrders.map((o) => (
        <li key={o.id} className="grid grid-cols-1 gap-6 py-10 md:grid-cols-[120px_1fr_auto] md:items-center">
          <EditorialImage seed={`order-${o.id}`} ratio="1/1" className="w-24" />
          <div>
            <p className="palace-eyebrow">{o.id} · {o.date}</p>
            <p className="palace-serif mt-2 text-[1.4rem] italic text-[#0C0C0E]">
              €{o.total.toLocaleString("de-DE")}
            </p>
            <p className="mt-2 font-serif italic text-[#0C0C0E]/70">{o.items.length} Stück · {o.status}</p>
          </div>
          <span className="palace-eyebrow">{o.status}</span>
        </li>
      ))}
    </ul>
  );
}

function Addresses() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {["Versand · Standard", "Rechnung"].map((label) => (
        <div key={label} className="border border-[rgba(12,12,14,.13)] p-8">
          <p className="palace-eyebrow">{label}</p>
          <p className="palace-serif mt-4 text-[1.2rem] italic">Alex Vogt</p>
          <p className="mt-2 text-[0.95rem] text-[#0C0C0E]/70">Bergmannstraße 24<br />10961 Berlin, Deutschland</p>
          <button type="button" className="palace-eyebrow uline mt-6 text-[#0C0C0E]">Bearbeiten</button>
        </div>
      ))}
    </div>
  );
}

function Payment() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="border border-[rgba(12,12,14,.13)] p-8">
        <p className="palace-eyebrow">Hinterlegte Karte</p>
        <p className="palace-serif mt-4 text-[1.2rem] tabular-nums">•••• 4242</p>
        <p className="mt-2 font-serif italic text-[#0C0C0E]/70">Visa · 08/29</p>
      </div>
      <button type="button" className="border border-dashed border-[rgba(12,12,14,.28)] p-8 text-center palace-eyebrow text-[#0C0C0E]">
        + Neue Zahlungsart
      </button>
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-xl border border-[rgba(12,12,14,.13)] p-8">
      <p className="palace-eyebrow">Präferenzen</p>
      <p className="palace-serif mt-4 text-[1.2rem] italic text-[#0C0C0E]">Ruhig, aufmerksam, nie aufdringlich.</p>
      <p className="mt-3 text-[0.95rem] text-[#0C0C0E]/70">Sprache, Benachrichtigungen und Datenschutz.</p>
    </div>
  );
}

function Empty({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-6 border-t border-[rgba(12,12,14,.13)] pt-16">
      <p className="palace-serif text-[1.5rem] italic text-[#0C0C0E]">{title}</p>
      <Link to={to} className="palace-btn">{cta} →</Link>
    </div>
  );
}

export default Account;
