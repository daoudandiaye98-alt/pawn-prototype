import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/pawn/PortalShell";
import { RoleGate } from "@/features/access/RoleGate";
import { PawnFigur, type PawnFigurHandle } from "@/components/pawn/PawnFigur";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 37/AP2 — "Erster Zug": das alte 9-Fragen-Formular (Musik, Filme, Architektur …)
 * führte zu nichts — keine Marken-DNA, keine Seite, kein Angebot. Ersetzt durch fünf
 * Fragen, die direkt in designer_brand_dna, die erste designer_page_blocks-Seite und
 * ein Angebot für den ersten Product Shot/Video münden. PortalGate.tsx bleibt
 * unverändert: Fortschritt und Status liegen weiter in designer_onboarding_sessions.
 */

type Welt = "Mode" | "Interior" | "Kunst";
const WELTEN: Welt[] = ["Mode", "Interior", "Kunst"];

const QUESTIONS = [
  { key: "welt", kind: "choice" as const },
  { key: "stil", kind: "text" as const },
  { key: "materialien", kind: "text" as const },
  { key: "zielkundin", kind: "text" as const },
  { key: "geschichte", kind: "textarea" as const },
] as const;

interface Turn { key: string; question: string; answer: string; at: string }

function answerMap(transcript: Turn[]): Record<string, string> {
  return Object.fromEntries(transcript.map((t) => [t.key, t.answer]));
}

