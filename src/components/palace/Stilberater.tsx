import { Link } from "react-router-dom";
import { PawnFigur } from "@/components/pawn/PawnFigur";
import { useStilberater } from "@/features/personalization/useStilberater";

/**
 * Teil 20a — Der Stilberater: ersetzt "Dein Geschmack" im Konto. Dieselben Daten wie
 * zuvor die Genom-Karte, jetzt als Prosa statt Balken — eine Stimme, kein Diagramm.
 * Jede Aussage einzeln löschbar (dismissed-Liste in user_memory), das Ganze abschaltbar
 * über den Personalisierung-Schalter aus Teil 19b (wirkt bereits).
 *
 * Teil 29: die Anfrage/Zustimmung/Ablehnung-Logik lebt jetzt in useStilberater.ts,
 * geteilt mit dem neuen Cover auf /dna.
 */
export function Stilberater({ className }: { className?: string }) {
  const { result, dismissed, loading, busy, anfordern, dismiss, personalizationOff } = useStilberater();

  if (personalizationOff) {
    return (
      <div className={className ?? "border-[1.5px] border-black bg-white p-6 md:p-8"}>
        <p className="editorial-eyebrow text-black/60">Stilberater</p>
        <p className="mt-3 text-sm text-black/60">
          Personalisierung ist aus — dein Stilberater zeigt sich wieder, sobald du sie in den{" "}
          <Link to="/account?tab=Einstellungen" className="underline decoration-1 underline-offset-4 hover:no-underline">Einstellungen</Link> anschaltest.
        </p>
      </div>
    );
  }

  if (loading) return <div className={className ?? "border-[1.5px] border-black bg-white p-8"}><div className="h-24 animate-pulse bg-black/5" /></div>;

  const fz = result?.fruehzustand;
  const hasContent = result?.fruehzustand?.erreicht && (result?.urteil || result?.einordnung);

  return (
    <div className={className ?? "border-[1.5px] border-black bg-white p-6 md:p-8"}>
      <div className="flex items-start gap-4">
        <PawnFigur size={56} interactive={false} showShadow={false} className="shrink-0" ariaLabel="PAWN" />
        <p className="mt-2 editorial-eyebrow text-black/60">Dein Stilberater</p>
      </div>

      {!hasContent ? (
        <div className="mt-4">
          {fz && !fz.erreicht ? (
            <>
              <p className="font-serif italic text-base leading-relaxed text-black/80">
                Zwei Blicke ergeben noch keinen Stil. Ich sage dir lieber nichts als etwas Falsches.
              </p>
              <p className="mt-2 text-sm text-black/60">{fz.aktuell} von {fz.ziel} Blicken bisher.</p>
              <div className="mt-3 h-[3px] w-full max-w-xs bg-black/10">
                <div className="h-full bg-black" style={{ width: `${Math.min(100, Math.round((fz.aktuell / fz.ziel) * 100))}%` }} />
              </div>
            </>
          ) : fz ? (
            <p className="text-sm text-black/70">
              Genug gesehen, um ein erstes Muster zu erkennen — willst du wissen, welches?
            </p>
          ) : (
            <p className="text-sm text-black/70">
              Dein Stilberater liest mit, während du dich umsiehst. Sobald genug Blicke zusammengekommen sind,
              sagt er dir, welches Muster darin steckt.
            </p>
          )}

          <button type="button" onClick={() => void anfordern(false)} disabled={busy || (fz ? !fz.erreicht : false)}
            className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-40">
            {busy ? "…" : "Einschätzung anfordern"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {!dismissed.includes("urteil") && result?.urteil && (
            <div className="group relative border-t border-black/15 pt-4 first:border-0 first:pt-0">
              <h3 className="pr-8 font-serif text-2xl leading-tight text-black">{result.urteil}</h3>
              <DismissBtn onClick={() => void dismiss("urteil")} />
            </div>
          )}
          {!dismissed.includes("einordnung") && result?.einordnung && (
            <div className="group relative border-t border-black/15 pt-4">
              {result.stilname && <p className="editorial-eyebrow text-black/60">{result.stilname}</p>}
              <p className="mt-2 max-w-2xl pr-8 text-[0.95rem] leading-relaxed text-black/85">{result.einordnung}</p>
              <DismissBtn onClick={() => void dismiss("einordnung")} />
            </div>
          )}
          {(result?.belege ?? []).some((_, i) => !dismissed.includes(`beleg-${i}`)) && (
            <div className="border-t border-black/15 pt-4">
              <p className="editorial-eyebrow text-black/60">Woran ich das sehe</p>
              <ul className="mt-2 space-y-2">
                {(result?.belege ?? []).map((b, i) => !dismissed.includes(`beleg-${i}`) && (
                  <li key={i} className="group relative pr-8 text-sm text-black/85">
                    {b.text} <span className="text-black/60">— {b.beleg}</span>
                    <DismissBtn onClick={() => void dismiss(`beleg-${i}`)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!dismissed.includes("blinder_fleck") && result?.blinder_fleck && (
            <div className="group relative border-t border-black/15 pt-4">
              <p className="editorial-eyebrow text-black/60">Was du noch nicht siehst</p>
              <p className="mt-2 pr-8 text-sm text-black/85">{result.blinder_fleck.text} <span className="text-black/60">— {result.blinder_fleck.beleg}</span></p>
              <DismissBtn onClick={() => void dismiss("blinder_fleck")} />
            </div>
          )}
          {!dismissed.includes("naechster_schritt") && result?.naechster_schritt && (
            <div className="group relative border-t border-black/15 pt-4">
              <p className="editorial-eyebrow text-black/60">Was ich dir zutraue</p>
              <p className="mt-2 pr-8 text-sm text-black/85">{result.naechster_schritt.text}</p>
              <DismissBtn onClick={() => void dismiss("naechster_schritt")} />
            </div>
          )}

          <div className="border-t border-black/15 pt-4">
            <button type="button" onClick={() => void anfordern(true)} disabled={busy}
              className="editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline disabled:opacity-40">
              {busy ? "…" : "Neu einschätzen →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DismissBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Aussage entfernen"
      className="absolute right-0 top-3 text-[0.6rem] uppercase tracking-[0.18em] text-black/30 opacity-0 hover:text-black group-hover:opacity-100">
      Entfernen
    </button>
  );
}
