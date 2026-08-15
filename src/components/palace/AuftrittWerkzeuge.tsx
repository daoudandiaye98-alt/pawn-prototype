/**
 * Teil U1.5 — die eine Bedienfläche des Auftritt-Modus.
 *
 * Genau eine Leiste, unten fixiert:  [ + Baustein ]   Zustandssatz   [ Fertig ]
 * Dazu drei Griffe an der Kante jedes Bausteins: Verschieben · Verdoppeln · Löschen.
 *
 * „+ Baustein" öffnet die acht bestehenden Arten als Bildkacheln mit Miniatur-Schema —
 * keine Textliste. Die Schemata sind reine Flächen (schwarz auf weiß, keine Rundung),
 * kein einziges Bild wird geladen.
 *
 * Farben kommen aus `--house-fg` / `--house-bg`, damit die Werkzeuge in der Farbwelt
 * des Hauses stehen statt daneben.
 */
import { useEscape } from "@/components/palace/Bildwand";
import type { PageBlockKind } from "@/components/palace/HausseiteBlocks";

const FLAECHE = { borderColor: "var(--house-fg, #000)", background: "var(--house-bg, #fff)", color: "var(--house-fg, #000)" };
const UMGEKEHRT = { borderColor: "var(--house-fg, #000)", background: "var(--house-fg, #000)", color: "var(--house-bg, #fff)" };

export const BAUSTEIN_NAME: Record<PageBlockKind, string> = {
  auftakt: "Auftakt",
  editorial_text: "Text",
  zitat: "Zitat",
  produktreihe: "Produktreihe",
  lookbook_streifen: "Lookbook-Streifen",
  banner_seitlich: "Bild seitlich",
  banner_vollbreite: "Bild vollbreit",
  ueberlappend: "Überlappend",
};

function Schema({ kind }: { kind: PageBlockKind }) {
  const rahmen = "relative block h-14 w-full overflow-hidden border-[1.5px]";
  const inhalt: Record<PageBlockKind, React.ReactNode> = {
    auftakt: <span className="absolute inset-1 block" style={{ background: "var(--house-fg, #000)" }} />,
    editorial_text: (
      <>
        <span className="absolute left-[12%] top-[26%] block h-[6px] w-[52%]" style={{ background: "var(--house-fg, #000)" }} />
        <span className="absolute left-[12%] top-[52%] block h-[2px] w-[76%]" style={{ background: "var(--house-fg, #000)", opacity: 0.6 }} />
        <span className="absolute left-[12%] top-[68%] block h-[2px] w-[64%]" style={{ background: "var(--house-fg, #000)", opacity: 0.6 }} />
      </>
    ),
    zitat: (
      <>
        <span className="absolute left-[22%] top-[34%] block h-[4px] w-[56%]" style={{ background: "var(--house-fg, #000)" }} />
        <span className="absolute left-[32%] top-[56%] block h-[4px] w-[36%]" style={{ background: "var(--house-fg, #000)" }} />
      </>
    ),
    produktreihe: (
      <>
        {[6, 30, 54, 78].map((l) => (
          <span key={l} className="absolute top-[18%] block h-[64%] w-[16%]" style={{ left: `${l}%`, background: "var(--house-fg, #000)" }} />
        ))}
      </>
    ),
    lookbook_streifen: (
      <>
        {[4, 34, 64, 94].map((l) => (
          <span key={l} className="absolute top-[10%] block h-[80%] w-[26%]" style={{ left: `${l}%`, background: "var(--house-fg, #000)" }} />
        ))}
      </>
    ),
    banner_seitlich: <span className="absolute bottom-[10%] left-[8%] top-[10%] block w-[34%]" style={{ background: "var(--house-fg, #000)" }} />,
    banner_vollbreite: <span className="absolute inset-x-1 top-[34%] block h-[32%]" style={{ background: "var(--house-fg, #000)" }} />,
    ueberlappend: (
      <>
        <span className="absolute bottom-[24%] left-[10%] top-[12%] block w-[46%]" style={{ background: "var(--house-fg, #000)" }} />
        <span className="absolute bottom-[10%] right-[12%] top-[36%] block w-[36%]"
          style={{ background: "var(--house-fg, #000)", boxShadow: "0 0 0 2px var(--house-bg, #fff)" }} />
      </>
    ),
  };
  return <span className={rahmen} style={FLAECHE}>{inhalt[kind]}</span>;
}