function OnboardingBody() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const figurRef = useRef<PawnFigurHandle>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [designerId, setDesignerId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("designer_onboarding_sessions")
        .select("id, designer_id, status, transcript")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSessionId(data.id);
        setDesignerId(data.designer_id);
        const loaded = (data.transcript as unknown as Turn[]) ?? [];
        setTranscript(loaded);
        setCurrent(Math.min(loaded.length, QUESTIONS.length - 1));
        if (data.status === "complete") setComplete(true);
        const { data: d } = await supabase.from("designers").select("brand_name").eq("id", data.designer_id).maybeSingle();
        setBrandName(d?.brand_name ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const existingAnswer = (key: string) => transcript.find((turn) => turn.key === key)?.answer ?? "";

  async function finishSynthesis(finalTranscript: Turn[]) {
    if (!designerId || !user) return;
    const answers = answerMap(finalTranscript);
    const stilTags = (answers.stil ?? "").split(/[,·]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
    const now = new Date().toISOString();

    await supabase.from("designer_brand_dna").upsert({
      designer_id: designerId,
      user_id: user.id,
      brand_dna: {
        welt: answers.welt ?? null,
        stil: stilTags,
        materialien: answers.materialien ?? null,
        zielkundin: answers.zielkundin ?? null,
        geschichte: answers.geschichte ?? null,
      },
      status: "active",
      generated_at: now,
    }, { onConflict: "designer_id" });

    // Marken-Ton lebt praktisch in designers.brand_dna (buildHouseTone in pawn-chat liest
    // von dort, nicht aus der separaten designer_brand_dna-Tabelle) — beide Orte werden
    // gefüllt, damit die Antworten sofort im Gespräch ankommen.
    const { data: designerRow } = await supabase.from("designers").select("brand_dna").eq("id", designerId).maybeSingle();
    const existingDna = (designerRow?.brand_dna as { signals?: string[] } | null) ?? {};
    const mergedSignals = Array.from(new Set([...(existingDna.signals ?? []), ...stilTags]));
    await supabase.from("designers").update({
      brand_dna: { ...existingDna, signals: mergedSignals, materialien: answers.materialien, zielkundin: answers.zielkundin, geschichte: answers.geschichte },
    }).eq("id", designerId);

    const { count } = await supabase.from("designer_page_blocks").select("id", { count: "exact", head: true }).eq("designer_id", designerId);
    if (!count) {
      await supabase.from("designer_page_blocks").insert({
        designer_id: designerId,
        kind: "editorial_text",
        position: 0,
        content: { heading: brandName ? `Über ${brandName}` : "Über dieses Haus", text: answers.geschichte ?? "" },
      });
    }

    await supabase.from("domain_events").insert({
      id: crypto.randomUUID(),
      at: now,
      type: "designer.onboarding_completed",
      actor: user.id,
      payload: { session_id: sessionId, welt: answers.welt ?? null, brand_dna_erzeugt: true, seite_erzeugt: !count },
    });
  }

  async function saveTurn() {
    if (!sessionId || !answer.trim()) return;
    setBusy(true);
    const turn: Turn = { key: QUESTIONS[current].key, question: t(`portal.onboarding.q.${QUESTIONS[current].key}`), answer: answer.trim(), at: new Date().toISOString() };
    const next = [...transcript.filter((entry) => entry.key !== turn.key), turn];
    const isLast = current === QUESTIONS.length - 1;
    const { error } = await supabase
      .from("designer_onboarding_sessions")
      .update({
        transcript: next as unknown as import("@/integrations/supabase/types").Json,
        status: isLast ? "complete" : "in_progress",
        started_at: transcript.length === 0 ? new Date().toISOString() : undefined,
        completed_at: isLast ? new Date().toISOString() : null,
      })
      .eq("id", sessionId);
    if (error) { toast.error(error.message); setBusy(false); return; }
    setTranscript(next);
    setAnswer("");
    if (isLast) {
      try {
        await finishSynthesis(next);
      } catch {
        toast.error(t("portal.onboarding.syntheseFehler"));
      }
      setComplete(true);
      figurRef.current?.celebrate();
      toast.success(t("portal.onboarding.completedToast"));
    } else {
      setCurrent(current + 1);
    }
    setBusy(false);
  }

  if (loading) return <div className="p-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;
  if (!sessionId) return <div className="p-16 text-center text-muted-foreground">{t("portal.onboarding.noSession")}</div>;

  if (complete) {
    return (
      <div className="mx-auto max-w-2xl border border-border bg-card p-12 text-center">
        <PawnFigur rank="bauer" size={96} interactive={false} showShadow={false} ariaLabel="PAWN" />
        <h2 className="mt-6 font-serif text-4xl">{t("portal.onboarding.complete.title")}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {t("portal.onboarding.complete.body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => navigate("/studio/kampagnen/neu")} className="rounded-none">
            {t("portal.onboarding.complete.ctaShot")}
          </Button>
          <Button onClick={() => navigate("/portal")} variant="outline" className="rounded-none">
            {t("portal.onboarding.complete.cta")}
          </Button>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[current];
  const progress = (current / QUESTIONS.length) * 100;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <PawnFigur ref={figurRef} rank="bauer" size={56} interactive={false} showShadow={false} ariaLabel="PAWN" />
        <div className="flex-1">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            <span>{t("portal.onboarding.progress", { current: current + 1, total: QUESTIONS.length })}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-0.5 w-full bg-secondary">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">{t("portal.onboarding.questionLabel", { n: current + 1 })}</p>
        <h2 className="mt-2 font-serif text-3xl leading-tight">{t(`portal.onboarding.q.${q.key}`)}</h2>

        {q.kind === "choice" ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {WELTEN.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setAnswer(w)}
                className={`border-[1.5px] px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.2em] transition-colors ${
                  answer === w ? "border-foreground bg-foreground text-background" : "border-border text-foreground/70 hover:border-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        ) : q.kind === "textarea" ? (
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder={t("portal.onboarding.answerPlaceholder")}
            className="mt-6 rounded-none"
          />
        ) : (
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("portal.onboarding.answerPlaceholder")}
            className="mt-6 rounded-none"
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => { if (current > 0) { setCurrent(current - 1); setAnswer(existingAnswer(QUESTIONS[current - 1].key)); } }}
            disabled={current === 0}
            className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            {t("common.back")}
          </button>
          <Button onClick={saveTurn} disabled={busy || !answer.trim()} className="rounded-none">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {current === QUESTIONS.length - 1 ? t("portal.onboarding.finish") : t("portal.onboarding.next")}
          </Button>
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="mt-8 border border-border bg-card p-6">
          <p className="editorial-eyebrow mb-3">{t("portal.onboarding.historyLabel")}</p>
          <ul className="space-y-3 text-sm">
            {transcript.map((turn) => (
              <li key={turn.key}>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{turn.question}</p>
                <p className="mt-1 text-foreground/90">{turn.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const PortalOnboarding = () => {
  const { t } = useI18n();
  return (
    <RoleGate role="designer">
      <PortalShell eyebrow={t("portal.onboarding.eyebrow")} title={t("portal.onboarding.title")}>
        <OnboardingBody />
      </PortalShell>
    </RoleGate>
  );
};

export default PortalOnboarding;
