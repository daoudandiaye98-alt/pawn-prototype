import { useParams } from "react-router-dom";
import { Play } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductImage } from "@/components/pawn/ProductImage";
import { ProductCard } from "@/components/pawn/ProductCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { designerBySlug, products } from "@/data/mock";

const DesignerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const designer = designerBySlug(slug ?? "y-project");
  const designerProducts = products.filter((p) => p.designerSlug === designer.slug);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="relative">
          <ProductImage seed={designer.slug + "_hero"} className="h-[60vh] min-h-[420px] w-full" />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-10 text-primary-foreground md:p-16">
            <p className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/60">{designer.location}</p>
            <h1 className="mt-3 font-serif text-6xl leading-[0.95] md:text-8xl">{designer.name}</h1>
            <p className="mt-3 max-w-xl text-lg text-primary-foreground/80">{designer.slogan}</p>
            <div className="mt-6">
              <Button className="rounded-none bg-primary-foreground text-primary hover:bg-primary-foreground/90">Follow studio</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border">
        <div className="editorial-container grid grid-cols-2 divide-x divide-border py-8 md:grid-cols-5">
          {[
            ["Collections", designer.collections],
            ["Products", designer.productsCount],
            ["Followers", (designer.followers / 1000).toFixed(0) + "K"],
            ["Featured in", designer.featuredIn],
            ["Member since", designer.memberSince],
          ].map(([label, value]) => (
            <div key={label} className="px-4">
              <p className="font-serif text-3xl">{value}</p>
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Story + showreel */}
      <section className="border-b border-border py-20">
        <div className="editorial-container grid items-start gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="editorial-eyebrow">The story</p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">A studio drawn in long lines.</h2>
            <p className="mt-6 text-foreground/70">{designer.bio}</p>
            <p className="mt-4 text-foreground/70">
              Each collection at {designer.name} extends a single sentence — re-cut, re-draped, re-asked. PAWN is the only marketplace where the studio releases archival drops.
            </p>
          </div>
          <div className="relative aspect-video w-full overflow-hidden border border-border">
            <ProductImage seed={designer.slug + "_reel"} className="h-full w-full" />
            <button className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center border border-primary-foreground/60 bg-background/20 text-primary-foreground backdrop-blur transition-colors hover:bg-background/40">
              <Play className="ml-0.5 h-5 w-5" />
            </button>
            <span className="absolute bottom-3 left-3 text-[0.65rem] uppercase tracking-[0.28em] text-primary-foreground/80">Showreel · A/W 26</span>
          </div>
        </div>
      </section>

      {/* Collections grid */}
      <section className="border-b border-border py-20">
        <div className="editorial-container">
          <SectionHeading eyebrow="Collections" title="From archive to current." />
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {["S/S 26", "A/W 25", "Resort 25", "Archive"].map((c, i) => (
              <div key={c} className="group">
                <ProductImage seed={designer.slug + "_c" + i} className="aspect-[4/5] w-full" />
                <p className="mt-3 font-serif text-xl">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured pieces */}
      {designerProducts.length > 0 && (
        <section className="border-b border-border py-20">
          <div className="editorial-container">
            <SectionHeading eyebrow="Featured pieces" title="What we recommend, right now." />
            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {designerProducts.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="bg-gradient-shadow py-20 text-primary-foreground">
        <div className="editorial-container max-w-2xl text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground/60">Studio newsletter</p>
          <h2 className="mt-4 font-serif text-4xl md:text-5xl">Be first inside the studio.</h2>
          <p className="mt-3 text-primary-foreground/70">Drops, archival releases and behind-the-scenes notes, only through PAWN.</p>
          <form className="mt-8 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <Input placeholder="Your email" className="rounded-none border-primary-foreground/40 bg-transparent text-primary-foreground placeholder:text-primary-foreground/40" />
            <Button className="rounded-none bg-primary-foreground text-primary hover:bg-primary-foreground/90">Subscribe</Button>
          </form>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DesignerPage;
