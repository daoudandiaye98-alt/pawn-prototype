import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PortalShell } from "@/components/pawn/PortalShell";
import { RoleGate } from "@/features/access/RoleGate";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Structured AI onboarding interview.
 * Persists each answer to designer_onboarding_sessions.transcript.
 * When complete, sets status='complete' and unlocks the Studio.
 *
 * Downstream synthesis of Brand DNA (edge function) is a follow-up.
 */

const QUESTIONS = [
  { key: "purpose", q: "Wofür steht deine Marke? In einem Satz." },
  { key: "emotion", q: "Welche Emotion soll deine Kollektion beim Träger auslösen?" },
  { key: "inspiration", q: "Welche Designer oder Bewegungen inspirieren dich?" },
  { key: "audience", q: "Welche Zielgruppe möchtest du erreichen?" },
  { key: "forbidden_colors", q: "Welche Farben würdest du NIEMALS benutzen?" },
  { key: "materials", q: "Welche Materialien definieren deine Identität?" },
  { key: "music", q: "Welche Musik passt zu deiner Marke?" },
  { key: "films", q: "Welche Filme beschreiben deine Welt?" },
  { key: "architecture", q: "Welche Architektur beschreibt deine Ästhetik?" },
] as const;

interface Turn { key: string; question: string; answer: string; at: string; }

function OnboardingBody() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
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
        .select("id, status, transcript")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSessionId(data.id);
        const loadedTranscript = (data.transcript as unknown as Turn[]) ?? [];
        setTranscript(loadedTranscript);
        setCurrent(Math.min(loadedTranscript.length, QUESTIONS.length - 1));
        if (data.status === "complete") setComplete(true);
      }
      setLoading(false);
    })();
  }, [user]);

  async function saveTurn() {
    if (!sessionId || !answer.trim()) return;
    setBusy(true);
    const turn: Turn = {
      key: QUESTIONS[current].key,
      question: QUESTIONS[current].q,
      answer: answer.trim(),
      at: new Date().toISOString(),
    };
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
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setTranscript(next);
    setAnswer("");
    if (isLast) {
      setComplete(true);
      await supabase.from("domain_events").insert({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        type: "designer.onboarding_completed",
        actor: user!.id,
        payload: { session_id: sessionId },
      });
      toast.success(t("portal.onboarding.completedToast"));
    } else {
      setCurrent(current + 1);
    }
  }

  if (loading) return <div className="p-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;
  if (!sessionId) return <div className="p-16 text-center text-muted-foreground">{t("portal.onboarding.noSession")}</div>;

  if (complete) {
    return (
      <div className="mx-auto max-w-2xl border border-border bg-card p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-accent text-accent">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="mt-6 font-serif text-4xl">{t("portal.onboarding.complete.title")}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {t("portal.onboarding.complete.body")}
        </p>
        <Button onClick={() => navigate("/portal")} className="mt-8 rounded-none">{t("portal.onboarding.complete.cta")}</Button>
      </div>
    );
  }

  const q = QUESTIONS[current];
  const progress = ((current) / QUESTIONS.length) * 100;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          <span>{t("portal.onboarding.progress", { current: current + 1, total: QUESTIONS.length })}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="mt-2 h-0.5 w-full bg-secondary">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">{t("portal.onboarding.questionLabel", { n: current + 1 })}</p>
        <h2 className="mt-2 font-serif text-3xl leading-tight">{t(`portal.onboarding.q.${q.key}`)}</h2>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          placeholder={t("portal.onboarding.answerPlaceholder")}
          className="mt-6 rounded-none"
        />
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => { if (current > 0) { setCurrent(current - 1); setAnswer(transcript.find((turn) => turn.key === QUESTIONS[current - 1].key)?.answer ?? ""); } }}
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
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{t(`portal.onboarding.q.${turn.key}`)}</p>
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
