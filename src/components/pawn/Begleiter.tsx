import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/features/campaign/quota";

/**
 * Erklärungstexte je Seite/Schritt — die verlässliche Basis, die immer da ist,
 * auch ohne KI. Rückfragen laufen zusätzlich über studio-ai (mode "chat"),
 * das selbst freundlich auf Textbausteine zurückfällt, wenn kein Anbieter
 * erreichbar ist.
 */
const PAGE_TEXTS: Record<string, string> = {
  "/studio": "Hier siehst du, was gerade wartet — Bestellungen, Nachrichten, ein möglicher nächster Zug.",
  "/studio/produkte": "Deine Stücke. Neu anlegen, bearbeiten, veröffentlichen — nichts geht ohne deinen Schalter live.",
  "/studio/bestellungen": "Deine Verkäufe laufen hier ein. Bestätige den Versand, sobald das Paket raus ist.",
  "/studio/kampagnen": "Bisherige Kampagnen und Editionen-Vorschläge. Neue entstehen im Kampagnen-Studio.",
  "/studio/videothek": "Alle fertigen Videos zum Herunterladen, inklusive Vorschlag für Caption und Hashtags.",
  "/studio/nachrichten": "Fragen von Kund·innen zu Bestellungen oder Stücken.",
  "/studio/brand": "Deine öffentliche Seite — Story, Zitat, Kollektionstitel, Bilder.",
  "/studio/plan": "Dein monatliches Credit-Guthaben und was jede Handlung kostet.",
  "/studio/auszahlung": "Dein Stripe-Konto. Ohne aktive Verbindung kannst du nicht verkaufen.",
  "/studio/einstellungen": "Zugang, Zahlungsdaten, Sprache — alles an einem Ort.",
};

const STEP_TEXTS: Record<string, string> = {
  "/studio/kampagnen/neu:bild-1": "Ein Stück aus der Kollektion — oder ein eigenes Bild hochladen. Freisteller setzt es auf neutralen Hintergrund, in 10–25 Sekunden, für den Preis, der am Knopf steht.",
  "/studio/kampagnen/neu:bild-2": "Kein Model, ein beschriebenes oder ein gespeichertes Haus-Model — ganz wie du magst.",
  "/studio/kampagnen/neu:bild-3": "Ein Satz genügt. Je genauer, desto passender der Vorschlag.",
  "/studio/kampagnen/neu:video-1": "Ein Foto genügt, mehr Fotos ergeben ein reicheres Ergebnis. Freisteller setzt es auf neutralen Hintergrund, in 10–25 Sekunden, für den Preis, der am Knopf steht.",
  "/studio/kampagnen/neu:video-2": "Model, Ort und Bewegung sind optional — sie schreiben dir einen Vorschlag für den Text.",
  "/studio/kampagnen/neu:video-3": "PAWN schickt jedes Foto an einen externen Dienst und wartet auf das Ergebnis — meist 1–2 Minuten. Schlägt ein Clip fehl, bleibt das Foto als ruhige Einstellung stehen, ohne Credits abzuziehen.",
  "/studio/kampagnen/neu:video-4": "PAWN nimmt jetzt rohe Aufnahmen auf — unabhängig vom fertigen Schnitt.",
  "/studio/kampagnen/neu:video-5": "Der Schnitt setzt die Aufnahmen komplett auf deinem Gerät zusammen — kostet keine Credits. Ohne Intro/Abspann bekommst du die reinen Aufnahmen aneinandergereiht.",
};

const FALLBACK_TEXT = "Frag mich, wenn etwas unklar ist.";
const FALLBACK_REPLY = "Das beantworte ich gerade nicht sicher — frag es gern nochmal im Copilot, dort helfe ich ausführlicher.";

function planLabel(plan: Plan): string {
  return plan === "maison" ? "Maison" : plan === "atelier" ? "Atelier" : "Haus";
}

interface BegleiterProps {
  pathname: string;
  step?: string;
  plan?: Plan;
  credits?: { balance: number; grant: number; loading: boolean };
}

export function Begleiter({ pathname, step, plan, credits }: BegleiterProps) {
  const [minimized, setMinimized] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const stepKey = step ? `${pathname}:${step}` : null;
  const text = (stepKey && STEP_TEXTS[stepKey]) || PAGE_TEXTS[pathname] || FALLBACK_TEXT;

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
        credits && !credits.loading ? `${credits.balance}/${credits.grant} Credits` : null,
      ].filter(Boolean).join(", ");
      const { data, error } = await supabase.functions.invoke("studio-ai", {
        body: { mode: "chat", messages: [{ role: "user", content: `[Kontext: ${contextBits}] ${question.trim()}` }] },
      });
      if (error) throw error;
      setAnswer(typeof data?.reply === "string" && data.reply ? data.reply : FALLBACK_REPLY);
    } catch {
      setAnswer(FALLBACK_REPLY);
    } finally {
      setBusy(false);
    }
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Begleiter öffnen"
        className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center border border-foreground bg-foreground text-background hover:bg-foreground/90"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 w-[calc(100vw-2.5rem)] max-w-xs">
      <div className="border border-foreground bg-white p-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-foreground font-serif text-[0.7rem]">♟</span>
            <p className="text-[0.85rem] leading-relaxed">{answer ?? text}</p>
          </div>
          <button type="button" onClick={() => setMinimized(true)} aria-label="Begleiter minimieren" className="shrink-0 text-muted-foreground hover:text-foreground">
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
              placeholder="Deine Rückfrage…"
              className="min-h-[36px] flex-1 border border-border bg-white p-2 text-sm focus:outline-none focus:border-foreground"
            />
            <button
              type="button"
              onClick={ask}
              disabled={busy || !question.trim()}
              aria-label="Rückfrage senden"
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
            Rückfrage stellen
          </button>
        )}
      </div>
    </div>
  );
}
