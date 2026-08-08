import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useCopilot } from "@/components/pawn/CopilotDrawer";
import { PawnFigur, PawnFigurState, type PawnFigurHandle, type PawnRank } from "@/components/pawn/PawnFigur";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { useNextMove } from "@/features/studio/nextMove";
import { useDesignerJourney, type JourneyStep } from "@/features/studio/useDesignerJourney";
import { useHouseMilestones, nextVerwandlungStep, VERWANDLUNG_STEPS } from "@/features/verwandlung";
import { useDisplayName } from "@/lib/displayName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Plus, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Rang der Figur folgt dem echten Milestone-Level des Hauses (useDesignerLevel). */
const RANK_BY_LEVEL: Record<string, PawnRank> = {
  bauer: "bauer", springer: "springer", laeufer: "laeufer", turm: "turm", dame: "dame",
};

/** Kleiner, lokaler Typewriter — zeigt Text zeichenweise, wie in docs/design-referenz/bauer.html. */
function useTypewriter(text: string, speedMs = 20) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setShown("");
    setDone(!text);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);
  return { shown, done };
}

type World = "Mode" | "Interior" | "Kunst";

interface Product {
  id: string; name: string; slug: string; world: World; price: number;
  image_url: string | null; status: string; inventory_mode: "stock" | "made_to_order";
  stock_quantity: number; lead_time_days: number | null; view_count?: number;
}
interface Message { id: string; subject: string; last_message_at: string; unread: boolean }
interface Campaign { id: string; title: string; caption: string | null; hashtags: string[] | null; status: string }
type CampaignRow = { id: string; title: string; content: unknown; status: string };
function toCampaign(r: CampaignRow): Campaign {
  const c = (r.content ?? {}) as { caption?: string; hashtags?: string[] };
  return { id: r.id, title: r.title, caption: c.caption ?? null, hashtags: c.hashtags ?? null, status: r.status };
}


