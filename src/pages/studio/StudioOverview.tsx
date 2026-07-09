import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { StudioShell, firstNameOf } from "@/components/pawn/StudioShell";
import { useCopilot } from "@/components/pawn/CopilotDrawer";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Plus, AlertTriangle } from "lucide-react";

type World = "Mode" | "Interior" | "Kunst";

interface Product {
  id: string; name: string; slug: string; world: World; price: number;
  image_url: string | null; status: string; inventory_mode: "stock" | "made_to_order";
  stock_quantity: number; lead_time_days: number | null;
}
interface Message { id: string; subject: string; last_message_at: string; unread: boolean }
interface Campaign { id: string; title: string; caption: string | null; hashtags: string[] | null; status: string }
type CampaignRow = { id: string; title: string; content: unknown; status: string };
function toCampaign(r: CampaignRow): Campaign {
  const c = (r.content ?? {}) as { caption?: string; hashtags?: string[] };
  return { id: r.id, title: r.title, caption: c.caption ?? null, hashtags: c.hashtags ?? null, status: r.status };
}


function greetingByHour() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function useDaySeries(designerId?: string, days = 30) {
  const [series, setSeries] = useState<number[]>([]);
  const [ordersSeries, setOrdersSeries] = useState<number[]>([]);
  const [wishSeries, setWishSeries] = useState<number[]>([]);

  useEffect(() => {
    if (!designerId) return;
    (async () => {
      const since = new Date(Date.now() - days * 86400000);
      const { data: prods } = await supabase.from("products").select("id, slug").eq("designer_id", designerId);
      const slugs = new Set((prods ?? []).map((p) => p.slug));
      if (slugs.size === 0) { setSeries(new Array(days).fill(0)); setOrdersSeries(new Array(days).fill(0)); setWishSeries(new Array(days).fill(0)); return; }

      const { data: ords } = await supabase.from("orders").select("id, created_at, status, amount_total, items").gte("created_at", since.toISOString()).eq("status", "paid");
      const rev = new Array(days).fill(0);
      const cnt = new Array(days).fill(0);
      for (const o of ((ords ?? []) as { created_at: string; amount_total: number; items: unknown }[])) {
        const idx = Math.floor((new Date(o.created_at).getTime() - since.getTime()) / 86400000);
        if (idx >= 0 && idx < days) {
          let mine = 0;
          const items = Array.isArray(o.items) ? o.items as { slug?: string; qty?: number; price?: number }[] : [];
          for (const it of items) if (it.slug && slugs.has(it.slug)) mine += (it.price ?? 0) * (it.qty ?? 1);
          if (mine > 0) { rev[idx] += mine; cnt[idx] += 1; }
        }
      }
      setSeries(rev); setOrdersSeries(cnt);

      const { data: evs } = await supabase.from("domain_events").select("created_at, payload").eq("type", "wishlist.added").gte("created_at", since.toISOString()).limit(500);
      const w = new Array(days).fill(0);
      for (const e of ((evs ?? []) as { created_at: string; payload: { slug?: string } }[])) {
        if (e.payload?.slug && slugs.has(e.payload.slug)) {
          const idx = Math.floor((new Date(e.created_at).getTime() - since.getTime()) / 86400000);
          if (idx >= 0 && idx < days) w[idx] += 1;
        }
      }
      setWishSeries(w);
    })();
  }, [designerId, days]);

  return { series, ordersSeries, wishSeries };
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="1.25" points={pts} /></svg>;
}

