import { useState } from "react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { RadarPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/pawn/ProductCard";
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
      <section className="border-b border-border bg-gradient-light">
        <div className="editorial-container py-20 text-center">
          <p className="editorial-eyebrow">Style DNA</p>
          <h1 className="mt-4 font-serif text-6xl leading-[0.95] md:text-8xl">
            YOUR DNA.
            <br /> YOUR CODE.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Your style is a language. We decode it — molecule by molecule.
          </p>
        </div>
      </section>

      {/* AI prompt */}
      <section className="border-b border-border py-16">
        <div className="editorial-container max-w-3xl">
          <form onSubmit={ask} className="flex items-center gap-2 border border-foreground bg-card p-2">
            <Sparkles className="ml-2 h-4 w-4 text-accent" />
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask PAWN AI anything — about your style, about a piece, about a designer…"
              className="border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            />
            <Button type="submit" className="rounded-none bg-foreground text-background hover:bg-foreground/90">
              Ask
            </Button>
          </form>
          {response && (
            <div className="mt-4 border border-border bg-card p-6 text-sm text-foreground/80">
              <p className="editorial-eyebrow mb-2">PAWN AI · Prototype</p>
              {response}
            </div>
          )}
        </div>
      </section>

      {/* Score + radar */}
      <section className="border-b border-border py-20">
        <div className="editorial-container grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="border border-border bg-card p-10">
            <p className="editorial-eyebrow">DNA Score</p>
            <p className="mt-4 font-serif text-[8rem] leading-none">87</p>
            <p className="text-sm uppercase tracking-[0.22em] text-accent">Very distinct</p>
            <div className="mt-8 grid grid-cols-3 gap-4 text-xs">
              <Metric label="Cohesion" value="92" />
              <Metric label="Edge" value="78" />
              <Metric label="Range" value="84" />
            </div>
            <Button asChild className="mt-8 w-full rounded-none">
              <a href="#report">View full DNA report</a>
            </Button>
          </div>
          <div className="border border-border bg-card p-10">
            <p className="editorial-eyebrow">Style DNA</p>
            <RadarPlaceholder className="mt-4" />
          </div>
        </div>
      </section>

      {/* Triptych */}
      <section className="py-20">
        <div className="editorial-container">
          <SectionHeading eyebrow="Decoded" title="Inspired by you. Similar to you. Next, for you." />
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { title: "Inspired by you", subtitle: "From your last 14 saves" },
              { title: "Similar styles", subtitle: "DNA proximity ≥ 80%" },
              { title: "Next evolution", subtitle: "Three steps ahead" },
            ].map((card, i) => (
              <div key={card.title} className="border border-border bg-card">
                <ProductCard product={products[i]} />
                <div className="border-t border-border p-6">
                  <p className="editorial-eyebrow">{card.subtitle}</p>
                  <h3 className="mt-2 font-serif text-2xl">{card.title}</h3>
                  <a href="#" className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
                    Explore <ArrowRight className="h-3 w-3" />
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
    <div className="border border-border p-3">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </div>
  );
}

export default DNA;
