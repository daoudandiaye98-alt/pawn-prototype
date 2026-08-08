import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PawnFigur, type PawnFigurHandle, type PawnRank } from "./PawnFigur";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 28b — "Die erste Partie": das Onboarding als Gespräch statt Formular.
 * Steuerung liegt komplett in pawn-chat (mode: "erste_partie") — diese Komponente zeigt
 * nur, was der Server gerade sagt, und schickt Entscheidungen zurück. Unterbrechbar über
 * "Später" (schließt einfach, der Server-Zustand bleibt stehen und wartet).
 */

interface Option { key: string; label: string }
interface AutomatikAngebot { key: string; frage: string }
type Schritt = "schwerpunkte" | "automatik" | "fertig";

interface ErstePartieResponse {
  ok: boolean;
  schritt?: Schritt;
  reply?: string;
  optionen?: Option[];
  automatik_angebot?: AutomatikAngebot | null;
  celebrate?: boolean;
  error?: string;
}

export function ErstePartie({ rank, onClose, onDone }: { rank: PawnRank; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const figurRef = useRef<PawnFigurHandle>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [schritt, setSchritt] = useState<Schritt | null>(null);
  const [optionen, setOptionen] = useState<Option[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [automatik, setAutomatik] = useState<AutomatikAngebot | null>(null);
  const [failed, setFailed] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    setLoading(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", { body: { mode: "erste_partie", ...body } });
      const r = (data ?? {}) as ErstePartieResponse;
      if (error || !r.ok) { setFailed(true); setLoading(false); return; }
      setReply(r.reply ?? "");
      setSchritt(r.schritt ?? null);
      setOptionen(r.optionen ?? []);
      setGewaehlt(new Set((r.optionen ?? []).map((o) => o.key)));
      setAutomatik(r.automatik_angebot ?? null);
      if (r.celebrate) setTimeout(() => figurRef.current?.celebrate(), 200);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void call({ partie_aktion: "start" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (key: string) => {
    setGewaehlt((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-foreground px-6 text-center text-background" role="dialog" aria-label={t("studio.erstePartie.title")}>
      <button type="button" onClick={onClose} className="absolute right-5 top-5 text-[0.62rem] uppercase tracking-[0.28em] text-background/60 hover:text-background">
        {t("studio.erstePartie.spaeter")}
      </button>

      <PawnFigur ref={figurRef} rank={rank} size={140} interactive={false} showShadow={false} ariaLabel="PAWN" />

      <div className="max-w-lg">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-background/60">{t("studio.erstePartie.title")}</p>
        {failed ? (
          <p className="mt-4 font-serif text-xl leading-relaxed sm:text-2xl">{t("studio.erstePartie.fehler")}</p>
        ) : loading && !reply ? (
          <p className="mt-4 font-serif text-xl leading-relaxed text-background/70 sm:text-2xl">{t("studio.erstePartie.denkt")}</p>
        ) : (
          <p className="mt-4 font-serif text-xl leading-relaxed sm:text-2xl">{reply}</p>
        )}

        {!failed && !loading && schritt === "schwerpunkte" && optionen.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {optionen.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => toggle(o.key)}
                  className={`border-[1.5px] px-4 py-2 text-[0.68rem] uppercase tracking-[0.2em] transition-colors ${
                    gewaehlt.has(o.key) ? "border-background bg-background text-foreground" : "border-background/40 text-background/70 hover:border-background"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void call({ partie_aktion: "schwerpunkte_bestaetigen", schwerpunkte_gewaehlt: Array.from(gewaehlt) })}
              disabled={gewaehlt.size === 0}
              className="border-[1.5px] border-background px-6 py-2.5 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-background hover:text-foreground disabled:opacity-40"
            >
              {t("studio.erstePartie.losGehts")}
            </button>
          </div>
        )}

        {!failed && !loading && schritt === "automatik" && automatik && (
          <div className="mt-8 flex justify-center gap-3">
            <button type="button" onClick={() => void call({ partie_aktion: "automatik_antworten", automatik_zustimmung: true })}
              className="border-[1.5px] border-background px-6 py-2.5 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-background hover:text-foreground">
              {t("studio.erstePartie.ja")}
            </button>
            <button type="button" onClick={() => void call({ partie_aktion: "automatik_antworten", automatik_zustimmung: false })}
              className="border-[1.5px] border-background/40 px-6 py-2.5 text-[0.62rem] uppercase tracking-[0.28em] text-background/70 hover:border-background hover:text-background">
              {t("studio.erstePartie.nein")}
            </button>
          </div>
        )}

        {(failed || (!loading && schritt === "fertig")) && (
          <button type="button" onClick={onDone} className="mt-8 border-[1.5px] border-background px-6 py-2.5 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-background hover:text-foreground">
            {t("studio.erstePartie.zurUebersicht")}
          </button>
        )}
      </div>
    </div>
  );
}
