import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { BauerAbend, type BauerAbendHandle } from "@/components/pawn/BauerAbend";
import { WhileYouWereAway } from "@/components/pawn/WhileYouWereAway";
import { ErstePartie } from "@/components/pawn/ErstePartie";
import type { PawnRank } from "@/components/pawn/PawnFigur";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { useNextMove } from "@/features/studio/nextMove";
import { useZugScheduler, rueckblickAbhaken, type Zug, type ZugKey } from "@/features/studio/zugScheduler";
import { BauerGespraech } from "@/components/pawn/BauerGespraech";
import { usePawnMood, type PawnMoodSignals } from "@/features/studio/usePawnMood";
import { useDisplayName } from "@/lib/displayName";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { schreibePawnSignal } from "@/lib/pawnSignal";
import { ladePlanGate, limitFor, type Plan } from "@/lib/planGate";

/**
 * Teil N — DIE ANKUNFT: die neue Studio-Startseite im Abendlicht-System.
 * Abendlicht-Bühne, Staubkörner, Begrüßung mit Hausnamen (getippt), dann GENAU
 * EINE Sache als Glas-Karte (der Prioritäts-Scheduler aus Teil K liefert sie,
 * der Bauer formuliert sie). Chips fürs Gespräch. Erst auf „Zeig mir den Rest"
 * oder „Später": die „Wenn du magst"-Kacheln und die Türen als ruhige Zeile.
 */

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

const REDUCED = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Die getippte Begrüßung — bei reduzierter Bewegung steht der Satz sofort da. */
function useGetippt(text: string) {
  const [shown, setShown] = useState(REDUCED ? text : "");
  const [fertig, setFertig] = useState(REDUCED);
  useEffect(() => {
    if (REDUCED) { setShown(text); setFertig(true); return; }
    setShown("");
    setFertig(false);
    if (!text) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) { window.clearInterval(id); setFertig(true); }
    }, 42);
    return () => window.clearInterval(id);
  }, [text]);
  return { shown, fertig };
}

/** Kleine warme Vignetten je Zug — visuelle Vorschau auf der einen Sache. */
function ZugVignette({ zug }: { zug: ZugKey }) {
  const stroke = "#f4c667";
  const common = { fill: "none", stroke, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" style={{ opacity: 0.9 }}>
      {zug === "eroeffnung" && (<g {...common}><rect x="12" y="12" width="40" height="40" rx="4" /><path d="M12 32h40M32 12v40" opacity=".5" /><circle cx="22" cy="22" r="4" fill={stroke} stroke="none" /></g>)}
      {zug === "vertraege" && (<g {...common}><path d="M20 10h20l8 8v36H20z" /><path d="M40 10v8h8" /><path d="M26 30h16M26 38h16M26 46h10" opacity=".7" /></g>)}
      {zug === "verkaufsfertig" && (<g {...common}><path d="M12 20l8 8 12-14" /><path d="M12 40l8 8 12-14" opacity=".7" /><path d="M40 26h14M40 46h14" opacity=".5" /></g>)}
      {zug === "freigabe" && (<g {...common}><rect x="10" y="14" width="44" height="32" rx="4" /><path d="M27 24l12 6-12 6z" fill={stroke} stroke="none" /><path d="M18 54h28" opacity=".5" /></g>)}
      {zug === "tuer" && (<g {...common}><path d="M20 54V12h24v42" /><path d="M20 54h24" opacity=".6" /><circle cx="38" cy="34" r="2" fill={stroke} stroke="none" /><path d="M44 20l8-4v36l-8-4" opacity=".4" /></g>)}
      {zug === "rueckblick" && (<g {...common}><circle cx="32" cy="28" r="14" /><path d="M32 20v8l6 4" /><path d="M18 50q14 8 28 0" opacity=".5" /></g>)}
      {zug === "idee" && (<g {...common}><path d="M32 10a14 14 0 0 1 8 25c-2 2-3 4-3 7h-10c0-3-1-5-3-7a14 14 0 0 1 8-25z" /><path d="M27 48h10M29 54h6" opacity=".7" /></g>)}
    </svg>
  );
}