export default function StudioOverview() {
  const { user, profile } = useAuth();
  const { designer, loading } = useMyDesigner();
  const { lines } = useDesignerOrders(designer?.id);
  const copilot = useCopilot();
  const { series, ordersSeries, wishSeries } = useDaySeries(designer?.id);

  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign | null>(null);
  const [mirror, setMirror] = useState<{ text: string; stats: { views_total: number; wish_total: number; orders_count: number } } | null>(null);
  const [visitorsYesterday, setVisitorsYesterday] = useState<number | null>(null);
  const [worldFilter, setWorldFilter] = useState<"all" | World>("all");

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [prods, msgs, camp, visitEvs] = await Promise.all([
        supabase.from("products").select("id, name, slug, world, price, image_url, status, inventory_mode, stock_quantity, lead_time_days").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("message_threads").select("id, subject, last_message_at, status").eq("designer_id", designer.id).order("last_message_at", { ascending: false }).limit(3),
        supabase.from("campaigns").select("id, title, content, status").eq("designer_id", designer.id).eq("status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("domain_events").select("id").eq("type", "designer.view").eq("payload->>designer_id", designer.id)
          .gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).lt("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      setProducts(((prods.data ?? []) as Product[]));
      setMessages(((msgs.data ?? []) as { id: string; subject: string; last_message_at: string; status: string }[]).map((m) => ({ id: m.id, subject: m.subject, last_message_at: m.last_message_at, unread: m.status === "open" })));
      setPendingCampaign(camp.data ? toCampaign(camp.data as CampaignRow) : null);
      setVisitorsYesterday(visitEvs.data ? visitEvs.data.length : null);
    })();
  }, [designer]);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.functions.invoke("studio-ai", { body: { mode: "weekly_mirror" } });
      if (data) setMirror(data as { text: string; stats: { views_total: number; wish_total: number; orders_count: number } });
    })();
  }, [designer]);

  const availableWorlds = useMemo(() => {
    const set = new Set(products.map((p) => p.world));
    return (["Mode", "Interior", "Kunst"] as World[]).filter((w) => set.has(w));
  }, [products]);

  const filteredProducts = useMemo(() => worldFilter === "all" ? products : products.filter((p) => p.world === worldFilter), [products, worldFilter]);
  const paid = useMemo(() => {
    const world = worldFilter;
    return lines.filter((l) => {
      if (l.order_status !== "paid") return false;
      if (world === "all") return true;
      const p = products.find((pp) => pp.slug === l.product_slug);
      return p?.world === world;
    });
  }, [lines, products, worldFilter]);

  const revenue30 = useMemo(() => paid.filter((l) => new Date(l.order_created_at) > new Date(Date.now() - 30 * 86400000)).reduce((s, l) => s + l.unit_price * l.qty, 0), [paid]);
  const orderCount = useMemo(() => new Set(paid.map((l) => l.order_id)).size, [paid]);
  const wishTotal = useMemo(() => wishSeries.reduce((s, n) => s + n, 0), [wishSeries]);
  const criticalStock = useMemo(() => filteredProducts.filter((p) => p.inventory_mode === "stock" && p.stock_quantity < 3).length, [filteredProducts]);

  const firstName = firstNameOf({ displayName: profile?.displayName }, designer?.brand_name, user?.email);

  const togglePublish = async (p: Product) => {
    const next = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setProducts((arr) => arr.map((x) => x.id === p.id ? { ...x, status: next } : x));
    toast.success(next === "published" ? "Veröffentlicht" : "Als Entwurf gespeichert");
  };

  const approveCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingCampaign(null); toast.success("Kampagne freigegeben");
  };

  const generateCampaign = async () => {
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "campaign_draft", channel: "editorial" } });
    if (error) { toast.error(error.message); return; }
    toast.success("Kampagne im Entwurf");
    // reload pending
    if (designer) {
      const { data: c } = await supabase.from("campaigns").select("id, title, content, status").eq("designer_id", designer.id).eq("status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      setPendingCampaign(c ? toCampaign(c as CampaignRow) : null);
    }
    void data;
  };

  const checklist = useMemo(() => {
    const items = [
      { label: "Porträt hochladen", done: !!designer?.avatar_url || !!designer?.hero_image_url, to: "/studio/brand" },
      { label: "Manifest schreiben", done: !!designer?.story && designer.story.length > 40, to: "/studio/brand" },
      { label: "Erstes Stück anlegen", done: products.length > 0, to: "/studio/produkte" },
      { label: "Stück veröffentlichen", done: products.some((p) => p.status === "published"), to: "/studio/produkte" },
      { label: "Auszahlungsdaten hinterlegen", done: false, to: "/studio/auszahlung" },
    ];
    return items;
  }, [designer, products]);
  const doneCount = checklist.filter((i) => i.done).length;
  const showChecklist = doneCount < 5;

  if (loading) return <StudioShell title="Bühne"><div className="animate-pulse space-y-6"><div className="h-32 bg-muted" /><div className="h-64 bg-muted" /></div></StudioShell>;

  if (!designer) return (
    <StudioShell title="Bühne" eyebrow="Willkommen">
      <div className="mx-auto max-w-xl border border-border bg-white p-10 text-center">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Kein Studio-Zugang</p>
        <h2 className="mt-3 font-serif text-3xl">Dein Studio steht noch nicht.</h2>
        <p className="mt-4 text-sm text-muted-foreground">Sobald deine Bewerbung angenommen ist, findest du hier deine Bühne.</p>
        <Link to="/apply" className="mt-6 inline-flex border border-foreground px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">Zur Bewerbung</Link>
      </div>
    </StudioShell>
  );

  return (
    <StudioShell title="Bühne" eyebrow="Bühne">
      {/* Greeting */}
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-medium md:text-4xl">
            {greetingByHour()}, <span className="capitalize">{firstName}</span>.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {visitorsYesterday !== null && visitorsYesterday > 0
              ? `Deine Bühne hatte gestern ${visitorsYesterday} Besucher${visitorsYesterday === 1 ? "" : ""}.`
              : "Willkommen zurück auf deiner Bühne."}
          </p>
        </div>
        <Link to="/studio/kampagnen/neu"
          className="flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:opacity-90">
          + Neue Kampagne
        </Link>
      </section>

      {/* World filter chips */}
      {availableWorlds.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["all", ...availableWorlds] as const).map((w) => (
            <button key={w} onClick={() => setWorldFilter(w as "all" | World)}
              className={`border px-3 py-1.5 text-[0.68rem] tracking-wide ${worldFilter === w ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:bg-muted"}`}>
              {w === "all" ? "Alle" : w}
            </button>
          ))}
        </div>
      )}

      {/* Onboarding checklist */}
      {showChecklist && (
        <section className="mb-6 border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Erste Schritte</p>
              <p className="mt-1 font-serif text-lg">Alles bereit für deinen Auftritt — {doneCount}/5</p>
            </div>
          </div>
          <ol className="mt-5 grid gap-2 md:grid-cols-5">
            {checklist.map((it, i) => (
              <Link key={it.label} to={it.to} className="border border-border bg-white p-3 hover:bg-muted">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center border ${it.done ? "border-foreground bg-foreground text-background" : "border-border"} text-[0.6rem]`}>{it.done ? "✓" : i + 1}</span>
                </div>
                <p className={`mt-2 text-xs leading-snug ${it.done ? "text-muted-foreground line-through" : ""}`}>{it.label}</p>
              </Link>
            ))}
          </ol>
        </section>
      )}

      {/* Copilot weekly mirror — black */}
      <section className="mb-6 border border-transparent bg-[#0B0B0D] p-8 text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center border border-white/25 font-serif">♟</span>
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/60">PAWN Copilot · Wochenspiegel</p>
            </div>
            <p className="mt-4 font-serif text-xl leading-relaxed md:text-2xl">
              {mirror?.text ?? "Ich schaue mir gerade deine Woche an…"}
            </p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-white/60" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={generateCampaign} className="border border-white bg-white px-4 py-2 text-[0.68rem] tracking-wide text-[#0B0B0D] hover:bg-white/90">Kampagne entwerfen</button>
          <button onClick={copilot.open} className="border border-white/50 px-4 py-2 text-[0.68rem] tracking-wide text-white hover:bg-white/10">Nachfragen</button>
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-8 grid gap-3 md:grid-cols-4">
        <KpiCard label="Umsatz 30T" value={`€ ${revenue30.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`} sparkline={series} />
        <KpiCard label="Bestellungen 30T" value={String(orderCount)} sparkline={ordersSeries} link="/studio/bestellungen" />
        <KpiCard label="Merkzettel-Zugänge" value={String(wishTotal)} sparkline={wishSeries} />
        <KpiCard label="Bestand kritisch" value={String(criticalStock)} link="/studio/produkte" highlight={criticalStock > 0} />
      </section>

      {/* Collection grid */}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Kollektion</p>
            <h2 className="mt-1 font-serif text-2xl">{filteredProducts.length} {filteredProducts.length === 1 ? "Stück" : "Stücke"}</h2>
          </div>
          <Link to="/studio/produkte" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Alle Produkte →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.slice(0, 7).map((p) => (
            <article key={p.id} className="group border border-border bg-white">
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Kein Bild</div>}
                <span className={`absolute left-3 top-3 border px-2 py-1 text-[0.6rem] tracking-wider ${p.inventory_mode === "stock" ? "border-border bg-white text-foreground" : "border-transparent bg-[#0B0B0D] text-white"}`}>
                  {p.inventory_mode === "stock" ? `Lager · ${p.stock_quantity}` : `Auf Anfertigung · ${p.lead_time_days ?? "—"} T`}
                </span>
              </div>
              <div className="p-4">
                <p className="truncate font-serif text-base">{p.name}</p>
                <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{p.world}</p>
                {p.inventory_mode === "stock" && p.stock_quantity < 3 && (
                  <p className="mt-2 flex items-center gap-1 text-[0.68rem] text-destructive"><AlertTriangle className="h-3 w-3" /> {p.stock_quantity === 0 ? "Ausverkauft" : `Nur noch ${p.stock_quantity}`}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="tabular-nums text-sm">€ {p.price.toLocaleString("de-DE")}</p>
                  <label className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <input type="checkbox" checked={p.status === "published"} onChange={() => togglePublish(p)} className="h-4 w-8 cursor-pointer appearance-none rounded-full border border-border bg-muted transition-colors checked:bg-[#0B0B0D]" />
                    <span>{p.status === "published" ? "Live" : "Entwurf"}</span>
                  </label>
                </div>
              </div>
            </article>
          ))}
          <Link to="/studio/produkte" className="flex aspect-[4/5] flex-col items-center justify-center border border-dashed border-border bg-white text-muted-foreground hover:border-foreground hover:text-foreground">
            <Plus className="h-6 w-6" />
            <p className="mt-3 text-[0.68rem] uppercase tracking-[0.24em]">Neues Stück anlegen</p>
          </Link>
        </div>
      </section>

      {/* Bottom two-column */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Orders */}
        <div className="border border-border bg-white p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Letzte Bestellungen</p>
            <Link to="/studio/bestellungen" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Alle →</Link>
          </div>
          {paid.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Noch keine bezahlten Bestellungen.</p>
              <p className="mt-1 text-xs text-muted-foreground">Sobald deine ersten Stücke verkauft werden, erscheinen sie hier.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {paid.slice(0, 6).map((l) => (
                <li key={`${l.order_id}-${l.product_slug}`} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base">{l.product_name}</p>
                    <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                      {(l.customer_first_name ?? "Kund·in")}{l.customer_country ? ` · ${l.customer_country}` : ""} · {new Date(l.order_created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-sm">€ {(l.unit_price * l.qty).toLocaleString("de-DE")}</p>
                    <span className="text-[0.6rem] uppercase tracking-[0.22em] text-emerald-700">Bezahlt</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending campaign */}
        <div className="border border-border bg-white p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Kampagne wartet auf dich</p>
            <Link to="/studio/kampagnen" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Alle →</Link>
          </div>
          {!pendingCampaign ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Gerade wartet nichts.</p>
              <button onClick={generateCampaign} className="mt-3 border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">Kampagne mit Copilot entwerfen</button>
            </div>
          ) : (
            <>
              <p className="font-serif text-xl">{pendingCampaign.title}</p>
              <div className="mt-4 border border-border bg-[#F7F5F0] p-4">
                {pendingCampaign.caption && <p className="font-serif italic leading-relaxed">"{pendingCampaign.caption}"</p>}
                {pendingCampaign.hashtags && pendingCampaign.hashtags.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">{pendingCampaign.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => approveCampaign(pendingCampaign.id)} className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background">Freigeben</button>
                <Link to={`/studio/kampagnen`} className="border border-border px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Änderungen wünschen</Link>
              </div>
              <p className="mt-3 text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">Nichts wird ohne deine Freigabe veröffentlicht.</p>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="border border-border bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Nachrichten</p>
            <Link to="/studio/nachrichten" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Alle →</Link>
          </div>
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Kein Posteingang zu zeigen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {m.unread && <span className="h-1.5 w-1.5 rounded-full bg-[#0B0B0D]" />}
                    <p className="font-serif text-base">{m.subject}</p>
                  </div>
                  <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{new Date(m.last_message_at).toLocaleDateString("de-DE")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </StudioShell>
  );
}

function KpiCard({ label, value, sparkline, link, highlight }: { label: string; value: string; sparkline?: number[]; link?: string; highlight?: boolean }) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
          <p className={`mt-3 font-serif text-3xl font-medium ${highlight ? "text-destructive" : ""}`}>{value}</p>
        </div>
      </div>
      {sparkline && sparkline.some((n) => n > 0) && (
        <div className="mt-4 h-7 w-full text-muted-foreground">
          <Sparkline data={sparkline} className="h-full w-full" />
        </div>
      )}
    </>
  );
  const cls = `block border ${highlight ? "border-destructive/50" : "border-border"} bg-white p-5 ${link ? "transition-colors hover:border-foreground" : ""}`;
  return link ? <Link to={link} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
