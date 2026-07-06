import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
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
    // Prefer signals if we have them
    const preferredWorld = personalization.world?.toLowerCase();
    const preferredPool = preferredWorld
      ? pool.filter((d) => (d.tags ?? []).some((t) => t.toLowerCase() === preferredWorld))
      : [];
    const source = preferredPool.length > 0 && Math.random() < 0.8 ? preferredPool : pool;
    setPick(source[Math.floor(Math.random() * source.length)]);
  }, [pool, personalization.world]);

  if (!pick) return null;
  return (
    <section className="relative z-10 overflow-hidden" style={{ minHeight }}>
      <EditorialImage
        seed={`banner-${pick.slug}`}
        src={pick.hero_image_url ?? pick.banner_url}
        ratio="16/9"
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 bg-[#0C0C0E]/50" />
      <div className="relative flex items-center justify-center px-6 py-24 text-center" style={{ minHeight }}>
        <Reveal>
          <p className="palace-eyebrow" style={{ color: "rgba(241,238,231,.75)" }}>
            Im Rampenlicht{world ? ` · ${world}` : ""}
          </p>
          <blockquote className="mx-auto mt-8 max-w-3xl">
            <p
              className="palace-serif italic font-light text-[#F1EEE7]"
              style={{ fontSize: "clamp(1.7rem, 4.2vw, 3.4rem)", lineHeight: 1.12 }}
            >
              „{pick.quote ?? fallbackQuote}"
            </p>
            <cite className="mt-8 block not-italic palace-eyebrow" style={{ color: "rgba(241,238,231,.75)" }}>
              {pick.quote_role ?? pick.brand_name}
            </cite>
          </blockquote>
          <Link
            to={`/designer/${pick.slug}`}
            className="mt-10 inline-block whitespace-nowrap border border-[rgba(241,238,231,.6)] px-6 py-3 text-[0.65rem] uppercase tracking-[0.32em] text-[#F1EEE7] transition-colors duration-500 hover:bg-[#F1EEE7] hover:text-[#0C0C0E]"
          >
            Zum Atelier von {pick.brand_name} →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
