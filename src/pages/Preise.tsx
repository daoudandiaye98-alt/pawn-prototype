/**
 * PART 48 AP6 — öffentliche Preisseite. Zwei Karten (Haus/Atelier), alle Zahlen live aus
 * ai_config.plans (planGate) — nichts hier ist hart verdrahtet oder erfunden. Maison bekommt
 * eine eigene Unterseite (/preise/maison), von der Atelier-Karte aus verlinkt.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ladePlanGate, preisFor, limitFor, canUse, type Plan } from "@/lib/planGate";
import { Check } from "lucide-react";

function fmtCount(n: number, noun: string): string {
  return n < 0 ? `Unbegrenzt ${noun}` : `${n} ${noun}`;
}

function benefitsFor(plan: Plan): string[] {
  const zeilen = [
    fmtCount(limitFor(plan, "chat_nachricht"), "Nachrichten mit PAWN im Monat"),
    fmtCount(limitFor(plan, "tuer_oeffnen"), "geöffnete Türen im Monat"),
    fmtCount(limitFor(plan, "signature_previews"), limitFor(plan, "signature_previews") === 1 ? "Signatur-Kostprobe" : "Signaturen"),
    fmtCount(limitFor(plan, "welten"), "Welt gleichzeitig"),
  ];
  if (canUse(plan, "chat_retrieval")) zeilen.push("Katalog-Wissen im Gespräch mit PAWN");
  if (canUse(plan, "dashboard_metriken")) zeilen.push("Kennzahlen im Cockpit");
  return zeilen;
}

export default function Preise() {
  const { hasRole } = useAuth();
  const isDesigner = hasRole("designer");
  const [gateReady, setGateReady] = useState(false);
  const [commissionPct, setCommissionPct] = useState(7);

  useEffect(() => {
    void ladePlanGate().then(() => setGateReady(true));
    void supabase.from("ai_config").select("value").eq("key", "platform_commission").maybeSingle()
      .then(({ data }) => {
        const pct = (data?.value as { pct?: number } | null)?.pct;
        if (typeof pct === "number") setCommissionPct(pct);
      });
  }, []);

  const ctaHref = isDesigner ? "/studio/plan" : "/apply";
  const ctaLabel = isDesigner ? "Zu deinem Plan" : "Bewerben";

  return (
    <PalaceLayout title="Pläne — PAWN" description="Haus und Atelier: was jeder Plan bei PAWN kostet und erlaubt — live, ohne Kleingedrucktes.">
      <section className="mx-auto max-w-[1100px] px-6 pt-32 pb-20 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Pläne</p>
          <h1 className="palace-serif mt-6 font-light text-black" style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Dein Haus, dein Tempo.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-black/70">
            Jedes angenommene Haus verkauft von Anfang an — mit derselben Provision, unabhängig vom Plan.
            Ein Plan bestimmt nur, wie viel KI-Werkzeug ein Haus im Monat zur Verfügung hat.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px border-[1.5px] border-black bg-black md:grid-cols-2">
          {(["haus", "atelier"] as Plan[]).map((key) => (
            <Reveal key={key} className={`bg-white p-8 md:p-10 ${key === "atelier" ? "relative" : ""}`}>
              <p className="palace-eyebrow">Plan</p>
              <h2 className="palace-serif mt-2 text-3xl text-black">{key === "haus" ? "Haus" : "Atelier"}</h2>
              <p className="mt-3 tabular-nums text-2xl text-black">
                {key === "haus" ? "0 €" : gateReady ? `${preisFor("atelier")} €` : "…"}
                <span className="text-sm text-black/60"> / Monat</span>
              </p>
              <p className="mt-3 max-w-xs text-sm text-black/70">
                {key === "haus" ? "Der Einstieg — jedes angenommene Haus startet hier." : "Für Häuser, die mehr Tempo wollen."}
              </p>

              {gateReady ? (
                <ul className="mt-8 space-y-3 text-sm text-black">
                  {benefitsFor(key).map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-8 text-sm text-black/50">Lädt …</p>
              )}

              {key === "atelier" && (
                <p className="mt-6 text-xs text-black/60">
                  <Link to="/preise/maison" className="underline hover:no-underline">Mehr zu Maison, dem größten Plan →</Link>
                </p>
              )}

              <Link to={ctaHref}
                className="mt-8 inline-block border border-black px-5 py-3 text-[0.68rem] uppercase tracking-[0.24em] text-black hover:bg-black hover:text-white">
                {ctaLabel}
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 max-w-2xl space-y-2 text-sm text-black/60">
          <p>Die Provision auf verkaufte Stücke bleibt für jedes Haus {commissionPct}% — unabhängig vom Plan.</p>
          <p>Dein Rang (vom Bauern aufwärts) wächst durch das, was du baust und verkaufst — kein Plan beschleunigt ihn.</p>
        </div>
      </section>
    </PalaceLayout>
  );
}
