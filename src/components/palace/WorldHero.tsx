/**
 * Monumental world-name entrance for /mode /interior /kunst.
 * 3-layer technique:
 *   - back text (huge outline-ish serif)
 *   - centered editorial image (breaks through the letters)
 *   - front text (same as back, clipped to the image band → letters weave through)
 * Mobile: image stacks below text, no clipping — always legible.
 */
import { useMemo } from "react";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Editable } from "@/components/palace/Editable";
import type { World } from "@/core/types/entities";

export interface WorldHeroProps {
  world: World;
  eyebrow: string;
  subline: string;
  image?: string | null;
}

export function WorldHero({ world, eyebrow, subline, image }: WorldHeroProps) {
  const label = world.toUpperCase();
  const seed = useMemo(() => `world-hero-${world}`, [world]);

  return (
    <section
      className="relative w-full overflow-hidden bg-[#F1EEE7]"
      style={{ minHeight: "clamp(78vh, 110vh, 118vh)" }}
    >
      {/* Eyebrow — top-left */}
      <div className="absolute left-6 top-32 z-30 md:left-14 md:top-40">
        <Editable as="p" contentKey={`world_${world}_hero_eyebrow`} className="palace-eyebrow">
          {eyebrow}
        </Editable>
      </div>

      {/* Desktop: three-layer clip composition */}
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
        {/* Back text */}
        <h1
          aria-hidden
          className="palace-serif absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-light text-[#0C0C0E]"
          style={{
            fontSize: "clamp(6rem, 14vw, 15rem)",
            lineHeight: 0.86,
            letterSpacing: "-0.045em",
          }}
        >
          {label}
        </h1>

        {/* Middle: editorial image band (breaks through) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "min(58vw, 780px)", aspectRatio: "16 / 10" }}
        >
          <EditorialImage seed={seed} src={image ?? null} ratio="16/10" className="h-full w-full" priority />
        </div>

        {/* Front text — same headline, clipped to a horizontal band that matches image height (~28% of viewport) */}
        <h1
          aria-hidden
          className="palace-serif absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-light text-[#0C0C0E]"
          style={{
            fontSize: "clamp(6rem, 14vw, 15rem)",
            lineHeight: 0.86,
            letterSpacing: "-0.045em",
            clipPath: "inset(38% 0 38% 0)",
          }}
        >
          {label}
        </h1>
      </div>

      {/* Accessible headline for screen readers */}
      <h1 className="sr-only">{world}</h1>

      {/* Mobile: stacked, legible */}
      <div className="relative z-20 flex flex-col items-center gap-8 px-6 pt-56 pb-16 text-center md:hidden">
        <h1
          className="palace-serif font-light text-[#0C0C0E]"
          style={{ fontSize: "clamp(3.6rem, 22vw, 6.4rem)", lineHeight: 0.9, letterSpacing: "-0.035em" }}
        >
          {label}
        </h1>
        <div className="w-full" style={{ aspectRatio: "4 / 5", maxWidth: "22rem" }}>
          <EditorialImage seed={seed} src={image ?? null} ratio="4/5" className="h-full w-full" priority />
        </div>
      </div>

      {/* Subline — bottom-left */}
      <div className="absolute bottom-14 left-6 z-30 max-w-md md:left-14 md:bottom-20">
        <Editable
          as="p"
          contentKey={`world_${world}_hero_subline`}
          className="block font-serif italic text-[1rem] leading-relaxed text-[#0C0C0E]/75 md:text-[1.1rem]"
          multiline
        >
          {subline}
        </Editable>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 right-6 z-30 hidden flex-col items-center gap-3 md:flex md:right-14">
        <span className="palace-eyebrow text-[#55534E]">Scroll</span>
        <span className="palace-drip block h-12 w-px bg-[#0C0C0E]" />
      </div>
    </section>
  );
}
