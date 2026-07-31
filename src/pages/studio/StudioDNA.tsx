/**
 * Teil 20b — Das Außenauge: ersetzt das Werkbuch (Teil 19a). Statt Balken/Prozentringen
 * schreibt PAWN in Prosa, wie die Arbeit des Hauses von außen ankommt, im Vergleich zur
 * eigenen Beschreibung — mit Beleg aus echtem Verhalten. Die Entwicklung (Verlauf) und
 * die Korrektur (DNA neu lesen bei Widerspruch) bleiben aus Teil 19a bestehen.
 */
import { useEffect, useMemo, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrandDna {
  worlds?: Record<string, number>;
  signals?: string[];
  distilled_at?: string;
  history?: { at: string; worlds: Record<string, number>; signals: string[]; reason: string }[];
}
interface ThemeRow { id: string; version: number; name: string | null; quelle: string; is_current: boolean; created_at: string; }
interface Beleg { text: string; beleg: string }
interface AussenaugeResult {
  ok: boolean;
  fruehzustand: { erreicht: boolean; stuecke: number; ziel_stuecke: number; hat_aufrufe: boolean };
  urteil?: string;
  belege?: Beleg[];
  blinder_fleck?: Beleg;
  naechster_schritt?: { text: string; begruendung?: string };
  generated_at?: string;
  error?: string;
  message?: string;
}

const QUELLE_LABEL: Record<string, string> = {
  dna_destilliert: "aus deiner DNA",
  designer_beschrieben: "von dir beschrieben",
  manuell_verfeinert: "von Hand verfeinert",
};

export default function StudioDNA() {
  const { designer, loading, refresh } = useMyDesigner();
  const [busy, setBusy] = useState(false);
  const [correction, setCorrection] = useState("");
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [aussenauge, setAussenauge] = useState<AussenaugeResult | null>(null);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("house_themes" as never).select("id, version, name, quelle, is_current, created_at")
      .eq("designer_id", designer.id).order("version", { ascending: false })
      .then(({ data }) => setThemes((data ?? []) as unknown as ThemeRow[]));
  }, [designer]);

  useEffect(() => {
    const cached = designer?.aussenauge as unknown as AussenaugeResult | undefined;
    setAussenauge(cached && Object.keys(cached).length > 0 ? cached : null);
  }, [designer]);

  const dna = (designer?.brand_dna ?? {}) as BrandDna;

  const einschaetzen = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dna-voice", { body: { mode: "designer" } });
      if (error) throw error;
      const r = data as AussenaugeResult;
      if (!r.ok) { toast.error(r.message ?? r.error ?? "Konnte noch keine Einschätzung schreiben."); return; }
      setAussenauge(r);
      if (r.fruehzustand?.erreicht && r.urteil) toast.success("Neu eingeschätzt.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const distill = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("distill-brand-dna", { body: { correction: correction.trim() } });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string; message?: string };
      if (!r.ok) { toast.error(r.message ?? r.error ?? "DNA konnte nicht korrigiert werden."); return; }
      toast.success("DNA korrigiert.");
      setCorrection("");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const timeline = useMemo(() => {
    const history = dna.history ?? [];
    const entries: { at: string; label: string }[] = history.map((h) => ({
      at: h.at,
      label: `DNA-${h.reason === "Korrektur" ? "Korrektur" : "Neu-Destillation"} — davor: ${(h.signals ?? []).slice(0, 3).join(", ") || "—"}`,
    }));
    for (const t of themes) {
      entries.push({ at: t.created_at, label: `Haus-Thema Version ${t.version}${t.name ? ` „${t.name}"` : ""} (${QUELLE_LABEL[t.quelle] ?? t.quelle})` });
    }
    if (history.length === 0 && dna.distilled_at) entries.push({ at: dna.distilled_at, label: "DNA zum ersten Mal destilliert" });
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12);
  }, [dna, themes]);

  if (loading) return <StudioShell title="Außenauge"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Außenauge"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const fz = aussenauge?.fruehzustand;
  const hasContent = fz?.erreicht && aussenauge?.urteil;

  return (
    <StudioShell title="Außenauge" eyebrow="Wie eure Arbeit ankommt">
      <section className="border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Das Urteil</p>

        {!hasContent ? (
          <div className="mt-4">
            {fz && !fz.erreicht ? (
              <p className="text-sm text-black/70">
                {fz.stuecke < fz.ziel_stuecke
                  ? `Noch zu früh — erst ${fz.stuecke} von ${fz.ziel_stuecke} veröffentlichten Stücken. Lieber schweigen als falsch liegen.`
                  : "Noch keine Aufrufe auf euren Stücken — sobald Besucher:innen da waren, lässt sich etwas sagen."}
              </p>
            ) : (
              <p className="text-sm text-black/70">Genug gesehen, um zu sagen, wie eure Arbeit von außen ankommt.</p>
            )}
            <button type="button" onClick={() => void einschaetzen()} disabled={busy || (fz ? !fz.erreicht : false)}
              className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-40">
              {busy ? "…" : "Einschätzung anfordern"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            <h2 className="font-serif text-2xl leading-tight text-black">{aussenauge.urteil}</h2>

            {(aussenauge.belege?.length ?? 0) > 0 && (
              <div className="border-t border-black/15 pt-4">
                <p className="editorial-eyebrow text-black/50">Woran wir das sehen</p>
                <ul className="mt-2 space-y-2">
                  {aussenauge.belege!.map((b, i) => (
                    <li key={i} className="text-sm text-black/85">{b.text} <span className="text-black/50">— {b.beleg}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {aussenauge.blinder_fleck && (
              <div className="border-t border-black/15 pt-4">
                <p className="editorial-eyebrow text-black/50">Der blinde Fleck</p>
                <p className="mt-2 text-sm text-black/85">{aussenauge.blinder_fleck.text} <span className="text-black/50">— {aussenauge.blinder_fleck.beleg}</span></p>
              </div>
            )}

            {aussenauge.naechster_schritt && (
              <div className="border-t border-black/15 pt-4">
                <p className="editorial-eyebrow text-black/50">Was du dich trauen solltest</p>
                <p className="mt-2 text-sm text-black/85">{aussenauge.naechster_schritt.text}</p>
                {aussenauge.naechster_schritt.begruendung && <p className="mt-1 text-xs text-black/50">{aussenauge.naechster_schritt.begruendung}</p>}
              </div>
            )}

            <div className="border-t border-black/15 pt-4">
              <button type="button" onClick={() => void einschaetzen()} disabled={busy}
                className="editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline disabled:opacity-40">
                {busy ? "…" : "Neu einschätzen →"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Die Entwicklung</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-black">Wie sie sich verändert hat</h2>

        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-black/60">Noch kein Verlauf — er entsteht, sobald sich eure DNA oder euer Thema weiterentwickelt.</p>
        ) : (
          <ol className="mt-6 space-y-4 border-l-[1.5px] border-black/20 pl-5">
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.44rem] top-1 h-2 w-2 border-[1.5px] border-black bg-white" />
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-black/40">
                  {new Date(e.at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                <p className="mt-0.5 text-sm text-black">{e.label}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8 border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Korrektur</p>
        <p className="mt-2 max-w-2xl text-sm text-black/70">Trifft eine Aussage nicht zu? Widersprich in eigenen Worten — wir lesen eure DNA daraufhin neu.</p>
        <textarea value={correction} onChange={(e) => setCorrection(e.target.value)}
          placeholder="Das stimmt nicht ganz, wir sind eher…"
          className="mt-3 w-full min-h-24 border border-border bg-background p-3 text-sm" />
        <button type="button" onClick={() => void distill()} disabled={busy || !correction.trim()}
          className="mt-2 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-40">
          {busy ? "…" : "DNA korrigieren"}
        </button>
      </section>
    </StudioShell>
  );
}
