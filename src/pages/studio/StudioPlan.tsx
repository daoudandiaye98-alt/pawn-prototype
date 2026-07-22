/**
 * Studio-Plan-Übersicht — Nutzen-orientiert, drei Ausbaustufen.
 * Kernbotschaft: 7% Provision bleibt immer 7%. Pläne sind optional.
 * Zahlen (Videos, Kontingente, Preise) kommen live aus ai_config — nichts hart verdrahtet.
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaignQuota, planLabel, type Plan, type PlanLimits } from "@/features/campaign/quota";
import { PlanFunnel } from "@/components/pawn/PlanFunnel";
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
    "Konsistentes Modellgesicht bei Try-Ons",
    "PAWN+ Denkstufe — tiefere Analysen",
  ],
  maison: [
    "Monatliches Haus-Dossier",
    "Saison-Lookbook (teilbarer Link + Druck-PDF)",
    "Vitrine-Rotation auf der Startseite",
    "Première-Priorität",
    "Editionen-Erstzugang",
    "Quartals-Einrichtungs-Check",
    "PAWN+ Max — stärkstes Modell, längster Kontext",
  ],
};

const HEADLINES: Record<Plan, string> = {
  haus: "Alles, um live zu sein.",
  atelier: "Wenn du regelmäßig veröffentlichst.",
  maison: "Für Ateliers mit Serienbetrieb.",
};
const BADGES: Record<Plan, string | undefined> = { haus: undefined, atelier: "PAWN+", maison: "PAWN+ Max" };

interface PlanPrices {
  atelier?: { eur_month?: number; stripe_price_id?: string | null };
  maison?: { eur_month?: number; stripe_price_id?: string | null };
}
interface ExampleVideo { plan: Plan; url: string }

function fmt(n: number): string { return n < 0 ? "alle" : String(n); }

function BudgetCircle({ spentCents, limitCents }: { spentCents: number; limitCents: number }) {
  const pct = limitCents > 0 ? Math.min(1, spentCents / limitCents) : 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e5e5" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="#000" strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="butt" transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontFamily="Inter, sans-serif">
          {limitCents > 0 ? `${Math.round(pct * 100)}%` : "—"}
        </text>
      </svg>
      <div>
        <p className="editorial-eyebrow">KI-Budget diesen Monat</p>
        <p className="mt-1 font-serif text-lg tabular-nums">
          {(spentCents / 100).toFixed(2)} € {limitCents > 0 ? `von ${(limitCents / 100).toFixed(2)} €` : "(im Haus-Plan nicht enthalten)"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Läuft im Hintergrund mit — die Kontingente oben bleiben, was zählt.
        </p>
      </div>
    </div>
  );
}

export default function StudioPlan() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = useCampaignQuota(designer?.id, plan);
  const [prices, setPrices] = useState<PlanPrices>({});
  const [busy, setBusy] = useState<Plan | null>(null);
  const [budget, setBudget] = useState<{ spent_cents: number; limit_cents: number } | null>(null);
  const [examples, setExamples] = useState<Partial<Record<Plan, string>>>({});

  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "plan_prices").maybeSingle()
      .then(({ data }) => data?.value && setPrices(data.value as unknown as PlanPrices));
  }, []);

  useEffect(() => {
    if (!designer) return;
    const month = new Date().toISOString().slice(0, 7);
    void Promise.all([
      supabase.from("ai_budget_ledger" as never).select("spent_cents").eq("designer_id", designer.id).eq("month", month).maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "ai_budget_limits").maybeSingle(),
    ]).then(([{ data: ledger }, { data: limitsCfg }]) => {
      const spent = (ledger as unknown as { spent_cents?: number } | null)?.spent_cents ?? 0;
      const limitsVal = (limitsCfg?.value as Record<string, number> | null) ?? {};
      setBudget({ spent_cents: spent, limit_cents: limitsVal[plan] ?? 0 });
    });
  }, [designer, plan]);

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
  }, []);

  const limits: PlanLimits = quota.limits;

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
    const l = limits[p];
    const videoLine = p === "haus"
      ? `${fmt(l.videos_per_month)} Kampagnen-Videos pro Monat (Editorial-Regie, PAWN-Emblem im Abspann)`
      : `${fmt(l.videos_per_month)} Kampagnen-Videos pro Monat, davon ${fmt(l.kinematic_videos_per_month)} kinematisch (✦ KI-Bewegtbild, ohne Emblem)`;
    const sigLine = `${fmt(l.signature_previews)} Signatur${l.signature_previews === 1 ? "-Kostprobe" : "en"}${p === "maison" ? " + 1 Wunsch-Signatur" : ""}`;
    const toolsLine = `${fmt(l.tryon_shots_per_month)} Try-Ons${l.product_shots_per_month !== l.tryon_shots_per_month || p === "haus" ? ` · ${fmt(l.product_shots_per_month)} Produkt-Shots` : " + Produkt-Shots"}`;
    return [videoLine, sigLine, toolsLine, ...STATIC_BENEFITS[p]];
  };

  return (
    <StudioShell title="Plan" eyebrow="Dein Haus im PAWN">
      <div className="max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Drei Ausbaustufen. Wähle, was zu deinem Rhythmus passt — jederzeit monatlich kündbar.
        </p>
        <p className="mt-3 border-l-2 border-foreground bg-muted/40 px-3 py-2 text-sm">
          <strong>7% Provision bleibt immer 7%</strong>, unabhängig vom Plan. Pläne unterscheiden sich nur in Kontingent und KI-Werkzeugen.
        </p>
      </div>

      <div className="mt-8">
        <PlanFunnel currentPlan={plan} designerId={designer?.id ?? null} />
      </div>

      <p className="mt-8 text-sm">
        Aktuell: <span className="font-medium">{planLabel(plan)}</span> · {quota.used} von {Number.isFinite(quota.limit) ? quota.limit : "∞"} Kampagnen diesen Monat.
      </p>

      {budget && (
        <div className="mt-4 max-w-md border border-border bg-white p-5">
          <BudgetCircle spentCents={budget.spent_cents} limitCents={budget.limit_cents} />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(["haus", "atelier", "maison"] as Plan[]).map((key) => {
          const current = key === plan;
          const badge = BADGES[key];
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
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{HEADLINES[key]}</p>

              <div className="mt-4 border border-border bg-black">
                {example ? (
                  <video src={example} muted playsInline loop autoPlay className="aspect-[9/16] w-full bg-black object-contain" />
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
