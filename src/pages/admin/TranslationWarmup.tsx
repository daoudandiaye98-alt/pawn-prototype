import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Wärmt die englische Fassung vor: lädt die wichtigsten Seiten unsichtbar in einem
 * Rahmen, während die Oberfläche auf Englisch steht. Die automatische Übersetzungs-
 * schicht sammelt dabei jeden deutschen Satz und legt ihn ins Gedächtnis —
 * Besucher:innen sehen später sofort Englisch, ohne Wartezeit.
 */
const ROUTES = [
  "/", "/shop", "/mode", "/interior", "/kunst", "/designers", "/dna",
  "/cart", "/auth", "/apply", "/kontakt", "/versand", "/presse",
  "/agb", "/datenschutz", "/impressum", "/widerruf",
];

export function TranslationWarmup() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);

  async function run() {
    setBusy(true);
    setDone(0);
    const previous = localStorage.getItem("pawn.locale");
    localStorage.setItem("pawn.locale", "en");
    try {
      for (const route of ROUTES) {
        if (frame.current) frame.current.src = route;
        await new Promise((r) => setTimeout(r, 4000));
        setDone((d) => d + 1);
      }
      toast.success("Englische Fassung vorgewärmt.");
    } catch {
      toast.error("Vorwärmen abgebrochen.");
    } finally {
      if (previous) localStorage.setItem("pawn.locale", previous);
      if (frame.current) frame.current.src = "about:blank";
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        title="Lädt die wichtigsten Seiten einmal auf Englisch, damit alle Texte übersetzt im Gedächtnis liegen."
        className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        <Sparkles className="h-3 w-3" />
        {busy ? `Vorwärmen ${done}/${ROUTES.length}` : "Englisch vorwärmen"}
      </button>
      <iframe
        ref={frame}
        title="Übersetzungs-Vorwärmung"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none fixed left-[-9999px] top-0 h-[900px] w-[1200px] opacity-0"
      />
    </>
  );
}