/** Glyphen der „Wenn du magst"-Kacheln — Wort + Bild, nie nur Icon. */
function RaumGlyphe({ raum }: { raum: "wand" | "auftritt" | "clips" | "postfach" | "geschaeft" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
      {raum === "wand" && (<g {...common}><rect x="8" y="10" width="14" height="18" /><rect x="26" y="10" width="14" height="12" /><rect x="26" y="26" width="14" height="12" /><path d="M8 38h14" opacity=".5" /></g>)}
      {raum === "auftritt" && (<g {...common}><rect x="8" y="8" width="32" height="32" /><path d="M24 8v32" /><path d="M12 16h8M12 22h8M28 16h8" opacity=".6" /></g>)}
      {raum === "clips" && (<g {...common}><rect x="8" y="12" width="32" height="24" rx="3" /><path d="M20 20l10 4-10 4z" fill="currentColor" stroke="none" /></g>)}
      {raum === "postfach" && (<g {...common}><path d="M8 26h10l3 5h6l3-5h10" /><path d="M8 26v12h32V26" /><path d="M12 18l12-8 12 8" opacity=".6" /></g>)}
      {raum === "geschaeft" && (<g {...common}><path d="M10 38V20l14-10 14 10v18" /><path d="M18 38v-10h12v10" /><path d="M8 38h32" /></g>)}
    </svg>
  );
}

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
    <div className="al-karte mx-auto max-w-xl p-8 sm:p-10">
      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.welcome.progress", { name, step: step + 1, total: WELCOME_STEPS.length })}</p>
      <h2 className="mt-3 font-serif text-2xl sm:text-3xl">{current.title}</h2>
      {current.body && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{current.body}</p>}
      {"bullets" in current && current.bullets && (
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {current.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f4c667]" />{b}</li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button type="button" onClick={onSkip} className="al-knopf-leise text-xs">
          {t("studio.overview.welcome.skip")}
        </button>
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="al-knopf-leise text-xs">
              {t("common.back")}
            </button>
          )}
          {last ? (
            <Link to="/studio/werke/neu" onClick={onSkip} className="al-knopf-primaer">
              <Plus className="h-3 w-3" /> {t("studio.overview.welcome.createFirst")}
            </Link>
          ) : (
            <button type="button" onClick={() => setStep((s) => s + 1)} className="al-knopf-primaer">
              {t("studio.overview.welcome.next")} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Feste, ruhige Staubkörner — Position/Verzögerung deterministisch, kein Zufall pro Render. */
const STAUB = [
  { left: "8%", delay: "0s", dur: "12s" }, { left: "22%", delay: "3.5s", dur: "10s" },
  { left: "38%", delay: "1.2s", dur: "13s" }, { left: "55%", delay: "5s", dur: "11s" },
  { left: "68%", delay: "2.2s", dur: "12.5s" }, { left: "81%", delay: "6.5s", dur: "10.5s" },
  { left: "92%", delay: "4.2s", dur: "13.5s" },
];

export default function StudioOverview() {
  const { designer, loading, refresh: refreshDesigner } = useMyDesigner();
  const { lines } = useDesignerOrders(designer?.id);
  const { level } = useDesignerLevel(designer?.id);
  const { firstName } = useDisplayName();
  const { t } = useI18n();
  const bauerRef = useRef<BauerAbendHandle>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign | null>(null);
  const [visitorsYesterday, setVisitorsYesterday] = useState<number | null>(null);
  const [visitorsDayBefore, setVisitorsDayBefore] = useState<number | null>(null);
  const [partieZuege, setPartieZuege] = useState<{ id: string; nr: number; text: string; akteur: string; created_at: string }[]>([]);

  const [gespraechOpen, setGespraechOpen] = useState(false);
  const [gespraechSeed, setGespraechSeed] = useState<string | undefined>(undefined);
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

  // PART 48 AP7: die Verbrauchszeile — ruhig, in der „Wenn du magst"-Zone.
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

  // Teil 28b: "Die erste Partie" — unverändert.
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

  // Teil 31 — Stimmungs-Maschine bleibt: sie färbt die Sprechzeile des Bauern.
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

  // Teil 34a — Türen bleiben bewusst leise: eine ruhige kursive Zeile, kein Zähler.
  const [newDoorsCount, setNewDoorsCount] = useState<number | null>(null);
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { count } = await supabase.from("designer_opportunities" as never)
        .select("id", { count: "exact", head: true }).eq("designer_id", designer.id).eq("status", "gefunden");
      setNewDoorsCount(count ?? 0);
    })();
  }, [designer]);

  // Teil K — der Prioritäts-Scheduler liefert GENAU EINE Sache.
  const zug = useZugScheduler({
    designerId: designer?.id,
    hatWartendeKampagne: !!pendingCampaign,
    neueTueren: newDoorsCount ?? 0,
  });
  const aktuellerZug = zug.loading ? null : zug.aktueller;
  const zugErledigt = (z: Zug) => {
    void schreibePawnSignal("zug_erledigt", { zug: z.key });
    if (z.key === "rueckblick" && designer) rueckblickAbhaken(designer.id);
    bauerRef.current?.freuen();
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

  // Der Bauer formuliert die eine Sache in seiner Stimme; ohne besonderen Zug die Stimmungs-Zeile.
  const spruch = aktuellerZug && aktuellerZug.key !== "idee"
    ? t(`studio.zug.${aktuellerZug.key}.spruch`)
    : moodLine;

  // Die getippte Begrüßung: Tageszeit + Hausname.
  const brand = designer?.brand_name || firstName;
  const stunde = new Date().getHours();
  const grussKey = stunde < 11 ? "studio.ankunft.gruss.morgen" : stunde < 18 ? "studio.ankunft.gruss.tag" : "studio.ankunft.gruss.abend";
  const gruss = designer ? t(grussKey, { name: brand }) : "";
  const { shown: grussGetippt, fertig: grussFertig } = useGetippt(gruss);

  // „Zeig mir den Rest" — einmal pro Sitzung gemerkt, damit Rückkehr ruhig bleibt.
  const [restOffen, setRestOffen] = useState(false);
  useEffect(() => {
    if (designer) setRestOffen(sessionStorage.getItem(`pawn_ankunft_rest_${designer.id}`) === "1");
  }, [designer?.id]);
  const oeffneRest = () => {
    if (designer) sessionStorage.setItem(`pawn_ankunft_rest_${designer.id}`, "1");
    setRestOffen(true);
  };

  const approveCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingCampaign(null);
    toast.success(t("studio.overview.toast.campaignApproved"));
    bauerRef.current?.freuen();
    void schreibePawnSignal("zug_erledigt", { zug: "kampagne_freigeben" });
  };

  const oeffneGespraech = (seed?: string) => {
    setGespraechSeed(seed);
    setGespraechOpen(true);
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

  if (loading) return <StudioShell title={t("studio.overview.title")}><div className="animate-pulse space-y-6"><div className="h-32" /><div className="h-64" /></div></StudioShell>;

  if (!designer) return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.welcome")}>
      <div className="al-karte mx-auto max-w-xl p-10 text-center">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.overview.noAccess")}</p>
        <h2 className="mt-3 font-serif text-3xl">{t("studio.overview.noAccess.title")}</h2>
        <p className="mt-4 text-sm text-muted-foreground">{t("studio.overview.noAccess.body")}</p>
        <Link to="/apply" className="al-knopf-primaer mt-6">{t("studio.overview.noAccess.cta")}</Link>
      </div>
    </StudioShell>
  );

  if (showWelcome) return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.welcome")}>
      <DesignerWelcome name={firstName} onSkip={dismissWelcome} />
    </StudioShell>
  );

  const raumKacheln = [
    { raum: "wand" as const, to: "/studio/werke", label: t("studio.dock.wand"), line: t("studio.ankunft.kachel.wand") },
    { raum: "auftritt" as const, to: "/studio/doppelseite", label: t("studio.dock.auftritt"), line: t("studio.ankunft.kachel.auftritt") },
    { raum: "clips" as const, to: "/studio/clips", label: t("studio.dock.clips"), line: t("studio.ankunft.kachel.clips") },
    { raum: "postfach" as const, to: "/studio/postfach", label: t("studio.dock.postfach"), line: t("studio.ankunft.kachel.postfach") },
    { raum: "geschaeft" as const, to: "/studio/geschaeft", label: t("studio.dock.geschaeft"), line: t("studio.ankunft.kachel.geschaeft") },
  ];

  return (
    <StudioShell title={t("studio.overview.title")} eyebrow={t("studio.overview.eyebrow.overview")} ohneMiniBauer>
      {lastSeenSnapshotReady && <WhileYouWereAway designerId={designer.id} previousLastSeenAt={lastSeenSnapshotRef.current} />}
      {showErstePartie && <ErstePartie rank={RANK_BY_LEVEL[level.level] ?? "bauer"} designerId={designer?.id} onClose={closeErstePartie} onDone={finishErstePartie} />}

      {!showErstePartie && onboardingStatus === "laeuft" && (
        <button
          type="button"
          onClick={() => setShowErstePartie(true)}
          className="al-karte mb-6 flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.erstePartie.resume.eyebrow")}</p>
            <p className="al-stimme mt-1 text-lg">{t("studio.erstePartie.resume.body")}</p>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.erstePartie.resume.cta")}</span>
        </button>
      )}

      {/* Die Bühne: Staub, der Bauer, die getippte Begrüßung, seine Zeile. */}
      <section className="relative mb-8 overflow-visible" aria-label={t("studio.ankunft.eineSache")}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {STAUB.map((s, i) => (
            <span key={i} className="al-staubkorn" style={{ left: s.left, animationDelay: s.delay, animationDuration: s.dur }} />
          ))}
        </div>
        <div className="relative flex items-end gap-6 pt-6">
          <BauerAbend ref={bauerRef} size={104} onTap={() => oeffneGespraech()} ariaLabel={t("studio.bauer.talkAria")} className="shrink-0" />
          <div className="min-w-0 flex-1 pb-2">
            <p className={`al-stimme text-2xl leading-snug md:text-3xl ${grussFertig ? "" : "al-caret"}`} aria-label={gruss}>
              {grussGetippt}
            </p>
            {grussFertig && spruch && (
              <button type="button" onClick={() => oeffneGespraech()} className="al-auftauchen mt-2 text-left">
                <p className="text-sm text-muted-foreground">{spruch}</p>
              </button>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{level.glyph} {level.label}</span>
              <div className="h-[3px] w-24 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.round((level.progress ?? 0) * 100)}%`, background: "linear-gradient(90deg,#f4c667,#e09a3a)" }} /></div>
              <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{level.next}</span>
            </div>
          </div>
        </div>
      </section>

      {/* GENAU EINE Sache — als Glas-Karte mit visueller Vorschau. */}
      {aktuellerZug && (
        <section data-guide={t("studio.guide.nextMove")} className="al-karte al-auftauchen mb-6 scroll-mt-20 p-6 sm:p-8">
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.ankunft.eineSache")}</p>
          <div className="mt-4 flex flex-wrap items-start gap-6">
            <div className="shrink-0"><ZugVignette zug={aktuellerZug.key} /></div>
            <div className="min-w-0 max-w-2xl flex-1">
              <h2 className="font-serif text-2xl leading-tight md:text-3xl">{t(`studio.zug.${aktuellerZug.key}.headline`)}</h2>
              <p className="mt-3 text-sm text-muted-foreground">{t(`studio.zug.${aktuellerZug.key}.reason`)}</p>
              {aktuellerZug.key === "verkaufsfertig" && aktuellerZug.checks && (
                <ul className="mt-4 space-y-1.5">
                  {aktuellerZug.checks.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] ${c.done ? "bg-[#f4c667] text-[#0b101c]" : "border border-white/25"}`} aria-hidden="true">{c.done ? "✓" : ""}</span>
                      <span className={c.done ? "text-muted-foreground" : ""}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {aktuellerZug.key === "freigabe" && pendingCampaign && (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <p className="text-sm">{pendingCampaign.title}</p>
                  <button type="button" onClick={() => void approveCampaign(pendingCampaign.id)} className="al-knopf-primaer text-xs">
                    {t("studio.overview.campaign.approve")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Link to={aktuellerZug.to} onClick={() => zugErledigt(aktuellerZug)} className="al-knopf-primaer">
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
            <ol className="mt-6 divide-y divide-border border-t border-white/10">
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

      {/* Chips fürs Gespräch. */}
      <div className="al-auftauchen-spaet mb-8 flex flex-wrap gap-2">
        {[t("studio.ankunft.chip1"), t("studio.ankunft.chip2"), t("studio.ankunft.chip3")].map((chip) => (
          <button key={chip} type="button" className="al-chip" onClick={() => oeffneGespraech(chip)}>
            {chip}
          </button>
        ))}
      </div>

      {/* Erst auf Wunsch: der Rest. */}
      {!restOffen ? (
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <button type="button" onClick={oeffneRest} className="al-knopf-leise">{t("studio.ankunft.zeigRest")}</button>
          <button type="button" onClick={oeffneRest} className="text-xs text-muted-foreground underline-offset-4 hover:underline">{t("studio.ankunft.spaeter")}</button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.ankunft.wennDuMagst")}</p>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {raumKacheln.map((k) => (
              <Link key={k.raum} to={k.to} className="al-karte group p-4 transition-transform hover:-translate-y-0.5">
                <span className="text-[#f4c667]"><RaumGlyphe raum={k.raum} /></span>
                <p className="mt-3 font-serif text-lg leading-none">{k.label}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{k.line}</p>
              </Link>
            ))}
          </div>

          {/* Türen — bewusst die leiseste Zeile der Seite. */}
          {(newDoorsCount ?? 0) > 0 && (
            <p className="mb-6 text-sm italic" style={{ color: "var(--al-leise)" }}>
              <Link to="/studio/tueren" className="hover:text-foreground">
                {newDoorsCount === 1 ? t("studio.ankunft.tueren.eine") : t("studio.ankunft.tueren.viele", { n: newDoorsCount ?? 0 })}
              </Link>
            </p>
          )}

          {designer.weekly_impulse && (
            <p className="mb-4 text-xs text-muted-foreground">
              <span className="uppercase tracking-[0.2em]">{t("studio.overview.wochenimpuls.eyebrow")}</span> — {designer.weekly_impulse}
            </p>
          )}

          {verbrauch && (() => {
            const plan: Plan = designer.plan ?? "haus";
            const tuerenLimit = limitFor(plan, "tuer_oeffnen");
            const nachrichtenLimit = limitFor(plan, "chat_nachricht");
            const teile = [
              tuerenLimit < 0 ? null : `${verbrauch.tueren} von ${tuerenLimit} Türen diesen Monat`,
              nachrichtenLimit < 0 ? null : `${verbrauch.nachrichten} von ${nachrichtenLimit} Nachrichten`,
            ].filter(Boolean);
            return teile.length > 0 ? (
              <p className="mb-6 text-xs text-muted-foreground">{teile.join(" · ")}</p>
            ) : null;
          })()}

          {/* Unsere Partie — bleibt als ruhiger Auszug erhalten. */}
          <section data-guide={t("studio.guide.partiebuch")} className="al-karte mb-6 p-6 sm:p-8">
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
        </>
      )}

      <BauerGespraech open={gespraechOpen} onClose={() => setGespraechOpen(false)} plan={(designer.plan as Plan) ?? "haus"} seed={gespraechSeed} />
    </StudioShell>
  );
}
