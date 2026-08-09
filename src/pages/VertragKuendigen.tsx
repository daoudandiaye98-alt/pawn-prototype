/**
 * Teil 39 AP1 — der Kündigungsbutton nach §312k BGB: eine öffentlich erreichbare, dauerhaft
 * verlinkte Seite mit der Schaltfläche "Verträge hier kündigen". Kündigt wird immer nur das
 * eigene, gerade laufende Abo — dafür muss man angemeldet sein, das schränkt die Erreichbarkeit
 * der Seite selbst aber nicht ein.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { isPaidPlan } from "@/lib/planGate";
import { planLabel, type Plan } from "@/features/campaign/quota";
import { toast } from "sonner";

export default function VertragKuendigen() {
  const { user } = useAuth();
  const { designer, loading, refresh } = useMyDesigner();
  const [step, setStep] = useState<"start" | "confirm" | "done">("start");
  const [busy, setBusy] = useState(false);

  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const active = isPaidPlan(plan);

  const confirmCancel = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
      if (error) throw error;
      const res = data as { error?: string; message?: string; ok?: boolean };
      if (res?.error) { toast.error(res.message ?? res.error); return; }
      setStep("done");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[680px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Rechtliches</p>
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.2rem,5vw,3.4rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Verträge hier kündigen.
          </h1>
          <p className="mt-6 font-sans text-[0.95rem] text-[#000000]/80">
            Diese Seite kündigt dein laufendes Paid-Abo im Studio (§312k BGB). Sie betrifft nicht Bestellungen
            bei einzelnen Designer-Häusern — dafür gilt das <Link to="/widerruf" className="underline">Widerrufsrecht</Link>.
          </p>
        </Reveal>

        <div className="mt-12 border border-[rgba(0,0,0,.22)] bg-white p-8">
          {!user ? (
            <>
              <p className="font-sans text-sm text-[#000000]/80">Melde dich an, um dein Abo zu kündigen.</p>
              <Link to="/auth" className="mt-4 inline-block border border-[#000000] bg-[#000000] px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#FFFFFF]">
                Anmelden
              </Link>
            </>
          ) : loading ? (
            <p className="font-sans text-sm text-[#000000]/60">Lädt…</p>
          ) : !designer ? (
            <p className="font-sans text-sm text-[#000000]/80">Zu deinem Konto gehört kein Designer-Haus mit einem Abo.</p>
          ) : step === "done" ? (
            <p className="font-sans text-sm text-[#000000]/80">
              Kündigung bestätigt. Dein Abo endet zum Ende der aktuellen Abrechnungsperiode — bis dahin bleiben
              deine Kontingente aktiv. Eine Bestätigung findest du auch in deinen Benachrichtigungen im Studio.
            </p>
          ) : !active ? (
            <p className="font-sans text-sm text-[#000000]/80">
              Du bist aktuell im Plan <strong>{planLabel(plan)}</strong> — es läuft kein kostenpflichtiges Abo, das gekündigt werden könnte.
            </p>
          ) : step === "start" ? (
            <>
              <p className="font-sans text-sm text-[#000000]/80">
                Du bist aktuell im Plan <strong>{planLabel(plan)}</strong>. Eine Kündigung beendet dein Abo zum Ende
                der laufenden Abrechnungsperiode — bis dahin bleiben deine Kontingente aktiv, danach läufst du im
                Plan Frei weiter.
              </p>
              <button type="button" onClick={() => setStep("confirm")}
                className="mt-6 border border-[#000000] bg-[#000000] px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#FFFFFF]">
                Verträge hier kündigen
              </button>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-[#000000]/80">
                Sicher? Der Plan <strong>{planLabel(plan)}</strong> endet dann zum Ende der laufenden Abrechnungsperiode.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => void confirmCancel()} disabled={busy}
                  className="border border-[#000000] bg-[#000000] px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#FFFFFF] disabled:opacity-50">
                  {busy ? "…" : "Ja, jetzt kündigen"}
                </button>
                <button type="button" onClick={() => setStep("start")} disabled={busy}
                  className="border border-[rgba(0,0,0,.28)] px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.24em] text-[#000000]">
                  Abbrechen
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
}
