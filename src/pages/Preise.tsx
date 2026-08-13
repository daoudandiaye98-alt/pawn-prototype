/**
 * PART 48 AP6 — öffentliche Preisseite. Zwei Karten (Haus/Atelier), alle Zahlen live aus
 * ai_config.plans (planGate) — nichts hier ist hart verdrahtet oder erfunden. Maison bekommt
 * eine eigene Unterseite (/preise/maison), von der Atelier-Karte aus verlinkt.
 *
 * Finale Form Teil G — Vier-Boxen-Muster statt Feature-Matrix: jeder Plan besteht aus genau vier
 * Zeilen (mehr Gutes / weniger Schlechtes / mehr Gutes bei Zug / ehrliche Realität ohne Zug) statt
 * einer Häkchen-Liste. Rang bleibt in jeder Zeile ausdrücklich unkäuflich (harte Regel #8).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ladePlanGate, preisFor, limitFor, type Plan } from "@/lib/planGate";
import { useI18n } from "@/lib/i18n";

function fmtCount(n: number, noun: string, unlimitedPrefix: string): string {
  return n < 0 ? `${unlimitedPrefix} ${noun}` : `${n} ${noun}`;
}

function fourBoxLines(t: ReturnType<typeof useI18n>["t"], plan: Plan, commissionPct: number): string[] {
  if (plan === "haus") {
    return [
      t("preise.box.haus.1"),
      t("preise.box.haus.2", { pct: commissionPct }),
      t("preise.box.haus.3"),
      t("preise.box.haus.4"),
    ];
  }
  const unbegrenzt = t("preise.unbegrenzt");
  const nachrichten = fmtCount(limitFor("atelier", "chat_nachricht"), t("preise.noun.nachrichten"), unbegrenzt);
  const tueren = fmtCount(limitFor("atelier", "tuer_oeffnen"), t("preise.noun.tueren"), unbegrenzt);
  const welten = fmtCount(limitFor("atelier", "welten"), t("preise.noun.welten"), unbegrenzt);
  return [
    t("preise.box.atelier.1"),
    t("preise.box.atelier.2", { pct: commissionPct }),
    t("preise.box.atelier.3", { nachrichten, tueren, welten }),
    t("preise.box.rankGrowth"),
  ];
}

export default function Preise() {
  const { hasRole } = useAuth();
  const isDesigner = hasRole("designer");
  const { t } = useI18n();
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
  const ctaLabel = isDesigner ? t("preise.cta.myPlan") : t("preise.cta.apply");

  return (
    <PalaceLayout title={t("preise.seo.title")} description={t("preise.seo.description")}>
      <section className="mx-auto max-w-[1100px] px-6 pt-32 pb-20 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{t("preise.eyebrow")}</p>
          <h1 className="palace-serif mt-6 font-light text-black" style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {t("preise.h1")}
          </h1>
          <p className="mt-6 max-w-2xl text-base text-black/70">
            {t("preise.intro")}
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px border-[1.5px] border-black bg-black md:grid-cols-2">
          {(["haus", "atelier"] as Plan[]).map((key) => (
            <Reveal key={key} className={`bg-white p-8 md:p-10 ${key === "atelier" ? "relative" : ""}`}>
              <p className="palace-eyebrow">{t("preise.card.planLabel")}</p>
              <h2 className="palace-serif mt-2 text-3xl text-black">{key === "haus" ? t("preise.card.name.haus") : t("preise.card.name.atelier")}</h2>
              <p className="mt-3 tabular-nums text-2xl text-black">
                {key === "haus" ? "0 €" : gateReady ? `${preisFor("atelier")} €` : "…"}
                <span className="text-sm text-black/60"> {t("preise.card.perMonth")}</span>
              </p>
              <p className="mt-3 max-w-xs text-sm text-black/70">
                {key === "haus" ? t("preise.card.desc.haus") : t("preise.card.desc.atelier")}
              </p>

              {gateReady ? (
                <div className="mt-8 divide-y divide-black/10 border-t border-black/10 text-sm text-black">
                  {fourBoxLines(t, key, commissionPct).map((line, i) => (
                    <p key={i} className="py-3 leading-snug">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-8 text-sm text-black/60">{t("preise.card.loading")}</p>
              )}

              {key === "atelier" && (
                <p className="mt-6 text-xs text-black/60">
                  <Link to="/preise/maison" className="underline hover:no-underline">{t("preise.card.maisonLink")}</Link>
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
          <p>{t("preise.footer.commission", { pct: commissionPct })}</p>
          <p>{t("preise.footer.rank")}</p>
        </div>
      </section>
    </PalaceLayout>
  );
}
