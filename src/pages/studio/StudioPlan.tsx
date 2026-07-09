/**
 * Studio-Plan-Übersicht. Drei Karten (Haus / Atelier / Maison).
 * Upgrade → create-checkout im subscription-mode, wenn Stripe konfiguriert.
 * Fehlt Setup: erzeugt einen message_thread als "Upgrade-Anfrage".
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCampaignQuota, planLabel, type Plan } from "@/features/campaign/quota";
import { Check } from "lucide-react";

interface PlanCard {
  key: Plan;
  name: string;
  price: string;
  bullets: string[];
}

const CARDS: PlanCard[] = [
  { key: "haus",    name: "Haus",    price: "0 €",  bullets: ["2 Reels pro Monat", "Stufe 1: PAWN-Renderer", "Community-Warteschlange"] },
  { key: "atelier", name: "Atelier", price: "19 €", bullets: ["10 Reels pro Monat", "Stufe 1 + generative Akzente (bald)", "Priorisierte Warteschlange"] },
  { key: "maison",  name: "Maison",  price: "79 €", bullets: ["30 Reels pro Monat", "Alle Stufen freigeschaltet", "Vorrang im Kalender"] },
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
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "plan_prices").maybeSingle();
      if (data?.value) setPrices(data.value as unknown as PlanPrices);
    })();
  }, []);

  const upgrade = async (target: Plan) => {
    if (!user || !designer) { toast.error("Bitte melde dich an."); return; }
    if (target === "haus" || target === plan) return;
    setBusy(target);
    try {
      const priceId = target === "atelier" ? prices.atelier?.stripe_price_id : prices.maison?.stripe_price_id;
      if (!priceId) {
        // Message-Thread als Anfrage
        const { data: thread, error } = await supabase.from("message_threads").insert({
          designer_id: designer.id,
          created_by: user.id,
          subject: `Plan-Upgrade auf ${planLabel(target)}`,
          category: "allgemein",
          status: "open",
        } as never).select("id").single();
        if (error) throw error;
        await supabase.from("messages").insert({
          thread_id: (thread as { id: string }).id,
          sender_id: user.id,
          body: `Ich möchte auf den Plan ${planLabel(target)} wechseln. Bitte meldet euch zur Freischaltung.`,
        } as never);
        toast.success("Anfrage gesendet — wir melden uns.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "subscription",
          plan: target,
          price_id: priceId,
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
      <p className="max-w-2xl text-sm text-muted-foreground">
        Drei Ausbaustufen. Jede erlaubt dir, im Monat mehr Kampagnen zu produzieren — und schaltet später neue Werkzeuge frei.
      </p>

      <p className="mt-4 text-sm">
        Aktuell: <span className="font-medium">{planLabel(plan)}</span> · {quota.used} von {quota.limit} Reels diesen Monat.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {CARDS.map((c) => {
          const current = c.key === plan;
          return (
            <div key={c.key} className={`border ${current ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border"} bg-white p-6`}>
              <p className="editorial-eyebrow">Plan</p>
              <h3 className="mt-2 font-serif text-3xl">{c.name}</h3>
              <p className="mt-2 tabular-nums text-xl">{c.price}<span className="text-sm text-muted-foreground"> / Monat</span></p>
              <ul className="mt-6 space-y-2 text-sm">
                {c.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b}</span></li>
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

      {(!prices.atelier?.stripe_price_id || !prices.maison?.stripe_price_id) && (
        <p className="mt-6 text-xs text-muted-foreground">
          Zahlung ist noch nicht vollständig eingerichtet — Upgrade-Wünsche gehen als Nachricht an unser Team.
        </p>
      )}
    </StudioShell>
  );
}
