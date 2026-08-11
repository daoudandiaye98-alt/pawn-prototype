/**
 * PART 48 AP6 — Maison-Unterseite, verlinkt von der Atelier-Karte auf /preise. Zahlen live aus
 * ai_config.plans; die Beschreibungen der schalter-Features (sichtbarkeitszug, mini_pawn,
 * director_loop) sind nüchtern gehalten und beschreiben nur, was die jeweilige Edge Function
 * tatsächlich tut — keine erfundenen Versprechen.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ladePlanGate, preisFor, limitFor, canUse } from "@/lib/planGate";
import { Check } from "lucide-react";

function fmtCount(n: number, noun: string): string {
  return n < 0 ? `Unbegrenzt ${noun}` : `${n} ${noun}`;
}

export default function PreiseMaison() {
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

  const zeilen = gateReady ? [
    fmtCount(limitFor("maison", "chat_nachricht"), "Nachrichten mit PAWN im Monat"),
    fmtCount(limitFor("maison", "tuer_oeffnen"), "geöffnete Türen im Monat"),
    "Alle Signaturen, plus eine Wunsch-Signatur nach deinen eigenen Vorgaben",
    fmtCount(limitFor("maison", "welten"), "Welten gleichzeitig"),
    canUse("maison", "chat_retrieval") ? "Katalog-Wissen im Gespräch mit PAWN" : null,
    canUse("maison", "dashboard_metriken") ? "Kennzahlen im Cockpit" : null,
    canUse("maison", "tuer_vorlauf") ? "Deine eigenen Türen sind sofort sichtbar — andere Pläne warten 48 Stunden" : null,
    canUse("maison", "sichtbarkeitszug") ? "PAWN schreibt dir wöchentlich einen Presse-Entwurf, den du selbst an Redaktionen oder Blogs verschicken kannst" : null,
    canUse("maison", "mini_pawn") ? "Eigene Automatiken, die PAWN nur mit deiner Freigabe für dich ausführt (Grün/Gelb/Rot-Zonen)" : null,
    canUse("maison", "director_loop") ? "PAWN lernt wöchentlich aus deinen Video-Ergebnissen und schärft künftige Vorschläge" : null,
  ].filter((x): x is string => !!x) : [];

  const ctaHref = isDesigner ? "/studio/plan" : "/apply";
  const ctaLabel = isDesigner ? "Zu deinem Plan" : "Bewerben";

  return (
    <PalaceLayout title="Maison — PAWN" description="Der größte Plan bei PAWN: was Maison zusätzlich erlaubt — live, ohne Kleingedrucktes.">
      <section className="mx-auto max-w-[900px] px-6 pt-32 pb-20 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow"><Link to="/preise" className="hover:underline">Pläne</Link> · Maison</p>
          <h1 className="palace-serif mt-6 font-light text-black" style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Maison.
          </h1>
          <p className="mt-6 max-w-xl text-base text-black/70">
            Für Häuser, die aus PAWN ihr Hauptwerkzeug machen. Dieselbe Provision wie jeder andere
            Plan — {gateReady ? `${preisFor("maison")} €` : "…"} im Monat für spürbar mehr Spielraum.
          </p>
        </Reveal>

        <Reveal className="mt-14 border-[1.5px] border-black bg-white p-8 md:p-10">
          <p className="palace-eyebrow">Plan</p>
          <h2 className="palace-serif mt-2 text-3xl text-black">Maison</h2>
          <p className="mt-3 tabular-nums text-2xl text-black">
            {gateReady ? `${preisFor("maison")} €` : "…"}<span className="text-sm text-black/60"> / Monat</span>
          </p>

          {gateReady ? (
            <ul className="mt-8 space-y-3 text-sm text-black">
              {zeilen.map((z) => (
                <li key={z} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{z}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-sm text-black/50">Lädt …</p>
          )}

          <Link to={ctaHref}
            className="mt-8 inline-block border border-black px-5 py-3 text-[0.68rem] uppercase tracking-[0.24em] text-black hover:bg-black hover:text-white">
            {ctaLabel}
          </Link>
        </Reveal>

        <div className="mt-10 max-w-xl space-y-2 text-sm text-black/60">
          <p>Die Provision auf verkaufte Stücke bleibt {commissionPct}% — wie bei Haus und Atelier.</p>
          <p>Dein Rang (vom Bauern aufwärts) wächst durch das, was du baust und verkaufst — kein Plan beschleunigt ihn.</p>
        </div>
      </section>
    </PalaceLayout>
  );
}
