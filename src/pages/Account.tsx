import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { useStore, selectors } from "@/core";
import { useAuth } from "@/lib/auth";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMyRequestThreads } from "@/features/commerce/hooks";
import { useThreadMessages, sendMessage } from "@/features/messages/useMessages";
import { useDisplayName } from "@/lib/displayName";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { Sparkles } from "lucide-react";

/* Hairline PAWN icons (stroke 1.25) */
const IOverview = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M3 15h14M5 15V8l5-4 5 4v7M9 15v-4h2v4" /></svg>
);
const IOrders = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M4 4h12l-1 12H5L4 4zM7 8h6M7 11h6" /></svg>
);
const IRequests = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M3 5h14v9H8l-5 3V5z" /></svg>
);
const IWish = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M10 16s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0116 8c0 4.5-6 8-6 8z" /></svg>
);
const IPayment = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="6" width="14" height="10" /><path d="M3 9h14M7 13h3" /></svg>
);
const IData = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><ellipse cx="10" cy="5" rx="6" ry="2" /><path d="M4 5v5c0 1.1 2.7 2 6 2s6-.9 6-2V5M4 10v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" /></svg>
);
const ISettings = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><circle cx="10" cy="10" r="2.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></svg>
);

const TABS = [
  { key: "Übersicht", icon: IOverview },
  { key: "Bestellungen", icon: IOrders },
  { key: "Anfragen", icon: IRequests },
  { key: "Merkzettel", icon: IWish },
  { key: "Zahlung", icon: IPayment },
  { key: "Meine Daten", icon: IData },
  { key: "Einstellungen", icon: ISettings },
] as const;
type Tab = typeof TABS[number]["key"];

function useMemberNumber(userId?: string) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("member_number").eq("id", userId).maybeSingle();
      setN((data?.member_number as number | null) ?? null);
    })();
  }, [userId]);
  return n;
}

const Account = () => {
  const [tab, setTab] = useState<Tab>("Übersicht");
  const { user, loading, signOut, roles } = useAuth();
  const { displayName, firstName } = useDisplayName();
  const memberNumber = useMemberNumber(user?.id);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (roles.includes("designer")) return <Navigate to="/studio" replace />;

  const memberSince = new Date(user.created_at).getFullYear();

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1400px]">
          <p className="palace-eyebrow">Konto</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1
                className="palace-serif font-light text-[#000000]"
                style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
              >
                Guten Tag, <span className="capitalize italic">{firstName}</span>.
              </h1>
              <p className="mt-4 flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#000000]/70">
                <span className="inline-flex items-center gap-1.5 border border-[rgba(0,0,0,.22)] px-2.5 py-1">
                  <span className="font-serif text-sm leading-none">♟</span>
                  User {memberNumber ?? "—"}
                </span>
                <span>Mitglied seit {memberSince}</span>
              </p>
            </div>
            <button type="button" onClick={signOut} className="palace-eyebrow uline text-[#000000]">
              Abmelden
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-14 md:py-20">
        <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[220px_1fr]">
          {/* Desktop cell nav */}
          <nav className="hidden lg:flex flex-col border-t border-[rgba(0,0,0,.18)] pt-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 text-left text-[0.72rem] uppercase tracking-[0.22em] transition-colors",
                    active
                      ? "bg-[#000000] text-white"
                      : "text-[#7C7972] hover:bg-[#000000] hover:text-white",
                  )}
                >
                  {active && <span className="absolute left-0 top-0 h-full w-[1.5px] bg-[#000000]" />}
                  <t.icon className="h-4 w-4 shrink-0" />
                  <span>{t.key}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile chip bar */}
          <nav className="lg:hidden -mx-6 flex gap-2 overflow-x-auto px-6 pb-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.24em] transition-colors",
                    active
                      ? "border-[#000000] bg-[#000000] text-white"
                      : "border-[rgba(0,0,0,.22)] text-[#000000]",
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.key}
                </button>
              );
            })}
          </nav>

          <div>
            {tab === "Übersicht" && <Overview name={displayName} onGoto={setTab} />}
            {tab === "Bestellungen" && <Card><Orders /></Card>}
            {tab === "Anfragen" && <Card><Requests /></Card>}
            {tab === "Merkzettel" && <Card><Empty title="Dein Merkzettel ist noch leer." to="/neu" cta="Ausstellung ansehen" /></Card>}
            {tab === "Zahlung" && <Card><PaymentTab /></Card>}
            {tab === "Meine Daten" && <MyData />}
            {tab === "Einstellungen" && <Card><Settings /></Card>}
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border-[1.5px] border-[#000000] bg-white p-6 md:p-8">{children}</div>;
}

