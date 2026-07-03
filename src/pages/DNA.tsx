import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, ArrowDown } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { PageLabel } from "@/components/pawn/PageLabel";
import { ChessDivider, ChapterLabel } from "@/components/pawn/ChessDivider";
import { DNAVisual, DNARing } from "@/components/pawn/DNAVisual";
import { useStore, marketplaceSelectors } from "@/core";
import { MutationMoment } from "@/features/dna/MutationMoment";


/**
 * DNA — the Identity Dossier.
 *
 * Reads top-to-bottom as a psychological fashion analysis, not a dashboard.
 * Chapter rhythm 01–09. Chess polarity: paper → ink → ivory → bone → ink → ivory.
 *
 * Future backend (see src/docs/BACKEND.md):
 *   dna_profiles · dna_reports
 */

const GENOME = [
  { key: "Structure",  value: 92, note: "Architectural restraint dominates" },
  { key: "Edge",       value: 78, note: "Considered, not loud" },
  { key: "Elegance",   value: 84, note: "Quiet, drawn slowly" },
  { key: "Darkness",   value: 71, note: "Shadow as composition" },
  { key: "Sensuality", value: 58, note: "Suppressed — room to grow" },
  { key: "Utility",    value: 66, note: "Form follows intent" },
];

const MUTATION = [
  {
    label: "Current Style",
    title: "Architectural Romance",
    body: "You build outfits like architecture: one strong line, one strong silence. Lemaire, Toteme, Y/Project.",
  },
  {
    label: "Suppressed Style",
    title: "Brutalist Sensuality",
    body: "Rick Owens, Ann Demeulemeester. A reading the algorithm sees beneath your saves — not yet expressed.",
  },
  {
    label: "Next Evolution",
    title: "Structured Drape",
    body: "A bias-cut silk under a heavy wool coat. The piece you have not bought, but already own in intention.",
  },
];

