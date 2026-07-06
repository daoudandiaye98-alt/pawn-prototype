import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { usePublicDesigners } from "@/lib/publicData";
import { useStore, marketplaceSelectors } from "@/core";

/**
 * /designers — Palace namewall.
 * Merges Supabase designers (via usePublicDesigners) with core seeds.
 * Typography is the design: large Cormorant names, micro world · city underneath.
 */
export default function Designers() {
  const { designers } = usePublicDesigners();
  const products = useStore(marketplaceSelectors.getAllProductViews);

  // Derive world per designer from their products
  const worldBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!map.has(p.designerSlug)) map.set(p.designerSlug, p.world);
    }
    return map;
  }, [products]);

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
            <p className="mx-auto mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/70">
              {designers.length} unabhängige Studios aus Mode, Interior und Kunst — kuratiert von PAWN.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Namewall */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <ul className="mx-auto max-w-[1400px] divide-y divide-[rgba(12,12,14,.13)]">
          {designers.map((d, i) => {
            const world = (d.tags?.[0]) || worldBySlug.get(d.slug) || "Atelier";
            return (
              <Reveal key={d.id} delay={Math.min(400, i * 40)}>
                <li>
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
                    <span className="palace-eyebrow text-[#7C7972] group-hover:text-[#0C0C0E]">
                      {world} · {d.location ?? "—"}
                    </span>
                  </Link>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </section>

      {/* CTA */}
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
