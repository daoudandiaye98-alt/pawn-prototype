import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { useStore, marketplaceSelectors } from "@/core";
import { Button } from "@/components/ui/button";

const DesignersIndex = () => {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-light">
        <div className="editorial-container grid gap-10 py-20 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="editorial-eyebrow">Designers</p>
            <h1 className="mt-3 font-serif text-6xl leading-[0.95] md:text-8xl">The houses we collect.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Independent studios building entire worlds around their garments. Each one curated by PAWN.
            </p>
          </div>
          <div className="self-end">
            <Button asChild size="lg" className="rounded-none">
              <Link to="/apply">Apply as designer</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="editorial-container">
          <SectionHeading eyebrow="A — Z" title="All designers" />
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {designers.map((d) => <DesignerCard key={d.slug} designer={d} />)}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DesignersIndex;
