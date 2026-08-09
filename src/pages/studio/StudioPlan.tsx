/**
 * Studio-Plan-Übersicht — eine Standortbestimmung, keine Preistabelle.
 * Kernbotschaft: 7% Provision bleibt immer 7%. Pläne sind optional.
 * Limits (Videos, Shots, Bildsprachen) kommen live aus ai_config.plan_limits.
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  usePlanQuota, planLabel, formatQuota, DEFAULT_PLAN_QUOTAS,
  type Plan, type PlanQuota,
} from "@/features/campaign/quota";
import { isPaidPlan, isLegacyPlan, PAID_PLAN_KEY } from "@/lib/planGate";
import { useContentValue } from "@/components/palace/Editable";
import { useI18n } from "@/lib/i18n";
import { Check, Sparkles } from "lucide-react";

// Teil 38 AP7 — Preisumbau: nach außen gibt es nur noch zwei Karten, Frei und Paid. 'atelier'
// bleibt in der Datenbank für Bestandsabos (eigener Preis läuft unverändert weiter), wird aber
// nicht mehr als eigene Karte angeboten — siehe PAID_PLAN_KEY in @/lib/planGate.
const VISIBLE_PLANS: Plan[] = ["haus", PAID_PLAN_KEY];

function useStaticBenefits(t: (key: string, vars?: Record<string, string | number>) => string): Record<Plan, string[]> {
  return {
    haus: [
      t("studio.plan.benefits.haus.commission"),
      t("studio.plan.benefits.haus.aiTier"),
    ],
    atelier: [
      t("studio.plan.benefits.atelier.curator"),
      t("studio.plan.benefits.atelier.textAtelier"),
      t("studio.plan.benefits.atelier.trendMirror"),
      t("studio.plan.benefits.atelier.aiTier"),
    ],
    maison: [
      t("studio.plan.benefits.maison.dossier"),
      t("studio.plan.benefits.maison.showcase"),
      t("studio.plan.benefits.maison.priority"),
      t("studio.plan.benefits.maison.aiTier"),
    ],
  };
}

function useHeadlines(t: (key: string, vars?: Record<string, string | number>) => string): Record<Plan, string> {
  return {
    haus: t("studio.plan.headline.haus"),
    atelier: t("studio.plan.headline.atelier"),
    maison: t("studio.plan.headline.maison"),
  };
}
const BADGES: Record<Plan, string | undefined> = { haus: undefined, atelier: "PAWN+", maison: "PAWN+ Max" };

interface PlanPrices {
  atelier?: { eur_month?: number; stripe_price_id?: string | null };
  maison?: { eur_month?: number; stripe_price_id?: string | null };
}

function fmt(t: (key: string, vars?: Record<string, string | number>) => string, n: number): string { return n < 0 ? t("studio.plan.all") : String(n); }
function fmtCount(t: (key: string, vars?: Record<string, string | number>) => string, n: number, noun: string): string {
  return n < 0 ? t("studio.plan.unlimitedNoun", { noun }) : `${n} ${noun}`;
}

/** Dein Monat — eine ruhige Zeile, kein Guthabenstand. */
function MonthLine({ used, limits, unlimited }: { used: Record<"videos" | "cinematic" | "shots", number>; limits: PlanQuota; unlimited: boolean }) {
  const { t } = useI18n();
  return (
    <div className="border border-border bg-white p-5">
      <p className="editorial-eyebrow">{t("studio.plan.yourMonth")}</p>
      <p className="mt-2 font-serif text-lg tabular-nums">
        {formatQuota(used.videos, unlimited ? -1 : limits.videos, t("studio.plan.videosNoun"))} · {formatQuota(used.shots, unlimited ? -1 : limits.shots, t("studio.plan.shotsNoun"))}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("studio.plan.monthHint")}
      </p>
    </div>
  );
}

