/**
 * Studio-Plan-Übersicht — Nutzen-orientiert, drei Ausbaustufen.
 * Kernbotschaft: 7% Provision bleibt immer 7%. Pläne sind optional.
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaignQuota, planLabel, type Plan } from "@/features/campaign/quota";
import { Check, Sparkles } from "lucide-react";

interface PlanCard {
  key: Plan;
  name: string;
  price: string;
  headline: string;
  benefits: string[];
  badge?: string;
}

const CARDS: PlanCard[] = [
  {
    key: "haus", name: "Haus", price: "0 €",
    headline: "Alles, um live zu sein.",
    benefits: [
      "2 Kampagnen-Videos pro Monat",
      "Editorial-Regie (Client-Renderer)",
      "PAWN-KI · Standard-Denkstufe",
      "7% bleiben immer 7%",
    ],
  },
  {
    key: "atelier", name: "Atelier", price: "19 €",
    headline: "Wenn du regelmäßig veröffentlichst.",
    badge: "PAWN+",
    benefits: [
      "10 Kampagnen-Videos pro Monat",
      "✦ Kinematischer Modus (KI-Bewegtbild)",
      "PAWN+ Denkstufe — tiefere Analysen",
      "Wöchentlicher Trend-Report im Spiegel",
    ],
  },
  {
    key: "maison", name: "Maison", price: "79 €",
    headline: "Für Ateliers mit Serienbetrieb.",
    badge: "PAWN+ Max",
    benefits: [
      "30 Kampagnen-Videos pro Monat",
      "Alle Stufen + Priorität in der Posting-Queue",
      "PAWN+ Max — stärkstes Modell, längster Kontext",
      "Persönlicher Einrichtungs-Check",
    ],
  },
];

interface PlanPrices { atelier?: { stripe_price_id?: string | null }; maison?: { stripe_price_id?: string | null } }

export default function StudioPlan() {
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = useCampaignQuota(designer?.id, plan);
  const [prices, setPrices] = useState<PlanPrices>({});
  const [busy, setBusy] = useState<Plan | null>(null);

  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "plan_prices").maybeSingle()
      .then(({ data }) => data?.value && setPrices(data.value as unknown as PlanPrices));
  }, []);

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

      <p className="mt-6 text-sm">
        Aktuell: <span className="font-medium">{planLabel(plan)}</span> · {quota.used} von {quota.limit} Kampagnen diesen Monat.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {CARDS.map((c) => {
          const current = c.key === plan;
          return (
            <div key={c.key}
              className={`relative border ${current ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border"} bg-white p-6`}>
              {c.badge && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 border border-foreground bg-foreground px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-background">
                  <Sparkles className="h-2.5 w-2.5" /> {c.badge}
                </span>
              )}
              <p className="editorial-eyebrow">Plan</p>
              <h3 className="mt-2 font-serif text-3xl">{c.name}</h3>
              <p className="mt-2 tabular-nums text-xl">{c.price}<span className="text-sm text-muted-foreground"> / Monat</span></p>
              <p className="mt-4 font-serif text-sm italic text-muted-foreground">{c.headline}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {c.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <span className="inline-block border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em]">Dein Plan</span>
                ) : c.key === "haus" ? (
                  <span className="text-xs text-muted-foreground">Basiszugang</span>
                ) : (
                  <button onClick={() => upgrade(c.key)} disabled={busy === c.key}
                    className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                    {busy === c.key ? "…" : "Wechseln"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Kündigung jederzeit im Studio zum Monatsende. Details in den <a href="/agb" className="underline">AGB</a>.
      </p>
      {(!prices.atelier?.stripe_price_id || !prices.maison?.stripe_price_id) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Zahlung ist noch nicht vollständig eingerichtet — Upgrade-Wünsche gehen als Nachricht an unser Team.
        </p>
      )}
    </StudioShell>
  );
}
