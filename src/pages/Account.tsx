import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useStore, selectors } from "@/core";
import { useAuth } from "@/lib/auth";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TABS = ["Übersicht", "Bestellungen", "Merkzettel", "Zahlung", "Meine Daten", "Einstellungen"] as const;
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
            {tab === "Zahlung" && <PaymentTab />}
            {tab === "Meine Daten" && <MyData />}
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

function MyData() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    const [profile, events, signals, sessions] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("domain_events").select("*").eq("actor", user.id).limit(500),
      supabase.from("domain_events").select("*").eq("type", "ai.taste_signal").contains("payload", { user_id: user.id }).limit(500),
      supabase.from("ai_sessions").select("*").eq("user_id", user.id),
    ]);
    const bundle = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile: profile.data,
      events: events.data,
      signals: signals.data,
      sessions: sessions.data,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pawn-daten-${user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBusy(false);
    toast.success("Deine Daten wurden heruntergeladen.");
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {});
    if (error || (data as { error?: string })?.error) {
      setBusy(false);
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Löschen fehlgeschlagen.");
      return;
    }
    await signOut();
    toast.success("Dein Konto wurde gelöscht.");
    navigate("/");
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="border border-[rgba(12,12,14,.13)] p-8">
        <p className="palace-eyebrow">Daten exportieren</p>
        <p className="palace-serif mt-3 text-[1.2rem] italic text-[#0C0C0E]">Alles, was wir über dich wissen — als JSON.</p>
        <p className="mt-3 text-[0.95rem] text-[#0C0C0E]/70">
          Profil, Ereignisse, Geschmackssignale und Chat-Sessions.
        </p>
        <button type="button" onClick={exportData} disabled={busy}
          className="palace-btn mt-6 disabled:opacity-50">
          {busy ? "…" : "JSON herunterladen"}
        </button>
      </div>
      <div className="border border-destructive/40 p-8">
        <p className="palace-eyebrow text-destructive">Konto löschen</p>
        <p className="palace-serif mt-3 text-[1.2rem] italic text-[#0C0C0E]">Das ist endgültig.</p>
        <p className="mt-3 text-[0.95rem] text-[#0C0C0E]/70">
          Wir entfernen dein Profil, deine Bewerbung, Consents, Sessions und Benachrichtigungen. Bestellungen und Buchhaltungsdaten
          bleiben — anonymisiert — aus gesetzlichen Gründen erhalten.
        </p>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)}
            className="mt-6 border border-destructive px-6 py-3 text-[0.7rem] uppercase tracking-[0.32em] text-destructive hover:bg-destructive hover:text-destructive-foreground">
            Konto löschen
          </button>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={deleteAccount} disabled={busy}
              className="border border-destructive bg-destructive px-6 py-3 text-[0.7rem] uppercase tracking-[0.32em] text-destructive-foreground disabled:opacity-50">
              {busy ? "…" : "Ja, endgültig löschen"}
            </button>
            <button type="button" onClick={() => setConfirming(false)}
              className="palace-btn">
              Abbrechen
            </button>
          </div>
        )}
      </div>
      <p className="palace-eyebrow">
        <Link to="/datenschutz" className="uline text-[#0C0C0E]">Datenschutzhinweise</Link>
      </p>
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

function PaymentTab() {
  return (
    <div className="max-w-xl border border-[rgba(12,12,14,.13)] p-8">
      <p className="palace-eyebrow">Zahlungsmethoden</p>
      <p className="palace-serif mt-4 text-[1.2rem] italic text-[#0C0C0E]">Noch keine hinterlegt.</p>
      <p className="mt-3 text-[0.95rem] text-[#0C0C0E]/70">Deine Zahlungsmethode wird bei der ersten Bestellung sicher über Stripe hinterlegt — verschlüsselt, nie auf unseren Servern gespeichert.</p>
    </div>
  );
}

export default Account;

