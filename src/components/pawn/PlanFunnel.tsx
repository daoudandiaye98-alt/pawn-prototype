/**
 * "Welches Haus bist du?" — 3 Fragen → Plan-Empfehlung mit Begründung.
 * In der Studio-Variante versucht sie zusätzlich eine kurze KI-Zeile aus der Brand-DNA
 * (studio-ai, best effort) — sonst greift immer der statische Fallback-Satz.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { type Plan, planLabel } from "@/features/campaign/quota";
import { Editable, useContentValue } from "@/components/palace/Editable";
import { ArrowRight } from "lucide-react";

interface Question { key: string; text: string; options: { label: string; weight: 1 | 2 | 3 }[] }

const QUESTIONS: Question[] = [
  {
    key: "frequency",
    text: "Wie oft bringst du neue Stücke oder Kampagnen heraus?",
    options: [
      { label: "Selten — wenn es passt", weight: 1 },
      { label: "Monatlich", weight: 2 },
      { label: "Wöchentlich oder öfter", weight: 3 },
    ],
  },
  {
    key: "motion",
    text: "Brauchst du echte KI-Kamerabewegung statt ruhiger Foto-Regie?",
    options: [
      { label: "Ruhige Editorial-Regie reicht", weight: 1 },
      { label: "Gelegentlich kinematisch", weight: 2 },
      { label: "Durchgängig kinematisch", weight: 3 },
    ],
  },
  {
    key: "reach",
    text: "Wie wichtig ist dir Priorität in Première und Vitrine?",
    options: [
      { label: "Nicht entscheidend", weight: 1 },
      { label: "Schön, aber kein Muss", weight: 2 },
      { label: "Sehr wichtig", weight: 3 },
    ],
  },
];

function recommend(total: number): Plan {
  if (total <= 4) return "haus";
  if (total <= 7) return "atelier";
  return "maison";
}

const STATIC_REASON: Record<Plan, string> = {
  haus: "Deine Antworten klingen nach einem ruhigen Rhythmus — der Haus-Plan deckt das kostenlos ab.",
  atelier: "Du veröffentlichst regelmäßig und willst echte Bewegung — Atelier gibt dir dafür das Werkzeug.",
  maison: "Serienbetrieb, volle Priorität — Maison ist für Häuser gebaut, die durchgängig produzieren.",
};

export function PlanFunnel({ currentPlan, designerId, context = "studio" }: {
  currentPlan?: Plan; designerId?: string | null; context?: "studio" | "landing";
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [loadingReason, setLoadingReason] = useState(false);

  const answer = (qKey: string, weight: number) => {
    const next = { ...answers, [qKey]: weight };
    setAnswers(next);
    if (Object.keys(next).length === QUESTIONS.length) {
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      const rec = recommend(total);
      setDone(true);
      setReason(resolvedReason[rec]);
      if (context === "studio" && designerId) {
        setLoadingReason(true);
        void supabase.functions.invoke("studio-ai", {
          body: {
            mode: "chat",
            question: `In einem Satz auf Deutsch, warum passt der Plan "${planLabel(rec)}" zu diesem Haus? Nutze die Brand-DNA falls hilfreich. Nur der eine Satz, keine Anführungszeichen.`,
          },
        }).then(({ data }) => {
          const reply = (data as { reply?: string } | null)?.reply?.trim();
          if (reply && reply.length < 220) setReason(reply);
        }).catch(() => { /* Fallback bleibt stehen */ })
          .finally(() => setLoadingReason(false));
      }
    }
  };

  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  const rec = done ? recommend(total) : null;
  const answeredCount = Object.keys(answers).length;

  const q1Text = useContentValue("plan_funnel.question_1", QUESTIONS[0].text);
  const q2Text = useContentValue("plan_funnel.question_2", QUESTIONS[1].text);
  const q3Text = useContentValue("plan_funnel.question_3", QUESTIONS[2].text);
  const questionText: Record<string, string> = { frequency: q1Text, motion: q2Text, reach: q3Text };
  const reasonHaus = useContentValue("plan_funnel.reason_haus", STATIC_REASON.haus);
  const reasonAtelier = useContentValue("plan_funnel.reason_atelier", STATIC_REASON.atelier);
  const reasonMaison = useContentValue("plan_funnel.reason_maison", STATIC_REASON.maison);
  const resolvedReason: Record<Plan, string> = { haus: reasonHaus, atelier: reasonAtelier, maison: reasonMaison };
  const nochmalLabel = useContentValue("plan_funnel.reset_cta", "Nochmal");

  return (
    <div className="border-[1.5px] border-black bg-white p-6">
      <Editable as="p" contentKey="plan_funnel.heading" className="editorial-eyebrow">Welches Haus bist du?</Editable>
      {!done ? (
        <div className="mt-4 space-y-6">
          {QUESTIONS.map((q, qi) => (
            <div key={q.key} className={answeredCount < qi ? "opacity-30" : ""}>
              <p className="font-serif text-lg">{questionText[q.key]}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => answer(q.key, o.weight)}
                    disabled={answeredCount < qi}
                    className={`border px-3 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${
                      answers[q.key] === o.weight ? "border-black bg-black text-white" : "border-border bg-white hover:border-black"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-serif text-2xl">Für dich passt: {planLabel(rec!)}.</p>
          <p className="mt-2 text-sm text-muted-foreground">{loadingReason ? "…" : reason}</p>
          {currentPlan && rec !== currentPlan && (
            context === "studio" ? (
              <a href={`#plan-${rec}`} className="mt-4 inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background">
                Zu {planLabel(rec!)} wechseln <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link to="/apply" className="mt-4 inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background">
                <Editable as="span" contentKey="plan_funnel.apply_cta">Als Haus bewerben</Editable> <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )
          )}
          <button onClick={() => { setAnswers({}); setDone(false); setReason(null); }}
            className="mt-4 ml-3 text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
            {nochmalLabel}
          </button>
        </div>
      )}
    </div>
  );
}
