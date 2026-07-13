import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { usePublicDesigners, type PublicDesigner } from "@/lib/publicData";
import { usePersonalization } from "@/features/personalization";

/**
 * Editorial rotating banner — chooses a random featured designer per page-view.
 * If DNA signals exist, prefers designers whose tags match the user's world.
 * Optional `world` prop scopes the pool to a single world (used on world pages).
 */
export function DynamicBanner({
  world,
  minHeight = "72vh",
  fallbackQuote = "Der Raum trägt, was du sonst nirgends findest.",
}: { world?: string; minHeight?: string; fallbackQuote?: string }) {
  const { designers } = usePublicDesigners();
  const personalization = usePersonalization();
  const [pick, setPick] = useState<PublicDesigner | null>(null);

  const pool = useMemo(() => {
    const featured = designers.filter((d) => d.is_featured);
    const base = featured.length > 0 ? featured : designers;
    if (!world) return base;
    return base.filter((d) => (d.tags ?? []).some((t) => t.toLowerCase() === world.toLowerCase())) || base;
  }, [designers, world]);

  useEffect(() => {
    if (pool.length === 0) { setPick(null); return; }
    // brand_dna-aware weighting: designers matching preferred world + shared signals.
    const preferredWorld = personalization.world;
    const preferredTags = personalization.preferredTags ?? [];
    const dnaMap = personalization.designerDna;
    const scored = pool.map((d) => {
      const dna = dnaMap.get(d.slug);
      let s = 0;
      if (preferredWorld && dna?.worlds[preferredWorld]) s += (dna.worlds[preferredWorld] ?? 0) * 2;
      if (preferredTags.length && dna?.signals) s += dna.signals.filter((t) => preferredTags.includes(t)).length;
      if (preferredWorld && (d.tags ?? []).some((t) => t.toLowerCase() === preferredWorld.toLowerCase())) s += 0.5;
      return { d, s: s + Math.random() * 0.4 };
    }).sort((a, b) => b.s - a.s);
    // 80% pick from top match, 20% random discovery
    const source = personalization.hasSignals && Math.random() < 0.8 ? scored.slice(0, Math.max(1, Math.floor(scored.length / 3))) : scored;
    const picked = source[Math.floor(Math.random() * source.length)]?.d ?? pool[0];
    if (picked) setPick(picked);
  }, [pool, personalization.world, personalization.preferredTags, personalization.designerDna, personalization.hasSignals]);


  if (!pick) return null;
  return (
    <section className="relative z-10 overflow-hidden" style={{ minHeight }}>
      <EditorialImage
        seed={`banner-${pick.slug}`}
        src={pick.hero_image_url ?? pick.banner_url}
        ratio="16/9"
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 bg-[#000000]/50" />
      <div className="relative flex items-center justify-center px-6 py-24 text-center" style={{ minHeight }}>
        <Reveal>
          <p className="palace-eyebrow" style={{ color: "rgba(241,238,231,.75)" }}>
            Im Rampenlicht{world ? ` · ${world}` : ""}
          </p>
          <blockquote className="mx-auto mt-8 max-w-3xl">
            {pick.quote ? (
              <p
                className="palace-serif italic font-light text-[#FFFFFF]"
                style={{ fontSize: "clamp(1.7rem, 4.2vw, 3.4rem)", lineHeight: 1.12 }}
              >
                „{pick.quote}"
              </p>
            ) : (
              <Editable
                as="p"
                contentKey="banner_fallback_quote"
                className="palace-serif block italic font-light text-[#FFFFFF]"
                multiline
              >
                {fallbackQuote}
              </Editable>
            )}
            <cite className="mt-8 block not-italic palace-eyebrow" style={{ color: "rgba(241,238,231,.75)" }}>
              {pick.quote_role ?? pick.brand_name}
            </cite>
          </blockquote>
          <Link
            to={`/designer/${pick.slug}`}
            className="mt-10 inline-block whitespace-nowrap border border-[rgba(241,238,231,.6)] px-6 py-3 text-[0.65rem] uppercase tracking-[0.32em] text-[#FFFFFF] transition-colors duration-500 hover:bg-[#FFFFFF] hover:text-[#000000]"
          >
            Zum Atelier von {pick.brand_name} →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
