import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { PageLabel } from "@/components/pawn/PageLabel";
import { ProductImage } from "@/components/pawn/ProductImage";
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
  { n: "03", title: "Build your brand", body: "Design your page and upload your first drop." },
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
      {/* HERO */}
      <section className="border-b border-foreground/10 bg-gradient-light">
        <div className="editorial-container grid gap-0 md:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col justify-between py-20 pr-0 md:pr-12">
            <PageLabel index="01">For Designers</PageLabel>
            <div className="mt-10">
              <h1 className="font-serif text-[3rem] leading-[0.92] md:text-[6rem]">
                FOR DESIGNERS,
                <br /> MADE TO BE SEEN.
              </h1>
              <p className="mt-8 max-w-xl text-lg text-foreground/65 font-cormorant italic">
                Werde Teil von PAWN. Zeige deine Arbeit einer globalen Community —
                ohne deine Identität zu verlieren.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90 px-8">
                  <Link to="/apply">Jetzt bewerben</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-none border-foreground/40 px-8">
                  <a href="#how">Mehr erfahren</a>
                </Button>
              </div>
            </div>
          </div>
          <div className="relative -mr-6 md:-mr-10 border-l border-foreground/10">
            <ProductImage seed="designers-hero-pawn" className="aspect-[3/4] h-full w-full md:aspect-auto" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-[0.6rem] uppercase tracking-[0.32em] text-background/75">
              <span>PAWN · Atelier</span>
              <span className="pawn-numeral text-base text-background/60">— 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — oxblood band */}
      <section className="border-b border-foreground/10 bg-accent text-accent-foreground">
        <div className="editorial-container grid grid-cols-2 divide-x divide-accent-foreground/15 md:grid-cols-4">
          {[
            ["12.4K+", "Designers & Artists"],
            ["180+", "Countries"],
            ["2.1M+", "Community Members"],
            ["€24M+", "Generated Revenue"],
          ].map(([v, l]) => (
            <div key={l} className="px-6 py-10">
              <p className="font-serif text-4xl md:text-5xl">{v}</p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] opacity-75">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-foreground/10 py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="02 — Why PAWN" title="A platform built around the designer." />
          <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="border-t border-foreground/15 pt-6">
                <Icon className="h-5 w-5 text-accent" strokeWidth={1.4} />
                <h3 className="mt-5 font-serif text-2xl">{title}</h3>
                <p className="mt-2 text-sm text-foreground/65">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-b border-foreground/10 py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="03 — How it works" title="Four steps. One platform." />
          <div className="mt-14 grid gap-px bg-foreground/10 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-background p-10">
                <p className="pawn-numeral text-5xl text-accent">{s.n}</p>
                <h3 className="mt-5 font-serif text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm text-foreground/65">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b border-foreground/10 py-24">
        <div className="editorial-container">
          <SectionHeading eyebrow="04 — Studios on PAWN" title="The designers, in their own words." />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.who} className="border border-foreground/12 bg-card p-10">
                <span className="pawn-numeral text-4xl text-accent">”</span>
                <blockquote className="mt-2 font-serif text-2xl leading-tight">{t.q}</blockquote>
                <figcaption className="mt-8 text-[0.65rem] uppercase tracking-[0.28em] text-foreground/60">
                  {t.who}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-shadow py-28 text-primary-foreground">
        <div className="editorial-container text-center">
          <PageLabel index="05" className="justify-center text-primary-foreground/60">
            Bewerbung
          </PageLabel>
          <h2 className="mt-6 font-serif text-5xl md:text-7xl">Ready to be seen?</h2>
          <p className="mx-auto mt-6 max-w-xl text-primary-foreground/70">
            Apply for the curator review and start building your PAWN presence within days.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-10 rounded-none bg-primary-foreground text-primary hover:bg-primary-foreground/90 px-10"
          >
            <Link to="/apply" className="inline-flex items-center gap-2">
              Apply now <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Designers;
