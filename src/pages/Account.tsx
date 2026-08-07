import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { MeasurementsPanel } from "@/components/palace/MeasurementsPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMyRequestThreads } from "@/features/commerce/hooks";
import { useThreadMessages, sendMessage } from "@/features/messages/useMessages";
import { useDisplayName } from "@/lib/displayName";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { Stilberater } from "@/components/palace/Stilberater";
import { AccountSettingsPanel } from "@/components/palace/AccountSettings";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
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
const ISettings = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><circle cx="10" cy="10" r="2.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></svg>
);

const TABS = [
  { key: "Übersicht", icon: IOverview },
  { key: "Bestellungen", icon: IOrders },
  { key: "Anfragen", icon: IRequests },
  { key: "Merkzettel", icon: IWish },
  { key: "Einstellungen", icon: ISettings },
] as const;
type Tab = typeof TABS[number]["key"];

const TAB_I18N_KEY = {
  "Übersicht": "account.overview",
  "Bestellungen": "account.orders",
  "Anfragen": "account.requests",
  "Merkzettel": "account.wishlist",
  "Einstellungen": "account.settings",
} as const;

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

function useMyOrderCount(userId?: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId);
      setN(count ?? 0);
    })();
  }, [userId]);
  return n;
}

const Account = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = TABS.find((t) => t.key === searchParams.get("tab"))?.key;
  const [tab, setTab] = useState<Tab>(tabFromUrl ?? "Übersicht");
  const { user, loading, signOut, roles } = useAuth();
  const { displayName, firstName } = useDisplayName();
  const { t } = useI18n();
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
                className="palace-serif font-light text-foreground"
                style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
              >
                Guten Tag, <span className="capitalize italic">{firstName}</span>.
              </h1>
              <p className="mt-4 flex items-center gap-3 text-[0.68rem] uppercase tracking-[0.28em] text-foreground/70">
                <span className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1">
                  <span className="font-serif text-sm leading-none">♟</span>
                  User {memberNumber ?? "—"}
                </span>
                <span>Mitglied seit {memberSince}</span>
              </p>
            </div>
            <button type="button" onClick={signOut} className="palace-eyebrow uline text-foreground">
              Abmelden
            </button>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-14 md:py-20">
        <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[220px_1fr]">
          {/* Desktop cell nav */}
          <nav className="hidden lg:flex flex-col border-t border-border pt-2">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 text-left text-[0.72rem] uppercase tracking-[0.22em] transition-colors",
                    active
                      ? "bg-foreground text-white"
                      : "text-muted-foreground hover:bg-foreground hover:text-white",
                  )}
                >
                  {active && <span className="absolute left-0 top-0 h-full w-[1.5px] bg-foreground" />}
                  <tb.icon className="h-4 w-4 shrink-0" />
                  <span>{t(TAB_I18N_KEY[tb.key])}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile chip bar */}
          <nav className="lg:hidden -mx-6 flex gap-2 overflow-x-auto px-6 pb-2">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  type="button"
                  onClick={() => setTab(tb.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.24em] transition-colors",
                    active
                      ? "border-foreground bg-foreground text-white"
                      : "border-border text-foreground",
                  )}
                >
                  <tb.icon className="h-3.5 w-3.5" />
                  {t(TAB_I18N_KEY[tb.key])}
                </button>
              );
            })}
          </nav>

          <div>
            {tab === "Übersicht" && <Overview name={displayName} onGoto={setTab} userId={user.id} />}
            {tab === "Bestellungen" && <Card><Orders /></Card>}
            {tab === "Anfragen" && <Card><Requests /></Card>}
            {tab === "Merkzettel" && <Card><Empty title="Dein Merkzettel ist noch leer." to="/neu" cta="Ausstellung ansehen" /></Card>}
            {tab === "Einstellungen" && (
              <div className="space-y-8">
                <MeasurementsPanel />
                <AccountSettingsPanel
                  role="customer"
                  paymentSlot={
                    <div className="space-y-4">
                      <p className="text-sm text-foreground/70">
                        Deine Zahlungsmethode wird bei der ersten Bestellung sicher über Stripe hinterlegt — verschlüsselt, nie auf unseren Servern gespeichert.
                      </p>
                      <p className="text-sm text-foreground/70">
                        Rechnungs- und Lieferadresse gibst du beim Bezahlen an; sie hängen an der jeweiligen Bestellung.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab("Bestellungen")}
                        className="border-[1.5px] border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-white"
                      >
                        Zur Bestellhistorie →
                      </button>
                    </div>
                  }
                />
              </div>
            )}

          </div>
        </div>
      </section>
    </PalaceLayout>
  );
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border-[1.5px] border-foreground bg-white p-6 md:p-8">{children}</div>;
}

