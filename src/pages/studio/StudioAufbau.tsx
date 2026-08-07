/**
 * "Deine Marke aufbauen" — der Begleiter: fünf Etappen, ein Zug für heute,
 * ein Wochenplan für Inhalte und Antworten auf Praxisfragen.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { useBrandJourney, type BrandStage } from "@/features/studio/useBrandJourney";
import { useStepRewards, RewardToast } from "@/features/rewards";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface PlanItem { tag: string; format: string; idee: string; }
interface AufbauAnswer { plan?: PlanItem[]; impuls?: string; zuspruch?: string; }

function usePraxis(t: (key: string, vars?: Record<string, string | number>) => string): { frage: string; antwort: string }[] {
  return [
    { frage: t("studio.aufbau.praxis.gewerbe.frage"), antwort: t("studio.aufbau.praxis.gewerbe.antwort") },
    { frage: t("studio.aufbau.praxis.kleinunternehmer.frage"), antwort: t("studio.aufbau.praxis.kleinunternehmer.antwort") },
    { frage: t("studio.aufbau.praxis.rechnung.frage"), antwort: t("studio.aufbau.praxis.rechnung.antwort") },
    { frage: t("studio.aufbau.praxis.umsatzsteuer.frage"), antwort: t("studio.aufbau.praxis.umsatzsteuer.antwort") },
    { frage: t("studio.aufbau.praxis.widerruf.frage"), antwort: t("studio.aufbau.praxis.widerruf.antwort") },
    { frage: t("studio.aufbau.praxis.versand.frage"), antwort: t("studio.aufbau.praxis.versand.antwort") },
  ];
}

export default function StudioAufbau() {
  const { designer, loading } = useMyDesigner();
  const { level } = useDesignerLevel(designer?.id);
  const journey = useBrandJourney(designer);
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AufbauAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const PRAXIS = usePraxis(t);
  const FALLBACK_PLAN = useFallbackPlan(t);

  const doneForRewards = useMemo(
    () => journey.allSteps.filter((s) => s.done).map((s) => ({
      key: s.key,
      title: t("studio.aufbau.stepDone", { label: s.label }),
      line: s.why,
    })),
    [journey.allSteps],
  );
  const { reward, dismiss } = useStepRewards("aufbau", doneForRewards);

  useEffect(() => {
    if (!designer) return;
    let alive = true;
    setBusy(true);
    void supabase.functions.invoke("studio-ai", {
      body: {
        mode: "aufbau",
        stage: journey.currentStage?.key ?? "ankommen",
        open_steps: journey.allSteps.filter((s) => !s.done).slice(0, 4).map((s) => s.label),
        locale: locale,
      },
    }).then(({ data }) => {
      if (!alive) return;
      const d = data as AufbauAnswer | null;
      if (d && (d.plan || d.impuls)) setAnswer(d);
      setBusy(false);
    }).catch(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [designer?.id, journey.currentStage?.key]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success(t("studio.aufbau.copied"));
    window.setTimeout(() => setCopied(null), 1500);
  };

  if (loading) return <StudioShell title={t("studio.aufbau.title")}><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.aufbau.title")}><p className="text-muted-foreground">{t("studio.aufbau.noAccess")}</p></StudioShell>;

  const pct = journey.totalCount > 0 ? journey.doneCount / journey.totalCount : 0;
  const zuspruch = answer?.zuspruch ?? encouragement(t, pct);

  return (
    <StudioShell title={t("studio.aufbau.title")} eyebrow={t("studio.aufbau.eyebrow")}>
      <RewardToast reward={reward} onDone={dismiss} />

      {/* Kopf */}
      <section className="border-[1.5px] border-foreground bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="font-serif text-5xl leading-none">{level.glyph}</span>
            <div>
              <p className="font-serif text-2xl leading-tight">{level.label}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                {t("studio.aufbau.stepsProgress", { done: journey.doneCount, total: journey.totalCount })}
              </p>
            </div>
          </div>
          <p className="max-w-md font-serif text-lg italic leading-snug">{zuspruch}</p>
        </div>
        <div className="mt-6 h-[3px] w-full bg-foreground/10">
          <div className="h-full bg-foreground transition-all duration-700" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      </section>

      {/* Heute */}
      <section className="mt-6 border-[1.5px] border-foreground bg-foreground p-6 text-background md:p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-background/50">{t("studio.aufbau.today")}</p>
        {journey.nextStep ? (
          <>
            <h2 className="mt-3 font-serif text-2xl leading-tight">{journey.nextStep.label}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/75">{journey.nextStep.how}</p>
            <Link
              to={journey.nextStep.to}
              className="mt-5 inline-block border-[1.5px] border-background bg-background px-5 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-foreground hover:bg-foreground hover:text-background"
            >
              {t("studio.aufbau.openTool", { tool: journey.nextStep.tool })}
            </Link>
          </>
        ) : (
          <h2 className="mt-3 font-serif text-2xl leading-tight">{t("studio.aufbau.allStepsDone")}</h2>
        )}
        {answer?.impuls && (
          <p className="mt-6 border-t border-background/20 pt-4 text-sm leading-relaxed text-background/80">
            <span className="mr-2 text-[0.6rem] uppercase tracking-[0.24em] text-background/50">{t("studio.aufbau.impulse")}</span>
            {answer.impuls}
          </p>
        )}
      </section>

      {/* Der Weg */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">{t("studio.aufbau.theWay")}</h2>
        <div className="mt-4 space-y-4">
          {journey.stages.map((stage, i) => (
            <StageCard key={stage.key} stage={stage} index={i + 1} />
          ))}
        </div>
      </section>

      {/* Content-Fahrplan */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">{t("studio.aufbau.weekPlan")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("studio.aufbau.weekPlanHint")}
        </p>
        {busy && !answer ? (
          <div className="mt-4 h-40 animate-pulse bg-muted" />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(answer?.plan ?? FALLBACK_PLAN).map((p) => (
              <div key={p.tag} className="border-[1.5px] border-foreground bg-white p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{p.tag}</p>
                  <p className="text-[0.6rem] uppercase tracking-[0.24em]">{p.format}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{p.idee}</p>
                <button
                  type="button"
                  onClick={() => copy(p.idee, p.tag)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
                >
                  {copied === p.tag ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {t("studio.aufbau.copy")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Praxisfragen */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">{t("studio.aufbau.praxisTitle")}</h2>
        <div className="mt-4 border-[1.5px] border-foreground bg-white">
          {PRAXIS.map((q) => {
            const isOpen = open === q.frage;
            return (
              <div key={q.frage} className="border-b border-foreground/15 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.frage)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm"
                >
                  <span>{q.frage}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-foreground/75">{q.antwort}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">{t("studio.aufbau.legalHint")}</p>
      </section>
    </StudioShell>
  );
}

function StageCard({ stage, index }: { stage: BrandStage; index: number }) {
  const doneCount = stage.steps.filter((s) => s.done).length;
  const [open, setOpen] = useState(!stage.done);
  const { t } = useI18n();

  return (
    <div className="border-[1.5px] border-foreground bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-foreground text-[0.6rem] tabular-nums">
            {stage.done ? "✓" : index}
          </span>
          <span>
            <span className="font-serif text-lg">{stage.title}</span>
            <span className="ml-3 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
              {doneCount}/{stage.steps.length}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t-[1.5px] border-foreground px-5 py-5">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/70">{stage.intro}</p>
          <ol className="mt-5 space-y-4">
            {stage.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 border-l-[1.5px] border-foreground/15 pl-4">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border text-[0.55rem] ${s.done ? "border-foreground bg-foreground text-background" : "border-foreground/40"}`}>
                  {s.done ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm ${s.done ? "text-foreground/50 line-through" : ""}`}>{s.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.why}</p>
                  {!s.done && (
                    <>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/70">{s.how}</p>
                      <Link to={s.to} className="mt-2 inline-block text-[0.6rem] uppercase tracking-[0.24em] underline decoration-1 underline-offset-4 hover:no-underline">
                        {t("studio.aufbau.openToolArrow", { tool: s.tool })}
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function useFallbackPlan(t: (key: string, vars?: Record<string, string | number>) => string): PlanItem[] {
  return [
    { tag: t("studio.aufbau.fallbackPlan.mon.tag"), format: t("studio.aufbau.fallbackPlan.mon.format"), idee: t("studio.aufbau.fallbackPlan.mon.idee") },
    { tag: t("studio.aufbau.fallbackPlan.wed.tag"), format: t("studio.aufbau.fallbackPlan.wed.format"), idee: t("studio.aufbau.fallbackPlan.wed.idee") },
    { tag: t("studio.aufbau.fallbackPlan.fri.tag"), format: t("studio.aufbau.fallbackPlan.fri.format"), idee: t("studio.aufbau.fallbackPlan.fri.idee") },
    { tag: t("studio.aufbau.fallbackPlan.sun.tag"), format: t("studio.aufbau.fallbackPlan.sun.format"), idee: t("studio.aufbau.fallbackPlan.sun.idee") },
  ];
}

function encouragement(t: (key: string, vars?: Record<string, string | number>) => string, pct: number): string {
  if (pct === 0) return t("studio.aufbau.encouragement.zero");
  if (pct < 0.35) return t("studio.aufbau.encouragement.low");
  if (pct < 0.7) return t("studio.aufbau.encouragement.mid");
  if (pct < 1) return t("studio.aufbau.encouragement.high");
  return t("studio.aufbau.encouragement.done");
}