const DNA = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setResponse(
      "Your signature reads as architectural with a romantic undertone. PAWN AI suggests a sharper shoulder and an unexpected drape this season — the Y/PROJECT Asymmetric Coat is your structural match.",
    );
  }

  return (
    <PublicLayout>
      {/* 01 · Opening — PAPER */}
      <section className="paper-surface relative">
        <div className="editorial-container py-24 md:py-32">
          <ChapterLabel index="01">Opening</ChapterLabel>
          <h1 className="mt-10 font-serif text-[3.4rem] leading-[0.9] md:text-[8.2rem]">
            YOUR DNA.
            <br />YOUR CODE.
          </h1>
          <p className="mt-10 max-w-xl font-cormorant text-2xl italic text-foreground/70">
            Your style is a language. We decode it — molecule by molecule.
          </p>
          <div className="mt-16 flex items-center gap-3 text-foreground/50">
            <ArrowDown className="h-4 w-4" strokeWidth={1.2} />
            <span className="text-[0.6rem] uppercase tracking-[0.34em]">
              Continue the dossier
            </span>
          </div>
        </div>
        <div className="hairline" />
      </section>

      {/* 02 · AI Command — INK */}
      <section className="ink-panel">
        <div className="editorial-container py-20">
          <ChapterLabel index="02" invert>The Question</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            Ask PAWN anything.
          </h2>
          <p className="mt-5 max-w-xl text-primary-foreground/65">
            About your wardrobe, a designer, a silhouette. The AI reads your signature
            in real time.
          </p>
          <form onSubmit={ask} className="mt-10 flex items-center gap-0 border border-primary-foreground/30 bg-ink-soft">
            <Sparkles className="ml-4 h-4 w-4 text-primary-foreground/70" strokeWidth={1.4} />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What does my style say about me?"
              className="border-0 bg-transparent text-base text-primary-foreground placeholder:text-primary-foreground/40 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              className="rounded-none decision-pill px-8 py-6 hover:opacity-90"
            >
              Decode
            </Button>
          </form>
          {response && (
            <div className="mt-6 border border-primary-foreground/15 bg-ink-soft p-6 text-sm text-primary-foreground/85">
              <p className="text-[0.6rem] uppercase tracking-[0.32em] text-primary-foreground/55">
                PAWN AI · Prototype
              </p>
              <p className="mt-2 font-cormorant text-xl italic">{response}</p>
            </div>
          )}
        </div>
      </section>

      {/* 03 · DNA Score + Helix — IVORY */}
      <section className="ivory-surface">
        <div className="editorial-container grid items-center gap-16 py-24 md:grid-cols-[1fr_1fr]">
          <div>
            <ChapterLabel index="03">Identity Reading</ChapterLabel>
            <h2 className="mt-6 font-serif text-5xl leading-[0.98] md:text-7xl">
              87 / 100.
              <br />
              <span className="text-foreground/55">Very Distinct.</span>
            </h2>
            <p className="mt-7 max-w-md text-foreground/70">
              Your style sits in the top 8% of distinct signatures on PAWN. You are
              not following a trend — you have a syntax.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-px bg-foreground/10">
              {[
                ["Cohesion", "92"],
                ["Edge", "78"],
                ["Range", "84"],
              ].map(([l, v]) => (
                <div key={l} className="bg-ivory p-5">
                  <p className="editorial-eyebrow">{l}</p>
                  <p className="mt-2 pawn-numeral text-3xl">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-10 text-foreground">
            <DNAVisual className="h-[420px] w-auto" />
            <DNARing score={87} className="hidden h-64 w-64 text-foreground md:block" />
          </div>
        </div>
        <ChessDivider label="Style Genome" />
      </section>

      {/* 04 · Style Genome — BONE editorial bar chart */}
      <section className="bone-surface">
        <div className="editorial-container py-24">
          <ChapterLabel index="04">Style Genome</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            The six molecules of your wardrobe.
          </h2>
          <div className="mt-14 grid gap-px bg-foreground/12 md:grid-cols-2">
            {GENOME.map((g) => (
              <div key={g.key} className="bg-bone p-8">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-2xl">{g.key}</h3>
                  <span className="pawn-numeral text-3xl text-foreground/80">{g.value}</span>
                </div>
                <div className="mt-5 h-px w-full bg-foreground/15">
                  <div
                    className="h-px bg-foreground"
                    style={{ width: `${g.value}%`, transform: "translateY(-0.5px)", height: "2px" }}
                  />
                </div>
                <p className="mt-4 text-sm text-foreground/65 font-cormorant italic">
                  {g.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · Mutation Path — INK with chess texture */}
      <section className="relative ink-panel overflow-hidden">
        <div className="absolute inset-0 chess-grid-light opacity-30" aria-hidden />
        <div className="editorial-container relative py-24">
          <ChapterLabel index="05" invert>Mutation Path</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            Where your style is going.
          </h2>
          <p className="mt-5 max-w-xl text-primary-foreground/65">
            Every signature mutates. PAWN traces the line from who you are now,
            through what you suppress, to what you will become.
          </p>
          <div className="mt-14 grid gap-px bg-primary-foreground/15 md:grid-cols-3">
            {MUTATION.map((m, i) => (
              <div key={m.title} className="relative bg-ink p-8">
                <p className="text-[0.6rem] uppercase tracking-[0.34em] text-primary-foreground/55">
                  {String(i + 1).padStart(2, "0")} · {m.label}
                </p>
                <h3 className="mt-6 font-serif text-3xl text-primary-foreground">{m.title}</h3>
                <p className="mt-5 text-sm text-primary-foreground/65 font-cormorant italic leading-relaxed">
                  {m.body}
                </p>
                {i < MUTATION.length - 1 && (
                  <ArrowRight className="absolute right-4 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary-foreground/40 md:block" strokeWidth={1.2} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-16">
            <MutationMoment />
          </div>
        </div>
      </section>

      {/* 06 · Inspired by you — PAPER */}
      <section className="paper-surface">
        <div className="editorial-container py-24">
          <ChapterLabel index="06">Inspired by you</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            Read from your last 14 saves.
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 3).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
        <ChessDivider label="Aligned Houses" />
      </section>

      {/* 07 · Designers aligned with your DNA — IVORY */}
      <section className="ivory-surface">
        <div className="editorial-container py-24">
          <ChapterLabel index="07">Aligned Houses</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            Studios that speak your syntax.
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {designers.slice(0, 3).map((d) => (
              <div key={d.slug} className="space-y-3">
                <DesignerCard designer={d} />
                <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.3em] text-foreground/60">
                  <span className="pawn-numeral text-base">{82 + ((d.slug.length * 3) % 12)}%</span>
                  <span>DNA proximity</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 08 · Mutating pieces — BONE */}
      <section className="bone-surface">
        <div className="editorial-container py-24">
          <ChapterLabel index="08">Mutating Pieces</ChapterLabel>
          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] md:text-6xl">
            The pieces that will move you forward.
          </h2>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(3, 6).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* 09 · Full DNA Report — INK · single oxblood decision */}
      <section className="ink-panel">
        <div className="editorial-container grid items-center gap-12 py-28 md:grid-cols-[1.4fr_auto_1fr]">
          <div>
            <ChapterLabel index="09" invert>The Report</ChapterLabel>
            <h2 className="mt-6 font-serif text-5xl leading-[0.98] md:text-7xl">
              Read your full
              <br />DNA dossier.
            </h2>
            <p className="mt-7 max-w-xl text-primary-foreground/65">
              42 pages. Signature, mutation path, suppressed identities, designer
              alignment, and a six-month wardrobe roadmap.
            </p>
          </div>
          <div className="hidden h-40 w-px bg-primary-foreground/20 md:block" aria-hidden />
          <div className="flex flex-col items-start gap-4">
            <Button asChild size="lg" className="rounded-none decision-pill px-10 py-7 text-sm hover:opacity-90">
              <Link to="/account">View full DNA report</Link>
            </Button>
            <Link to="/shop" className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/60 hover:text-primary-foreground">
              Or shop your signature →
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DNA;
