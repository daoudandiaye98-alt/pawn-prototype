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
import { useContentValue } from "@/components/palace/Editable";
import { Check, Sparkles } from "lucide-react";

const STATIC_BENEFITS: Record<Plan, string[]> = {
  haus: [
    "7% bleiben immer 7%",
    "PAWN-KI · Standard-Denkstufe",
  ],
  atelier: [
    "KI-Kurator prüft deine Kollektion vor Veröffentlichung",
    "Text-Atelier für Produkttexte",
    "Persönlicher Welt-Spiegel mit Trend-Report",
    "PAWN+ Denkstufe — tiefere Analysen",
  ],
  maison: [
    "Monatliches Haus-Dossier",
    "Vitrine-Rotation auf der Startseite",
    "Dein Video zuerst auf der Startseite, früher Zugang zu gemeinsamen Kampagnen",
    "PAWN+ Max — stärkstes Modell, längster Kontext",
  ],
};

const HEADLINES: Record<Plan, string> = {
  haus: "Alles, um live zu sein.",
  atelier: "Wenn du regelmäßig veröffentlichst.",
  maison: "Für Ateliers im Serienbetrieb.",
};
const BADGES: Record<Plan, string | undefined> = { haus: undefined, atelier: "PAWN+", maison: "PAWN+ Max" };

interface PlanPrices {
  atelier?: { eur_month?: number; stripe_price_id?: string | null };
  maison?: { eur_month?: number; stripe_price_id?: string | null };
}

function fmt(n: number): string { return n < 0 ? "alle" : String(n); }
function fmtCount(n: number, noun: string): string {
  return n < 0 ? `unbegrenzt ${noun}` : `${n} ${noun}`;
}

/** Dein Monat — eine ruhige Zeile, kein Guthabenstand. */
function MonthLine({ used, limits, unlimited }: { used: Record<"videos" | "cinematic" | "shots", number>; limits: PlanQuota; unlimited: boolean }) {
  return (
    <div className="border border-border bg-white p-5">
      <p className="editorial-eyebrow">Dein Monat</p>
      <p className="mt-2 font-serif text-lg tabular-nums">
        {formatQuota(used.videos, unlimited ? -1 : limits.videos, "Videos")} · {formatQuota(used.shots, unlimited ? -1 : limits.shots, "Shots")}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Fotos ohne KI-Werkzeuge zählen nicht mit. Am 1. beginnt der Monat neu.
      </p>
    </div>
  );
}

export default function StudioPlan() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
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

  const upgrade = async (target: Plan) => {
    if (!user || !designer) { toast.error("Bitte melde dich an."); return; }
    if (target === "haus" || target === plan) return;
    setBusy(target);
    try {
      const priceId = target === "atelier" ? prices.atelier?.stripe_price_id : prices.maison?.stripe_price_id;
      if (!priceId) {
        const { data: thread, error } = await supabase.from("message_threads").insert({
          designer_id: designer.id, created_by: user.id,
          subject: `Plan-Upgrade auf ${planLabel(target)}`,
          category: "allgemein", status: "open",
        } as never).select("id").single();
        if (error) throw error;
        await supabase.from("messages").insert({
          thread_id: (thread as { id: string }).id, sender_id: user.id,
          body: `Ich möchte auf den Plan ${planLabel(target)} wechseln. Bitte meldet euch zur Freischaltung.`,
        } as never);
        toast.success("Anfrage gesendet — wir melden uns.");
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
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const priceFor = (p: Plan): string => {
    if (p === "haus") return "0 €";
    const eur = p === "atelier" ? prices.atelier?.eur_month : prices.maison?.eur_month;
    return eur != null ? `${eur} €` : (p === "atelier" ? "24 €" : "99 €");
  };

  const benefitsFor = (p: Plan): string[] => {
    const l = planLimits[p];
    const videoLine = l.cinematic > 0 || l.cinematic < 0
      ? `${fmtCount(l.videos, "Videos")} pro Monat, ${fmt(l.cinematic)} davon kinematisch${l.emblem ? "" : " — ohne PAWN-Emblem"}`
      : `${fmtCount(l.videos, "Videos")} pro Monat in Editorial-Regie${l.emblem ? ", mit PAWN-Emblem im Abspann" : ""}`;
    const shotLine = `${fmtCount(l.shots, "Model-Shots & Freisteller")} pro Monat`;
    const sigLine = `${fmt(l.signature_previews)} Bildsprache${l.signature_previews === 1 ? "" : "en"}${p === "maison" ? " + 1 Wunsch-Bildsprache" : ""}`;
    return [videoLine, shotLine, sigLine, ...resolvedStaticBenefits[p]].filter(Boolean);
  };

  return (
    <StudioShell title="Plan" eyebrow="Dein Haus im PAWN">
      <div className="max-w-2xl">
        <p className="palace-serif text-lg">
          <strong>7 % bleiben immer 7 %. Pläne sind optional.</strong>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Drei Ausbaustufen, monatlich kündbar. Sie unterscheiden sich nur darin, wie viel du im Monat produzieren kannst — nie in deiner Provision.
        </p>
      </div>

      <p className="mt-8 text-sm">
        Aktuell: <span className="font-medium">{planLabel(plan)}</span>.
      </p>

      {!quota.loading && (
        <div className="mt-4 max-w-md">
          <MonthLine used={quota.used} limits={quota.limits} unlimited={quota.unlimited} />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(["haus", "atelier", "maison"] as Plan[]).map((key) => {
          const current = key === plan;
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
              <p className="editorial-eyebrow">Plan</p>
              <h3 className="mt-2 font-serif text-3xl">{planLabel(key)}</h3>
              <p className="mt-2 tabular-nums text-xl">{priceFor(key)}<span className="text-sm text-muted-foreground"> / Monat</span></p>
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{resolvedHeadlines[key]}</p>

              <div className="mt-4 border border-border bg-black">
                {imageExample ? (
                  <img src={imageExample} alt="" className="aspect-[9/16] w-full bg-black object-contain" />
                ) : example ? (
                  <div className="relative">
                    <video src={example} muted playsInline loop autoPlay className="aspect-[9/16] w-full bg-black object-contain" />
                    <span className="absolute right-2 top-2 border border-white/70 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-white/90">Video · Beta</span>
                  </div>
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center p-4 text-center text-xs text-white/50">
                    Beispiel folgt, sobald das erste Haus in dieser Stufe produziert.
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
                {current ? (
                  <span className="inline-block border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em]">Dein Plan</span>
                ) : key === "haus" ? (
                  <span className="text-xs text-muted-foreground">Basiszugang</span>
                ) : (
                  <button onClick={() => upgrade(key)} disabled={busy === key}
                    className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                    {busy === key ? "…" : "Wechseln"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Kündigung jederzeit im Studio zum Monatsende. Details in den <a href="/agb" className="underline">AGB</a>.
        Bestehende Abos behalten ihren bisherigen Preis.
      </p>
      {(!prices.atelier?.stripe_price_id || !prices.maison?.stripe_price_id) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Zahlung ist noch nicht vollständig eingerichtet — Upgrade-Wünsche gehen als Nachricht an unser Team.
        </p>
      )}
    </StudioShell>
  );
}
