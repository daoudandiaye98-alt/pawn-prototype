import { useState } from "react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { RadarPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/pawn/ProductCard";
import { PageLabel } from "@/components/pawn/PageLabel";
import { DNAVisual, DNARing } from "@/components/pawn/DNAVisual";
import { products } from "@/data/mock";
import { Sparkles, ArrowRight } from "lucide-react";

const DNA = () => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<string | null>(null);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setResponse(
      "Your signature reads as architectural with a romantic undertone. Try a sharper shoulder and an unexpected drape this season.",
    );
  }

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="border-b border-foreground/10 bg-gradient-light">
        <div className="editorial-container grid items-center gap-10 py-20 md:grid-cols-[1.3fr_0.9fr]">
          <div>
            <PageLabel index="01">Style DNA</PageLabel>
            <h1 className="mt-6 font-serif text-[3.2rem] leading-[0.92] md:text-[7rem]">
              YOUR DNA.
              <br /> YOUR CODE.
            </h1>
            <p className="mt-7 max-w-xl text-lg text-foreground/65 font-cormorant italic">
              Your style is a language. We decode it — molecule by molecule.
            </p>
          </div>
          <div className="flex items-center justify-center text-foreground">
            <DNAVisual className="h-[420px] w-auto" />
          </div>
        </div>
      </section>

      {/* AI command */}
      <section className="border-b border-foreground/10 py-16">
        <div className="editorial-container max-w-3xl">
          <PageLabel index="02">PAWN AI · Command</PageLabel>
          <form
            onSubmit={ask}
            className="mt-5 flex items-center gap-2 border border-foreground bg-card p-2"
          >
            <Sparkles className="ml-3 h-4 w-4 text-accent" strokeWidth={1.4} />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask PAWN AI — about your style, a piece, a designer…"
              className="border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              className="rounded-none bg-accent px-6 text-accent-foreground hover:bg-accent/90"
            >
              Ask
            </Button>
          </form>
          {response && (
            <div className="mt-4 border border-foreground/12 bg-card p-6 text-sm text-foreground/85">
              <p className="editorial-eyebrow mb-2">PAWN AI · Prototype</p>
              {response}
            </div>
          )}
        </div>
      </section>

      {/* Score + radar */}
      <section className="border-b border-foreground/10 py-20">
        <div className="editorial-container grid items-start gap-px bg-foreground/10 lg:grid-cols-[1fr_1.2fr]">
          <div className="bg-card p-10">
            <PageLabel index="03">DNA Score</PageLabel>
            <div className="mt-6 flex items-center justify-center text-accent">
              <DNARing score={87} className="h-72 w-72" />
            </div>
            <p className="mt-2 text-center text-[0.65rem] uppercase tracking-[0.32em] text-accent">
              Very distinct
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
              <Metric label="Cohesion" value="92" />
              <Metric label="Edge" value="78" />
              <Metric label="Range" value="84" />
            </div>
            <Button asChild className="mt-8 w-full rounded-none bg-accent text-accent-foreground hover:bg-accent/90">
              <a href="#report">View full DNA report</a>
            </Button>
          </div>
          <div className="bg-card p-10">
            <PageLabel index="04">Style DNA</PageLabel>
            <RadarPlaceholder className="mt-6" />
          </div>
        </div>
      </section>

      {/* Triptych */}
      <section className="py-24">
        <div className="editorial-container">
          <SectionHeading
            eyebrow="05 — Decoded"
            title="Inspired by you. Similar to you. Next, for you."
          />
          <div className="mt-14 grid grid-cols-1 gap-px bg-foreground/10 md:grid-cols-3">
            {[
              { title: "Inspired by you", subtitle: "From your last 14 saves" },
              { title: "Similar styles", subtitle: "DNA proximity ≥ 80%" },
              { title: "Next evolution", subtitle: "Three steps ahead" },
            ].map((card, i) => (
              <div key={card.title} className="bg-background">
                <ProductCard product={products[i]} />
                <div className="border-t border-foreground/10 p-6">
                  <p className="editorial-eyebrow">{card.subtitle}</p>
                  <h3 className="mt-2 font-serif text-2xl">{card.title}</h3>
                  <a
                    href="#"
                    className="mt-4 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.28em]"
                  >
                    Explore <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-foreground/10 p-3 text-center">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </div>
  );
}

export default DNA;
