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
import { useCredits, planLabel, creditExample, type Plan } from "@/features/campaign/quota";
import { PlanFunnel } from "@/components/pawn/PlanFunnel";
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
interface CreditPack { id: string; credits: number; eur: number; stripe_price_id: string | null }
interface CreditHistoryItem { at: string; action: string; model: string | null; credits: number }
interface PlanLimitEntry { signature_previews: number; emblem: boolean; tier: number }

function fmt(n: number): string { return n < 0 ? "alle" : String(n); }

const ACTION_LABEL: Record<string, string> = {
  product_shot: "Freisteller", tryon_shot: "Model-Shot", tryon_clip: "Model-Clip",
  clip_standard: "Kinematischer Clip", clip_premium: "Kinematischer Clip (Signatur)", kauf: "Aufgeladen",
};

function CreditCircle({ balance, grant }: { balance: number; grant: number }) {
  const pct = grant > 0 ? Math.min(1, balance / grant) : 0;
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
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontFamily="Inter, sans-serif" fontWeight="600">
          {grant > 0 ? balance : "—"}
        </text>
      </svg>
      <div>
        <p className="editorial-eyebrow">Guthaben diesen Monat</p>
        <p className="mt-1 font-serif text-lg tabular-nums">{balance} von {grant} Credits</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fotos ohne KI-Werkzeuge kosten nichts. Ungenutzte Credits verfallen zum Monatsende.
        </p>
      </div>
    </div>
  );
}

export default function StudioPlan() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const credits = useCredits(designer?.id, plan);
  const [prices, setPrices] = useState<PlanPrices>({});
  const [busy, setBusy] = useState<Plan | null>(null);
  const [buyBusy, setBuyBusy] = useState<string | null>(null);
  const [examples, setExamples] = useState<Partial<Record<Plan, string>>>({});
  const [planCreditsAll, setPlanCreditsAll] = useState<Record<Plan, number>>({ haus: 30, atelier: 300, maison: 1200 });
  const [planLimits, setPlanLimits] = useState<Record<Plan, PlanLimitEntry>>({
    haus: { signature_previews: 1, emblem: true, tier: 1 },
    atelier: { signature_previews: 3, emblem: false, tier: 2 },
    maison: { signature_previews: -1, emblem: false, tier: 3 },
  });
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [history, setHistory] = useState<CreditHistoryItem[]>([]);

  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "plan_prices").maybeSingle()
      .then(({ data }) => data?.value && setPrices(data.value as unknown as PlanPrices));
    supabase.from("ai_config").select("value").eq("key", "plan_credits").maybeSingle()
      .then(({ data }) => data?.value && setPlanCreditsAll((prev) => ({ ...prev, ...(data.value as Partial<Record<Plan, number>>) })));
    supabase.from("ai_config").select("value").eq("key", "plan_limits").maybeSingle()
      .then(({ data }) => data?.value && setPlanLimits((prev) => ({ ...prev, ...(data.value as unknown as Record<Plan, PlanLimitEntry>) })));
    supabase.from("ai_config").select("value").eq("key", "credit_packs").maybeSingle()
      .then(({ data }) => Array.isArray(data?.value) && setPacks(data.value as unknown as CreditPack[]));
  }, []);

  useEffect(() => {
    if (!designer) return;
    const month = new Date().toISOString().slice(0, 7);
    void supabase.from("credits_ledger" as never).select("history").eq("designer_id", designer.id).eq("month", month).maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as { history?: CreditHistoryItem[] } | null;
        setHistory(((row?.history ?? []) as CreditHistoryItem[]).slice().reverse());
      });
  }, [designer, plan, credits.balance]);

  const buyPack = async (pack: CreditPack) => {
    if (!user || !designer) { toast.error("Bitte melde dich an."); return; }
    if (!pack.stripe_price_id) return;
    setBuyBusy(pack.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "credits", price_id: pack.stripe_price_id, credits: pack.credits,
          success_url: `${window.location.origin}/studio/plan?credits=1`,
          cancel_url: `${window.location.origin}/studio/plan`,
          customer_email: user.email,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string; message?: string })?.url;
      if (url) window.location.href = url;
      else toast.error((data as { message?: string })?.message ?? "Kauf konnte nicht gestartet werden.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuyBusy(null);
    }
  };

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
    const pc = planCreditsAll[p] ?? 0;
    const l = planLimits[p];
    const creditsLine = `${pc} Credits pro Monat${p === "haus" ? " (Editorial-Regie kostenlos, PAWN-Emblem im Abspann)" : " — Editorial-Regie bleibt immer kostenlos"}`;
    const exampleLine = creditExample(pc, credits.costs);
    const sigLine = `${fmt(l.signature_previews)} Signatur${l.signature_previews === 1 ? "-Vorschau" : "en"}${p === "maison" ? " + 1 Wunsch-Signatur" : ""}`;
    return [creditsLine, exampleLine, sigLine, ...resolvedStaticBenefits[p]].filter(Boolean);
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
        Aktuell: <span className="font-medium">{planLabel(plan)}</span>.
      </p>

      {!credits.loading && (
        <div className="mt-4 max-w-md border border-border bg-white p-5">
          <CreditCircle balance={credits.balance} grant={credits.grant} />
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 max-w-md border border-border bg-white p-5">
          <p className="editorial-eyebrow">Verlauf diesen Monat</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {history.slice(0, 10).map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{new Date(h.at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · {ACTION_LABEL[h.action] ?? h.action}</span>
                <span className={`tabular-nums ${h.credits > 0 ? "text-emerald-700" : ""}`}>{h.credits > 0 ? "+" : ""}{h.credits}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {packs.length > 0 && (
        <div className="mt-4 max-w-2xl border border-border bg-white p-5">
          <p className="editorial-eyebrow">Credits nachkaufen</p>
          <p className="mt-1 text-sm text-muted-foreground">Zusätzlich zum monatlichen Guthaben — verfällt nicht zum Monatsende.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {packs.map((p) => (
              <div key={p.id} className="border border-border p-4 text-center">
                <p className="font-serif text-2xl tabular-nums">{p.credits}</p>
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="mt-2 tabular-nums">{p.eur} €</p>
                <button onClick={() => buyPack(p)} disabled={!p.stripe_price_id || buyBusy === p.id}
                  className="mt-3 w-full border border-foreground bg-foreground px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background disabled:opacity-40">
                  {!p.stripe_price_id ? "Bald verfügbar" : buyBusy === p.id ? "…" : "Kaufen"}
                </button>
              </div>
            ))}
          </div>
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
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{resolvedHeadlines[key]}</p>

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
