import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Globe2, Sparkles, Hand } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { products, designers } from "@/data/mock";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <PublicLayout>
      {/* Hero — Light vs Shadow */}
      <section className="border-b border-border">
        <div className="grid min-h-[640px] grid-cols-1 md:grid-cols-2">
          <article className="relative flex flex-col justify-between bg-gradient-light p-10 md:p-16">
            <p className="editorial-eyebrow">I — Light</p>
            <div className="animate-fade-up">
              <h1 className="font-serif text-[3.2rem] leading-[0.95] md:text-[5.5rem]">
                INNOCENCE
                <br /> IS A CHOICE.
              </h1>
              <p className="mt-6 max-w-md text-base text-foreground/70">
                Purity. Structure. Control. A wardrobe drawn with patience — built to outlast the season.
              </p>
              <Link to="/shop?gender=women" className="mt-10 inline-flex items-center gap-3 border-b border-foreground pb-1 text-sm uppercase tracking-[0.22em]">
                Explore the light <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">PAWN · Chapter 01</p>
          </article>
          <article className="relative flex flex-col justify-between bg-gradient-shadow p-10 text-primary-foreground md:p-16">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/60">II — Shadow</p>
            <div className="animate-fade-up">
              <h1 className="font-serif text-[3.2rem] leading-[0.95] md:text-[5.5rem]">
                AMBITION
                <br /> IS POWER.
              </h1>
              <p className="mt-6 max-w-md text-base text-primary-foreground/70">
                Instinct. Edge. Freedom. For those who treat clothing as a strategic weapon.
              </p>
              <Link to="/shop?gender=men" className="mt-10 inline-flex items-center gap-3 border-b border-primary-foreground pb-1 text-sm uppercase tracking-[0.22em] text-primary-foreground">
                Explore the shadow <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-primary-foreground/40">PAWN · Chapter 02</p>
          </article>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-b border-border">
        <div className="editorial-container grid grid-cols-2 divide-x divide-border md:grid-cols-4">
          {[
            { icon: Hand, label: "Curated by PAWN" },
            { icon: Sparkles, label: "AI Stylist" },
            { icon: ShieldCheck, label: "Secure Payments" },
            { icon: Globe2, label: "Worldwide Shipping" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-6 py-6">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-xs uppercase tracking-[0.22em]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Designers */}
      <section className="py-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading eyebrow="Featured Designers" title={<>The studios<br />we collect.</>} description="Independent houses building entire worlds around their garments." />
            <Link to="/designers" className="hidden whitespace-nowrap text-xs uppercase tracking-[0.22em] underline-offset-4 hover:underline md:inline">
              View all designers →
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {designers.slice(0, 4).map((d) => <DesignerCard key={d.slug} designer={d} />)}
          </div>
        </div>
      </section>

      {/* Featured Pieces */}
      <section className="border-t border-border py-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading eyebrow="Featured Pieces" title={<>Worn by the<br />undecided minority.</>} />
            <Link to="/shop" className="hidden whitespace-nowrap text-xs uppercase tracking-[0.22em] underline-offset-4 hover:underline md:inline">
              Enter the boutique →
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* DNA CTA */}
      <section className="border-t border-border bg-gradient-shadow py-24 text-primary-foreground">
        <div className="editorial-container grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/60">Your DNA. Your Code.</p>
            <h2 className="mt-4 font-serif text-5xl md:text-6xl">Style is a language. We decode it.</h2>
            <p className="mt-6 max-w-lg text-primary-foreground/70">
              Discover the structural signature behind the way you dress — and the next evolution of your wardrobe.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-none bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              <Link to="/dna">Discover your DNA</Link>
            </Button>
          </div>
          <div className="aspect-square w-full max-w-md justify-self-end border border-primary-foreground/20 bg-primary/40 backdrop-blur">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <g stroke="hsl(38 32% 92% / 0.5)" fill="none" strokeWidth="0.6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <circle key={i} cx="100" cy="100" r={20 + i * 10} />
                ))}
                {Array.from({ length: 12 }).map((_, i) => (
                  <line key={i} x1="100" y1="100" x2={100 + 90 * Math.cos((i * Math.PI) / 6)} y2={100 + 90 * Math.sin((i * Math.PI) / 6)} />
                ))}
              </g>
              <text x="100" y="105" textAnchor="middle" fontFamily="Cormorant Garamond" fontSize="36" fill="hsl(38 32% 92%)">87</text>
            </svg>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Index;
