import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnFigur, type PawnFigurHandle, type PawnRank } from "@/components/pawn/PawnFigur";
import { WhileYouWereAway } from "@/components/pawn/WhileYouWereAway";
import { ErstePartie } from "@/components/pawn/ErstePartie";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { useNextMove } from "@/features/studio/nextMove";
import { usePawnMood, type PawnMoodSignals } from "@/features/studio/usePawnMood";
import { useDisplayName } from "@/lib/displayName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { schreibePawnSignal } from "@/lib/pawnSignal";

/** Rang der Figur folgt dem echten Milestone-Level des Hauses (useDesignerLevel). */
const RANK_BY_LEVEL: Record<string, PawnRank> = {
  bauer: "bauer", springer: "springer", laeufer: "laeufer", turm: "turm", dame: "dame",
};

type World = "Mode" | "Interior" | "Kunst";

interface Product {
  id: string; name: string; slug: string; world: World; price: number;
  image_url: string | null; status: string; inventory_mode: "stock" | "made_to_order";
  stock_quantity: number; lead_time_days: number | null; product_dna?: Record<string, unknown[]>;
}
interface Message { id: string; subject: string; last_message_at: string; unread: boolean }
interface Campaign { id: string; title: string; status: string; created_at: string }
type CampaignRow = { id: string; title: string; status: string; created_at: string };

