/**
 * Studio-Plan-Übersicht — eine Standortbestimmung, keine Preistabelle.
 * Kernbotschaft: 7% Provision bleibt immer 7%. Pläne sind optional.
 * Preise und Feature-Grenzen kommen live aus ai_config.plans (planGate).
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
import { isPaidPlan, ladePlanGate, preisFor, stripePriceFor, limitFor, canUse } from "@/lib/planGate";
import { useMediaUrl } from "@/lib/media";
import { useContentValue } from "@/components/palace/Editable";
import { useI18n } from "@/lib/i18n";
import { Check, Sparkles } from "lucide-react";
// Teil O Fix — die Plan-Bilder aus Teil O: sie füllen die Beispiel-Fläche, solange
// kein echtes Beispiel existiert. Nie ein leeres schwarzes Loch.
import planHausBild from "@/assets/teil-o/plan-haus.webp";
import planAtelierBild from "@/assets/teil-o/plan-atelier.webp";
import planMaisonBild from "@/assets/teil-o/plan-maison.webp";

const PLAN_BILD: Record<Plan, string> = { haus: planHausBild, atelier: planAtelierBild, maison: planMaisonBild };

// PART 38 WP7: drei kaufbare Pläne, alle drei als eigene Karte sichtbar — Atelier ist wieder
// ein regulärer, neu abschließbarer Plan (nicht mehr nur ein auslaufendes Bestandsabo).
const VISIBLE_PLANS: Plan[] = ["haus", "atelier", "maison"];

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

function fmt(t: (key: string, vars?: Record<string, string | number>) => string, n: number): string { return n < 0 ? t("studio.plan.all") : String(n); }
function fmtCount(t: (key: string, vars?: Record<string, string | number>) => string, n: number, noun: string): string {
  return n < 0 ? t("studio.plan.unlimitedNoun", { noun }) : `${n} ${noun}`;
}

/** Teil P — die Beispiel-Fläche eines Plans. Drei Stufen, nie ein schwarzes Loch:
 *  1. echtes Bild-Beispiel (media_assets), 2. Première-Video, 3. das Plan-Bild aus Teil O.
 *  Gespeicherte Beispiel-Werte können bloße Storage-Orte sein (s. src/lib/media.ts) —
 *  sie werden hier beim Anzeigen frisch signiert. Lädt ein Beispiel trotzdem nicht
 *  (kaputte oder abgelaufene URL), fällt die Fläche auf das Plan-Bild zurück,
 *  statt schwarz zu bleiben. */
