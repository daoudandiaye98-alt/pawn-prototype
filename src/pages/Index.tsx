import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { HeroScene } from "@/components/palace/HeroScene";
import { HelixScene } from "@/components/palace/HelixScene";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { usePublicDesigners, useActiveCollection } from "@/lib/publicData";
import { useStore, marketplaceSelectors } from "@/core";

function useScrollProgress(ref: React.RefObject<HTMLElement>) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const prog = Math.max(0, Math.min(1, scrolled / Math.max(1, total)));
      setP(prog);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);
  return p;
}

const Index = () => {
  const { designers } = usePublicDesigners();
  const collection = useActiveCollection();
  const products = useStore(marketplaceSelectors.getAllProductViews);

  const featured = designers.filter((d) => d.is_featured);
  const cover = featured[0] ?? designers[0];
  const statement = featured[1] ?? designers[1] ?? designers[0];
  const featuredCount = featured.length || 8;
  const atelierCount = designers.length;

  // Canvas fade-out on scroll (except during finale).
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const finaleRef = useRef<HTMLElement | null>(null);
  const finaleProgress = useScrollProgress(finaleRef as React.RefObject<HTMLElement>);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const heroFade = Math.max(0.07, 1 - y / (window.innerHeight * 0.9));
      const finaleBoost = finaleProgress > 0.05 ? finaleProgress : 0;
      setCanvasOpacity(Math.min(1, heroFade + finaleBoost));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [finaleProgress]);

  // Horizontal collection track scroll
  const trackSectionRef = useRef<HTMLElement | null>(null);
  const trackInnerRef = useRef<HTMLDivElement | null>(null);
  const trackProgress = useScrollProgress(trackSectionRef as React.RefObject<HTMLElement>);
  const smoothedRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      smoothedRef.current += (trackProgress - smoothedRef.current) * 0.09;
      const inner = trackInnerRef.current;
      if (inner) {
        const max = inner.scrollWidth - window.innerWidth;
        inner.style.transform = `translate3d(${-smoothedRef.current * Math.max(0, max)}px, 0, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trackProgress]);

  // Signature scene texts
  const finaleText = finaleProgress < 0.33
    ? "Jeder fängt klein an."
    : finaleProgress < 0.66
      ? "Der Raum wächst mit."
      : "Aus dem Bauern wird die Dame.";

  const productBySlug = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>();
    for (const p of products) m.set(p.slug, p);
    return m;
  }, [products]);

  const editorialTiles = products.slice(0, 6);

  return (
    <PalaceLayout>
      {/* Fixed 3D canvas layer behind everything */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
        style={{ opacity: canvasOpacity, transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
      >
        <HeroScene finaleProgress={finaleProgress} />
      </div>

      {/* ── 01 HERO ─────────────────────────────────────────── */}
      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 md:px-14">
        <div className="mx-auto max-w-[1400px] text-center">
          <p className="palace-eyebrow motion-reveal">
            Kuratierte Ausstellung · Ausgabe 07 · Juli
          </p>
          <h1
            className="palace-serif palace-line-rise mt-10 text-[#0C0C0E]"
            style={{ fontSize: "clamp(3rem, 8.5vw, 8.2rem)", lineHeight: 0.94, letterSpacing: "-0.02em" }}
          >
            <span className="block font-light">{featuredCount} Designer,</span>
            <span className="block italic font-light">die du noch nicht kennst.</span>
          </h1>
          <p className="mx-auto mt-10 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/70">
            Mode · Interior · Kunst — ausgewählt aus {atelierCount} unabhängigen Ateliers.
          </p>

          <HeroPrompt />

          <div className="mt-16 flex flex-col items-center gap-4">
            <span className="palace-eyebrow">Scroll</span>
            <span className="palace-drip block h-14 w-px bg-[#0C0C0E]" />
          </div>
        </div>
      </section>

      {/* ── 02 NAMESTRIP ────────────────────────────────────── */}
      <section className="relative z-10 border-y border-[rgba(12,12,14,.13)] bg-[#F1EEE7] py-6 overflow-hidden">
        <div className="palace-marquee flex whitespace-nowrap">
          {[...designers, ...designers].map((d, i) => (
            <span key={`${d.id}-${i}`} className="flex items-center gap-6 px-8 palace-eyebrow">
              <span className="text-[#0C0C0E]">{d.brand_name}</span>
              <span className="text-[#A8A49B]">· {d.location ?? "—"}</span>
              <span className="text-[#A8A49B]">◆</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── 03 COVER STORY ──────────────────────────────────── */}
      {cover && (
        <section className="relative z-10 bg-[#F1EEE7]">
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-0 px-0 md:grid-cols-[1.25fr_1fr] md:min-h-[92vh]">
            <Reveal className="relative">
              <EditorialImage
                seed={`cover-${cover.slug}`}
                src={cover.hero_image_url ?? cover.banner_url}
                ratio="5/4"
                className="h-full w-full"
                priority
              />
              <div className="absolute bottom-6 left-6 max-w-xs" style={{ mixBlendMode: "difference" }}>
                <p className="palace-eyebrow text-white/70">Cover Story · Nr. 07</p>
                <p className="mt-2 font-serif italic text-white">{cover.brand_name}, {cover.location ?? "—"}</p>
              </div>
            </Reveal>

            <Reveal delay={120} className="flex flex-col justify-center gap-8 px-8 py-16 md:px-14 md:py-24">
              <p className="palace-eyebrow">Cover Story</p>
              <h2 className="palace-serif font-light text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.02] text-[#0C0C0E]">
                {cover.brand_name}. <span className="italic">Eine Handschrift,<br/>die man wiederkennt.</span>
              </h2>
              {cover.story && (
                <p className="max-w-md text-[0.95rem] leading-relaxed text-[#0C0C0E]/80">
                  {cover.story}
                </p>
              )}
              {cover.quote && (
                <blockquote className="max-w-md border-l border-[rgba(12,12,14,.28)] pl-5">
                  <p className="palace-serif italic text-[1.4rem] leading-snug text-[#0C0C0E]">„{cover.quote}"</p>
                  <cite className="mt-3 block not-italic palace-eyebrow">{cover.quote_role ?? cover.brand_name}</cite>
                </blockquote>
              )}
              <Link to={`/designer/${cover.slug}`} className="palace-eyebrow uline w-fit text-[#0C0C0E]">
                Kollektion ansehen →
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 04 EDITORIAL GRID · Frisch aus den Ateliers ───── */}
      <section className="relative z-10 bg-[#F1EEE7] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-16 flex items-end justify-between gap-8">
            <div>
              <p className="palace-eyebrow">Diese Woche neu</p>
              <h2 className="palace-serif mt-4 font-light text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">
                Frisch aus <span className="italic">den Ateliers.</span>
              </h2>
            </div>
            <Link to="/neu" className="palace-eyebrow uline text-[#0C0C0E]">Alles Neue →</Link>
          </div>

          <div className="grid grid-cols-12 gap-6 md:gap-8">
            {editorialTiles.map((p, i) => {
              // Alternating monumental row shapes
              const layouts = [
                { span: "col-span-12 md:col-span-5", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                { span: "col-span-12 md:col-span-5", ratio: "3/2" as const },
              ];
              const l = layouts[i % layouts.length];
              return (
                <Reveal key={p.id} delay={i * 60} className={l.span}>
                  <Link to={`/product/${p.slug}`} className="group block">
                    <EditorialImage seed={`prod-${p.slug}`} ratio={l.ratio} />
                    <div className="mt-4">
                      <p className="palace-serif italic text-[1.15rem] leading-tight text-[#0C0C0E]">{p.name}</p>
                      <p className="palace-eyebrow mt-2">Mode · {p.designer}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 05 STATEMENT BANNER ─────────────────────────────── */}
      {statement && (
        <section className="relative z-10 min-h-[72vh] overflow-hidden">
          <EditorialImage
            seed={`banner-${statement.slug}`}
            src={statement.hero_image_url ?? statement.banner_url}
            ratio="16/9"
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-0 bg-[#0C0C0E]/45" />
          <div className="relative flex min-h-[72vh] items-center justify-center px-6 text-center">
            <Reveal>
              <p className="palace-eyebrow text-white/60">Statement</p>
              <blockquote className="mx-auto mt-8 max-w-3xl">
                <p className="palace-serif italic font-light text-white" style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.6rem)", lineHeight: 1.1 }}>
                  „{statement.quote ?? "Der Raum trägt, was du sonst nirgends findest."}"
                </p>
                <cite className="mt-8 block not-italic palace-eyebrow text-white/70">
                  {statement.quote_role ?? statement.brand_name}
                </cite>
              </blockquote>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 06 CURATED COLLECTION · horizontal scroll ─────── */}
      <section ref={trackSectionRef} className="relative z-10 bg-[#F1EEE7]" style={{ height: "320vh" }}>
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="px-6 pt-24 md:px-14">
            <div className="mx-auto flex max-w-[1600px] items-end justify-between gap-8">
              <div>
                <p className="palace-eyebrow">Kuratierte Kollektion № {collection.number}</p>
                <h2 className="palace-serif mt-4 font-light text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">
                  {collection.title}. <span className="italic">{collection.subtitle}</span>
                </h2>
              </div>
              <p className="palace-eyebrow hidden md:block">Scroll = seitwärts</p>
            </div>
          </div>
          <div className="mt-16 flex flex-1 items-center overflow-hidden">
            <div ref={trackInnerRef} className="flex gap-8 pl-6 md:pl-14 will-change-transform">
              {collection.items.map((it, i) => {
                const p = productBySlug.get(it.product_slug);
                return (
                  <Reveal key={`${it.product_slug}-${i}`} delay={i * 40} className="w-[74vw] shrink-0 md:w-[36vw] lg:w-[28vw]">
                    <div className="relative">
                      <EditorialImage seed={`col-${it.product_slug}`} ratio="3/4" />
                      <span
                        className="absolute left-4 top-4 palace-eyebrow text-white"
                        style={{ mixBlendMode: "difference" }}
                      >
                        {it.world ?? "—"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="palace-serif italic text-[1.15rem] text-[#0C0C0E]">
                        {p?.name ?? it.product_slug}
                      </p>
                      <p className="palace-eyebrow mt-2">
                        {p?.designer ?? "Studio"} {p ? `· €${p.price.toLocaleString("de-DE")}` : ""}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
              <div className="w-[10vw] shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 07 ATELIER FEATURE ──────────────────────────────── */}
      <section className="relative z-10 bg-[#F1EEE7] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 md:grid-cols-2 md:gap-24">
          <Reveal className="flex flex-col justify-center">
            <p className="palace-eyebrow">Im Atelier</p>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
              Zwischen zwei Zügen — <span className="italic">wie ein Stück entsteht.</span>
            </h3>
            <p className="mt-8 max-w-md text-[0.95rem] leading-relaxed text-[#0C0C0E]/80">
              Ein Vormittag im Studio, drei Kaffee, ein Schnitt, der nach Wochen endlich sitzt.
              Wir zeigen die Momente vor dem Bild, nicht das Bild.
            </p>
            <Link to="/designers" className="palace-eyebrow uline mt-10 w-fit text-[#0C0C0E]">
              Zur Geschichte →
            </Link>
          </Reveal>
          <Reveal delay={140}>
            <EditorialImage seed="atelier-feature" ratio="4/5" />
          </Reveal>
        </div>
      </section>

      {/* ── 08 IM HINTERGRUND (Helix) ───────────────────────── */}
      <section className="relative z-10 bg-[#F1EEE7] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-16 md:grid-cols-2">
          <Reveal>
            <p className="palace-eyebrow">Im Hintergrund</p>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
              Der Raum merkt sich, <span className="italic">was dich bewegt.</span>
            </h3>
            <p className="mt-8 max-w-md text-[0.95rem] leading-relaxed text-[#0C0C0E]/80">
              Ohne Fragebogen, ohne Häkchen. Beim Sehen, beim Verweilen, beim Zurückkommen
              wird die Ausstellung ein bisschen mehr deine.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("palace:open-chat"))}
              className="palace-btn mt-10"
            >
              Frag PAWN →
            </button>
          </Reveal>
          <Reveal delay={140} className="relative h-[520px]">
            <HelixScene />
          </Reveal>
        </div>
      </section>

      {/* ── 09 DESIGNER CTA ─────────────────────────────────── */}
      <section className="relative z-10 bg-[#F1EEE7] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto max-w-[1200px] text-center">
          <Reveal>
            <p className="palace-eyebrow">Für Designer</p>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,4vw,3.6rem)] leading-[1.02]">
              Die Bühne steht. <span className="italic">Der Auftritt gehört dir.</span>
            </h3>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <Link
                to="/apply"
                className="group flex h-full flex-col justify-between border border-[rgba(12,12,14,.28)] p-10 text-left transition-colors duration-500 hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
              >
                <p className="palace-eyebrow group-hover:text-[#A8A49B]">Bewerben</p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  Als Designer<br/>bewerben.
                </p>
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <Link
                to="/neu"
                className="group flex h-full flex-col justify-between border border-[rgba(12,12,14,.28)] p-10 text-left transition-colors duration-500 hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
              >
                <p className="palace-eyebrow group-hover:text-[#A8A49B]">Sehen</p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  Zur laufenden<br/>Ausstellung.
                </p>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 10 SIGNATURE SCENE ──────────────────────────────── */}
      <section
        ref={finaleRef as React.RefObject<HTMLElement>}
        className="relative z-10"
        style={{ height: "200vh" }}
      >
        <div className="sticky top-0 flex h-screen items-end justify-center px-6 pb-24 md:px-14">
          <div className="text-center">
            <p className="palace-eyebrow">Signatur</p>
            <p
              key={finaleText}
              className="palace-serif mt-6 font-light italic text-[#0C0C0E] motion-reveal"
              style={{ fontSize: "clamp(2rem, 5vw, 4.4rem)", lineHeight: 1.05 }}
            >
              {finaleText}
            </p>
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
};

export default Index;
