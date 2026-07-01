import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Globe2, Sparkles, Hand } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { PageLabel } from "@/components/pawn/PageLabel";
import { PawnMark } from "@/components/pawn/PawnMark";
import { ChessDivider, ChapterLabel } from "@/components/pawn/ChessDivider";
import { DNAVisual } from "@/components/pawn/DNAVisual";
import { useStore, marketplaceSelectors } from "@/core";
import { Button } from "@/components/ui/button";

const Index = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
    <PublicLayout>
      {/* HERO — true paper vs ink chess split */}
      <section className="relative">
        <div className="relative grid min-h-[680px] grid-cols-1 md:grid-cols-2">
          {/* PAPER side */}
          <article className="paper-panel relative flex flex-col justify-between p-10 md:p-16">
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
              <span>PAWN · White</span>
              <span className="pawn-numeral text-foreground/40 text-base">— I</span>
            </div>
          </article>

          {/* INK side */}
          <article className="ink-panel relative flex flex-col justify-between p-10 md:p-16">
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
              <span>PAWN · Black</span>
              <span className="pawn-numeral text-primary-foreground/35 text-base">II —</span>
            </div>
          </article>

          {/* Centerpiece pawn — the chess pivot */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-foreground/20 bg-background">
              <PawnMark className="h-12 w-12 text-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="ivory-surface border-y border-foreground/10">
        <div className="editorial-container grid grid-cols-2 divide-x divide-foreground/10 md:grid-cols-4">
          {[
            { icon: Hand, label: "Curated by PAWN" },
            { icon: Sparkles, label: "AI Stylist" },
            { icon: ShieldCheck, label: "Secure Payments" },
            { icon: Globe2, label: "Worldwide Shipping" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 px-6 py-7">
              <Icon className="h-4 w-4" strokeWidth={1.4} />
              <span className="text-[0.7rem] uppercase tracking-[0.26em]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <ChessDivider label="The Houses" />

      {/* Featured Designers — bone surface */}
      <section className="bone-surface pb-24">
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

      <ChessDivider label="The Pieces" />

      {/* Featured Pieces — paper surface */}
      <section className="paper-surface py-24">
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

      {/* Intelligence band — INK with chess-grid texture */}
      <section className="relative ink-panel overflow-hidden">
        <div className="absolute inset-0 chess-grid-light opacity-40" aria-hidden />
        <div className="editorial-container relative grid items-center gap-12 py-24 md:grid-cols-[1.2fr_0.9fr]">
          <div>
            <ChapterLabel index="03" invert>Intelligence</ChapterLabel>
            <h2 className="mt-7 font-serif text-5xl leading-[0.95] md:text-7xl">
              PAWN is not a shop.
              <br />It is a system.
            </h2>
            <p className="mt-7 max-w-xl text-primary-foreground/70">
              An intelligence engine that learns your structural signature, decodes
              the houses that match it, and predicts the next piece before you do.
            </p>
            <div className="mt-10 flex items-center gap-6">
              <Button
                asChild
                size="lg"
                className="rounded-none bg-primary-foreground px-8 text-primary hover:bg-primary-foreground/90"
              >
                <Link to="/dna">Open your DNA dossier</Link>
              </Button>
              <Link
                to="/designers"
                className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/70 hover:text-primary-foreground"
              >
                For designers →
              </Link>
            </div>
          </div>
          <div className="flex justify-center text-primary-foreground/80">
            <DNAVisual className="h-[360px] w-auto" />
          </div>
        </div>
      </section>

      {/* Closing ivory commerce band */}
      <section className="ivory-surface">
        <div className="editorial-container grid items-center gap-10 py-20 md:grid-cols-[1.2fr_auto_1fr]">
          <div>
            <PageLabel index="04">The Floor</PageLabel>
            <h3 className="mt-4 font-serif text-4xl leading-[1.02] md:text-5xl">
              Enter the boutique.
            </h3>
            <p className="mt-4 max-w-md text-foreground/65">
              Every piece on PAWN is selected. Nothing is here by accident.
            </p>
          </div>
          <div className="hidden h-32 w-px bg-foreground/15 md:block" aria-hidden />
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-none bg-foreground px-8 text-background hover:bg-foreground/90">
              <Link to="/shop">Shop the collection</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none border-foreground/30">
              <Link to="/designers/all">Browse designers</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Index;
