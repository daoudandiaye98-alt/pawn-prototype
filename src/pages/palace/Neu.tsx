import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { useStore, marketplaceSelectors } from "@/core";

export default function Neu() {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">Ausstellung · Ausgabe 07</p>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              Alles Neue. <span className="italic">Diese Woche.</span>
            </h1>
            <p className="mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/70">
              Mode, Interior und Kunst — kuratiert, in einer Bewegung.
            </p>
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
                        <p className="palace-serif italic text-[1.1rem] text-[#0C0C0E]">{p.name}</p>
                        <p className="palace-eyebrow mt-2">{p.world} · {p.designer}</p>
                      </div>
                      <p className="palace-eyebrow text-[#0C0C0E]">€{p.price.toLocaleString("de-DE")}</p>
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
