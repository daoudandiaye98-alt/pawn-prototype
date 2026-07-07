import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { HeroScene } from "@/components/palace/HeroScene";
import { HelixScene } from "@/components/palace/HelixScene";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { DynamicBanner } from "@/components/palace/DynamicBanner";
import { PickYourStyle } from "@/components/palace/PickYourStyle";
import { Editable } from "@/components/palace/Editable";
import { usePublicDesigners, useActiveCollection } from "@/lib/publicData";
import { useStore, marketplaceSelectors } from "@/core";
import { usePersonalization, sortByPersonalization } from "@/features/personalization";


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
  const personalization = usePersonalization();


  const featured = designers.filter((d) => d.is_featured);
  const cover = featured[0] ?? designers[0];

  // Canvas fade — smoothed via rAF so the pawn never pops on scroll.
  // Full opacity through the first viewport (hero), soft fade after, restored during finale.
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const finaleRef = useRef<HTMLElement | null>(null);
  const finaleProgress = useScrollProgress(finaleRef as React.RefObject<HTMLElement>);
  const targetOpacityRef = useRef(1);
  const currentOpacityRef = useRef(1);

  useEffect(() => {
    const compute = () => {
      const y = window.scrollY;
      const vh = window.innerHeight || 800;
      // Stay fully visible through 70% of the first screen, then ease to 0.12 by 1.8vh.
      const fadeStart = vh * 0.7;
      const fadeEnd = vh * 1.8;
      const raw = 1 - Math.max(0, Math.min(1, (y - fadeStart) / (fadeEnd - fadeStart)));
      const heroFade = 0.12 + raw * 0.88;
      const finaleBoost = finaleProgress > 0.05 ? finaleProgress : 0;
      targetOpacityRef.current = Math.min(1, heroFade + finaleBoost);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);

    let raf = 0;
    const loop = () => {
      currentOpacityRef.current += (targetOpacityRef.current - currentOpacityRef.current) * 0.08;
      setCanvasOpacity(currentOpacityRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
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

  const editorialTiles = useMemo(
    () => sortByPersonalization(products, personalization).slice(0, 6),
    [products, personalization],
  );

  const personalSubtitle = useMemo(() => {
    if (!personalization.hasSignals) return null;
    const w = personalization.world;
    const m = personalization.mood;
    if (m === "ruhig" && w) return `Für dich kuratiert: ruhige, skulpturale Stücke aus ${w}.`;
    if (m === "spannung" && w) return `Für dich zusammengestellt: kontrastreiche Handschriften aus ${w}.`;
    if (w) return `Für dich kuratiert — mit Fokus auf ${w}.`;
    if (m === "ruhig") return "Für dich kuratiert: ruhige, skulpturale Stücke.";
    if (m === "spannung") return "Für dich kuratiert: kontrastreiche Handschriften.";
    return null;
  }, [personalization]);


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
          {/* Soft white plate keeps text legible over the 3D canvas without hiding the pawn */}
          <div className="mx-auto max-w-[1100px] rounded-none px-2 py-6 md:px-8 md:py-10"
               style={{ background: "radial-gradient(ellipse at center, rgba(241,238,231,.92) 0%, rgba(241,238,231,.72) 55%, rgba(241,238,231,0) 100%)" }}>
            <Editable as="p" contentKey="hero_eyebrow" className="palace-eyebrow motion-reveal">
              Kuratierte Ausstellung · Ausgabe 07 · Juli
            </Editable>
            <h1
              className="palace-serif palace-line-rise mt-8 text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.4rem, 6.5vw, 6.4rem)", lineHeight: 1.02, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="hero_headline_1" className="block font-light">Mode, Interior und Kunst —</Editable>
              <Editable as="span" contentKey="hero_headline_2" className="block italic font-light">von unabhängigen Designern.</Editable>
            </h1>
            <Editable as="p" contentKey="hero_subline" className="mx-auto mt-8 block max-w-2xl text-[1.05rem] leading-[1.65] text-[#3A3833]" multiline>
              {personalSubtitle ?? "PAWN ist die kuratierte Ausstellung, in der du sie zuerst entdeckst."}
            </Editable>

            <HeroPrompt />
          </div>

          <div className="mt-14 flex flex-col items-center gap-4">
            <span className="palace-eyebrow" style={{ color: "#55534E" }}>Scroll</span>
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

      {/* ── 05 STATEMENT BANNER — rotates through featured designers ── */}
      <DynamicBanner />

      {/* ── 05b PICK YOUR STYLE — swipe discovery ─────────── */}
      <section className="relative z-10 border-y border-[rgba(12,12,14,.13)] bg-[#F1EEE7] py-24 md:py-32">
        <PickYourStyle />
      </section>

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
              <p className="palace-eyebrow hidden md:block">Scroll = seitwärts · oder Pfeile</p>
            </div>
          </div>
          <div className="relative mt-16 flex flex-1 items-center overflow-hidden">
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

            {/* Palace navigation arrows — advance one card at a time */}
            <TrackArrows sectionRef={trackSectionRef} steps={collection.items.length} />
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

function HeroPrompt() {
  const [value, setValue] = useState("");
  const send = () => {
    const text = value.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent("palace:open-chat"));
    // Give the drawer a beat to mount before we hand off the message.
    setTimeout(() => window.dispatchEvent(new CustomEvent("palace:chat-send", { detail: { message: text } })), 220);
    setValue("");
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="mx-auto mt-10 flex w-full max-w-2xl items-stretch border border-[rgba(12,12,14,.35)] bg-white shadow-[0_8px_30px_-18px_rgba(12,12,14,.35)]"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Frag PAWN — z.B. „skulpturale Mäntel"'
        className="flex-1 bg-transparent px-5 py-4 text-left text-[1rem] text-[#0C0C0E] placeholder:text-[#55534E] focus:outline-none md:text-[1.05rem]"
        aria-label="Frag PAWN"
      />
      <button
        type="submit"
        className="whitespace-nowrap bg-[#0C0C0E] px-6 text-[0.68rem] uppercase tracking-[0.32em] text-[#F1EEE7] transition-colors duration-300 hover:bg-[#3A3A3C]"
      >
        Fragen →
      </button>
    </form>
  );
}

function TrackArrows({ sectionRef, steps }: { sectionRef: React.RefObject<HTMLElement>; steps: number }) {
  const scrollByCard = (dir: -1 | 1) => {
    const sec = sectionRef.current;
    if (!sec) return;
    const rect = sec.getBoundingClientRect();
    const pinDistance = sec.offsetHeight - window.innerHeight;
    const step = pinDistance / Math.max(1, steps - 1);
    // Nudge into the pinning window first if the user hasn't reached it.
    const base = rect.top < 0 ? window.scrollY : window.scrollY + rect.top;
    const target = base + Math.round(step * dir + (rect.top < 0 ? step * dir * 0 : 0));
    window.scrollTo({ top: rect.top < 0 ? window.scrollY + dir * step : target, behavior: "smooth" });
  };
  const btn = "grid h-12 w-12 place-items-center rounded-full border border-[rgba(12,12,14,.35)] bg-[#F1EEE7]/85 text-[#0C0C0E] backdrop-blur transition-all duration-300 hover:bg-[#0C0C0E] hover:text-[#F1EEE7]";
  return (
    <div className="pointer-events-none absolute inset-0 hidden items-center justify-between px-4 md:flex md:px-8">
      <button
        type="button"
        aria-label="Zurück"
        onClick={() => scrollByCard(-1)}
        className={`${btn} pointer-events-auto`}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.3} />
      </button>
      <button
        type="button"
        aria-label="Weiter"
        onClick={() => scrollByCard(1)}
        className={`${btn} pointer-events-auto`}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.3} />
      </button>
    </div>
  );
}

export default Index;

