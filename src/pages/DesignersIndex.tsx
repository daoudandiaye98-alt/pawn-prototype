import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { useStore, marketplaceSelectors } from "@/core";
import { PageHeader, SectionHeader, Command, Hairline } from "@/components/pawn/primitives";

const DesignersIndex = () => {
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  return (
    <PublicLayout>
      <section className="paper-surface">
        <div className="editorial-container section-y">
          <PageHeader
            eyebrow="Designers"
            index="A—Z"
            title={<>The houses<br />we collect.</>}
            lede="Independent studios building entire worlds around their garments. Each one curated by PAWN."
            action={
              <Link to="/apply" className="inline-flex h-12 items-center justify-center bg-[hsl(var(--oxblood))] px-8 text-[0.78rem] uppercase tracking-[0.22em] text-[hsl(var(--accent-foreground))] motion-micro hover:opacity-90">
                Apply as designer
              </Link>
            }
          />
        </div>
        <Hairline />
      </section>
      <section className="ivory-surface">
        <div className="editorial-container section-y">
          <SectionHeader eyebrow="Directory" title="All designers" description="Every studio on PAWN, listed alphabetically." />
          <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {designers.map((d) => <DesignerCard key={d.slug} designer={d} />)}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DesignersIndex;
