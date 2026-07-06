import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { usePublicDesigners } from "@/lib/publicData";
import { useStore, marketplaceSelectors } from "@/core";

/**
 * /designers — Palace namewall.
 * Hover on a name reveals a small B/W preview image that follows the cursor.
 */
export default function Designers() {
  const { designers } = usePublicDesigners();
  const products = useStore(marketplaceSelectors.getAllProductViews);

  const worldBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!map.has(p.designerSlug)) map.set(p.designerSlug, p.world);
    }
    return map;
  }, [products]);

  const productBySlug = useMemo(() => {
    const map = new Map<string, string | undefined>();
    // Seed ProductView has no imageUrl; leave empty so we rely on designer hero/banner.
    return map;
  }, []);


  const [hover, setHover] = useState<{ src?: string; brand: string } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wallRef = useRef<HTMLElement | null>(null);

  const onMove = (e: React.MouseEvent) => {
    const rect = wallRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1400px] text-center">
          <Reveal>
            <p className="palace-eyebrow">Atelier · Verzeichnis</p>
            <h1
              className="palace-serif mt-10 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.2rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              Wer diesen Raum <span className="italic">füllt.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/75">
              {designers.length} unabhängige Studios aus Mode, Interior und Kunst — kuratiert von PAWN.
            </p>
          </Reveal>
        </div>
      </section>

      <section
        ref={wallRef}
        className="relative px-6 py-24 md:px-14 md:py-32"
        onMouseMove={onMove}
      >
        {/* Cursor preview */}
        {hover && (
          <div
            className="pointer-events-none absolute z-30 hidden overflow-hidden border border-[rgba(12,12,14,.28)] bg-[#F1EEE7] shadow-[0_20px_60px_-30px_rgba(12,12,14,0.5)] transition-opacity duration-300 md:block"
            style={{
              left: pos.x + 20,
              top: pos.y - 90,
              width: 200,
              height: 260,
              opacity: hover.src ? 1 : 0.5,
            }}
          >
            {hover.src ? (
              <img
                src={hover.src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                style={{ filter: "grayscale(1) contrast(var(--palace-image-contrast, 1.06))" }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#EFEDE8] palace-serif italic text-[#8F8B82]">
                {hover.brand}
              </div>
            )}
          </div>
        )}

        <ul className="mx-auto max-w-[1400px] divide-y divide-[rgba(12,12,14,.13)]">
          {designers.map((d, i) => {
            const world = (d.tags?.[0]) || worldBySlug.get(d.slug) || "Atelier";
            const preview = d.hero_image_url ?? d.banner_url ?? productBySlug.get(d.slug);
            return (
              <Reveal key={d.id} delay={Math.min(400, i * 40)}>
                <li
                  onMouseEnter={() => setHover({ src: preview ?? undefined, brand: d.brand_name })}
                  onMouseLeave={() => setHover(null)}
                >
                  <Link
                    to={`/designer/${d.slug}`}
                    className="group flex flex-col items-center gap-3 py-10 text-center transition-colors duration-500 md:py-14"
                  >
                    <span
                      className="palace-serif font-light text-[#0C0C0E]/85 transition-colors duration-500 group-hover:text-[#0C0C0E]"
                      style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
                    >
                      {d.brand_name}
                    </span>
                    <span className="palace-eyebrow text-[#6B6862] group-hover:text-[#0C0C0E]">
                      {world} · {d.location ?? "—"}
                    </span>
                  </Link>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </section>

      <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-20 md:px-14">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-6 md:flex-row">
          <p className="palace-serif italic text-[1.3rem] text-[#0C0C0E]">
            Ist dein Atelier hier noch nicht?
          </p>
          <Link to="/apply" className="palace-btn">Als Designer bewerben →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
