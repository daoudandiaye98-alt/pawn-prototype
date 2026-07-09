/**
 * "So funktioniert's" — einklappbare Erklärzeile für jeden Studio-Bereich.
 * 2-3 Sätze Klartext + max. 3 Mini-Schritte. Nach "Verstanden" merkt localStorage
 * die Entscheidung. Über den Copilot jederzeit wieder aufrufbar.
 */
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

interface Props {
  storageKey: string;      // z.B. "howto:orders"
  title: string;           // z.B. "Bestellungen"
  intro: string;           // 2-3 Sätze Klartext
  steps: string[];         // max 3 kurze Schritte
  defaultOpen?: boolean;
}

export function HowItWorks({ storageKey, title, intro, steps, defaultOpen = false }: Props) {
  const key = `pawn.howto.${storageKey}.dismissed`;
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, [key]);

  if (dismissed && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-3 w-3" /> Wie funktioniert {title}?
      </button>
    );
  }

  return (
    <section className="mb-6 border-[1.5px] border-foreground bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-3"
      >
        <span className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em]">
          <HelpCircle className="h-3.5 w-3.5" /> So funktioniert {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t-[1.5px] border-foreground px-5 py-5">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/80">{intro}</p>
          {steps.length > 0 && (
            <ol className="mt-4 space-y-1.5 text-sm">
              {steps.slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-foreground text-[0.55rem] tabular-nums">{i + 1}</span>
                  <span className="text-foreground/80">{s}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.localStorage.setItem(key, "1");
                setDismissed(true);
                setOpen(false);
              }}
              className="border-[1.5px] border-foreground bg-foreground px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-background hover:bg-background hover:text-foreground"
            >
              Verstanden
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground"
            >
              Später
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
