import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { Button } from "@/components/ui/button";
import { Globe2, Wrench, ShoppingBag, Crown, ArrowRight } from "lucide-react";

const BENEFITS = [
  { icon: Globe2, title: "Global visibility", body: "Featured across PAWN editorial channels and AI discovery." },
  { icon: Wrench, title: "Powerful tools", body: "Inventory, analytics, storytelling and AI co-styling — built in." },
  { icon: ShoppingBag, title: "Sell worldwide", body: "Borderless commerce with fully managed logistics." },
  { icon: Crown, title: "Your brand, your space", body: "A page that feels like a magazine cover, not a marketplace tile." },
];

const STEPS = [
  { n: "01", title: "Apply", body: "Tell us about your studio in fifteen minutes." },
  { n: "02", title: "Get reviewed", body: "Our curators answer within 7 days." },
  { n: "03", title: "Build your brand", body: "Design your designer page and upload your first drop." },
  { n: "04", title: "Sell & grow", body: "Launch globally with PAWN behind every order." },
];

const TESTIMONIALS = [
  { q: "PAWN didn't put us in a marketplace. It put us in a magazine.", who: "M. Aren, Founder — Studio Aren" },
  { q: "The AI surfaces the right customer before we even finish the campaign.", who: "L. Olesen, Creative Director" },
  { q: "Our first month on PAWN matched a full season anywhere else.", who: "K. Mori, Atelier Kuro" },
];

const Designers = () => {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-light">
        <div className="editorial-container grid gap-10 py-24 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="editorial-eyebrow">For Designers</p>
            <h1 className="mt-4 font-serif text-6xl leading-[0.95] md:text-8xl">
              FOR DESIGNERS,
              <br /> MADE TO BE SEEN.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              PAWN ist der Marktplatz für visionäre Designer und Artists. Build your world, reach global customers, and sell without losing identity.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-none">
                <Link to="/apply">Jetzt bewerben</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-none">
                <a href="#how">Mehr erfahren</a>
              </Button>
            </div>
          </div>
          <div className="relative border border-border bg-card p-8">
            <p className="editorial-eyebrow">Demo · Prototype data</p>
            <div className="mt-6 grid grid-cols-2 gap-6">
              <Stat value="12.4K+" label="Designers & Artists" />
              <Stat value="180+" label="Countries" />
              <Stat value="2.1M+" label="Community Members" />
              <Stat value="€24M+" label="Generated Revenue" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-border py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="Why PAWN" title="A platform built around the designer." />
          <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="border-t border-border pt-6">
                <Icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 font-serif text-2xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-b border-border py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="How it works" title="Four steps. One platform." />
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border border-border bg-card p-8">
                <p className="font-serif text-5xl text-accent">{s.n}</p>
                <h3 className="mt-4 font-serif text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-border py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="Studios on PAWN" title="The designers, in their own words." />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.who} className="border border-border bg-card p-8">
                <blockquote className="font-serif text-2xl leading-tight">&ldquo;{t.q}&rdquo;</blockquote>
                <figcaption className="mt-6 text-xs uppercase tracking-[0.22em] text-muted-foreground">{t.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-shadow py-24 text-primary-foreground">
        <div className="editorial-container text-center">
          <h2 className="font-serif text-5xl md:text-7xl">Ready to be seen?</h2>
          <p className="mx-auto mt-6 max-w-xl text-primary-foreground/70">
            Apply for the curator review and start building your PAWN presence within days.
          </p>
          <Button asChild size="lg" className="mt-10 rounded-none bg-primary-foreground text-primary hover:bg-primary-foreground/90">
            <Link to="/apply" className="inline-flex items-center gap-2">
              Apply now <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-border pt-4">
      <p className="font-serif text-4xl">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
    </div>
  );
}

export default Designers;
