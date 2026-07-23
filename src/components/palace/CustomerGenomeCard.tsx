import { useMemo } from "react";
import { Link } from "react-router-dom";
import { usePersonalization, explainMatch, scoreForPersonalization, type DesignerDna } from "@/features/personalization";
import { GenomeCard, type GenomeStrand } from "@/components/palace/GenomeCard";

/**
 * "Dein Geschmack" — die Genom-Karte des Kunden, aus echten Geschmacks-
 * Signalen (usePersonalization) statt Fake-Daten. Wird auf /dna und im
 * kuratierten Konto (/account) gerendert. Read-safe: ohne Signale zeigt
 * GenomeCard selbst den einladenden Basis-Zustand.
 */
export function CustomerGenomeCard({ className }: { className?: string }) {
  const { hasSignals, world, mood, worldDistribution, preferredTags, preferredDesigners, designerDna } = usePersonalization();

  const worldStrands: GenomeStrand[] = useMemo(() => {
    const total = Object.values(worldDistribution).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return (["Mode", "Interior", "Kunst"] as const).map((w) => ({
      label: w,
      value: Math.round(((worldDistribution[w] ?? 0) / total) * 100),
    }));
  }, [worldDistribution]);

  const houseMatches = useMemo(() => {
    if (!hasSignals) return [];
    const profile = { world, preferredTags, hasSignals, preferredDesigners };
    const withText = Array.from(designerDna.values()).map((dna) => {
      const topWorld = Object.entries(dna.worlds).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
      const item = { designerSlug: dna.slug, tags: dna.signals, world: topWorld };
      return { dna, text: explainMatch(item, profile, designerDna), score: scoreForPersonalization(item, profile, designerDna) };
    });
    const matched: { dna: DesignerDna; text: string; score: number }[] = [];
    for (const m of withText) if (m.text) matched.push({ dna: m.dna, text: m.text, score: m.score });
    return matched.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [hasSignals, world, preferredTags, preferredDesigners, designerDna]);

  return (
    <GenomeCard
      className={className}
      eyebrow="Dein Geschmack"
      title="Deine Genom-Karte"
      subtitle={hasSignals ? `Stimmung: ${mood === "ruhig" ? "ruhig · skulptural" : mood === "spannung" ? "Spannung · Kontrast" : "im Werden"}` : undefined}
      strands={worldStrands.length > 0 ? worldStrands : undefined}
      strandsLabel="Deine Welten"
      emptyText="Deine Genom-Karte füllt sich, sobald du im Chat erzählst oder Stücke merkst."
    >
      {preferredTags.length > 0 && (
        <div className="mt-6 border-t border-black/15 pt-4">
          <p className="editorial-eyebrow text-black/50">Deine Signale</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {preferredTags.slice(0, 8).map((t) => (
              <span key={t} className="border-[1.5px] border-black px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-black">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {houseMatches.length > 0 && (
        <div className="mt-6 border-t border-black/15 pt-4">
          <p className="editorial-eyebrow text-black/50">Passende Häuser</p>
          <ul className="mt-2 space-y-3">
            {houseMatches.map(({ dna, text }) => (
              <li key={dna.slug}>
                <Link to={`/designer/${dna.slug}`} className="text-sm text-black underline decoration-1 underline-offset-4 hover:no-underline">
                  {dna.brandName}
                </Link>
                <p className="mt-0.5 text-sm text-black/70">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GenomeCard>
  );
}