function greetingByHour(t: (k: string) => string) {
  const h = new Date().getHours();
  if (h < 11) return t("studio.overview.greeting.morning");
  if (h < 18) return t("studio.overview.greeting.day");
  return t("studio.overview.greeting.evening");
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

function useWelcomeSteps(t: (k: string, vars?: Record<string, string | number>) => string) {
  return [
    {
      title: t("studio.overview.welcome.step1.title"),
      body: t("studio.overview.welcome.step1.body"),
    },
    {
      title: t("studio.overview.welcome.step2.title"),
      body: null,
      bullets: [
        t("studio.overview.welcome.step2.bullet1"),
        t("studio.overview.welcome.step2.bullet2"),
        t("studio.overview.welcome.step2.bullet3"),
      ],
    },
    {
      title: t("studio.overview.welcome.step3.title"),
      body: t("studio.overview.welcome.step3.body"),
    },
  ] as const;
}

function DesignerWelcome({ name, onSkip }: { name: string; onSkip: () => void }) {
  const { t } = useI18n();
  const WELCOME_STEPS = useWelcomeSteps(t);
  const [step, setStep] = useState(0);
  const last = step === WELCOME_STEPS.length - 1;
  const current = WELCOME_STEPS[step];
  return (
    <div className="mx-auto max-w-xl border-[1.5px] border-foreground bg-white p-8 sm:p-10">
      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.welcome.progress", { name, step: step + 1, total: WELCOME_STEPS.length })}</p>
      <h2 className="mt-3 font-serif text-2xl font-medium sm:text-3xl">{current.title}</h2>
      {current.body && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{current.body}</p>}
      {"bullets" in current && current.bullets && (
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {current.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 bg-foreground" />{b}</li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={onSkip} className="text-[0.65rem] uppercase tracking-[0.24em] text-muted-foreground underline hover:text-foreground">
          {t("studio.overview.welcome.skip")}
        </button>
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="border border-border bg-white px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:border-foreground">
              {t("common.back")}
            </button>
          )}
          {last ? (
            <Link to="/studio/produkte/neu" onClick={onSkip} className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-black">
              <Plus className="h-3 w-3" /> {t("studio.overview.welcome.createFirst")}
            </Link>
          ) : (
            <button type="button" onClick={() => setStep((s) => s + 1)} className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-black">
              {t("studio.overview.welcome.next")} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Suggestion { key: string; label: string; reason: string; to: string }

function DailyList({ suggestions, onDismiss }: { suggestions: Suggestion[]; onDismiss: (key: string) => void }) {
  const { t } = useI18n();
  return (
    <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.today")}</p>
      {suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("studio.overview.today.empty")}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {suggestions.map((s) => (
            <li key={s.key} className="group flex items-center justify-between gap-4 border-[1.5px] border-border px-4 py-3 hover:border-foreground">
              <Link to={s.to} className="min-w-0 flex-1">
                <p className="text-sm">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>
              </Link>
              <button type="button" onClick={() => onDismiss(s.key)} aria-label={t("studio.overview.today.dismiss")} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DesignerJourney({ steps, doneCount }: { steps: JourneyStep[]; doneCount: number }) {
  const { t } = useI18n();
  if (steps.length === 0) return null;
  return (
    <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.journey.progress", { done: doneCount, total: steps.length })}</p>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.key} className={`border-[1.5px] px-4 py-3 ${s.done ? "border-border" : "border-foreground"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] text-[0.6rem] ${s.done ? "border-foreground bg-foreground text-background" : "border-foreground"}`}>
                  {s.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <div>
                  <p className={`text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.label}</p>
                  {!s.done && <p className="mt-0.5 text-xs text-muted-foreground">{s.reason}</p>}
                </div>
              </div>
              {!s.done && (
                <Link to={s.to} className="shrink-0 text-[0.62rem] uppercase tracking-[0.2em] underline hover:text-foreground">{t("studio.overview.journey.go")}</Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function StudioOverview() {
  const { designer, loading, refresh: refreshDesigner } = useMyDesigner();
  const { lines } = useDesignerOrders(designer?.id);
  const { level } = useDesignerLevel(designer?.id);
  const { milestones } = useHouseMilestones(designer?.id);
  const { firstName } = useDisplayName();
  const copilot = useCopilot();
  const { t, locale } = useI18n();
  const { series, ordersSeries, wishSeries } = useDaySeries(designer?.id);
  const [showKpi, setShowKpi] = useState(false);
  const [showLower, setShowLower] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign | null>(null);
  const [mirror, setMirror] = useState<{ text: string; stats: { views_total: number; wish_total: number; orders_count: number } } | null>(null);
  const [visitorsYesterday, setVisitorsYesterday] = useState<number | null>(null);
  const [worldFilter, setWorldFilter] = useState<"all" | World>("all");
  // Teil 16c: Erfolg wird am Verkauf gemessen, nicht an erzeugter Menge — Shop-Klicks
  // je Stück (Summe über seine verlinkten Medien).
  const [shopClicksByProduct, setShopClicksByProduct] = useState<Record<string, number>>({});
  const [productsLoaded, setProductsLoaded] = useState(false);
  // Teil 17d: eigenes Material, das noch nie fürs PAWN-Archiv eingereicht wurde (Teil 12b) —
  // speist die tägliche Liste, macht den bestehenden Weg über die Mediathek sichtbarer.
  const [unsubmittedMediaCount, setUnsubmittedMediaCount] = useState(0);
  // Teil 28a: PAWN wird Person — Figur im Hero, Partie-Buch-Auszug (Tabelle folgt erst mit PR 28c,
  // bis dahin bleibt die Sektion ehrlich leer statt einen Fehler zu zeigen).
  const pawnRef = useRef<PawnFigurHandle>(null);
  const [partieZuege, setPartieZuege] = useState<{ id: string; nr: number; text: string; akteur: string; created_at: string }[]>([]);
  const [heroDismissed, setHeroDismissed] = useState(false);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [prods, msgs, camp, visitEvs] = await Promise.all([
        supabase.from("products").select("id, name, slug, world, price, image_url, status, inventory_mode, stock_quantity, lead_time_days, product_dna, view_count").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("message_threads").select("id, subject, last_message_at, status").eq("designer_id", designer.id).order("last_message_at", { ascending: false }).limit(3),
        supabase.from("campaigns").select("id, title, content, status").eq("designer_id", designer.id).eq("status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("domain_events").select("id").eq("type", "designer.view").eq("payload->>designer_id", designer.id)
          .gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).lt("created_at", new Date(Date.now() - 86400000).toISOString()),
      ]);
      setProducts(((prods.data ?? []) as Product[]));
      setProductsLoaded(true);
      setMessages(((msgs.data ?? []) as { id: string; subject: string; last_message_at: string; status: string }[]).map((m) => ({ id: m.id, subject: m.subject, last_message_at: m.last_message_at, unread: m.status === "open" })));
      setPendingCampaign(camp.data ? toCampaign(camp.data as CampaignRow) : null);
      setVisitorsYesterday(visitEvs.data ? visitEvs.data.length : null);

      const { data: media } = await supabase.from("media_assets" as never).select("product_id, performance").eq("designer_id", designer.id).not("product_id", "is", null);
      const clicks: Record<string, number> = {};
      for (const m of (media ?? []) as unknown as Array<{ product_id: string; performance: { shop_clicks?: number } }>) {
        clicks[m.product_id] = (clicks[m.product_id] ?? 0) + (m.performance?.shop_clicks ?? 0);
      }
      setShopClicksByProduct(clicks);

      const { count } = await supabase.from("media_assets" as never).select("id", { count: "exact", head: true })
        .eq("designer_id", designer.id).eq("review_status", "privat");
      setUnsubmittedMediaCount(count ?? 0);
    })();
  }, [designer]);

  // Teil 28c legt die Tabelle partie_zuege erst an — bis dahin bleibt die Sektion ehrlich leer.
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.from("partie_zuege" as never).select("id, nr, text, akteur, created_at")
        .eq("designer_id", designer.id).order("created_at", { ascending: false }).limit(5);
      setPartieZuege((data as never as typeof partieZuege) ?? []);
    })();
  }, [designer]);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.functions.invoke("studio-ai", { body: { mode: "weekly_mirror", locale } });
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
  // Teil 16c: Verkäufe je Stück — die erzeugte Menge tritt in den Hintergrund.
  const salesBySlug = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of lines) {
      if (l.order_status !== "paid") continue;
      map[l.product_slug] = (map[l.product_slug] ?? 0) + l.qty;
    }
    return map;
  }, [lines]);
  const criticalStock = useMemo(() => filteredProducts.filter((p) => p.inventory_mode === "stock" && p.stock_quantity < 3).length, [filteredProducts]);

  const hasStory = !!designer?.story && designer.story.length > 40;
  const hasPortrait = !!designer?.avatar_url || !!designer?.hero_image_url;
  const publishedCount = products.filter((p) => p.status === "published").length;
  const nextMove = useNextMove({ designerId: designer?.id, level, hasStory, hasPortrait, publishedCount });

  // Teil 28a: Begrüßung aus echten Daten — Blicke über Nacht + der vorbereitete Zug (Teil 17c).
  const greetingLine = useMemo(() => {
    const viewsPart = visitorsYesterday && visitorsYesterday > 0
      ? (visitorsYesterday === 1 ? t("studio.overview.hero.greetingViews.one") : t("studio.overview.hero.greetingViews.many", { n: visitorsYesterday }))
      : t("studio.overview.hero.greetingNoViews");
    return `${viewsPart} ${nextMove.headline}`;
  }, [visitorsYesterday, nextMove.headline, t]);
  const { shown: heroTyped, done: heroTypedDone } = useTypewriter(greetingLine);

  const togglePublish = async (p: Product) => {
    const next = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setProducts((arr) => arr.map((x) => x.id === p.id ? { ...x, status: next } : x));
    toast.success(next === "published" ? t("studio.overview.toast.published") : t("studio.overview.toast.savedAsDraft"));
  };

  const approveCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingCampaign(null); toast.success(t("studio.overview.toast.campaignApproved"));
  };

  const generateCampaign = async () => {
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "campaign_draft", channel: "editorial", locale } });
    if (error) { toast.error(error.message); return; }
    toast.success(t("studio.overview.toast.campaignDrafted"));
    // reload pending
    if (designer) {
      const { data: c } = await supabase.from("campaigns").select("id, title, content, status").eq("designer_id", designer.id).eq("status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      setPendingCampaign(c ? toCampaign(c as CampaignRow) : null);
    }
    void data;
  };

  // Teil 17c: der durchgehende Weg — acht Schritte, jeder Zustand aus echten Daten abgeleitet,
  // nie in einer eigenen Checklisten-Tabelle gespeichert.
  const journey = useDesignerJourney({ designer, productsCount: products.length, hasPaidOrder: paid.length > 0 });

  const dnaMissingProduct = useMemo(() => products.filter((p) => p.status === "published").find((p) => {
    const dna = (p as unknown as { product_dna?: Record<string, unknown[]> }).product_dna ?? {};
    const n = (k: string) => Array.isArray(dna[k]) ? dna[k]!.length : 0;
    return n("materials") + n("silhouette") + n("colors") + n("mood") === 0;
  }), [products]);

  // Teil 22b: Bestellungen, die seit über 3 Tagen unbearbeitet sind (noch nicht einmal "in Arbeit").
  const staleOrdersCount = useMemo(() => {
    const cutoff = Date.now() - 3 * 86400000;
    const staleOrderIds = new Set(
      paid.filter((l) => l.fulfillment_status === "new" && new Date(l.order_created_at).getTime() < cutoff).map((l) => l.order_id),
    );
    return staleOrderIds.size;
  }, [paid]);

  // Teil 17c: tägliche Liste — höchstens drei begründete Vorschläge, aus echtem Zustand
  // abgeleitet. Weggelegtes kommt frühestens nach 7 Tagen zurück (kein Streak-Zwang, keine
  // roten Zähler — die Liste darf auch leer sein).
  const dismissedMap = designer?.dismissed_suggestions ?? {};
  const isDismissed = (key: string) => {
    const at = dismissedMap[key];
    return !!at && Date.now() - new Date(at).getTime() < 7 * 86400000;
  };
  const dailySuggestions = useMemo(() => {
    if (!designer) return [];
    const pool: { key: string; label: string; reason: string; to: string }[] = [];
    if (!hasPortrait) pool.push({ key: "portrait", label: t("studio.overview.suggestion.portrait.label"), reason: t("studio.overview.suggestion.portrait.reason"), to: "/studio/brand" });
    if (!hasStory) pool.push({ key: "manifest", label: t("studio.overview.suggestion.manifest.label"), reason: t("studio.overview.suggestion.manifest.reason"), to: "/studio/brand" });
    if (dnaMissingProduct) pool.push({ key: "dna", label: t("studio.overview.suggestion.dna.label"), reason: t("studio.overview.suggestion.dna.reason"), to: `/studio/produkte?dna=${dnaMissingProduct.id}` });
    if (criticalStock > 0) pool.push({ key: "stock", label: t("studio.overview.suggestion.stock.label"), reason: criticalStock === 1 ? t("studio.overview.suggestion.stock.reason.one") : t("studio.overview.suggestion.stock.reason.many", { n: criticalStock }), to: "/studio/produkte" });
    if (staleOrdersCount > 0) pool.push({ key: "stale-orders", label: t("studio.overview.suggestion.staleOrders.label"), reason: staleOrdersCount === 1 ? t("studio.overview.suggestion.staleOrders.reason.one") : t("studio.overview.suggestion.staleOrders.reason.many", { n: staleOrdersCount }), to: "/studio/bestellungen" });
    if (messages.some((m) => m.unread)) pool.push({ key: "messages", label: t("studio.overview.suggestion.messages.label"), reason: t("studio.overview.suggestion.messages.reason"), to: "/studio/nachrichten" });
    if (pendingCampaign) pool.push({ key: "campaign", label: t("studio.overview.suggestion.campaign.label"), reason: t("studio.overview.suggestion.campaign.reason"), to: "/studio/kampagnen" });
    if (unsubmittedMediaCount > 0) pool.push({ key: "archiv", label: t("studio.overview.suggestion.archiv.label"), reason: t("studio.overview.suggestion.archiv.reason"), to: "/studio/mediathek" });
    return pool.filter((s) => !isDismissed(s.key)).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer, hasPortrait, hasStory, dnaMissingProduct, criticalStock, messages, pendingCampaign, unsubmittedMediaCount, staleOrdersCount, t]);

  const dismissSuggestion = async (key: string) => {
    if (!designer) return;
    const next = { ...dismissedMap, [key]: new Date().toISOString() };
    const { error } = await supabase.from("designers").update({ dismissed_suggestions: next }).eq("id", designer.id);
    if (error) { toast.error(error.message); return; }
    void refreshDesigner();
  };

  // Teil 17b: drei ruhige Schritte für ein frisches Haus — abgeleitet aus "noch keine Stücke",
  // kein eigenes DB-Flag. Session-weit ausblendbar, kommt beim nächsten Besuch zurück, solange
  // kein Stück existiert.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  useEffect(() => {
    if (!designer) return;
    setWelcomeDismissed(sessionStorage.getItem(`pawn_welcome_seen_${designer.id}`) === "1");
  }, [designer?.id]);
  const dismissWelcome = () => {
    if (designer) sessionStorage.setItem(`pawn_welcome_seen_${designer.id}`, "1");
    setWelcomeDismissed(true);
  };
  const showWelcome = !!designer && productsLoaded && products.length === 0 && !welcomeDismissed;

  // Teil 28a: die Dialogkarte legt sich für diese Sitzung ab, sobald "Später" gewählt wird —
  // ohne Strafe, beim nächsten Besuch ist PAWN wieder da.
  useEffect(() => {
    if (!designer) return;
    setHeroDismissed(sessionStorage.getItem(`pawn_hero_dismissed_${designer.id}`) === "1");
  }, [designer?.id]);
  const dismissHero = () => {
    if (designer) sessionStorage.setItem(`pawn_hero_dismissed_${designer.id}`, "1");
    setHeroDismissed(true);
  };
  const scrollToNextMove = () => {
    document.getElementById("naechster-zug")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) return <StudioShell title={t("studio.overview.title")}><div className="animate-pulse space-y-6"><div className="h-32 bg-muted" /><div className="h-64 bg-muted" /></div></StudioShell>;

  if (!designer) return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.welcome")}>
      <div className="mx-auto max-w-xl border border-border bg-white p-10 text-center">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.noAccess")}</p>
        <h2 className="mt-3 font-serif text-3xl">{t("studio.overview.noAccess.title")}</h2>
        <p className="mt-4 text-sm text-muted-foreground">{t("studio.overview.noAccess.body")}</p>
        <Link to="/apply" className="mt-6 inline-flex border border-foreground px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">{t("studio.overview.noAccess.cta")}</Link>
      </div>
    </StudioShell>
  );

  if (showWelcome) return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.welcome")}>
      <DesignerWelcome name={firstName} onSkip={dismissWelcome} />
    </StudioShell>
  );

  return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.overview")}>
      {/* Teil 28a: PAWN als Figur — Hero, Namensschild, Dialogkarte mit echter Begrüßung */}
      <section className="mb-8 border-b-[1.5px] border-foreground pb-8 text-center">
        <div className="flex justify-center">
          <PawnFigur ref={pawnRef} rank={RANK_BY_LEVEL[level.level] ?? "bauer"} size={160} />
        </div>
        <div className="mt-3">
          <p className="font-serif text-2xl font-semibold tracking-tight">PAWN</p>
          <p className="mt-1 text-[0.58rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.hero.nameplateSub")}</p>
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="font-serif text-lg text-foreground leading-none">{level.glyph}</span>
          {level.label}
        </p>
        <h1 className="sr-only">{greetingByHour(t)}, {firstName}.</h1>

        {!heroDismissed && (
          <div className="mx-auto mt-6 max-w-xl border-[1.5px] border-foreground bg-white text-left shadow-[8px_8px_0_0_#000]">
            <div className="min-h-[84px] p-5">
              <p className="font-serif text-lg italic leading-relaxed sm:text-xl">
                {heroTyped}
                {!heroTypedDone && <span className="pf-caret" aria-hidden="true" />}
              </p>
            </div>
            {heroTypedDone && (
              <div className="flex flex-wrap gap-2 border-t-[1.5px] border-foreground px-5 py-4">
                <Link
                  to={nextMove.to}
                  onClick={() => pawnRef.current?.squish()}
                  className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.55rem] uppercase tracking-[0.26em] text-background hover:bg-background hover:text-foreground"
                >
                  {t("studio.overview.hero.chip.takeOver")}
                </Link>
                <button type="button" onClick={scrollToNextMove} className="border-[1.5px] border-foreground px-4 py-2 text-[0.55rem] uppercase tracking-[0.26em] hover:bg-foreground hover:text-background">
                  {t("studio.overview.hero.chip.guide")}
                </button>
                <button type="button" onClick={dismissHero} className="border-[1.5px] border-foreground px-4 py-2 text-[0.55rem] uppercase tracking-[0.26em] hover:bg-foreground hover:text-background">
                  {t("studio.overview.hero.chip.later")}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Begleiter — der Weg zur eigenen Marke, immer einen Klick entfernt */}
      <Link to="/studio/aufbau" className="mb-6 flex flex-wrap items-center justify-between gap-4 border-[1.5px] border-foreground bg-white px-6 py-4 hover:bg-foreground hover:text-background">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.28em] opacity-60">{t("studio.overview.companion.eyebrow")}</p>
          <p className="mt-1 font-serif text-lg">{t("studio.overview.companion.body")}</p>
        </div>
        <span className="text-[0.62rem] uppercase tracking-[0.28em]">{t("studio.overview.companion.cta")}</span>
      </Link>

      {/* DEIN NÄCHSTER ZUG — die grösste Karte */}
      <section id="naechster-zug" data-guide={t("studio.guide.nextMove")} className="mb-6 scroll-mt-20 border-[1.5px] border-foreground bg-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
              <ArrowRight className="h-3 w-3" /> {t("studio.overview.nextMove.eyebrow")}
              {nextMove.urgency === "hoch" && <span className="border-[1.5px] border-destructive px-1.5 text-destructive">{t("studio.overview.nextMove.urgent")}</span>}
            </p>
            <h2 className="mt-3 font-serif text-2xl leading-tight md:text-3xl">{nextMove.headline}</h2>
            <p className="mt-3 text-sm text-foreground/70">{nextMove.reason}</p>
          </div>
          <Link
            to={nextMove.to}
            className="inline-flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:bg-background hover:text-foreground"
          >
            {nextMove.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Teil 17c: tägliche Liste — höchstens drei begründete Vorschläge, darf leer sein. */}
      <DailyList suggestions={dailySuggestions} onDismiss={dismissSuggestion} />

      {/* Teil 17c: Dein Weg — acht Schritte vom Konto bis zum ersten Verkauf, abgeleitet. */}
      <DesignerJourney steps={journey.steps} doneCount={journey.doneCount} />

      {/* Teil 15c: Die Verwandlung — Stufen aus echtem Tun, niemals käuflich. */}
      <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">
            {milestones.verwandlung_at ? t("studio.overview.verwandlung.reached") : t("studio.overview.verwandlung.title")}
          </p>
          {milestones.verwandlung_at && <span className="font-serif text-lg leading-none">♛</span>}
        </div>
        <ol className="mt-4 flex flex-wrap items-stretch gap-2">
          {VERWANDLUNG_STEPS.map((step) => {
            const done = !!milestones[step.key];
            const isNext = !done && nextVerwandlungStep(milestones)?.key === step.key;
            const content = (
              <div className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 border-[1.5px] px-3 py-2 text-center ${
                done ? "border-foreground bg-foreground text-background"
                : isNext ? "border-foreground bg-white"
                : "border-border bg-white text-muted-foreground"
              }`}>
                <span className="font-serif text-lg leading-none">{step.glyph}</span>
                <span className="text-[0.55rem] uppercase tracking-wide leading-tight">{step.label}</span>
              </div>
            );
            return (
              <li key={step.key} className="min-w-[110px] flex-1">
                {isNext ? <Link to={step.to}>{content}</Link> : content}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("studio.overview.verwandlung.hint")}
        </p>
      </section>

      {/* Teil 28a: Deine Wand — jedes veröffentlichte Stück bekommt einen Platz, echte Bilder statt Platzhalter. */}
      <section data-guide={t("studio.guide.wand")} className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.wand.title")}</p>
          <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{Math.min(publishedCount, 8)} / 8</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => {
            const p = products.filter((x) => x.status === "published")[i];
            return (
              <div key={i} className={`aspect-[4/5] border ${p ? "border-[1.5px] border-foreground shadow-[4px_4px_0_0_#000]" : "border-dashed border-border"}`}>
                {p?.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{t("studio.overview.wand.hint")}</p>
      </section>

      {/* Teil 28a: "Du triffst mich überall" — dieselbe Figur als Lade-/Leer-/Erfolgs-Zustand. */}
      <section className="mb-6">
        <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.states.title")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { pose: "load", label: t("studio.overview.states.load"), caption: t("studio.pawn.loading") },
            { pose: "shrug", label: t("studio.overview.states.empty"), caption: t("studio.pawn.empty.title") },
            { pose: "win", label: t("studio.overview.states.win"), caption: t("studio.pawn.win.title") },
          ] as const).map((s) => (
            <div key={s.pose} className="border-[1.5px] border-foreground bg-white p-4 text-center">
              <div className="flex justify-center">
                <PawnFigurState pose={s.pose} size={42} />
              </div>
              <p className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{s.label} — „{s.caption}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Teil 28a: Deine Räume — Werkbank/Schaufenster/Dein Raum, mit lebenden Zustandszeilen. */}
      <section data-guide={t("studio.guide.rooms")} className="mb-6">
        <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.rooms.title")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/studio/produkte" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
            <p className="font-serif text-lg">{t("studio.overview.rooms.werkbank")}</p>
            <p className="mt-1 text-sm opacity-70">
              {(() => {
                const missing = products.filter((p) => !p.image_url).length;
                if (missing === 0) return t("studio.overview.rooms.werkbank.ok");
                return missing === 1 ? t("studio.overview.rooms.werkbank.missing.one") : t("studio.overview.rooms.werkbank.missing.many", { n: missing });
              })()}
            </p>
          </Link>
          <Link to="/studio/mediathek" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
            <p className="font-serif text-lg">{t("studio.overview.rooms.schaufenster")}</p>
            <p className="mt-1 text-sm opacity-70">
              {unsubmittedMediaCount === 0
                ? t("studio.overview.rooms.schaufenster.none")
                : unsubmittedMediaCount === 1
                  ? t("studio.overview.rooms.schaufenster.waiting.one")
                  : t("studio.overview.rooms.schaufenster.waiting.many", { n: unsubmittedMediaCount })}
            </p>
          </Link>
          <Link to="/studio/hausseite" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
            <p className="font-serif text-lg">{t("studio.overview.rooms.deinRaum")}</p>
            <p className="mt-1 text-sm opacity-70">
              {designer.page_published_at
                ? `${t("studio.overview.rooms.deinRaum.published")}${designer.collection_title ? ` · „${designer.collection_title}"` : ""}`
                : t("studio.overview.rooms.deinRaum.draft")}
            </p>
          </Link>
        </div>
      </section>

      {/* Teil 28a: Partie-Buch-Auszug — leuchtet erst richtig auf, sobald partie_zuege (PR 28c) schreibt. */}
      <section data-guide={t("studio.guide.partiebuch")} className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.partiebuch.title")}</p>
        </div>
        {partieZuege.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("studio.overview.partiebuch.empty")}</p>
        ) : (
          <ol className="mt-4 divide-y divide-border">
            {partieZuege.map((z) => (
              <li key={z.id} className="flex items-baseline gap-3 py-3 text-sm">
                <span className="font-serif">{z.nr}.</span>
                <span className="flex-1">{z.akteur === "pawn" && "♟ "}{z.text}</span>
                <span className="shrink-0 text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {z.akteur === "pawn" ? t("studio.overview.partiebuch.by.pawn") : z.akteur === "halle" ? t("studio.overview.partiebuch.by.halle") : t("studio.overview.partiebuch.by.you")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* World filter chips */}
      {availableWorlds.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {(["all", ...availableWorlds] as const).map((w) => (
            <button key={w} onClick={() => setWorldFilter(w as "all" | World)}
              className={`border-[1.5px] px-3 py-1.5 text-[0.68rem] tracking-wide ${worldFilter === w ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:bg-muted"}`}>
              {w === "all" ? t("studio.overview.worldFilter.all") : w}
            </button>
          ))}
        </div>
      )}

      {/* Copilot weekly mirror — black */}
      <section className="mb-6 border border-transparent bg-foreground p-8 text-background">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center border border-background/25 font-serif">♟</span>
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-background/60">{t("studio.overview.copilot.eyebrow")}</p>
            </div>
            <p className="mt-4 font-serif text-xl leading-relaxed md:text-2xl">
              {mirror?.text ?? t("studio.overview.copilot.thinking")}
            </p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-background/60" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={generateCampaign} className="border border-background bg-background px-4 py-2 text-[0.68rem] tracking-wide text-foreground hover:bg-background/90">{t("studio.overview.copilot.draftCampaign")}</button>
          <button onClick={copilot.open} className="border border-background/50 px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-background/10">{t("studio.overview.copilot.ask")}</button>
        </div>
      </section>

      {/* KPIs — einklappbar */}
      <section className="mb-6 border-[1.5px] border-border bg-white">
        <button type="button" onClick={() => setShowKpi((v) => !v)} className="flex w-full items-center justify-between px-5 py-3">
          <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.kpi.eyebrow")}</span>
          {showKpi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showKpi && (
          <div className="grid gap-3 border-t border-border p-4 md:grid-cols-4">
            <KpiCard label={t("studio.overview.kpi.revenue30")} value={`€ ${revenue30.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`} sparkline={series} />
            <KpiCard label={t("studio.overview.kpi.orders30")} value={String(orderCount)} sparkline={ordersSeries} link="/studio/bestellungen" />
            <KpiCard label={t("studio.overview.kpi.wishlist")} value={String(wishTotal)} sparkline={wishSeries} />
            <KpiCard label={t("studio.overview.kpi.criticalStock")} value={String(criticalStock)} link="/studio/produkte" highlight={criticalStock > 0} />
          </div>
        )}
      </section>


      {/* Collection grid */}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.collection.eyebrow")}</p>
            <h2 className="mt-1 font-serif text-2xl">{filteredProducts.length === 1 ? t("studio.overview.collection.count.one", { n: filteredProducts.length }) : t("studio.overview.collection.count.many", { n: filteredProducts.length })}</h2>
          </div>
          <Link to="/studio/produkte" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">{t("studio.overview.collection.allProducts")}</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.slice(0, 7).map((p) => (
            <article key={p.id} className="group border border-border bg-white">
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{t("studio.overview.product.noImage")}</div>}
                <span className={`absolute left-3 top-3 border px-2 py-1 text-[0.6rem] tracking-wider ${p.inventory_mode === "stock" ? "border-border bg-background text-foreground" : "border-transparent bg-foreground text-background"}`}>
                  {p.inventory_mode === "stock" ? t("studio.overview.product.stock", { n: p.stock_quantity }) : t("studio.overview.product.madeToOrder", { days: p.lead_time_days ?? "—" })}
                </span>
              </div>
              <div className="p-4">
                <p className="truncate font-serif text-base">{p.name}</p>
                <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{p.world}</p>
                {p.inventory_mode === "stock" && p.stock_quantity < 3 && (
                  <p className="mt-2 flex items-center gap-1 text-[0.68rem] text-destructive"><AlertTriangle className="h-3 w-3" /> {p.stock_quantity === 0 ? t("studio.overview.product.soldOut") : t("studio.overview.product.lowStock", { n: p.stock_quantity })}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <p className="tabular-nums text-sm">€ {p.price.toLocaleString("de-DE")}</p>
                  <label className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <input type="checkbox" checked={p.status === "published"} onChange={() => togglePublish(p)} className="h-4 w-8 cursor-pointer appearance-none rounded-full border border-border bg-muted transition-colors checked:bg-foreground" />
                    <span>{p.status === "published" ? t("studio.overview.product.live") : t("studio.overview.product.draft")}</span>
                  </label>
                </div>
                <p className="mt-2 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("studio.overview.product.stats", { views: p.view_count ?? 0, clicks: shopClicksByProduct[p.id] ?? 0, sales: salesBySlug[p.slug] ?? 0 })}
                </p>
              </div>
            </article>
          ))}
          <Link to="/studio/produkte/neu" className="flex aspect-[4/5] flex-col items-center justify-center border border-dashed border-border bg-white text-muted-foreground hover:border-foreground hover:text-foreground">
            <Plus className="h-6 w-6" />
            <p className="mt-3 text-[0.68rem] uppercase tracking-[0.24em]">{t("studio.overview.product.addNew")}</p>
          </Link>
        </div>
      </section>

      {/* Bottom two-column — einklappbar */}
      <section className="mb-2 border-[1.5px] border-border bg-white">
        <button type="button" onClick={() => setShowLower((v) => !v)} className="flex w-full items-center justify-between px-5 py-3">
          <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.lower.eyebrow")}</span>
          {showLower ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </section>
      {showLower && (
      <section className="grid gap-6 lg:grid-cols-2">

        {/* Orders */}
        <div className="border border-border bg-white p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.orders.eyebrow")}</p>
            <Link to="/studio/bestellungen" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">{t("studio.overview.viewAll")}</Link>
          </div>
          {paid.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("studio.overview.orders.empty.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("studio.overview.orders.empty.body")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {paid.slice(0, 6).map((l) => (
                <li key={`${l.order_id}-${l.product_slug}`} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-base">{l.product_name}</p>
                    <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                      {(l.customer_first_name ?? t("studio.overview.orders.customerFallback"))}{l.customer_country ? ` · ${l.customer_country}` : ""} · {new Date(l.order_created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-sm">€ {(l.unit_price * l.qty).toLocaleString("de-DE")}</p>
                    <span className="text-[0.6rem] uppercase tracking-[0.22em] text-foreground">{t("studio.overview.orders.paid")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending campaign */}
        <div className="border border-border bg-white p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.campaign.eyebrow")}</p>
            <Link to="/studio/kampagnen" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">{t("studio.overview.viewAll")}</Link>
          </div>
          {!pendingCampaign ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("studio.overview.campaign.empty")}</p>
              <button onClick={generateCampaign} className="mt-3 border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">{t("studio.overview.campaign.draftWithCopilot")}</button>
            </div>
          ) : (
            <>
              <p className="font-serif text-xl">{pendingCampaign.title}</p>
              <div className="mt-4 border border-border bg-muted p-4">
                {pendingCampaign.caption && <p className="font-serif italic leading-relaxed">"{pendingCampaign.caption}"</p>}
                {pendingCampaign.hashtags && pendingCampaign.hashtags.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">{pendingCampaign.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => approveCampaign(pendingCampaign.id)} className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background">{t("studio.overview.campaign.approve")}</button>
                <Link to={`/studio/kampagnen`} className="border border-border px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("studio.overview.campaign.requestChanges")}</Link>
              </div>
              <p className="mt-3 text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">{t("studio.overview.campaign.noAutoPublish")}</p>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="border border-border bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.messages.eyebrow")}</p>
            <Link to="/studio/nachrichten" className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">{t("studio.overview.viewAll")}</Link>
          </div>
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("studio.overview.messages.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {m.unread && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                    <p className="font-serif text-base">{m.subject}</p>
                  </div>
                  <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{new Date(m.last_message_at).toLocaleDateString("de-DE")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      )}
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
