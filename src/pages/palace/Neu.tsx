import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { useSiteContent } from "@/lib/siteContent";
import { useStore, marketplaceSelectors } from "@/core";
import { usePersonalization, sortByPersonalization } from "@/features/personalization";

export default function Neu() {
  const raw = useStore(marketplaceSelectors.getAllProductViews);
  const personalization = usePersonalization();
  const products = useMemo(() => sortByPersonalization(raw, personalization, personalization.designerDna), [raw, personalization]);
  const ausgabeNummer = useSiteContent("ausgabe_nummer");
  return (
    <PalaceLayout transparentHeader={false}>

      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">
              <Editable as="span" contentKey="landing.neu_eyebrow">Ausstellung</Editable> · Ausgabe {ausgabeNummer}
            </p>
            <h1
              className="palace-serif mt-8 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="landing.neu_headline_a">Alles Neue. </Editable>
              <Editable as="span" contentKey="landing.neu_headline_b" className="italic">Diese Woche.</Editable>
            </h1>
            <Editable as="p" contentKey="landing.neu_subline" className="mt-8 block max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#000000]/70">
              Mode, Interior und Kunst — kuratiert, in einer Bewegung.
            </Editable>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-12 gap-6 md:gap-8">
            {products.map((p, i) => {
              const spans = [
                "col-span-12 md:col-span-5",
                "col-span-12 md:col-span-4",
                "col-span-12 md:col-span-3",
                "col-span-12 md:col-span-3",
                "col-span-12 md:col-span-4",
                "col-span-12 md:col-span-5",
              ];
              const ratios = ["3/4", "4/5", "3/4"] as const;
              return (
                <Reveal key={p.id} delay={i * 40} className={spans[i % spans.length]}>
                  <Link to={`/product/${p.slug}`} className="group block">
                    <EditorialImage seed={`neu-${p.slug}`} ratio={ratios[i % ratios.length]} />
                    <div className="mt-4 flex items-baseline justify-between gap-4">
                      <div>
                        <p className="palace-serif italic text-[1.1rem] text-[#000000]">{p.name}</p>
                        <p className="palace-eyebrow mt-2">{p.world} · {p.designer}</p>
                      </div>
                      <p className="palace-eyebrow text-[#000000]">€{p.price.toLocaleString("de-DE")}</p>
                    </div>
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