function PlanBeispiel({ plan, imageExample, videoExample }: { plan: Plan; imageExample?: string; videoExample?: string }) {
  const { t } = useI18n();
  const bildUrl = useMediaUrl(imageExample ?? null);
  const videoUrl = useMediaUrl(videoExample ?? null);
  const [bildKaputt, setBildKaputt] = useState(false);
  const [videoKaputt, setVideoKaputt] = useState(false);
  useEffect(() => { setBildKaputt(false); }, [bildUrl]);
  useEffect(() => { setVideoKaputt(false); }, [videoUrl]);

  return (
    <div className="mt-4 border border-border bg-black">
      {bildUrl && !bildKaputt ? (
        <img src={bildUrl} alt="" onError={() => setBildKaputt(true)} className="aspect-[9/16] w-full bg-black object-contain" />
      ) : videoUrl && !videoKaputt ? (
        <div className="relative">
          <video src={videoUrl} muted playsInline loop autoPlay onError={() => setVideoKaputt(true)} className="aspect-[9/16] w-full bg-black object-contain" />
          <span className="absolute right-2 top-2 border border-white/70 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-white/90">{t("studio.plan.videoBeta")}</span>
        </div>
      ) : (
        /* Teil O Fix — Zukunftsregel: echte Beispiele sind besser als diese
           Bilder. Sobald ein echtes Haus-Beispiel einer Stufe existiert
           (media_assets mit Rechten bzw. Première-Video, s. oben), greift es
           automatisch zuerst und ersetzt dieses Bild. Bis dahin steht hier
           nie ein leeres schwarzes Loch, sondern das Plan-Bild. */
        <img
          src={PLAN_BILD[plan]}
          alt=""
          width={1200}
          height={896}
          loading="lazy"
          className="aspect-[9/16] w-full object-cover"
        />
      )}
    </div>
  );
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
  const [busy, setBusy] = useState<Plan | null>(null);
  const [examples, setExamples] = useState<Partial<Record<Plan, string>>>({});
  const [imageExamples, setImageExamples] = useState<Partial<Record<Plan, string>>>({});
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => { void ladePlanGate().then(() => setGateReady(true)); }, []);

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

  // PART 38 WP7: drei kaufbare Pläne — ein Wechsel von Haus auf Atelier/Maison löst direkt einen
  // Checkout für den Ziel-Plan aus; ein Wechsel zwischen zwei laufenden Bezahlplänen (z. B.
  // Atelier → Maison) geht NIE automatisch über einen zweiten Checkout (Gefahr: zwei parallel
  // laufende Abos), sondern als begleitete Anfrage ans Team.
  const switchToPlan = async (target: Plan) => {
    if (!user || !designer) { toast.error(t("studio.plan.toast.pleaseSignIn")); return; }
    if (plan === target) return;
    setBusy(target);
    try {
      if (isPaidPlan(plan)) {
        await requestPlanChange(`Ich bin aktuell im Plan ${planLabel(plan)} und möchte auf den Plan ${planLabel(target)} wechseln. Bitte meldet euch, um den Wechsel zu begleiten.`);
        return;
      }
      const priceId = stripePriceFor(target);
      if (!priceId) {
        await requestPlanChange(`Ich möchte auf den Plan ${planLabel(target)} wechseln. Bitte meldet euch zur Freischaltung.`);
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "subscription", plan: target, price_id: priceId,
          success_url: `${window.location.origin}/studio/plan?upgraded=${target}`,
          cancel_url: `${window.location.origin}/studio/plan`,
          customer_email: user.email,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (url) window.location.href = url;
    } catch {
      toast.error(`Der Wechsel zu ${planLabel(target)} hat gerade nicht geklappt. Versuch es in ein paar Minuten noch einmal.`);
    } finally {
      setBusy(null);
    }
  };

  const priceFor = (p: Plan): string => {
    if (p === "haus") return "0 €";
    const eur = preisFor(p);
    return eur > 0 ? `${eur} €` : "–";
  };

  const benefitsFor = (p: Plan): string[] => {
    const l: PlanQuota = {
      ...DEFAULT_PLAN_QUOTAS[p],
      signature_previews: limitFor(p, "signature_previews"),
      emblem: canUse(p, "emblem"),
    };
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
        {t("studio.plan.currently")} <span className="font-medium">{planLabel(plan)}</span>.
      </p>

      {!quota.loading && (
        <div className="mt-4 max-w-md">
          <MonthLine used={quota.used} limits={quota.limits} unlimited={quota.unlimited} />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {VISIBLE_PLANS.map((key) => {
          const current = plan === key;
          const badge = BADGES[key];
          const imageExample = imageExamples[key];
          const example = examples[key];
          return (
            <div key={key} id={`plan-${key}`}
              className={`relative border ${current ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border"} bg-white p-6`}>
              {badge && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 border border-foreground bg-foreground px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-background">
                  <Sparkles className="h-2.5 w-2.5" /> {badge}
                </span>
              )}
              <p className="editorial-eyebrow">{t("studio.plan.planLabel")}</p>
              <h3 className="mt-2 font-serif text-3xl">{planLabel(key)}</h3>
              <p className="mt-2 tabular-nums text-xl">{priceFor(key)}<span className="text-sm text-muted-foreground"> {t("studio.plan.perMonth")}</span></p>
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{resolvedHeadlines[key]}</p>

              <PlanBeispiel plan={key} imageExample={imageExample} videoExample={example} />

              <ul className="mt-6 space-y-2 text-sm">
                {benefitsFor(key).map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <span className="inline-block border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em]">{t("studio.plan.yourPlan")}</span>
                ) : key === "haus" ? (
                  <span className="text-xs text-muted-foreground">{t("studio.plan.baseAccess")}</span>
                ) : (
                  <button onClick={() => void switchToPlan(key)} disabled={busy === key}
                    className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                    {busy === key ? "…" : t("studio.plan.switchTo")}
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
      {gateReady && (!stripePriceFor("atelier") || !stripePriceFor("maison")) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("studio.plan.paymentNotSetUp")}
        </p>
      )}
    </StudioShell>
  );
}
