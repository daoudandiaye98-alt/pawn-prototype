import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Globe2, Sparkles, Hand } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { PageLabel } from "@/components/pawn/PageLabel";
import { PawnMark } from "@/components/pawn/PawnMark";
import { products, designers } from "@/data/mock";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <PublicLayout>
      {/* Hero — Light vs Shadow */}
      <section className="relative border-b border-foreground/10">
        <div className="relative grid min-h-[680px] grid-cols-1 md:grid-cols-2">
          {/* LIGHT */}
          <article className="relative flex flex-col justify-between bg-gradient-light p-10 md:p-16">
            <PageLabel index="01">Light</PageLabel>
            <div className="animate-fade-up">
              <h1 className="font-serif text-[3rem] leading-[0.92] md:text-[5.8rem]">
                INNOCENCE
                <br /> IS A CHOICE.
              </h1>
              <p className="mt-6 max-w-md text-base text-foreground/70">
                Purity. Structure. Control. A wardrobe drawn with patience —
                built to outlast the season.
              </p>
              <Link
                to="/shop?gender=women"
                className="mt-10 inline-flex items-center gap-3 border-b border-foreground pb-1 text-[0.7rem] uppercase tracking-[0.28em]"
              >
                Explore the light <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
              </Link>
            </div>
            <div className="flex items-end justify-between text-[0.6rem] uppercase tracking-[0.32em] text-foreground/55">
              <span>PAWN · Chapter 01</span>
              <span className="pawn-numeral text-foreground/40 text-base">— I</span>
            </div>
          </article>

          {/* SHADOW */}
          <article className="relative flex flex-col justify-between bg-gradient-shadow p-10 text-primary-foreground md:p-16">
            <PageLabel index="02" className="text-primary-foreground/70">
              Shadow
            </PageLabel>
            <div className="animate-fade-up">
              <h1 className="font-serif text-[3rem] leading-[0.92] md:text-[5.8rem]">
                AMBITION
                <br /> IS POWER.
              </h1>
              <p className="mt-6 max-w-md text-base text-primary-foreground/70">
                Instinct. Edge. Freedom. For those who treat clothing as a
                strategic weapon.
              </p>
              <Link
                to="/shop?gender=men"
                className="mt-10 inline-flex items-center gap-3 border-b border-primary-foreground pb-1 text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground"
              >
                Explore the shadow <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
              </Link>
            </div>
            <div className="flex items-end justify-between text-[0.6rem] uppercase tracking-[0.32em] text-primary-foreground/45">
              <span>PAWN · Chapter 02</span>
              <span className="pawn-numeral text-primary-foreground/35 text-base">II —</span>
            </div>
          </article>

          {/* Centerpiece pawn between two worlds */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-foreground/20 bg-background">
              <PawnMark className="h-12 w-12 text-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b border-foreground/10">
        <div className="editorial-container grid grid-cols-2 divide-x divide-foreground/10 md:grid-cols-4">
          {[
            { icon: Hand, label: "Curated by PAWN" },
            { icon: Sparkles, label: "AI Stylist" },
            { icon: ShieldCheck, label: "Secure Payments" },
            { icon: Globe2, label: "Worldwide Shipping" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-6 py-7">
              <Icon className="h-4 w-4 text-accent" strokeWidth={1.4} />
              <span className="text-[0.7rem] uppercase tracking-[0.26em]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Designers */}
      <section className="py-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              eyebrow="01 — Featured Houses"
              title={<>The studios<br />we collect.</>}
              description="Independent houses building entire worlds around their garments."
            />
            <Link
              to="/designers"
              className="hidden whitespace-nowrap text-[0.7rem] uppercase tracking-[0.26em] underline-offset-4 hover:underline md:inline"
            >
              View all designers →
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {designers.slice(0, 4).map((d) => (
              <DesignerCard key={d.slug} designer={d} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Pieces */}
      <section className="border-t border-foreground/10 py-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              eyebrow="02 — Featured Pieces"
              title={<>Worn by the<br />undecided minority.</>}
            />
            <Link
              to="/shop"
              className="hidden whitespace-nowrap text-[0.7rem] uppercase tracking-[0.26em] underline-offset-4 hover:underline md:inline"
            >
              Enter the boutique →
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* DNA CTA */}
      <section className="relative border-t border-foreground/10 bg-gradient-shadow py-28 text-primary-foreground">
        <div className="editorial-container grid items-center gap-12 md:grid-cols-2">
          <div>
            <PageLabel index="03" className="text-primary-foreground/60">
              Your DNA · Your Code
            </PageLabel>
            <h2 className="mt-5 font-serif text-5xl leading-[0.95] md:text-7xl">
              Style is a language.
              <br />
              We decode it.
            </h2>
            <p className="mt-7 max-w-lg text-primary-foreground/70">
              Discover the structural signature behind the way you dress — and
              the next evolution of your wardrobe.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-9 rounded-none bg-primary-foreground px-8 text-primary hover:bg-primary-foreground/90"
            >
              <Link to="/dna">Discover your DNA</Link>
            </Button>
          </div>
          <div className="aspect-square w-full max-w-md justify-self-end border border-primary-foreground/15 bg-primary/40 backdrop-blur">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <g stroke="hsl(36 35% 92% / 0.45)" fill="none" strokeWidth="0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <circle key={i} cx="100" cy="100" r={20 + i * 10} />
                ))}
                {Array.from({ length: 12 }).map((_, i) => (
                  <line
                    key={i}
                    x1="100"
                    y1="100"
                    x2={100 + 90 * Math.cos((i * Math.PI) / 6)}
                    y2={100 + 90 * Math.sin((i * Math.PI) / 6)}
                  />
                ))}
              </g>
              <text
                x="100"
                y="108"
                textAnchor="middle"
                fontFamily="Playfair Display"
                fontSize="44"
                fill="hsl(36 35% 92%)"
              >
                87
              </text>
              <text
                x="100"
                y="128"
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="6"
                letterSpacing="3"
                fill="hsl(36 35% 92% / 0.7)"
              >
                DNA SCORE
              </text>
            </svg>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Index;