function useWelcomeSteps(t: (k: string, vars?: Record<string, string | number>) => string) {
  return [
    { title: t("studio.overview.welcome.step1.title"), body: t("studio.overview.welcome.step1.body") },
    {
      title: t("studio.overview.welcome.step2.title"), body: null,
      bullets: [t("studio.overview.welcome.step2.bullet1"), t("studio.overview.welcome.step2.bullet2"), t("studio.overview.welcome.step2.bullet3")],
    },
    { title: t("studio.overview.welcome.step3.title"), body: t("studio.overview.welcome.step3.body") },
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

interface WoRow { key: string; label: string; reason: string; to: string; dismissable: boolean }

export default function StudioOverview() {
  const { designer, loading, refresh: refreshDesigner } = useMyDesigner();
  const { lines } = useDesignerOrders(designer?.id);
  const { level } = useDesignerLevel(designer?.id);
  const { firstName } = useDisplayName();
  const { t } = useI18n();
  const pawnRef = useRef<PawnFigurHandle>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign | null>(null);
  const [visitorsYesterday, setVisitorsYesterday] = useState<number | null>(null);
  const [visitorsDayBefore, setVisitorsDayBefore] = useState<number | null>(null);
  const [unsubmittedMediaCount, setUnsubmittedMediaCount] = useState(0);
  const [partieZuege, setPartieZuege] = useState<{ id: string; nr: number; text: string; akteur: string; created_at: string }[]>([]);
  const [tapLine, setTapLine] = useState<string | null>(null);

  const lastSeenSnapshotRef = useRef<string | null>(null);
  const [lastSeenSnapshotReady, setLastSeenSnapshotReady] = useState(false);
  useEffect(() => {
    if (designer && !lastSeenSnapshotReady) {
      lastSeenSnapshotRef.current = designer.studio_last_seen_at;
      setLastSeenSnapshotReady(true);
    }
  }, [designer, lastSeenSnapshotReady]);

  // Teil 28b: "Die erste Partie" — beim allerersten Studio-Besuch öffnet sich das Gespräch von
  // selbst; danach nur noch über die Fortsetzen-Karte. "Später" legt es für diese Sitzung ab.
  const [showErstePartie, setShowErstePartie] = useState(false);
  const onboardingStatus = (designer?.onboarding_state as { status?: string } | undefined)?.status;
  useEffect(() => {
    if (!designer) return;
    if (onboardingStatus === "abgeschlossen") return;
    const dismissedKey = `pawn_partie_dismissed_${designer.id}`;
    if (sessionStorage.getItem(dismissedKey) === "1") return;
    if (!onboardingStatus || onboardingStatus === "nicht_begonnen") setShowErstePartie(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer?.id, onboardingStatus]);
  const closeErstePartie = () => {
    if (designer) sessionStorage.setItem(`pawn_partie_dismissed_${designer.id}`, "1");
    setShowErstePartie(false);
  };
  const finishErstePartie = () => {
    setShowErstePartie(false);
    void refreshDesigner();
  };

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [prods, msgs, camp, visitY, visitDB] = await Promise.all([
        supabase.from("products").select("id, name, slug, world, price, image_url, status, inventory_mode, stock_quantity, lead_time_days, product_dna").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("message_threads").select("id, subject, last_message_at, status").eq("designer_id", designer.id).order("last_message_at", { ascending: false }).limit(5),
        supabase.from("campaigns").select("id, title, status, created_at").eq("designer_id", designer.id).eq("status", "proposed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("domain_events").select("id").eq("type", "designer.view").eq("payload->>designer_id", designer.id)
          .gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).lt("created_at", new Date(Date.now() - 86400000).toISOString()),
        supabase.from("domain_events").select("id").eq("type", "designer.view").eq("payload->>designer_id", designer.id)
          .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString()).lt("created_at", new Date(Date.now() - 2 * 86400000).toISOString()),
      ]);
      setProducts(((prods.data ?? []) as Product[]));
      setProductsLoaded(true);
      setMessages(((msgs.data ?? []) as { id: string; subject: string; last_message_at: string; status: string }[]).map((m) => ({ id: m.id, subject: m.subject, last_message_at: m.last_message_at, unread: m.status === "open" })));
      setPendingCampaign(camp.data ? (camp.data as CampaignRow) : null);
      setVisitorsYesterday(visitY.data ? visitY.data.length : null);
      setVisitorsDayBefore(visitDB.data ? visitDB.data.length : null);

      const { count } = await supabase.from("media_assets" as never).select("id", { count: "exact", head: true })
        .eq("designer_id", designer.id).eq("review_status", "privat");
      setUnsubmittedMediaCount(count ?? 0);
    })();
  }, [designer]);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.from("partie_zuege" as never).select("id, nr, text, akteur, created_at")
        .eq("designer_id", designer.id).order("created_at", { ascending: false }).limit(5);
      setPartieZuege((data as never as typeof partieZuege) ?? []);
    })();
  }, [designer]);

  const paid = useMemo(() => lines.filter((l) => l.order_status === "paid"), [lines]);
  const publishedCount = products.filter((p) => p.status === "published").length;
  const hasStory = !!designer?.story && designer.story.length > 40;
  const hasPortrait = !!designer?.avatar_url || !!designer?.hero_image_url;
  const nextMove = useNextMove({ designerId: designer?.id, level, hasStory, hasPortrait, publishedCount });

  const dnaMissingProduct = useMemo(() => products.filter((p) => p.status === "published").find((p) => {
    const dna = p.product_dna ?? {};
    const n = (k: string) => Array.isArray(dna[k]) ? (dna[k] as unknown[]).length : 0;
    return n("materials") + n("silhouette") + n("colors") + n("mood") === 0;
  }), [products]);
  const criticalStock = useMemo(() => products.filter((p) => p.inventory_mode === "stock" && p.stock_quantity < 3).length, [products]);
  const staleOrdersCount = useMemo(() => {
    const cutoff = Date.now() - 3 * 86400000;
    const staleOrderIds = new Set(
      paid.filter((l) => l.fulfillment_status === "new" && new Date(l.order_created_at).getTime() < cutoff).map((l) => l.order_id),
    );
    return staleOrderIds.size;
  }, [paid]);

  // Teil 31 — Stimmungs-Maschine: deterministisch aus bereits geladenen Hub-Daten.
  const moodSignals: PawnMoodSignals = useMemo(() => {
    const now = Date.now();
    const recentPaid = paid.slice().sort((a, b) => new Date(b.order_created_at).getTime() - new Date(a.order_created_at).getTime())[0];
    const saleOrMilestoneHoursAgo = recentPaid ? (now - new Date(recentPaid.order_created_at).getTime()) / 3600000 : null;
    const waitingAges = [
      ...messages.filter((m) => m.unread).map((m) => (now - new Date(m.last_message_at).getTime()) / 86400000),
      ...paid.filter((l) => l.fulfillment_status === "new").map((l) => (now - new Date(l.order_created_at).getTime()) / 86400000),
    ];
    const oldestWaitingDays = waitingAges.length > 0 ? Math.max(...waitingAges) : null;
    const lastVisitDays = lastSeenSnapshotReady && lastSeenSnapshotRef.current
      ? (now - new Date(lastSeenSnapshotRef.current).getTime()) / 86400000 : null;
    const activityRising = visitorsYesterday != null && visitorsDayBefore != null && visitorsYesterday > visitorsDayBefore && visitorsYesterday > 0;
    return { saleOrMilestoneHoursAgo, hasPendingMove: !!pendingCampaign, activityRising, oldestWaitingDays, lastVisitDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid, messages, visitorsYesterday, visitorsDayBefore, pendingCampaign, lastSeenSnapshotReady]);
  const { mood, variant } = usePawnMood(moodSignals);

  const oldestWaitingItem = useMemo(() => {
    const candidates: { label: string; days: number }[] = [];
    for (const m of messages) if (m.unread) candidates.push({ label: m.subject, days: (Date.now() - new Date(m.last_message_at).getTime()) / 86400000 });
    for (const l of paid) if (l.fulfillment_status === "new") candidates.push({ label: l.product_name, days: (Date.now() - new Date(l.order_created_at).getTime()) / 86400000 });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.days - a.days)[0];
  }, [messages, paid]);

  const moodLine = useMemo(() => {
    if (!mood) return "";
    const vars: Record<string, string | number> = {
      n: visitorsYesterday ?? 0,
      product: products.find((p) => p.status === "published")?.name ?? t("studio.overview.hero.nameplateSub"),
      label: nextMove.headline,
      item: oldestWaitingItem?.label ?? nextMove.headline,
      days: oldestWaitingItem ? Math.round(oldestWaitingItem.days) : 7,
    };
    return t(`studio.mood.${mood}.greeting.${variant + 1}`, vars);
  }, [mood, variant, visitorsYesterday, products, nextMove.headline, oldestWaitingItem, t]);

  const onFigureTap = (fallbackLine: string) => {
    if (mood === "sehnsucht") { setTapLine(t("studio.mood.sehnsucht.tapWarm")); return; }
    setTapLine(mood ? t(`studio.mood.${mood}.tap.${variant + 1}`) : fallbackLine);
  };

  const approveCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingCampaign(null);
    toast.success(t("studio.overview.toast.campaignApproved"));
    pawnRef.current?.celebrate();
    void schreibePawnSignal("zug_erledigt", { zug: "kampagne_freigeben" });
  };

  // Teil 32 — Die Nutzungs-Schleife: "Dein Zug" angenommen oder übersprungen, nur als Muster.
  const [moveSkipped, setMoveSkipped] = useState(false);
  const takeMove = () => { void schreibePawnSignal("zug_erledigt", { zug: nextMove.key }); pawnRef.current?.squish(); };
  const skipMove = () => { setMoveSkipped(true); void schreibePawnSignal("zug_uebersprungen", { zug: nextMove.key }); };

  // Teil 17c: tägliche Liste, jetzt Teil von Schritt 2 — begründete Vorschläge, aus echtem
  // Zustand abgeleitet. Weggelegtes kommt frühestens nach 7 Tagen zurück.
  const dismissedMap = designer?.dismissed_suggestions ?? {};
  const isDismissed = (key: string) => {
    const at = dismissedMap[key];
    return !!at && Date.now() - new Date(at).getTime() < 7 * 86400000;
  };
  const woRows: WoRow[] = useMemo(() => {
    if (!designer) return [];
    const pool: WoRow[] = [];
    if (!hasPortrait) pool.push({ key: "portrait", label: t("studio.overview.suggestion.portrait.label"), reason: t("studio.overview.suggestion.portrait.reason"), to: "/studio/brand", dismissable: true });
    if (!hasStory) pool.push({ key: "manifest", label: t("studio.overview.suggestion.manifest.label"), reason: t("studio.overview.suggestion.manifest.reason"), to: "/studio/brand", dismissable: true });
    if (dnaMissingProduct) pool.push({ key: "dna", label: t("studio.overview.suggestion.dna.label"), reason: t("studio.overview.suggestion.dna.reason"), to: `/studio/produkte?dna=${dnaMissingProduct.id}`, dismissable: true });
    if (criticalStock > 0) pool.push({ key: "stock", label: t("studio.overview.suggestion.stock.label"), reason: criticalStock === 1 ? t("studio.overview.suggestion.stock.reason.one") : t("studio.overview.suggestion.stock.reason.many", { n: criticalStock }), to: "/studio/produkte", dismissable: true });
    if (staleOrdersCount > 0) pool.push({ key: "stale-orders", label: t("studio.overview.suggestion.staleOrders.label"), reason: staleOrdersCount === 1 ? t("studio.overview.suggestion.staleOrders.reason.one") : t("studio.overview.suggestion.staleOrders.reason.many", { n: staleOrdersCount }), to: "/studio/bestellungen", dismissable: true });
    if (messages.some((m) => m.unread)) pool.push({ key: "messages", label: t("studio.overview.suggestion.messages.label"), reason: t("studio.overview.suggestion.messages.reason"), to: "/studio/nachrichten", dismissable: true });
    if (unsubmittedMediaCount > 0) pool.push({ key: "archiv", label: t("studio.overview.suggestion.archiv.label"), reason: t("studio.overview.suggestion.archiv.reason"), to: "/studio/mediathek", dismissable: true });
    const urgent = pool.filter((s) => !isDismissed(s.key));

    const missingImages = products.filter((p) => !p.image_url).length;
    const rooms: WoRow[] = [
      {
        key: "room-werkbank", label: t("studio.overview.rooms.werkbank"),
        reason: missingImages === 0 ? t("studio.overview.rooms.werkbank.ok") : missingImages === 1 ? t("studio.overview.rooms.werkbank.missing.one") : t("studio.overview.rooms.werkbank.missing.many", { n: missingImages }),
        to: "/studio/produkte", dismissable: false,
      },
      {
        key: "room-schaufenster", label: t("studio.overview.rooms.schaufenster"),
        reason: unsubmittedMediaCount === 0 ? t("studio.overview.rooms.schaufenster.none") : unsubmittedMediaCount === 1 ? t("studio.overview.rooms.schaufenster.waiting.one") : t("studio.overview.rooms.schaufenster.waiting.many", { n: unsubmittedMediaCount }),
        to: "/studio/mediathek", dismissable: false,
      },
      {
        key: "room-deinraum", label: t("studio.overview.rooms.deinRaum"),
        reason: designer.page_published_at ? t("studio.overview.rooms.deinRaum.published") : t("studio.overview.rooms.deinRaum.draft"),
        to: "/studio/hausseite", dismissable: false,
      },
    ];
    return [...urgent, ...rooms];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer, hasPortrait, hasStory, dnaMissingProduct, criticalStock, staleOrdersCount, messages, unsubmittedMediaCount, products, t]);

  const dismissSuggestion = async (key: string) => {
    if (!designer) return;
    const next = { ...dismissedMap, [key]: new Date().toISOString() };
    const { error } = await supabase.from("designers").update({ dismissed_suggestions: next }).eq("id", designer.id);
    if (error) { toast.error(error.message); return; }
    void refreshDesigner();
    void schreibePawnSignal("funktion_ignoriert", { funktion: key });
  };

  // Teil 17b: drei ruhige Schritte für ein frisches Haus.
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
      {lastSeenSnapshotReady && <WhileYouWereAway designerId={designer.id} previousLastSeenAt={lastSeenSnapshotRef.current} />}
      {showErstePartie && <ErstePartie rank={RANK_BY_LEVEL[level.level] ?? "bauer"} onClose={closeErstePartie} onDone={finishErstePartie} />}

      {!showErstePartie && onboardingStatus === "laeuft" && (
        <button
          type="button"
          onClick={() => setShowErstePartie(true)}
          className="mb-6 flex w-full flex-wrap items-center justify-between gap-4 border-[1.5px] border-foreground bg-white px-6 py-4 text-left hover:bg-foreground hover:text-background"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.28em] opacity-60">{t("studio.erstePartie.resume.eyebrow")}</p>
            <p className="mt-1 font-serif text-lg">{t("studio.erstePartie.resume.body")}</p>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.28em]">{t("studio.erstePartie.resume.cta")}</span>
        </button>
      )}

      {/* Teil 31 — PAWN kompakt links + Satz. Die Stimmung zeigt sich nur in Bewegung und
          Wortwahl, nie beschriftet. */}
      <section id="studio-hero" className="mb-6 flex items-center gap-4 border-[1.5px] border-foreground bg-white p-5">
        <PawnFigur ref={pawnRef} rank={RANK_BY_LEVEL[level.level] ?? "bauer"} size={72} mood={mood} moodVariant={variant} onTap={onFigureTap} showShadow={false} ariaLabel="PAWN" />
        <p className="font-serif text-lg italic leading-snug sm:text-xl">{tapLine ?? moodLine}</p>
      </section>

      {/* Schnellzeile */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link to="/studio/produkte/neu" className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground">
          {t("studio.overview.quickrow.newProduct")}
        </Link>
        <Link to="/studio/kampagnen/neu" className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
          {t("studio.overview.quickrow.stage")}
        </Link>
        <Link to="/studio/bestellungen" className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
          {t("studio.overview.quickrow.orders")}
        </Link>
        <Link to={`/designer/${designer.slug}`} target="_blank" rel="noopener noreferrer" className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
          {t("studio.overview.quickrow.myPage")}
        </Link>
      </div>

      {/* Schritt 1 · Dein Zug */}
      <section data-guide={t("studio.guide.nextMove")} className="mb-6 scroll-mt-20 border-[1.5px] border-foreground bg-white p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
          <ArrowRight className="h-3 w-3" /> {t("studio.overview.step1.eyebrow")}
          {nextMove.urgency === "hoch" && <span className="border-[1.5px] border-destructive px-1.5 text-destructive">{t("studio.overview.nextMove.urgent")}</span>}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-serif text-2xl leading-tight md:text-3xl">{nextMove.headline}</h2>
            <p className="mt-3 text-sm text-foreground/70">{nextMove.reason}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link to={nextMove.to} onClick={takeMove} className="inline-flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:bg-background hover:text-foreground">
              {nextMove.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {!moveSkipped && (
              <button type="button" onClick={skipMove} className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground underline hover:text-foreground">
                {t("studio.overview.nextMove.skip")}
              </button>
            )}
          </div>
        </div>

        {pendingCampaign && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-foreground/15 pt-5">
            <p className="text-sm">{pendingCampaign.title}</p>
            <button type="button" onClick={() => void approveCampaign(pendingCampaign.id)} className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground">
              {t("studio.overview.campaign.approve")}
            </button>
          </div>
        )}

        {/* Wand als Zeile in der Karte */}
        <div className="mt-6 border-t-[1.5px] border-foreground/15 pt-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.overview.wand.title")}</p>
            <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{Math.min(publishedCount, 8)} / 8</span>
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => {
              const p = products.filter((x) => x.status === "published")[i];
              return (
                <div key={i} className={`aspect-[4/5] border ${p ? "border-[1.5px] border-foreground" : "border-dashed border-border"}`}>
                  {p?.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Schritt 2 · Wo etwas los ist */}
      <section data-guide={t("studio.guide.rooms")} className="mb-6 border-[1.5px] border-foreground bg-white p-6 sm:p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.step2.eyebrow")}</p>
        <ol className="mt-4 divide-y divide-border">
          {woRows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.reason}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link to={row.to} onClick={() => void schreibePawnSignal("funktion_genutzt", { funktion: row.key })} className="text-[0.6rem] uppercase tracking-[0.22em] underline hover:text-foreground">{t("studio.overview.step2.action.open")}</Link>
                {row.dismissable && (
                  <button type="button" onClick={() => void dismissSuggestion(row.key)} aria-label={t("studio.overview.today.dismiss")} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Schritt 3 · Unsere Partie */}
      <section data-guide={t("studio.guide.partiebuch")} className="mb-6 border-[1.5px] border-foreground bg-white p-6 sm:p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.step3.eyebrow")}</p>
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
    </StudioShell>
  );
}