function openChat() {
  window.dispatchEvent(new CustomEvent("palace:open-chat"));
}

function Overview({ name, onGoto, userId }: { name: string; onGoto: (t: Tab) => void; userId: string }) {
  const firstName = name.split(/\s+/)[0];
  const orderCount = useMyOrderCount(userId);
  const { ids: wishIds } = useWishlist();
  const { threads } = useMyRequestThreads();

  const stats = [
    { label: "Bestellungen", value: orderCount, tab: "Bestellungen" as Tab },
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
            className="border-[1.5px] border-foreground bg-white p-6 text-left transition-colors hover:bg-muted"
          >
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{s.label}</p>
            <p className="palace-serif mt-3 text-4xl font-semibold text-foreground" style={{ fontWeight: 600 }}>
              {s.value}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={openChat}
          className="group flex flex-col justify-between border-[1.5px] border-foreground bg-foreground p-6 text-left text-white transition-transform hover:-translate-y-0.5"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-white/60">Frag PAWN</p>
            <p className="palace-serif mt-3 text-[1.15rem] italic leading-snug">
              PAWN Chat — Fragen zu Bestellungen, Stücken, deiner DNA.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-white">
            <Sparkles className="h-3 w-3" /> Chat öffnen →
          </span>
        </button>
      </div>

      <Card>
        <p className="palace-serif italic text-[1.1rem] text-foreground/80">
          Willkommen zurück, <span className="capitalize">{firstName}</span>.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { title: "Deine Bestellungen", body: "Verfolge, was unterwegs ist.", tab: "Bestellungen" as Tab },
            { title: "Merkzettel", body: "Stücke, die du dir gemerkt hast.", tab: "Merkzettel" as Tab },
            { title: "Einstellungen", body: "Zugang, Zahlung, Datenschutz.", tab: "Einstellungen" as Tab },
          ].map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => onGoto(t.tab)}
              className="border border-border p-5 text-left transition-colors hover:border-foreground"
            >
              <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t.tab}</p>
              <p className="palace-serif mt-2 text-[1.1rem] text-foreground">{t.title}</p>
              <p className="mt-2 text-sm text-foreground/70">{t.body}</p>
            </button>
          ))}
        </div>
      </Card>

      <Stilberater />
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
      <aside className="border-t border-border">
        <ul className="divide-y divide-border">
          {threads.map((t) => (
            <li key={t.id}>
              <button onClick={() => setActiveId(t.id)}
                className={`block w-full px-1 py-4 text-left ${activeId === t.id ? "bg-muted" : ""}`}>
                <p className="palace-eyebrow">
                  {t.designer?.brand_name ?? "Atelier"}
                  {t.category === "produkt" && <span className="ml-2 border border-border px-1.5 py-0.5 text-[0.5rem] tracking-[0.28em]">PRODUKT</span>}
                </p>
                <p className="palace-serif mt-1 text-[1.1rem] italic text-foreground">{t.subject}</p>
                {t.product && <p className="mt-1 text-[0.75rem] text-muted-foreground">→ {t.product.name}</p>}
                <p className="mt-1 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{new Date(t.last_message_at).toLocaleDateString("de-DE")} · {t.status}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="border border-border p-6 min-h-[50vh] flex flex-col">
        {!active ? (
          <p className="palace-eyebrow text-muted-foreground">Wähle eine Anfrage.</p>
        ) : (
          <>
            <header className="border-b border-border pb-4">
              <p className="palace-eyebrow">{active.category} · {active.status}</p>
              <h3 className="palace-serif mt-1 text-[1.4rem] text-foreground">{active.subject}</h3>
              {active.product && <Link to={`/product/${active.product.slug}`} className="palace-eyebrow uline mt-2 inline-block">Zum Produkt →</Link>}
            </header>
            <div ref={listRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className={m.sender_id === user?.id ? "text-right" : ""}>
                  <p className="text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground">{m.sender_id === user?.id ? "Du" : active.designer?.brand_name ?? "Atelier"}</p>
                  <p className="mt-1 text-[0.95rem] text-foreground">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex gap-2">
                <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Antworten …"
                  className="flex-1 border border-border bg-transparent p-2 text-[0.95rem] focus:outline-none focus:border-foreground" />
                <Button variant="editorial" size="chip" onClick={send} disabled={!reply.trim()} className="bg-foreground text-background disabled:opacity-40">Senden</Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}


interface RealOrder {
  id: string; created_at: string; status: string; fulfillment_status: string | null;
  amount_total: number; items: unknown; tracking_number: string | null; carrier: string | null;
  invoice_number: string | null;
}

const FULFILLMENT_LABEL: Record<string, string> = {
  new: "Neu", in_progress: "In Arbeit", packed: "Verpackt", shipped: "Versendet", delivered: "Zugestellt",
};

function Orders() {
  const { locale } = useI18n();
  const { user } = useAuth();
  const [orders, setOrders] = useState<RealOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let alive = true;
    void supabase.from("orders")
      .select("id, created_at, status, fulfillment_status, amount_total, items, tracking_number, carrier, invoice_number")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) { setOrders((data ?? []) as RealOrder[]); setLoading(false); } });
    return () => { alive = false; };
  }, [user?.id]);

  const downloadInvoice = async (orderId: string) => {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(`${orderId}.pdf`, 3600);
    if (error || !data?.signedUrl) { toast.error("Rechnung konnte nicht geöffnet werden."); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (loading) return <div className="animate-pulse h-40 bg-muted" />;
  if (orders.length === 0) {
    return <Empty title="Noch keine Bestellungen." to="/neu" cta="Ausstellung ansehen" />;
  }
  return (
    <ul className="divide-y divide-border">
      {orders.map((o) => {
        const items = Array.isArray(o.items) ? o.items as Array<{ name?: string }> : [];
        return (
          <li key={o.id} className="grid grid-cols-1 gap-6 py-10 md:grid-cols-[120px_1fr_auto] md:items-center">
            <EditorialImage seed={`order-${o.id}`} ratio="1/1" className="w-24" />
            <div>
              <p className="palace-eyebrow">{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleDateString(locale === "en" ? "en-GB" : "de-DE")}</p>
              <p className="palace-serif mt-2 text-[1.4rem] italic text-foreground">
                {formatPrice(o.amount_total / 100, locale)}
              </p>
              <p className="mt-2 font-serif italic text-foreground/70">{items.length} Stück{o.status === "paid" && o.fulfillment_status ? ` · ${FULFILLMENT_LABEL[o.fulfillment_status] ?? o.fulfillment_status}` : ""}</p>
              {o.tracking_number && (
                <p className="mt-1 text-xs text-muted-foreground">Tracking: {o.tracking_number}{o.carrier && ` · ${o.carrier}`}</p>
              )}
              {o.invoice_number && (
                <button onClick={() => downloadInvoice(o.id)} className="mt-2 text-xs underline underline-offset-2">
                  Rechnung {o.invoice_number} herunterladen
                </button>
              )}
            </div>
            <span className="palace-eyebrow">{o.status}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-6 pt-4">
      <p className="palace-serif text-[1.5rem] italic text-foreground">{title}</p>
      <Button asChild variant="editorial" size="chip"><Link to={to}>{cta} →</Link></Button>
    </div>
  );
}

export default Account;
