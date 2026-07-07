import { ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { DynamicBanner } from "@/components/palace/DynamicBanner";
import { Editable } from "@/components/palace/Editable";
import { useStore, marketplaceSelectors } from "@/core";
import type { World } from "@/core/types/entities";
import { usePublicDesigners, usePublishedProducts } from "@/lib/publicData";
import { usePersonalization, sortByPersonalization } from "@/features/personalization";


interface WorldPageProps {
  world: World;
  eyebrow: string;
  headline: ReactNode;
  intro: string;
}

/**
 * Editorial world page for /mode /interior /kunst.
 * - Full-height eyebrow + serif headline
 * - Featured designer band from this world (from Supabase or seed fallback)
 * - Hairline category chips generated from product tags (client-side filter)
 * - Editorial 12-col grid of products filtered by world
 * - Slim CTA to /apply
 */
export function WorldPage({ world, eyebrow, headline, intro }: WorldPageProps) {
  const seedProducts = useStore(marketplaceSelectors.getAllProductViews);
  const { designers } = usePublicDesigners();
  const { products: dbProducts } = usePublishedProducts(world);

  const worldProducts = useMemo(() => {
    const seed = seedProducts.filter((p) => p.world === world);
    // DB products win by slug — merge into seed shape
    const dbShaped = dbProducts.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, world, category: "Neu",
      designer: designers.find((d) => d.id === p.designer_id)?.brand_name ?? "PAWN",
      designerSlug: designers.find((d) => d.id === p.designer_id)?.slug ?? "",
      price: p.price, imageUrl: p.image_url,
    }));
    const dbSlugs = new Set(dbShaped.map((p) => p.slug));
    return [...dbShaped, ...seed.filter((p) => !dbSlugs.has(p.slug))];
  }, [seedProducts, dbProducts, world, designers]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of worldProducts) set.add(p.category);
    return Array.from(set);
  }, [worldProducts]);

  const [active, setActive] = useState<string | null>(null);
  const personalization = usePersonalization();
  const filtered = active ? worldProducts.filter((p) => p.category === active) : worldProducts;
  const visible = useMemo(() => sortByPersonalization(filtered, personalization), [filtered, personalization]);


  // Featured designer: first designer whose tags mention this world (DB) or match seed heuristics.
  const featured = useMemo(() => {
    const byWorld = designers.find((d) => (d.tags ?? []).some((t) => t.toLowerCase() === world.toLowerCase()));
    if (byWorld) return byWorld;
    // fallback: infer from first product of that world
    const firstProd = worldProducts[0];
    if (!firstProd) return designers[0];
    return designers.find((d) => d.slug === firstProd.designerSlug) ?? designers[0];
  }, [designers, world, worldProducts]);

  return (
    <PalaceLayout transparentHeader={false}>
      {/* ── Editorial header ─────────────────────────────── */}
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">{eyebrow}</p>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              {headline}
            </h1>
            <p className="mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/70">
              {intro}
            </p>
          </Reveal>

          {/* Hairline category chips */}
          {categories.length > 0 && (
            <Reveal delay={100} className="mt-12 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActive(null)}
                className={`border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300 ${
                  active === null
                    ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]"
                    : "border-[rgba(12,12,14,.22)] text-[#0C0C0E] hover:border-[#0C0C0E]"
                }`}
              >
                Alles
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActive(c)}
                  className={`border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300 ${
                    active === c
                      ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]"
                      : "border-[rgba(12,12,14,.22)] text-[#0C0C0E] hover:border-[#0C0C0E]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Featured designer band ───────────────────────── */}
      {featured && (
        <section className="mt-24 border-y border-[rgba(12,12,14,.13)] bg-[#F1EEE7] md:mt-32">
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-0 md:grid-cols-[1fr_1fr] md:min-h-[72vh]">
            <Reveal className="relative">
              <EditorialImage
                seed={`world-${world}-${featured.slug}`}
                src={featured.hero_image_url ?? featured.banner_url}
                ratio="4/5"
                className="h-full w-full"
              />
            </Reveal>
            <Reveal delay={120} className="flex flex-col justify-center gap-8 px-8 py-16 md:px-14">
              <p className="palace-eyebrow">Im Studio · {world}</p>
              <h2 className="palace-serif font-light text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
                {featured.brand_name}. <span className="italic">Eine Handschrift, die man wiederkennt.</span>
              </h2>
              {featured.story && (
                <p className="max-w-md text-[0.95rem] leading-relaxed text-[#0C0C0E]/80">{featured.story}</p>
              )}
              {featured.quote && (
                <blockquote className="max-w-md border-l border-[rgba(12,12,14,.28)] pl-5">
                  <p className="palace-serif italic text-[1.3rem] leading-snug text-[#0C0C0E]">„{featured.quote}"</p>
                </blockquote>
              )}
              <Link to={`/designer/${featured.slug}`} className="palace-eyebrow uline w-fit text-[#0C0C0E]">
                Zum Atelier →
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* Rotating banner — random featured designer of this world */}
      <DynamicBanner world={world} minHeight="60vh" />

      {/* ── Grid ─────────────────────────────────────────── */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1600px]">
          {visible.length === 0 ? (
            <p className="palace-eyebrow text-[#7C7972]">Nichts in dieser Kategorie — noch.</p>
          ) : (
            <div className="grid grid-cols-12 gap-6 md:gap-8">
              {visible.map((p, i) => {
                const layouts = [
                  { span: "col-span-12 md:col-span-5", ratio: "3/4" as const },
                  { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                  { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                  { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                  { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                  { span: "col-span-12 md:col-span-5", ratio: "3/2" as const },
                ];
                const l = layouts[i % layouts.length];
                return (
                  <Reveal key={p.id} delay={i * 50} className={l.span}>
                    <Link to={`/product/${p.slug}`} className="group block">
                      <EditorialImage seed={`${world}-${p.slug}`} ratio={l.ratio} />
                      <div className="mt-4 flex items-baseline justify-between gap-4">
                        <div>
                          <p className="palace-serif italic text-[1.15rem] leading-tight text-[#0C0C0E]">{p.name}</p>
                          <p className="palace-eyebrow mt-2">{p.category} · {p.designer}</p>
                        </div>
                        <p className="palace-eyebrow text-[#0C0C0E]">€{p.price.toLocaleString("de-DE")}</p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Designer CTA ─────────────────────────────────── */}
      <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-20 md:px-14">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-6 md:flex-row">
          <p className="palace-serif italic text-[1.3rem] text-[#0C0C0E]">
            Du arbeitest in dieser Welt? Zeig uns dein Atelier.
          </p>
          <Link to="/apply" className="palace-btn">Als Designer bewerben →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
