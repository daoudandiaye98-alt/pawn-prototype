import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Gemeinsames visuelles System für DNA — an allen Orten (Admin-DNA, Dein
 * Geschmack, Akquise-Kurator). Ein Genom ist nichts weiter als benannte
 * Gewichte (0–100); die Karte rendert sie als Stränge (harte Ladder-Balken,
 * zitiert die Helix von der Landing) plus optionale gelernte Rangliste,
 * Puls-Zeile, Signatur-Chips und Sprunglinks. Fehlen Daten, zeigt sie einen
 * einladenden Basis-Zustand statt leerer Flächen.
 */
export interface GenomeStrand {
  label: string;
  value: number; // 0–100
  hint?: string;
}

export interface GenomeSignature {
  id: string;
  name: string;
  wunsch?: boolean;
}

export interface GenomeScore {
  value: number;
  max?: number;
  reasons?: Record<string, string>;
}

export interface GenomePulse {
  text: string;
  when?: string;
}

export interface GenomeCardProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  strands?: GenomeStrand[];
  strandsLabel?: string;
  learned?: GenomeStrand[];
  learnedLabel?: string;
  pulse?: GenomePulse | null;
  signatures?: GenomeSignature[];
  signaturesHref?: string;
  signaturesLinkLabel?: string;
  campaignsHref?: string;
  campaignsLinkLabel?: string;
  score?: GenomeScore | null;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  children?: ReactNode;
}

const TICKS = 14;

/** Eine Strang-Sprosse: harte Ladder-Balken, gefüllt bis zum Gewicht. */
export function GenomeRung({ value }: { value: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * TICKS);
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: TICKS }).map((_, i) => (
        <span
          key={i}
          className={cn("h-3 w-2.5 border-[1.5px] border-black", i < filled ? "bg-black" : "bg-white")}
        />
      ))}
    </div>
  );
}

export function GenomeCard(props: GenomeCardProps) {
  const hasStrands = (props.strands?.length ?? 0) > 0;
  const hasLearned = (props.learned?.length ?? 0) > 0;
  const hasScore = props.score != null;
  const isEmpty = props.empty || (!hasStrands && !hasLearned && !hasScore);
  const linkClass = "editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline";

  return (
    <div className={cn("border-[1.5px] border-black bg-white p-6 md:p-8", props.className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {props.eyebrow && <p className="editorial-eyebrow text-black/50">{props.eyebrow}</p>}
          <h3 className="mt-1 font-serif text-xl leading-tight text-black">{props.title}</h3>
          {props.subtitle && <p className="mt-1 text-sm text-black/60">{props.subtitle}</p>}
        </div>
        {hasScore && (
          <p className="whitespace-nowrap font-serif text-3xl leading-none tabular-nums text-black">
            {Math.round(props.score!.value)}
            <span className="text-sm text-black/50"> / {props.score!.max ?? 100}</span>
          </p>
        )}
      </div>

      {isEmpty ? (
        <div className="mt-6 border border-dashed border-black/30 p-6 text-center">
          <p className="text-sm text-black/60">
            {props.emptyText ?? "Die Genom-Karte füllt sich, sobald es erste Signale gibt."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {hasStrands && (
            <div className="space-y-3">
              {props.strandsLabel && <p className="editorial-eyebrow text-black/50">{props.strandsLabel}</p>}
              {props.strands!.map((s) => (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between text-[0.68rem] uppercase tracking-[0.2em] text-black">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-black/50">
                      {Math.round(s.value)}
                      {s.hint ? ` · ${s.hint}` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <GenomeRung value={s.value} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasLearned && (
            <div className="space-y-2 border-t border-black/15 pt-4">
              {props.learnedLabel && <p className="editorial-eyebrow text-black/50">{props.learnedLabel}</p>}
              <ul className="space-y-1.5">
                {props.learned!.map((s) => (
                  <li key={s.label} className="flex items-center justify-between text-sm text-black">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-black/60">{s.hint ?? `${Math.round(s.value)}%`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasScore && props.score!.reasons && Object.keys(props.score!.reasons).length > 0 && (
            <ul className="space-y-1 border-t border-black/15 pt-4 text-sm text-black/80">
              {Object.entries(props.score!.reasons).map(([k, v]) => (
                <li key={k}>
                  <span className="text-black/50">{k}:</span> {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {props.pulse && (
        <p className="mt-6 flex items-center gap-2 border-t border-black/15 pt-4 text-[0.72rem] text-black/70">
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse bg-black" />
          Zuletzt gelernt: {props.pulse.text}
          {props.pulse.when ? ` · ${props.pulse.when}` : ""}
        </p>
      )}

      {(props.signatures?.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-black/15 pt-4">
          <p className="editorial-eyebrow text-black/50">Signaturen</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.signatures!.map((s) => (
              <span
                key={s.id}
                className="border-[1.5px] border-black px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-black"
              >
                {s.name}
                {s.wunsch ? " ✦" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {(props.signaturesHref || props.campaignsHref) && (
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-black/15 pt-4">
          {props.signaturesHref && (
            <Link to={props.signaturesHref} className={linkClass}>
              {props.signaturesLinkLabel ?? "Zum Regisseur"} →
            </Link>
          )}
          {props.campaignsHref && (
            <Link to={props.campaignsHref} className={linkClass}>
              {props.campaignsLinkLabel ?? "Zu Kampagnen"} →
            </Link>
          )}
        </div>
      )}

      {props.children}
    </div>
  );
}
