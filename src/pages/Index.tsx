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
import { PremiereSection } from "@/components/palace/PremiereSection";
import { PlanFunnel } from "@/components/pawn/PlanFunnel";
import { Editable, EditableImage, useContentValue } from "@/components/palace/Editable";
import { useSiteContent } from "@/lib/siteContent";
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

function ChapterMark({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-block h-[9px] w-[9px] border-[1.5px] border-black" />
      <p className="palace-eyebrow">{index} / {label}</p>
    </div>
  );
}

const Index = () => {
  const { designers } = usePublicDesigners();
  const collection = useActiveCollection();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");
  const gridChapterLabel = useContentValue("landing.grid_chapter_label", "Diese Woche neu");
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
      const fadeStart = vh * 0.7;
      const fadeEnd = vh * 1.8;
      const raw = 1 - Math.max(0, Math.min(1, (y - fadeStart) / (fadeEnd - fadeStart)));
      const heroFade = 0.12 + raw * 0.88;
      // When the finale section enters view, override to a full-strength reveal
      // so the pawn→queen morph is unmistakably visible.
      if (finaleProgress > 0.02) {
        targetOpacityRef.current = 1;
      } else {
        targetOpacityRef.current = heroFade;
      }
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);

    let raf = 0;
    const loop = () => {
      currentOpacityRef.current += (targetOpacityRef.current - currentOpacityRef.current) * 0.08;
      // Clamp — the delta lerp can drift past [0,1] on fp corners and cause flicker.
      const clamped = Math.max(0, Math.min(1, currentOpacityRef.current));
      currentOpacityRef.current = clamped;
      setCanvasOpacity(clamped);
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
  const finaleText1 = useContentValue("landing.signature_text_1", "Jeder fängt klein an.");
  const finaleText2 = useContentValue("landing.signature_text_2", "Der Raum wächst mit.");
  const finaleText3 = useContentValue("landing.signature_text_3", "Aus dem Bauern wird die Dame.");
  const finaleText = finaleProgress < 0.33 ? finaleText1 : finaleProgress < 0.66 ? finaleText2 : finaleText3;

  const productBySlug = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>();
    for (const p of products) m.set(p.slug, p);
    return m;
  }, [products]);

  const editorialTiles = useMemo(
    () => sortByPersonalization(products, personalization, personalization.designerDna).slice(0, 6),
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
      {/* Gallery backdrop — warm vertical wash + horizon glow behind the 3D canvas */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% 78%, rgba(255,255,255,0.85) 0%, rgba(241,238,231,0.35) 55%, rgba(241,238,231,0) 100%), linear-gradient(180deg, #E8E5DE 0%, #FFFFFF 38%, #F6F3EC 100%)",
        }}
      />

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
            <p className="palace-eyebrow motion-reveal">
              <Editable as="span" contentKey="landing.hero_eyebrow">Kuratierte Ausstellung</Editable> · Ausgabe {ausgabeNummer}
            </p>
            <h1
              className="palace-serif palace-line-rise mt-8 text-[#000000]"
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
            <span className="palace-drip block h-14 w-px bg-[#000000]" />
          </div>
        </div>
      </section>

      {/* ── 02 NAMESTRIP ────────────────────────────────────── */}
      <section className="relative z-10 border-y border-[rgba(0,0,0,.18)] bg-[#FFFFFF] py-6 overflow-hidden">
        <div className="palace-marquee flex whitespace-nowrap">
          {[...designers, ...designers].map((d, i) => (
            <span key={`${d.id}-${i}`} className="flex items-center gap-6 px-8 palace-eyebrow">
              <span className="text-[#000000]">{d.brand_name}</span>
              <span className="text-[#A8A49B]">· {d.location ?? "—"}</span>
              <span className="text-[#A8A49B]">◆</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── 03 COVER STORY ──────────────────────────────────── */}
      {cover && (
        <section className="relative z-10 bg-[#FFFFFF]">
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
                <p className="palace-eyebrow text-white/70">Cover Story · Nr. {ausgabeNummer}</p>
                <p className="mt-2 font-serif italic text-white">{cover.brand_name}, {cover.location ?? "—"}</p>
              </div>
            </Reveal>

            <Reveal delay={120} className="flex flex-col justify-center gap-8 px-8 py-16 md:px-14 md:py-24">
              <Editable as="p" contentKey="landing.cover_story_eyebrow" className="palace-eyebrow">Cover Story</Editable>
              <h2 className="palace-serif font-light text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.02] text-[#000000]">
                {cover.brand_name}. <Editable as="span" contentKey="landing.cover_story_headline" className="italic">Eine Handschrift,<br/>die man wiedererkennt.</Editable>
              </h2>
              {cover.story && (
                <p className="max-w-md text-[0.95rem] leading-relaxed text-[#000000]/80">
                  {cover.story}
                </p>
              )}
              {cover.quote && (
                <blockquote className="max-w-md border-l border-[rgba(0,0,0,.28)] pl-5">
                  <p className="palace-serif italic text-[1.4rem] leading-snug text-[#000000]">„{cover.quote}"</p>
                  <cite className="mt-3 block not-italic palace-eyebrow">{cover.quote_role ?? cover.brand_name}</cite>
                </blockquote>
              )}
              <Link to={`/designer/${cover.slug}`} className="palace-eyebrow uline w-fit text-[#000000]">
                <Editable as="span" contentKey="landing.cover_story_cta">Kollektion ansehen →</Editable>
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 04 EDITORIAL GRID · Frisch aus den Ateliers ───── */}
      <section className="relative z-10 bg-[#FFFFFF] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-16 flex items-end justify-between gap-8">
            <div>
              <ChapterMark index="01" label={gridChapterLabel} />
              <h2 className="palace-serif mt-4 font-light text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">
                <Editable as="span" contentKey="landing.grid_headline_a">Frisch aus </Editable>
                <Editable as="span" contentKey="landing.grid_headline_b" className="italic">den Ateliers.</Editable>
              </h2>
            </div>
            <Link to="/neu" className="palace-eyebrow uline text-[#000000]">
              <Editable as="span" contentKey="landing.grid_cta">Alles Neue →</Editable>
            </Link>
          </div>

          {editorialTiles.length === 0 ? (
  <div className="py-20 text-center">
    <Editable as="h2" contentKey="landing.grid_empty_title" className="palace-serif italic text-[clamp(2rem,4vw,3.4rem)] leading-[1.02] text-[#000000]">
  Die ersten Häuser ziehen ein.
</Editable>
<Editable as="p" contentKey="landing.grid_empty_body" className="mt-4 palace-eyebrow text-[#000000]">
  Bald zeigen wir hier die neuesten Stücke.
</Editable>
</div>
) : (
<div className="grid grid-cols-12 border-l-[1.5px] border-t-[1.5px] border-black">
            {editorialTiles.map((p, i) => {
              const layouts = [
                { span: "col-span-12 md:col-span-5", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-3", ratio: "3/4" as const },
                { span: "col-span-12 md:col-span-4", ratio: "4/5" as const },
                { span: "col-span-12 md:col-span-5", ratio: "3/2" as const },
              ];
              const l = layouts[i % layouts.length];
              const worldLetter = (p.world ?? "M").charAt(0).toUpperCase();
              const idx = String(i + 1).padStart(2, "0");
              return (
                <Reveal key={p.id} delay={i * 60} className={`${l.span} border-r-[1.5px] border-b-[1.5px] border-black`}>
                  <Link to={`/product/${p.slug}`} className="group block p-3 md:p-4">
                    <div className="relative">
                      <EditorialImage seed={`prod-${p.slug}`} ratio={l.ratio} />
                      <span className="absolute left-3 top-3 border-[1.5px] border-black bg-white px-2 py-1 text-[0.55rem] font-medium uppercase tracking-[0.32em] text-black">
                        {worldLetter}–{idx}
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="palace-serif italic text-[1.15rem] leading-tight text-[#000000]">{p.name}</p>
                      <p className="palace-eyebrow mt-2">Mode · {p.designer}</p>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
      )}
        </div>
      </section>


      {/* ── 05 STATEMENT BANNER — rotates through featured designers ── */}
      <DynamicBanner />

      {/* ── 05b PICK YOUR STYLE — swipe discovery ─────────── */}
      <section className="relative z-10 border-y border-[rgba(0,0,0,.18)] bg-[#FFFFFF] py-24 md:py-32">
        <PickYourStyle />
      </section>

      {/* ── 05c PREMIÈRE — kuratierte Designer-Videos ─────── */}
      <PremiereSection />

      {/* ── 06 CURATED COLLECTION · horizontal scroll ─────── */}
      {collection.items.length > 0 && (
      <section ref={trackSectionRef} className="relative z-10 bg-[#FFFFFF]" style={{ height: "320vh" }}>
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="px-6 pt-24 md:px-14">
            <div className="mx-auto flex max-w-[1600px] items-end justify-between gap-8">
              <div>
                <p className="palace-eyebrow">
                  <Editable as="span" contentKey="landing.collection_eyebrow">Kuratierte Kollektion</Editable> № {collection.number}
                </p>
                <h2 className="palace-serif mt-4 font-light text-[clamp(2rem,4vw,3.4rem)] leading-[1.02]">
                  {collection.title}. <span className="italic">{collection.subtitle}</span>
                </h2>
              </div>
              <Editable as="p" contentKey="landing.collection_hint" className="palace-eyebrow hidden md:block">Scroll = seitwärts · oder Pfeile</Editable>
            </div>
          </div>
          <div className="relative mt-16 flex flex-1 items-center overflow-hidden">
            <div ref={trackInnerRef} className="flex gap-8 pl-6 md:pl-14 will-change-transform">
              {collection.items.map((it, i) => {
                const p = productBySlug.get(it.product_slug);
                return (
                  <Reveal key={`${it.product_slug}-${i}`} delay={i * 40} className="w-[74vw] shrink-0 md:w-[36vw] lg:w-[28vw]">
                    <div className="relative">
                      <EditorialImage
  seed={`col-${it.product_slug}`}
  ratio="3/4"
/>
                      <span
                        className="absolute left-4 top-4 palace-eyebrow text-white"
                        style={{ mixBlendMode: "difference" }}
                      >
                        {it.world ?? "—"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="palace-serif italic text-[1.15rem] text-[#000000]">
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
)}
      {/* ── 07 ATELIER FEATURE ──────────────────────────────── */}
      <section className="relative z-10 bg-[#FFFFFF] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 md:grid-cols-2 md:gap-24">
          <Reveal className="flex flex-col justify-center">
            <Editable as="p" contentKey="atelier_eyebrow" className="palace-eyebrow">Im Atelier</Editable>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
              <Editable as="span" contentKey="atelier_headline_a">Zwischen zwei Zügen — </Editable>
              <Editable as="span" contentKey="atelier_headline_b" className="italic">wie ein Stück entsteht.</Editable>
            </h3>
            <Editable as="p" contentKey="atelier_body" className="mt-8 block max-w-md text-[0.95rem] leading-relaxed text-[#000000]/80" multiline>
              Ein Vormittag im Studio, drei Kaffee, ein Schnitt, der nach Wochen endlich sitzt — wir zeigen die Momente vor dem Bild.
            </Editable>
            <Link to="/designers" className="palace-eyebrow uline mt-10 w-fit text-[#000000]">
              Zur Geschichte →
            </Link>
          </Reveal>
          <Reveal delay={140}>
            <EditableImage
              contentKey="atelier_image"
              fallback=""
              alt="Atelier"
              className="block h-auto w-full"
              fallbackNode={<EditorialImage seed="atelier-feature" ratio="4/5" />}
            />
          </Reveal>
        </div>
      </section>

      {/* ── 08 IM HINTERGRUND (Helix) ───────────────────────── */}
      <section className="relative z-10 bg-[#FFFFFF] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 items-center gap-16 md:grid-cols-2">
          <Reveal>
            <Editable as="p" contentKey="landing.helix_eyebrow" className="palace-eyebrow">Im Hintergrund</Editable>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,3.6vw,3.2rem)] leading-[1.02]">
              <Editable as="span" contentKey="landing.helix_headline_a">Der Raum merkt sich, </Editable>
              <Editable as="span" contentKey="landing.helix_headline_b" className="italic">was dich bewegt.</Editable>
            </h3>
            <Editable as="p" contentKey="landing.helix_body" className="mt-8 block max-w-md text-[0.95rem] leading-relaxed text-[#000000]/80" multiline>
              Beim Sehen, beim Verweilen, beim Zurückkommen wird die Ausstellung von selbst ein bisschen mehr deine.
            </Editable>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("palace:open-chat"))}
              className="palace-btn mt-10"
            >
              <Editable as="span" contentKey="landing.helix_cta">Frag PAWN →</Editable>
            </button>
          </Reveal>
          <Reveal delay={140} className="relative h-[520px]">
            <HelixScene />
          </Reveal>
        </div>
      </section>

      {/* ── 09 DESIGNER CTA ─────────────────────────────────── */}
      <section className="relative z-10 bg-[#FFFFFF] px-6 py-28 md:px-14 md:py-40">
        <div className="mx-auto max-w-[1200px] text-center">
          <Reveal>
            <Editable as="p" contentKey="cta_eyebrow" className="palace-eyebrow">Für Designer</Editable>
            <h3 className="palace-serif mt-6 font-light text-[clamp(2rem,4vw,3.6rem)] leading-[1.02]">
              <Editable as="span" contentKey="cta_headline_a">Die Bühne steht. </Editable>
              <Editable as="span" contentKey="cta_headline_b" className="italic">Der Auftritt gehört dir.</Editable>
            </h3>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <Link
                to="/apply"
                className="group flex h-full flex-col justify-between border border-[rgba(0,0,0,.28)] p-10 text-left transition-colors duration-500 hover:bg-[#000000] hover:text-[#FFFFFF]"
              >
                <Editable as="p" contentKey="landing.cta_label_apply" className="palace-eyebrow group-hover:text-[#A8A49B]">Bewerben</Editable>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="cta_card_a">Als Designer<br/>bewerben.</Editable>
                </p>
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <Link
                to="/neu"
                className="group flex h-full flex-col justify-between border border-[rgba(0,0,0,.28)] p-10 text-left transition-colors duration-500 hover:bg-[#000000] hover:text-[#FFFFFF]"
              >
                <Editable as="p" contentKey="landing.cta_label_view" className="palace-eyebrow group-hover:text-[#A8A49B]">Sehen</Editable>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="cta_card_b">Zur laufenden<br/>Ausstellung.</Editable>
                </p>
              </Link>
            </Reveal>
          </div>

          <div className="mx-auto mt-16 max-w-xl text-left">
            <Reveal delay={200}>
              <PlanFunnel context="landing" />
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
            <Editable as="p" contentKey="landing.signature_eyebrow" className="palace-eyebrow">Signatur</Editable>
            <p
              key={finaleText}
              className="palace-serif mt-6 font-light italic text-[#000000] motion-reveal"
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
  const placeholder = useContentValue("landing.hero_prompt_placeholder", 'Frag PAWN — z.B. „skulpturale Mäntel"');
  const ctaLabel = useContentValue("landing.hero_prompt_cta", "Fragen →");
  const send = () => {
    const text = value.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent("palace:open-chat"));
    setTimeout(() => window.dispatchEvent(new CustomEvent("palace:chat-send", { detail: { message: text } })), 220);
    setValue("");
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="mx-auto mt-10 flex h-14 w-full max-w-[520px] items-stretch border-[1.5px] border-black bg-white"
      style={{ boxShadow: "6px 6px 0 #000" }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-4 text-left text-[0.95rem] text-[#000000] placeholder:text-[#7C7972] focus:outline-none"
        aria-label="Frag PAWN"
      />
      <button
        type="submit"
        className="whitespace-nowrap border-l-[1.5px] border-black bg-[#000000] px-6 text-[0.7rem] uppercase tracking-[0.32em] text-white transition-colors duration-200 hover:bg-white hover:text-black"
      >
        {ctaLabel}
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
  const btn = "grid h-12 w-12 place-items-center rounded-full border border-[rgba(0,0,0,.35)] bg-[#FFFFFF]/85 text-[#000000] backdrop-blur transition-all duration-300 hover:bg-[#000000] hover:text-[#FFFFFF]";
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

