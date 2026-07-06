import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { useStore, marketplaceSelectors } from "@/core";

/**
 * Simple editorial grid for /mode /interior /kunst.
 * Placeholder — same tokens as the palace, filters by world tag later.
 */
export function PalaceWorldPage({ world, eyebrow, headline }: { world: string; eyebrow: string; headline: ReactNode }) {
  const products = useStore(marketplaceSelectors.getAllProductViews);

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">{eyebrow}</p>
            <h1 className="palace-serif mt-6 font-light text-[clamp(2.5rem,6vw,5rem)] leading-[0.98]">
              {headline}
            </h1>
          </Reveal>
          <div className="mt-20 grid grid-cols-12 gap-6 md:gap-8">
            {products.slice(0, 9).map((p, i) => {
              const spans = ["col-span-12 md:col-span-4", "col-span-12 md:col-span-5", "col-span-12 md:col-span-3"];
              return (
                <Reveal key={p.id} delay={i * 40} className={spans[i % spans.length]}>
                  <Link to={`/product/${p.slug}`} className="block">
                    <EditorialImage seed={`${world}-${p.slug}`} ratio="3/4" />
                    <p className="palace-serif italic mt-4 text-[1.1rem]">{p.name}</p>
                    <p className="palace-eyebrow mt-2">{world} · {p.designer}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
}

export default function Neu() {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">Ausstellung · Ausgabe 07</p>
            <h1 className="palace-serif mt-6 font-light text-[clamp(2.5rem,6vw,5rem)] leading-[0.98]">
              Alles Neue. <span className="italic">Diese Woche.</span>
            </h1>
          </Reveal>
          <div className="mt-20 grid grid-cols-12 gap-6 md:gap-8">
            {products.map((p, i) => {
              const spans = ["col-span-12 md:col-span-5", "col-span-12 md:col-span-4", "col-span-12 md:col-span-3", "col-span-12 md:col-span-3", "col-span-12 md:col-span-4", "col-span-12 md:col-span-5"];
              const ratios = ["3/4", "4/5", "3/4"] as const;
              return (
                <Reveal key={p.id} delay={i * 40} className={spans[i % spans.length]}>
                  <Link to={`/product/${p.slug}`} className="block">
                    <EditorialImage seed={`neu-${p.slug}`} ratio={ratios[i % ratios.length]} />
                    <p className="palace-serif italic mt-4 text-[1.1rem]">{p.name}</p>
                    <p className="palace-eyebrow mt-2">{p.designer} · €{p.price.toLocaleString("de-DE")}</p>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
}
