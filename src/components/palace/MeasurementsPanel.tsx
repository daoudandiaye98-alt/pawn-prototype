/**
 * „Dein Maßband" — Körpermaße hinterlegen. Grundlage des Passform-Assistenten.
 * Wird im Konto und auf der DNA-Seite eingebunden.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useMyMeasurements } from "@/features/fit/useMyMeasurements";
import { BODY_FIELDS, FIT_PREFERENCES, emptyBody, hasAnyBodyValue, type BodyMeasurements, type FitPreference } from "@/features/fit/measurements";

type Draft = Record<string, string>;

const toDraft = (b: BodyMeasurements | null): Draft => {
  const d: Draft = {};
  for (const f of BODY_FIELDS) d[f.key] = b?.[f.key] != null ? String(b[f.key]) : "";
  return d;
};

export function MeasurementsPanel({ className }: { className?: string }) {
  const { body, loading, save, clear, signedIn } = useMyMeasurements();
  const [draft, setDraft] = useState<Draft>(toDraft(null));
  const [pref, setPref] = useState<FitPreference>("gerade");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(toDraft(body));
    setPref(body?.fit_preference ?? "gerade");
  }, [body]);

  if (!signedIn) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const next: BodyMeasurements = { ...emptyBody(), fit_preference: pref };
      for (const f of BODY_FIELDS) {
        const raw = (draft[f.key] ?? "").replace(",", ".").trim();
        const n = Number(raw);
        next[f.key] = raw !== "" && Number.isFinite(n) && n > 0 && n < 300 ? n : null;
      }
      await save(next);
      toast.success("Maße gespeichert — PAWN sagt dir ab jetzt, was passt.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await clear();
      setDraft(toDraft(null));
      setPref("gerade");
      toast.success("Maße gelöscht.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className ?? "border-[1.5px] border-black bg-white p-6 md:p-8"}>
      <p className="editorial-eyebrow text-black/60">Dein Maßband</p>
      <h2 className="mt-1 font-serif text-2xl leading-tight text-black">Was dir wirklich passt.</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-black/70">
        Größe M heißt bei jedem Haus etwas anderes. Trag deine Maße einmal ein — dann steht auf jeder
        Artikelseite, welche Größe dir wirklich passt. Die Angaben sieht nur du, kein Haus, niemand sonst.
      </p>

      {loading ? (
        <div className="mt-6 h-24 animate-pulse bg-black/5" />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {BODY_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.24em] text-black/60">{f.label} (cm)</span>
                <input
                  inputMode="decimal"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder="—"
                  className="mt-1 w-full border border-black/20 bg-white p-3 text-sm focus:border-black focus:outline-none"
                />
                <span className="mt-1 block text-xs text-black/45">{f.hint}</span>
              </label>
            ))}
          </div>

          <p className="mt-8 text-[0.62rem] uppercase tracking-[0.24em] text-black/60">Wie trägst du am liebsten?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FIT_PREFERENCES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPref(p.key)}
                className={`min-h-[40px] border px-4 py-2 text-sm ${pref === p.key ? "border-black bg-black text-white" : "border-black/20 hover:border-black"}`}
              >
                {p.label} <span className={pref === p.key ? "opacity-70" : "text-black/45"}>· {p.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="min-h-[44px] border-[1.5px] border-black bg-black px-5 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-white disabled:opacity-40"
            >
              {busy ? "Speichert…" : "Maße speichern"}
            </button>
            {hasAnyBodyValue(body) && (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="text-[0.62rem] uppercase tracking-[0.24em] text-black/60 underline underline-offset-4 hover:text-black"
              >
                Maße löschen
              </button>
            )}
            <Link to="/shop" className="text-[0.62rem] uppercase tracking-[0.24em] text-black/60 underline underline-offset-4 hover:text-black">
              Passende Stücke ansehen →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
