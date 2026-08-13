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
import { useZugScheduler, rueckblickAbhaken, type Zug } from "@/features/studio/zugScheduler";
import { BauerGespraech } from "@/components/pawn/BauerGespraech";
import { usePawnMood, type PawnMoodSignals } from "@/features/studio/usePawnMood";
import { useDisplayName } from "@/lib/displayName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { schreibePawnSignal } from "@/lib/pawnSignal";
import { ladePlanGate, limitFor, type Plan } from "@/lib/planGate";

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
  const [partieZuege, setPartieZuege] = useState<{ id: string; nr: number; text: string; akteur: string; created_at: string }[]>([]);

  // Teil K — der Bauer als Hub: Gesprächs-Schublade + "Alle Züge ansehen" + Brett-Zähler.
  const [gespraechOpen, setGespraechOpen] = useState(false);
  const [alleZuegeOffen, setAlleZuegeOffen] = useState(false);
  const [offeneThreads, setOffeneThreads] = useState(0);
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { count } = await supabase.from("message_threads").select("id", { count: "exact", head: true })
        .eq("designer_id", designer.id).eq("status", "open");
      setOffeneThreads(count ?? 0);
    })();
  }, [designer]);

  // PART 48 AP7: die Verbrauchszeile — eine ruhige Zeile statt Guthabenstand, live aus
  // plan_usage_stand + ai_config.plans (planGate). Nur monatliche Kontingente, kein
  // dauerhafter Degradierungs-Indikator (der zeigt sich transient im Gespräch selbst).
  const [verbrauch, setVerbrauch] = useState<{ tueren: number; nachrichten: number } | null>(null);
  useEffect(() => {
    if (!designer) return;
    (async () => {
      await ladePlanGate();
      const [{ data: tueren }, { data: nachrichten }] = await Promise.all([
        supabase.rpc("plan_usage_stand" as never, { p_designer_id: designer.id, p_feature: "tuer_oeffnen" } as never),
        supabase.rpc("plan_usage_stand" as never, { p_designer_id: designer.id, p_feature: "chat_nachricht" } as never),
      ]);
      setVerbrauch({ tueren: Number(tueren) || 0, nachrichten: Number(nachrichten) || 0 });
    })();
  }, [designer]);

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
  }, [paid, messages, visitorsYesterday, visitorsDayBefore, pendingCampaign, lastSeenSnapshotReady]);
  const { mood, variant } = usePawnMood(moodSignals);

  // Teil 34a — Offene Türen: kündigt neu gefundene, noch unentschiedene Türen in der Begrüßung an.
  const [newDoorsCount, setNewDoorsCount] = useState<number | null>(null);
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { count } = await supabase.from("designer_opportunities" as never)
        .select("id", { count: "exact", head: true }).eq("designer_id", designer.id).eq("status", "gefunden");
      setNewDoorsCount(count ?? 0);
    })();
  }, [designer]);

  // Teil K — der Prioritäts-Scheduler: aus allem, was ansteht, wird GENAU EINE Zug-Karte.
  const zug = useZugScheduler({
    designerId: designer?.id,
    hatWartendeKampagne: !!pendingCampaign,
    neueTueren: newDoorsCount ?? 0,
  });
  const aktuellerZug = zug.loading ? null : zug.aktueller;
  const zugErledigt = (z: Zug) => {
    void schreibePawnSignal("zug_erledigt", { zug: z.key });
    if (z.key === "rueckblick" && designer) rueckblickAbhaken(designer.id);
    pawnRef.current?.squish();
  };

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

  // Teil 34a — kündigt neue, noch unentschiedene Türen in der Begrüßung an; sticht die
  // Stimmungs-Zeile aus, da es konkrete, handlungsrelevante Information ist.
  const heroLine = newDoorsCount && newDoorsCount > 0
    ? t("studio.overview.tueren.announce", { n: newDoorsCount })
    : moodLine;

  // Teil K — der Bauer spricht die aktuelle Zug-Karte; ohne besonderen Zug die Stimmungs-Zeile.
  const spruch = aktuellerZug && aktuellerZug.key !== "idee"
    ? t(`studio.zug.${aktuellerZug.key}.spruch`)
    : heroLine;

  const approveCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingCampaign(null);
    toast.success(t("studio.overview.toast.campaignApproved"));
    pawnRef.current?.celebrate();
    void schreibePawnSignal("zug_erledigt", { zug: "kampagne_freigeben" });
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
      {showErstePartie && <ErstePartie rank={RANK_BY_LEVEL[level.level] ?? "bauer"} designerId={designer?.id} onClose={closeErstePartie} onDone={finishErstePartie} />}

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

      {/* Teil K — der Bauer als Hub: Figur + Sprechzeile (ein Tipp öffnet das Gespräch),
          Level-Figur direkt daneben. Die Stimmung zeigt sich in Bewegung und Wortwahl. */}
      <section id="studio-hero" className="mb-6 flex items-center gap-5 border-[1.5px] border-foreground bg-white p-5">
        <PawnFigur ref={pawnRef} rank={RANK_BY_LEVEL[level.level] ?? "bauer"} size={84} mood={mood} moodVariant={variant} onTap={() => setGespraechOpen(true)} showShadow={false} ariaLabel={t("studio.bauer.talkAria")} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setGespraechOpen(true)} className="text-left">
            <p className="font-serif text-lg italic leading-snug sm:text-xl">{spruch}</p>
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{level.glyph} {level.label}</span>
            <div className="h-[3px] w-24 bg-border" aria-hidden="true"><div className="h-full bg-foreground" style={{ width: `${Math.round((level.progress ?? 0) * 100)}%` }} /></div>
            <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{level.next}</span>
          </div>
        </div>
      </section>

      {/* Part 38 AP2 — Wochenimpuls: ein kurzer, DNA-passender Wissens-Impuls, still im Hintergrund
          befüllt, kein eigenes PAWN-Element (Design-Gesetz: genau eins pro Seite). */}
      {designer.weekly_impulse && (
        <p className="mb-8 text-xs text-muted-foreground">
          <span className="uppercase tracking-[0.2em]">{t("studio.overview.wochenimpuls.eyebrow")}</span> — {designer.weekly_impulse}
        </p>
      )}

      {/* PART 48 AP7 — Verbrauchszeile: eine ruhige Zeile statt Guthabenstand, live aus
          plan_usage_stand + ai_config.plans. -1 = unbegrenzt, zeigt dann keine Zahl. */}
      {verbrauch && (() => {
        const plan: Plan = designer.plan ?? "haus";
        const tuerenLimit = limitFor(plan, "tuer_oeffnen");
        const nachrichtenLimit = limitFor(plan, "chat_nachricht");
        const teile = [
          tuerenLimit < 0 ? null : `${verbrauch.tueren} von ${tuerenLimit} Türen diesen Monat`,
          nachrichtenLimit < 0 ? null : `${verbrauch.nachrichten} von ${nachrichtenLimit} Nachrichten`,
        ].filter(Boolean);
        return teile.length > 0 ? (
          <p className="mb-8 text-xs text-muted-foreground">{teile.join(" · ")}</p>
        ) : null;
      })()}

      {/* Teil K — genau EINE Zug-Karte aus dem Prioritäts-Scheduler. Verträge, Verkaufsfertig
          und Freigaben sind Züge geworden, keine parallelen Banner mehr. */}
      {aktuellerZug && (
        <section data-guide={t("studio.guide.nextMove")} className="mb-6 scroll-mt-20 border-[1.5px] border-foreground bg-white p-6 sm:p-8">
          <p className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
            <ArrowRight className="h-3 w-3" /> {t("studio.zug.eyebrow")}
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 max-w-2xl">
              <h2 className="font-serif text-2xl leading-tight md:text-3xl">{t(`studio.zug.${aktuellerZug.key}.headline`)}</h2>
              <p className="mt-3 text-sm text-foreground/70">{t(`studio.zug.${aktuellerZug.key}.reason`)}</p>
              {aktuellerZug.key === "verkaufsfertig" && aktuellerZug.checks && (
                <ul className="mt-4 space-y-1.5">
                  {aktuellerZug.checks.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[0.6rem] ${c.done ? "border-foreground bg-foreground text-background" : "border-border"}`} aria-hidden="true">{c.done ? "✓" : ""}</span>
                      <span className={c.done ? "text-muted-foreground" : ""}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {aktuellerZug.key === "freigabe" && pendingCampaign && (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <p className="text-sm">{pendingCampaign.title}</p>
                  <button type="button" onClick={() => void approveCampaign(pendingCampaign.id)} className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground">
                    {t("studio.overview.campaign.approve")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Link to={aktuellerZug.to} onClick={() => zugErledigt(aktuellerZug)} className="inline-flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:bg-background hover:text-foreground">
                {t(`studio.zug.${aktuellerZug.key}.cta`)} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {zug.zuege.length > 1 && (
                <button type="button" onClick={() => setAlleZuegeOffen((v) => !v)} className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground underline hover:text-foreground">
                  {t("studio.zug.alle")}
                </button>
              )}
            </div>
          </div>
          {alleZuegeOffen && zug.zuege.length > 1 && (
            <ol className="mt-6 divide-y divide-border border-t-[1.5px] border-foreground/15">
              {zug.zuege.slice(1).map((z, i) => (
                <li key={z.key} className="flex items-center justify-between gap-4 py-3">
                  <p className="text-sm"><span className="font-serif">{i + 2}.</span> {t(`studio.zug.${z.key}.headline`)}</p>
                  <Link to={z.to} onClick={() => zugErledigt(z)} className="shrink-0 text-[0.6rem] uppercase tracking-[0.22em] underline hover:text-foreground">
                    {t(`studio.zug.${z.key}.cta`)}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* Teil K — das Brett: vier tappbare Mini-Kacheln, Zahl und Wort, monochrom. */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link to="/studio/doppelseite" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
          <p className="font-serif text-xl leading-none">{designer.page_published_at ? t("studio.brett.live") : t("studio.brett.privat")}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] opacity-60">{t("studio.brett.haus")}</p>
        </Link>
        <Link to="/studio/werke" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
          <p className="font-serif text-xl leading-none tabular-nums">{publishedCount}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] opacity-60">{t("studio.brett.werke")}</p>
        </Link>
        <Link to="/studio/nachrichten" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
          <p className="font-serif text-xl leading-none tabular-nums">{offeneThreads}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] opacity-60">{t("studio.brett.nachrichten")}</p>
        </Link>
        <Link to="/studio/tueren" className="border-[1.5px] border-foreground bg-white p-4 hover:bg-foreground hover:text-background">
          <p className="font-serif text-xl leading-none tabular-nums">{newDoorsCount ?? 0}</p>
          <p className="mt-2 text-[0.6rem] uppercase tracking-[0.24em] opacity-60">{t("studio.brett.tueren")}</p>
        </Link>
      </div>

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

      {/* Teil K — die Gesprächs-Schublade des Bauern. */}
      <BauerGespraech open={gespraechOpen} onClose={() => setGespraechOpen(false)} plan={(designer.plan as Plan) ?? "haus"} />
    </StudioShell>
  );
}