function openChat() {
  window.dispatchEvent(new CustomEvent("palace:open-chat"));
}

function Overview({ name, onGoto }: { name: string; onGoto: (t: Tab) => void }) {
  const firstName = name.split(/\s+/)[0];
  const customerOrders = useStore(selectors.getCustomerOrders);
  const { ids: wishIds } = useWishlist();
  const { threads } = useMyRequestThreads();

  const stats = [
    { label: "Bestellungen", value: customerOrders.length, tab: "Bestellungen" as Tab },
    { label: "Merkzettel", value: wishIds.size, tab: "Merkzettel" as Tab },
    { label: "Offene Anfragen", value: threads.filter((t) => t.status === "open").length, tab: "Anfragen" as Tab },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onGoto(s.tab)}
            className="border-[1.5px] border-[#000000] bg-white p-6 text-left transition-colors hover:bg-[rgba(0,0,0,.04)]"
          >
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">{s.label}</p>
            <p className="palace-serif mt-3 text-4xl font-semibold text-[#000000]" style={{ fontWeight: 600 }}>
              {s.value}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={openChat}
          className="group flex flex-col justify-between border-[1.5px] border-[#000000] bg-[#000000] p-6 text-left text-white transition-transform hover:-translate-y-0.5"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-white/60">Frag PAWN</p>
            <p className="palace-serif mt-3 text-[1.15rem] italic leading-snug">
              Dein Concierge — Fragen zu Bestellungen, Stücken, deiner DNA.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-white">
            <Sparkles className="h-3 w-3" /> Chat öffnen →
          </span>
        </button>
      </div>

      <Card>
        <p className="palace-serif italic text-[1.1rem] text-[#000000]/80">
          Schön dich zu sehen, <span className="capitalize">{firstName}</span>. Ruhig hier — genau richtig zum Stöbern.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { title: "Deine Bestellungen", body: "Verfolge, was unterwegs ist.", tab: "Bestellungen" as Tab },
            { title: "Merkzettel", body: "Stücke, die du dir gemerkt hast.", tab: "Merkzettel" as Tab },
            { title: "Deine Daten", body: "Konto, Datenschutz, Export.", tab: "Meine Daten" as Tab },
          ].map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => onGoto(t.tab)}
              className="border border-[rgba(0,0,0,.18)] p-5 text-left transition-colors hover:border-[#000000]"
            >
              <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[#7C7972]">{t.tab}</p>
              <p className="palace-serif mt-2 text-[1.1rem] text-[#000000]">{t.title}</p>
              <p className="mt-2 text-sm text-[#000000]/70">{t.body}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Requests() {
  const { user } = useAuth();
  const { threads, loading, refresh } = useMyRequestThreads();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { messages, listRef } = useThreadMessages(activeId);
  const [reply, setReply] = useState("");
  const active = threads.find((t) => t.id === activeId) ?? null;

  const send = async () => {
    if (!activeId || !user || !reply.trim()) return;
    const { error } = await sendMessage(activeId, user.id, reply.trim());
    if (error) return toast.error(error.message);
    setReply(""); refresh();
  };

  if (loading) return <p className="palace-eyebrow">Lade …</p>;
  if (threads.length === 0) return <Empty title="Noch keine Anfragen." to="/neu" cta="Ausstellung ansehen" />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="border-t border-[rgba(0,0,0,.18)]">
        <ul className="divide-y divide-[rgba(0,0,0,.14)]">
          {threads.map((t) => (
            <li key={t.id}>
              <button onClick={() => setActiveId(t.id)}
                className={`block w-full px-1 py-4 text-left ${activeId === t.id ? "bg-[rgba(0,0,0,.04)]" : ""}`}>
                <p className="palace-eyebrow">
                  {t.designer?.brand_name ?? "Atelier"}
                  {t.category === "produkt" && <span className="ml-2 border border-[rgba(0,0,0,.28)] px-1.5 py-0.5 text-[0.5rem] tracking-[0.28em]">PRODUKT</span>}
                </p>
                <p className="palace-serif mt-1 text-[1.1rem] italic text-[#000000]">{t.subject}</p>
                {t.product && <p className="mt-1 text-[0.75rem] text-[#7C7972]">→ {t.product.name}</p>}
                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.28em] text-[#7C7972]">{new Date(t.last_message_at).toLocaleDateString("de-DE")} · {t.status}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="border border-[rgba(0,0,0,.18)] p-6 min-h-[50vh] flex flex-col">
        {!active ? (
          <p className="palace-eyebrow text-[#7C7972]">Wähle eine Anfrage.</p>
        ) : (
          <>
            <header className="border-b border-[rgba(0,0,0,.14)] pb-4">
              <p className="palace-eyebrow">{active.category} · {active.status}</p>
              <h3 className="palace-serif mt-1 text-[1.4rem] text-[#000000]">{active.subject}</h3>
              {active.product && <Link to={`/product/${active.product.slug}`} className="palace-eyebrow uline mt-2 inline-block">Zum Produkt →</Link>}
            </header>
            <div ref={listRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className={m.sender_id === user?.id ? "text-right" : ""}>
                  <p className="text-[0.55rem] uppercase tracking-[0.28em] text-[#7C7972]">{m.sender_id === user?.id ? "Du" : active.designer?.brand_name ?? "Atelier"}</p>
                  <p className="mt-1 text-[0.95rem] text-[#000000]">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[rgba(0,0,0,.14)] pt-3">
              <div className="flex gap-2">
                <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Antworten …"
                  className="flex-1 border border-[rgba(0,0,0,.22)] bg-transparent p-2 text-[0.95rem] focus:outline-none focus:border-[#000000]" />
                <button onClick={send} disabled={!reply.trim()} className="palace-btn bg-[#000000] text-[#FFFFFF] disabled:opacity-40">Senden</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}


function Orders() {
  const customerOrders = useStore(selectors.getCustomerOrders);
  if (customerOrders.length === 0) {
    return <Empty title="Noch keine Bestellungen." to="/neu" cta="Ausstellung ansehen" />;
  }
  return (
    <ul className="divide-y divide-[rgba(0,0,0,.18)]">
      {customerOrders.map((o) => (
        <li key={o.id} className="grid grid-cols-1 gap-6 py-10 md:grid-cols-[120px_1fr_auto] md:items-center">
          <EditorialImage seed={`order-${o.id}`} ratio="1/1" className="w-24" />
          <div>
            <p className="palace-eyebrow">{o.id} · {o.date}</p>
            <p className="palace-serif mt-2 text-[1.4rem] italic text-[#000000]">
              €{o.total.toLocaleString("de-DE")}
            </p>
            <p className="mt-2 font-serif italic text-[#000000]/70">{o.items.length} Stück · {o.status}</p>
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
    <div className="max-w-2xl space-y-6">
      <div className="border-[1.5px] border-[#000000] bg-white p-8">
        <p className="palace-eyebrow">Daten exportieren</p>
        <p className="palace-serif mt-3 text-[1.2rem] italic text-[#000000]">Alles, was wir über dich wissen — als JSON.</p>
        <p className="mt-3 text-[0.95rem] text-[#000000]/70">
          Profil, Ereignisse, Geschmackssignale und Chat-Sessions.
        </p>
        <button type="button" onClick={exportData} disabled={busy}
          className="palace-btn mt-6 disabled:opacity-50">
          {busy ? "…" : "JSON herunterladen"}
        </button>
      </div>
      <div className="border-[1.5px] border-destructive/60 bg-white p-8">
        <p className="palace-eyebrow text-destructive">Konto löschen</p>
        <p className="palace-serif mt-3 text-[1.2rem] italic text-[#000000]">Das ist endgültig.</p>
        <p className="mt-3 text-[0.95rem] text-[#000000]/70">
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
        <Link to="/datenschutz" className="uline text-[#000000]">Datenschutzhinweise</Link>
      </p>
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-xl">
      <p className="palace-eyebrow">Präferenzen</p>
      <p className="palace-serif mt-4 text-[1.2rem] italic text-[#000000]">Ruhig, aufmerksam, nie aufdringlich.</p>
      <p className="mt-3 text-[0.95rem] text-[#000000]/70">Sprache, Benachrichtigungen und Datenschutz.</p>
    </div>
  );
}

function Empty({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-6 pt-4">
      <p className="palace-serif text-[1.5rem] italic text-[#000000]">{title}</p>
      <Link to={to} className="palace-btn">{cta} →</Link>
    </div>
  );
}

function PaymentTab() {
  return (
    <div className="max-w-xl">
      <p className="palace-eyebrow">Zahlungsmethoden</p>
      <p className="palace-serif mt-4 text-[1.2rem] italic text-[#000000]">Noch keine hinterlegt.</p>
      <p className="mt-3 text-[0.95rem] text-[#000000]/70">Deine Zahlungsmethode wird bei der ersten Bestellung sicher über Stripe hinterlegt — verschlüsselt, nie auf unseren Servern gespeichert.</p>
    </div>
  );
}

export default Account;
