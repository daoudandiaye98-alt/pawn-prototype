/**
 * "Deine Marke aufbauen" — der Begleiter: fünf Etappen, ein Zug für heute,
 * ein Wochenplan für Inhalte und Antworten auf Praxisfragen.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { useBrandJourney, type BrandStage } from "@/features/studio/useBrandJourney";
import { useStepRewards, RewardToast } from "@/features/rewards";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PlanItem { tag: string; format: string; idee: string; }
interface AufbauAnswer { plan?: PlanItem[]; impuls?: string; zuspruch?: string; }

const PRAXIS: { frage: string; antwort: string }[] = [
  {
    frage: "Brauche ich ein Gewerbe?",
    antwort: "Sobald du regelmäßig verkaufst, um Geld zu verdienen, meldest du in Deutschland ein Gewerbe beim Gewerbeamt deiner Stadt an — das kostet meist zwischen 20 und 60 Euro und dauert etwa eine halbe Stunde. Künstlerische Arbeit kann als freiberuflich gelten; das entscheidet das Finanzamt im Einzelfall.",
  },
  {
    frage: "Was ist die Kleinunternehmerregelung?",
    antwort: "Bleibt dein Umsatz im laufenden Jahr unter der gesetzlichen Grenze, kannst du dich als Kleinunternehmer führen lassen. Dann weist du auf deinen Rechnungen keine Umsatzsteuer aus und setzt in PAWN deinen Steuersatz auf 0 Prozent. Auf der Rechnung steht dann ein Hinweis auf diese Regelung.",
  },
  {
    frage: "Was muss auf meine Rechnung?",
    antwort: "Dein Name und deine Anschrift, Name und Anschrift der Kundin, Rechnungsnummer, Datum, Beschreibung des Stücks, Preis, Steuersatz und Steuerbetrag — oder der Hinweis auf die Kleinunternehmerregelung. PAWN erzeugt die Rechnung aus deinen Angaben unter Einstellungen.",
  },
  {
    frage: "Wie halte ich es mit der Umsatzsteuer?",
    antwort: "Trag deinen Steuersatz einmal im Studio ein — PAWN zeigt Preise dann brutto an, wie es für Privatkund·innen vorgeschrieben ist. Verkäufe ins Ausland haben eigene Regeln; frag dazu deine Steuerberatung.",
  },
  {
    frage: "Was gilt beim Widerruf?",
    antwort: "Privatkund·innen dürfen online gekaufte Stücke in der Regel 14 Tage lang zurückgeben. Maßanfertigungen sind davon oft ausgenommen. Deine Widerrufsfrist stellst du im Studio ein, PAWN zeigt sie auf jeder Produktseite.",
  },
  {
    frage: "Was muss ich beim Versand beachten?",
    antwort: "Nenne Versandkosten und Lieferzeit vor dem Kauf, verschicke möglichst mit Sendungsnummer und trag sie im Studio ein — deine Kundin wird automatisch informiert. Das senkt Rückfragen deutlich.",
  },
];

const HINWEIS = "Das ist eine allgemeine Orientierung nach bestem Wissen und ersetzt keine Rechts- oder Steuerberatung.";

export default function StudioAufbau() {
  const { designer, loading } = useMyDesigner();
  const { level } = useDesignerLevel(designer?.id);
  const journey = useBrandJourney(designer);
  const [open, setOpen] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AufbauAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const doneForRewards = useMemo(
    () => journey.allSteps.filter((s) => s.done).map((s) => ({
      key: s.key,
      title: `${s.label} — geschafft.`,
      line: s.why,
    })),
    [journey.allSteps],
  );
  const { reward, dismiss } = useStepRewards("aufbau", doneForRewards);

  useEffect(() => {
    if (!designer) return;
    let alive = true;
    setBusy(true);
    void supabase.functions.invoke("studio-ai", {
      body: {
        mode: "aufbau",
        stage: journey.currentStage?.key ?? "ankommen",
        open_steps: journey.allSteps.filter((s) => !s.done).slice(0, 4).map((s) => s.label),
      },
    }).then(({ data }) => {
      if (!alive) return;
      const d = data as AufbauAnswer | null;
      if (d && (d.plan || d.impuls)) setAnswer(d);
      setBusy(false);
    }).catch(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [designer?.id, journey.currentStage?.key]);

  const copy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Kopiert.");
    window.setTimeout(() => setCopied(null), 1500);
  };

  if (loading) return <StudioShell title="Deine Marke aufbauen"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Deine Marke aufbauen"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const pct = journey.totalCount > 0 ? journey.doneCount / journey.totalCount : 0;
  const zuspruch = answer?.zuspruch ?? encouragement(pct);

  return (
    <StudioShell title="Deine Marke aufbauen" eyebrow="Schritt für Schritt">
      <RewardToast reward={reward} onDone={dismiss} />

      {/* Kopf */}
      <section className="border-[1.5px] border-foreground bg-white p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <span className="font-serif text-5xl leading-none">{level.glyph}</span>
            <div>
              <p className="font-serif text-2xl leading-tight">{level.label}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                {journey.doneCount} von {journey.totalCount} Schritten
              </p>
            </div>
          </div>
          <p className="max-w-md font-serif text-lg italic leading-snug">{zuspruch}</p>
        </div>
        <div className="mt-6 h-[3px] w-full bg-foreground/10">
          <div className="h-full bg-foreground transition-all duration-700" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      </section>

      {/* Heute */}
      <section className="mt-6 border-[1.5px] border-foreground bg-foreground p-6 text-background md:p-8">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-background/50">Heute</p>
        {journey.nextStep ? (
          <>
            <h2 className="mt-3 font-serif text-2xl leading-tight">{journey.nextStep.label}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/75">{journey.nextStep.how}</p>
            <Link
              to={journey.nextStep.to}
              className="mt-5 inline-block border-[1.5px] border-background bg-background px-5 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-foreground hover:bg-foreground hover:text-background"
            >
              {journey.nextStep.tool} öffnen
            </Link>
          </>
        ) : (
          <h2 className="mt-3 font-serif text-2xl leading-tight">Alle Schritte stehen. Jetzt zählt Wiederholung.</h2>
        )}
        {answer?.impuls && (
          <p className="mt-6 border-t border-background/20 pt-4 text-sm leading-relaxed text-background/80">
            <span className="mr-2 text-[0.6rem] uppercase tracking-[0.24em] text-background/50">Impuls</span>
            {answer.impuls}
          </p>
        )}
      </section>

      {/* Der Weg */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">Der Weg</h2>
        <div className="mt-4 space-y-4">
          {journey.stages.map((stage, i) => (
            <StageCard key={stage.key} stage={stage} index={i + 1} />
          ))}
        </div>
      </section>

      {/* Content-Fahrplan */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">Dein Wochenplan</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Was du diese Woche zeigen kannst — abgeleitet aus deiner Arbeit. Kopieren, abwandeln, posten.
        </p>
        {busy && !answer ? (
          <div className="mt-4 h-40 animate-pulse bg-muted" />
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(answer?.plan ?? FALLBACK_PLAN).map((p) => (
              <div key={p.tag} className="border-[1.5px] border-foreground bg-white p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{p.tag}</p>
                  <p className="text-[0.6rem] uppercase tracking-[0.24em]">{p.format}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{p.idee}</p>
                <button
                  type="button"
                  onClick={() => copy(p.idee, p.tag)}
                  className="mt-4 inline-flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
                >
                  {copied === p.tag ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Kopieren
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Praxisfragen */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">Praxisfragen</h2>
        <div className="mt-4 border-[1.5px] border-foreground bg-white">
          {PRAXIS.map((q) => {
            const isOpen = open === q.frage;
            return (
              <div key={q.frage} className="border-b border-foreground/15 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.frage)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm"
                >
                  <span>{q.frage}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-foreground/75">{q.antwort}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">{HINWEIS}</p>
      </section>
    </StudioShell>
  );
}

function StageCard({ stage, index }: { stage: BrandStage; index: number }) {
  const doneCount = stage.steps.filter((s) => s.done).length;
  const [open, setOpen] = useState(!stage.done);

  return (
    <div className="border-[1.5px] border-foreground bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-foreground text-[0.6rem] tabular-nums">
            {stage.done ? "✓" : index}
          </span>
          <span>
            <span className="font-serif text-lg">{stage.title}</span>
            <span className="ml-3 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
              {doneCount}/{stage.steps.length}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t-[1.5px] border-foreground px-5 py-5">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/70">{stage.intro}</p>
          <ol className="mt-5 space-y-4">
            {stage.steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 border-l-[1.5px] border-foreground/15 pl-4">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border text-[0.55rem] ${s.done ? "border-foreground bg-foreground text-background" : "border-foreground/40"}`}>
                  {s.done ? "✓" : ""}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm ${s.done ? "text-foreground/50 line-through" : ""}`}>{s.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.why}</p>
                  {!s.done && (
                    <>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/70">{s.how}</p>
                      <Link to={s.to} className="mt-2 inline-block text-[0.6rem] uppercase tracking-[0.24em] underline decoration-1 underline-offset-4 hover:no-underline">
                        {s.tool} öffnen →
                      </Link>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const FALLBACK_PLAN: PlanItem[] = [
  { tag: "Montag", format: "Story", idee: "Zeig deinen Arbeitsplatz, so wie er heute Morgen aussieht. Ein Bild, ein Satz dazu." },
  { tag: "Mittwoch", format: "Video, 15 Sekunden", idee: "Filme eine einzige Handbewegung aus deiner Arbeit — nähen, schleifen, malen. Sprich dabei, warum du es so machst." },
  { tag: "Freitag", format: "Beitrag", idee: "Ein Stück im Detail: eine Naht, eine Kante, ein Material. Dazu ein Satz, was daran besonders ist, und der Link zu deiner PAWN-Seite." },
  { tag: "Sonntag", format: "Story", idee: "Eine Frage an deine Leute: welches der beiden Stücke sie eher tragen würden. Antworten sammeln, nächste Woche darauf antworten." },
];

function encouragement(pct: number): string {
  if (pct === 0) return "Der Anfang besteht aus einem einzigen Schritt. Der Rest folgt.";
  if (pct < 0.35) return "Du hast angefangen — das ist mehr, als die meisten tun.";
  if (pct < 0.7) return "Es wird sichtbar. Bleib dran, der Rest geht schneller.";
  if (pct < 1) return "Fast alles steht. Die letzten Schritte sind die, die verkaufen.";
  return "Dein Haus steht. Jetzt zählt, dass du regelmäßig zeigst, was du machst.";
}
