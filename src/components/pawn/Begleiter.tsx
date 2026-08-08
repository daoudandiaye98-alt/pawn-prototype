import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/features/campaign/quota";
import { useI18n } from "@/lib/i18n";

/**
 * Erklärungstexte je Seite/Schritt — die verlässliche Basis, die immer da ist,
 * auch ohne KI. Rückfragen laufen zusätzlich über studio-ai (mode "chat"),
 * das selbst freundlich auf Textbausteine zurückfällt, wenn kein Anbieter
 * erreichbar ist. Werte hier sind i18n-Schlüssel, keine Texte selbst.
 */
const PAGE_TEXT_KEYS: Record<string, string> = {
  "/studio": "begleiter.page.studio",
  "/studio/produkte": "begleiter.page.produkte",
  "/studio/produkte/neu": "begleiter.page.produkteNeu",
  "/studio/bestellungen": "begleiter.page.bestellungen",
  "/studio/kampagnen": "begleiter.page.kampagnen",
  "/studio/mediathek": "begleiter.page.mediathek",
  "/studio/content-begleiter": "begleiter.page.contentBegleiter",
  "/studio/videothek": "begleiter.page.videothek",
  "/studio/nachrichten": "begleiter.page.nachrichten",
  "/studio/hausseite": "begleiter.page.hausseite",
  "/studio/brand": "begleiter.page.brand",
  "/studio/plan": "begleiter.page.plan",
  "/studio/auszahlung": "begleiter.page.auszahlung",
  "/studio/einstellungen": "begleiter.page.einstellungen",
};

const STEP_TEXT_KEYS: Record<string, string> = {
  "/studio/kampagnen/neu:bild-material": "begleiter.step.bildMaterial",
  "/studio/kampagnen/neu:bild-model": "begleiter.step.bildModel",
  "/studio/kampagnen/neu:bild-bewegung": "begleiter.step.bildBewegung",
  "/studio/kampagnen/neu:video-material": "begleiter.step.videoMaterial",
  "/studio/kampagnen/neu:video-model": "begleiter.step.videoModel",
  "/studio/kampagnen/neu:video-bewegung": "begleiter.step.videoBewegung",
  "/studio/kampagnen/neu:video-feinschliff": "begleiter.step.videoFeinschliff",
};

const FALLBACK_TEXT_KEY = "begleiter.fallbackText";
const FALLBACK_REPLY_KEY = "begleiter.fallbackReply";

function planLabel(plan: Plan): string {
  return plan === "maison" ? "Maison" : plan === "atelier" ? "Atelier" : "Haus";
}

interface BegleiterProps {
  pathname: string;
  step?: string;
  plan?: Plan;
  quota?: { summary: string; loading: boolean };
  /** Teil 28d: "Ein PAWN unten, nie zwei" — wenn die mobile Scroll-Begleitung
   * (PawnGuide) aktiv ist, übernimmt sie unten den Chat-Einstieg; dieser
   * Knopf tritt auf Mobil dann zurück, um nicht doppelt am unteren Rand zu stehen. */
  hideOnMobile?: boolean;
}

export function Begleiter({ pathname, step, plan, quota, hideOnMobile }: BegleiterProps) {
  const { t, locale } = useI18n();
  const [minimized, setMinimized] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const mobileHideFlex = hideOnMobile ? "hidden lg:flex" : "flex";
  const mobileHideBlock = hideOnMobile ? "hidden lg:block" : "block";

  useEffect(() => {
    const openFromGuide = () => { setMinimized(false); setAsking(true); };
    window.addEventListener("studio:open-begleiter", openFromGuide);
    return () => window.removeEventListener("studio:open-begleiter", openFromGuide);
  }, []);

  const stepKey = step ? `${pathname}:${step}` : null;
  const textKey = (stepKey && STEP_TEXT_KEYS[stepKey]) || PAGE_TEXT_KEYS[pathname] || FALLBACK_TEXT_KEY;
  const text = t(textKey);

  // Neuer Kontext (Seite oder Schritt gewechselt) → Rückfrage-Zustand zurücksetzen, Sprechblase bleibt offen.
  useEffect(() => {
    const nextKey = stepKey ?? pathname;
    if (key.current !== nextKey) {
      key.current = nextKey;
      setAnswer(null);
      setQuestion("");
      setAsking(false);
    }
  }, [pathname, stepKey]);

  const ask = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const contextBits = [
        `Seite ${pathname}`,
        step ? `Schritt ${step}` : null,
        plan ? `${planLabel(plan)}-Plan` : null,
        quota && !quota.loading ? quota.summary : null,
      ].filter(Boolean).join(", ");
      const { data, error } = await supabase.functions.invoke("studio-ai", {
        body: { mode: "chat", messages: [{ role: "user", content: `[Kontext: ${contextBits}] ${question.trim()}` }], locale },
      });
      if (error) throw error;
      setAnswer(typeof data?.reply === "string" && data.reply ? data.reply : t(FALLBACK_REPLY_KEY));
    } catch {
      setAnswer(t(FALLBACK_REPLY_KEY));
    } finally {
      setBusy(false);
    }
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label={t("begleiter.openAria")}
        className={`fixed bottom-5 right-5 z-30 ${mobileHideFlex} h-11 w-11 items-center justify-center border border-foreground bg-foreground text-background hover:bg-foreground/90`}
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-5 right-5 z-30 w-[calc(100vw-2.5rem)] max-w-xs ${mobileHideBlock}`}>
      <div className="border border-foreground bg-white p-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-foreground font-serif text-[0.7rem]">♟</span>
            <p className="text-[0.85rem] leading-relaxed">{answer ?? text}</p>
          </div>
          <button type="button" onClick={() => setMinimized(true)} aria-label={t("begleiter.minimizeAria")} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {asking ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder={t("begleiter.inputPlaceholder")}
              className="min-h-[36px] flex-1 border border-border bg-white p-2 text-sm focus:outline-none focus:border-foreground"
            />
            <button
              type="button"
              onClick={ask}
              disabled={busy || !question.trim()}
              aria-label={t("begleiter.sendAria")}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-foreground bg-foreground text-background disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="mt-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground underline hover:text-foreground"
          >
            {t("begleiter.askButton")}
          </button>
        )}
      </div>
    </div>
  );
}
