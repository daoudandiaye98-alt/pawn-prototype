/**
 * PART 48 AP6 — Maison-Unterseite, verlinkt von der Atelier-Karte auf /preise. Zahlen live aus
 * ai_config.plans; die Beschreibungen der schalter-Features (sichtbarkeitszug, mini_pawn,
 * director_loop) sind nüchtern gehalten und beschreiben nur, was die jeweilige Edge Function
 * tatsächlich tut — keine erfundenen Versprechen.
 *
 * Finale Form Teil G — Vier-Boxen-Muster statt Feature-Matrix (s. Preise.tsx). Rang bleibt
 * ausdrücklich unkäuflich (harte Regel #8).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ladePlanGate, preisFor, limitFor, canUse } from "@/lib/planGate";

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

  // Finale Form Teil G — vier Zeilen statt Häkchen-Liste. Die Schalter-Extras (Wunsch-Signatur,
  // Türen-Vorlauf, Sichtbarkeitszug, Automatiken, Regisseur-Lernschleife) bleiben real und live
  // aus canUse(), landen aber verdichtet in Zeile 3 statt als eigene Aufzählungspunkte.
  const zuegeExtra = gateReady ? [
    canUse("maison", "tuer_vorlauf") ? "deine eigenen Türen sofort sichtbar" : null,
    canUse("maison", "sichtbarkeitszug") ? "ein wöchentlicher Presse-Entwurf zum Selbstverschicken" : null,
    canUse("maison", "mini_pawn") ? "eigene Automatiken mit deiner Freigabe" : null,
  ].filter((x): x is string => !!x) : [];
  const boxLines = gateReady ? [
    "Dein Hauptwerkzeug: Maison, wenn PAWN dein Alltag wird.",
    `Dieselbe Provision wie jeder andere Plan — ${commissionPct}%, nie mehr, nur weil du zahlst.`,
    `Freigeschaltete Züge: ${fmtCount(limitFor("maison", "chat_nachricht"), "Nachrichten mit PAWN")}, ${fmtCount(limitFor("maison", "tuer_oeffnen"), "Türen")}, alle Signaturen plus eine Wunsch-Signatur${zuegeExtra.length ? `, ${zuegeExtra.join(", ")}` : ""}.`,
    "Dein Rang wächst weiter nur durch das, was du baust und verkaufst — nie durch den Plan.",
  ] : [];

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
            <div className="mt-8 divide-y divide-black/10 border-t border-black/10 text-sm text-black">
              {boxLines.map((line, i) => (
                <p key={i} className="py-3 leading-snug">{line}</p>
              ))}
            </div>
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