export default function StudioPlan() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const { t } = useI18n();
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = usePlanQuota(designer?.id, plan);
  const [prices, setPrices] = useState<PlanPrices>({});
  const [busy, setBusy] = useState<Plan | null>(null);
  const [examples, setExamples] = useState<Partial<Record<Plan, string>>>({});
  const [imageExamples, setImageExamples] = useState<Partial<Record<Plan, string>>>({});
  const [planLimits, setPlanLimits] = useState<Record<Plan, PlanQuota>>(DEFAULT_PLAN_QUOTAS);

  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "plan_prices").maybeSingle()
      .then(({ data }) => data?.value && setPrices(data.value as unknown as PlanPrices));
    supabase.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle()
      .then(({ data }) => {
        const cfg = (data?.value ?? {}) as Partial<Record<Plan, Partial<PlanQuota>>>;
        setPlanLimits({
          haus: { ...DEFAULT_PLAN_QUOTAS.haus, ...(cfg.haus ?? {}) },
          atelier: { ...DEFAULT_PLAN_QUOTAS.atelier, ...(cfg.atelier ?? {}) },
          maison: { ...DEFAULT_PLAN_QUOTAS.maison, ...(cfg.maison ?? {}) },
        });
      });
  }, []);

  useEffect(() => {
    void supabase.from("video_assets" as never)
      .select("url, designers:designer_id(plan)")
      .eq("premiere", true)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as Array<{ url: string; designers: { plan: Plan } | null }>;
        const byPlan: Partial<Record<Plan, string>> = {};
        for (const r of rows) {
          const p = r.designers?.plan;
          if (p && !byPlan[p]) byPlan[p] = r.url;
        }
        setExamples(byPlan);
      });
    // Bild-Beispiele haben Vorrang (Teil 16a: Bild ist das Herz, Video bleibt Beta).
    void supabase.from("media_assets" as never)
      .select("url, kind, rights_granted, designers:designer_id(plan)")
      .eq("kind", "bild")
      .eq("rights_granted", true)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as Array<{ url: string; designers: { plan: Plan } | null }>;
        const byPlan: Partial<Record<Plan, string>> = {};
        for (const r of rows) {
          const p = r.designers?.plan;
          if (p && !byPlan[p]) byPlan[p] = r.url;
        }
        setImageExamples(byPlan);
      });
  }, []);

  const HEADLINES = useHeadlines(t);
  const STATIC_BENEFITS = useStaticBenefits(t);

  const headlineHaus = useContentValue("studio_plan.haus.headline", HEADLINES.haus);
  const headlineAtelier = useContentValue("studio_plan.atelier.headline", HEADLINES.atelier);
  const headlineMaison = useContentValue("studio_plan.maison.headline", HEADLINES.maison);
  const resolvedHeadlines: Record<Plan, string> = { haus: headlineHaus, atelier: headlineAtelier, maison: headlineMaison };

  const benefitsHaus = useContentValue("studio_plan.haus.benefits", STATIC_BENEFITS.haus.join("\n"));
  const benefitsAtelier = useContentValue("studio_plan.atelier.benefits", STATIC_BENEFITS.atelier.join("\n"));
  const benefitsMaison = useContentValue("studio_plan.maison.benefits", STATIC_BENEFITS.maison.join("\n"));
  const resolvedStaticBenefits: Record<Plan, string[]> = {
    haus: benefitsHaus.split("\n").filter(Boolean),
    atelier: benefitsAtelier.split("\n").filter(Boolean),
    maison: benefitsMaison.split("\n").filter(Boolean),
  };

  // Ein bestehendes Atelier-Abo ist ein zahlendes Bestandsabo mit eigenem, unverändert
  // weiterlaufendem Preis (siehe CLAUDE.md) — für diesen Fall NIE direkt einen neuen
  // Stripe-Checkout auslösen (Gefahr: zwei parallel laufende Abos). Stattdessen geht die
  // Anfrage als Nachricht ans Team, das den Wechsel manuell/mit Proration begleitet.
  const requestPlanChange = async (note: string) => {
    if (!user || !designer) return;
    const { data: thread, error } = await supabase.from("message_threads").insert({
      designer_id: designer.id, created_by: user.id,
      subject: "Plan-Wechsel auf Paid",
      category: "allgemein", status: "open",
    } as never).select("id").single();
    if (error) throw error;
    await supabase.from("messages").insert({
      thread_id: (thread as { id: string }).id, sender_id: user.id, body: note,
    } as never);
    toast.success(t("studio.plan.toast.requestSent"));
  };

  const upgrade = async () => {
    if (!user || !designer) { toast.error(t("studio.plan.toast.pleaseSignIn")); return; }
    if (isPaidPlan(plan)) return;
    setBusy(PAID_PLAN_KEY);
    try {
      const priceId = prices.maison?.stripe_price_id;
      if (!priceId) {
        await requestPlanChange(`Ich möchte auf den Plan ${planLabel(PAID_PLAN_KEY)} (Paid) wechseln. Bitte meldet euch zur Freischaltung.`);
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "subscription", plan: PAID_PLAN_KEY, price_id: priceId,
          success_url: `${window.location.origin}/studio/plan?upgraded=${PAID_PLAN_KEY}`,
          cancel_url: `${window.location.origin}/studio/plan`,
          customer_email: user.email,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (url) window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const requestLegacySwitch = async () => {
    if (!user || !designer) { toast.error(t("studio.plan.toast.pleaseSignIn")); return; }
    setBusy(PAID_PLAN_KEY);
    try {
      await requestPlanChange("Ich bin aktuell im Plan Atelier und möchte auf den neuen Plan Paid wechseln. Bitte meldet euch, um den Wechsel zu begleiten.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const priceFor = (p: Plan): string => {
    if (p === "haus") return "0 €";
    const eur = prices.maison?.eur_month;
    return eur != null ? `${eur} €` : "99 €";
  };

  const benefitsFor = (p: Plan): string[] => {
    const l = planLimits[p];
    const videoLine = l.cinematic > 0 || l.cinematic < 0
      ? t("studio.plan.benefitLine.videosCinematic", {
          videos: fmtCount(t, l.videos, t("studio.plan.videosNoun")),
          cinematic: fmt(t, l.cinematic),
          emblemNote: l.emblem ? "" : t("studio.plan.benefitLine.noEmblemSuffix"),
        })
      : t("studio.plan.benefitLine.videosEditorial", {
          videos: fmtCount(t, l.videos, t("studio.plan.videosNoun")),
          emblemNote: l.emblem ? t("studio.plan.benefitLine.emblemSuffix") : "",
        });
    const shotLine = t("studio.plan.benefitLine.shots", { count: fmtCount(t, l.shots, t("studio.plan.shotsAndCutoutsNoun")) });
    const sigBase = l.signature_previews === 1
      ? t("studio.plan.benefitLine.signatureOne", { count: fmt(t, l.signature_previews) })
      : t("studio.plan.benefitLine.signatureMany", { count: fmt(t, l.signature_previews) });
    const sigLine = sigBase + (p === "maison" ? t("studio.plan.benefitLine.wishSignatureSuffix") : "");
    return [videoLine, shotLine, sigLine, ...resolvedStaticBenefits[p]].filter(Boolean);
  };

  return (
    <StudioShell title={t("studio.plan.title")} eyebrow={t("studio.plan.eyebrow")}>
      <div className="max-w-2xl">
        <p className="palace-serif text-lg">
          <strong>{t("studio.plan.commissionHeadline")}</strong>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("studio.plan.commissionSub")}
        </p>
      </div>

      <p className="mt-8 text-sm">
        {t("studio.plan.currently")} <span className="font-medium">{planLabel(plan)}</span>
        {isLegacyPlan(plan) && <span className="text-muted-foreground"> — {t("studio.plan.legacyNote")}</span>}.
      </p>

      {!quota.loading && (
        <div className="mt-4 max-w-md">
          <MonthLine used={quota.used} limits={quota.limits} unlimited={quota.unlimited} />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {VISIBLE_PLANS.map((key) => {
          const isPaidCard = key !== "haus";
          // Ein Atelier-Bestandsabo zählt schon als Paid — die Paid-Karte markiert es als
          // aktuell, damit niemand fälschlich als "noch Frei" erscheint.
          const current = isPaidCard ? isPaidPlan(plan) : plan === "haus";
          const badge = BADGES[key];
          const imageExample = imageExamples[key];
          const example = examples[key];
          const tierLabel = key === "haus" ? t("studio.plan.tierLabel.frei") : t("studio.plan.tierLabel.paid");
          return (
            <div key={key} id={`plan-${key}`}
              className={`relative border ${current ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border"} bg-white p-6`}>
              {badge && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 border border-foreground bg-foreground px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-background">
                  <Sparkles className="h-2.5 w-2.5" /> {badge}
                </span>
              )}
              <p className="editorial-eyebrow">{t("studio.plan.planLabel")}</p>
              <h3 className="mt-2 font-serif text-3xl">{tierLabel}</h3>
              <p className="mt-2 tabular-nums text-xl">{priceFor(key)}<span className="text-sm text-muted-foreground"> {t("studio.plan.perMonth")}</span></p>
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{resolvedHeadlines[key]}</p>

              <div className="mt-4 border border-border bg-black">
                {imageExample ? (
                  <img src={imageExample} alt="" className="aspect-[9/16] w-full bg-black object-contain" />
                ) : example ? (
                  <div className="relative">
                    <video src={example} muted playsInline loop autoPlay className="aspect-[9/16] w-full bg-black object-contain" />
                    <span className="absolute right-2 top-2 border border-white/70 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-white/90">{t("studio.plan.videoBeta")}</span>
                  </div>
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-white/50">
                    {t("studio.plan.exampleComingSoon")}
                  </div>
                )}
              </div>

              <ul className="mt-6 space-y-2 text-sm">
                {benefitsFor(key).map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current && !(isPaidCard && isLegacyPlan(plan)) ? (
                  <span className="inline-block border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em]">{t("studio.plan.yourPlan")}</span>
                ) : key === "haus" ? (
                  <span className="text-xs text-muted-foreground">{t("studio.plan.baseAccess")}</span>
                ) : isLegacyPlan(plan) ? (
                  <button onClick={() => void requestLegacySwitch()} disabled={busy === PAID_PLAN_KEY}
                    className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                    {busy === PAID_PLAN_KEY ? "…" : t("studio.plan.discussSwitch")}
                  </button>
                ) : (
                  <button onClick={() => void upgrade()} disabled={busy === PAID_PLAN_KEY}
                    className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                    {busy === PAID_PLAN_KEY ? "…" : t("studio.plan.switchTo")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {t("studio.plan.cancelHint.pre")} <a href="/agb" className="underline">{t("studio.plan.cancelHint.linkLabel")}</a>{t("studio.plan.cancelHint.post")}
      </p>
      {!prices.maison?.stripe_price_id && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("studio.plan.paymentNotSetUp")}
        </p>
      )}
    </StudioShell>
  );
}