export function BausteinWahl({ arten, onWahl, onSchliessen }: {
  arten: PageBlockKind[];
  onWahl: (kind: PageBlockKind) => void;
  onSchliessen: () => void;
}) {
  useEscape(true, onSchliessen);
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label="Baustein wählen">
      <button type="button" aria-label="Schließen" onClick={onSchliessen}
        className="absolute inset-0 h-full w-full" style={{ background: "var(--house-fg, #000)", opacity: 0.25 }} />
      <div className="bildblatt absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto border-t-[1.5px] p-5 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:border-l-[1.5px] md:border-t-0"
        style={FLAECHE}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="palace-eyebrow">Baustein wählen</p>
          <button type="button" onClick={onSchliessen}
            className="min-h-[36px] border-[1.5px] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em]" style={FLAECHE}>
            Zurück
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {arten.map((k) => (
            <button key={k} type="button" onClick={() => onWahl(k)} className="block text-left">
              <Schema kind={k} />
              <span className="palace-eyebrow mt-2 block">{BAUSTEIN_NAME[k]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Die drei Griffe an der Kante eines Bausteins. */
export function BausteinGriffe({ ziehGriff, onHoch, onRunter, onVerdoppeln, onLoeschen, name }: {
  ziehGriff: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLButtonElement> };
  onHoch: () => void;
  onRunter: () => void;
  onVerdoppeln: () => void;
  onLoeschen: () => void;
  name: string;
}) {
  const knopf = "flex h-8 min-w-8 items-center justify-center border-[1.5px] px-2 text-[0.62rem] uppercase tracking-[0.12em]";
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-[3] flex items-start gap-1">
      <span className="palace-eyebrow pointer-events-none mr-1 hidden border-[1.5px] px-2 py-1.5 sm:block" style={FLAECHE}>{name}</span>
      <button
        type="button"
        {...ziehGriff}
        aria-label={`${name} verschieben — ziehen, oder mit den Pfeiltasten`}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); onHoch(); }
          if (e.key === "ArrowDown") { e.preventDefault(); onRunter(); }
          ziehGriff.onKeyDown?.(e);
        }}
        className={`${knopf} pointer-events-auto touch-none cursor-grab`}
        style={UMGEKEHRT}
      >
        ↕
      </button>
      <button type="button" onClick={onVerdoppeln} aria-label={`${name} verdoppeln`}
        className={`${knopf} pointer-events-auto`} style={FLAECHE}>⧉</button>
      <button type="button" onClick={onLoeschen} aria-label={`${name} löschen`}
        className={`${knopf} pointer-events-auto`} style={FLAECHE}>✕</button>
    </div>
  );
}

/** Die eine Leiste. Unten fixiert, immer sichtbar, nie zwei davon. */
export function AuftrittLeiste({ live, onBaustein, onFertig }: {
  live: boolean; onBaustein: () => void; onFertig: () => void;
}) {
  return (
    // Eine Stufe unter dem Einwilligungs-Banner (z-flyout = 70): erst die Entscheidung
    // über Daten, dann das Werkzeug.
    <div className="fixed inset-x-0 bottom-0 z-[68] flex items-center justify-between gap-3 border-t-[1.5px] px-4 py-3"
      style={FLAECHE}>
      <button type="button" onClick={onBaustein}
        className="min-h-[40px] shrink-0 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em]" style={UMGEKEHRT}>
        + Baustein
      </button>
      <p className="min-w-0 flex-1 text-center text-[0.72rem] leading-tight">
        {live
          ? "Diese Seite ist live — Änderungen sind sofort sichtbar."
          : "Auftritt wird bearbeitet"}
      </p>
      <button type="button" onClick={onFertig}
        className="min-h-[40px] shrink-0 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em]" style={FLAECHE}>
        Fertig
      </button>
    </div>
  );
}

/** Kleiner Bestätiger fürs Löschen — es fragt nach, wie der Auftrag verlangt. */
export function LoeschFrage({ name, onJa, onNein }: { name: string; onJa: () => void; onNein: () => void }) {
  useEscape(true, onNein);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Abbrechen" onClick={onNein}
        className="absolute inset-0 h-full w-full" style={{ background: "var(--house-fg, #000)", opacity: 0.35 }} />
      <div className="relative w-full max-w-sm border-[1.5px] p-5" style={FLAECHE}>
        <p className="text-sm">„{name}" entfernen?</p>
        <p className="mt-2 text-sm opacity-70">Der Baustein verschwindet sofort von der Seite.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onJa}
            className="min-h-[40px] flex-1 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em]" style={UMGEKEHRT}>
            Entfernen
          </button>
          <button type="button" onClick={onNein}
            className="min-h-[40px] flex-1 border-[1.5px] px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em]" style={FLAECHE}>
            Behalten
          </button>
        </div>
      </div>
    </div>
  );
}
