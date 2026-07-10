import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { PrevNext } from "@/components/palace/PrevNext";
import { supabase } from "@/integrations/supabase/client";
import { useStore, marketplaceSelectors, toDesignerView, toProductView } from "@/core";
import { useDesignerPrevNext } from "@/features/navigation/usePrevNext";
import { useSiteContent } from "@/lib/siteContent";
import { Editable } from "@/components/palace/Editable";

interface DbDesigner {
  id: string;
  slug: string;
  brand_name: string;
  location: string | null;
  country: string | null;
  story: string | null;
  quote: string | null;
  quote_role: string | null;
  tags: string[] | null;
  avatar_url: string | null;
  banner_url: string | null;
  hero_image_url: string | null;
  website: string | null;
  instagram: string | null;
  portrait_url: string | null;
  manifesto: string | null;
  atelier_image_url: string | null;
  atelier_caption: string | null;
  collection_title: string | null;
  house_number: number | null;
  created_at: string | null;
}

/* prefers-reduced-motion */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/* Smoothed scroll progress (0..1) within a section based on its position. */
function useSectionProgress(ref: React.RefObject<HTMLElement>) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    let target = 0;
    let cur = 0;
    const tick = () => {
      cur += (target - cur) * 0.12;
      setP(cur);
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const past = Math.min(Math.max(-r.top, 0), Math.max(total, 1));
      target = Math.min(Math.max(past / Math.max(total, 1), 0), 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, [ref]);
  return p;
}

/* Custom cursor — only on fine-pointer devices. */
function CustomCursor() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = document.createElement("div");
    el.className = "palace-cursor";
    document.body.appendChild(el);
    let mx = 0, my = 0, cx = 0, cy = 0, raf = 0;
    const move = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const enter = () => el.classList.add("is-over-link");
    const leave = () => el.classList.remove("is-over-link");
    const tick = () => {
      cx += (mx - cx) * 0.22; cy += (my - cy) * 0.22;
      el.style.transform = `translate(${cx - 6}px, ${cy - 6}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", move);
    document.querySelectorAll("a,button").forEach((n) => {
      n.addEventListener("mouseenter", enter);
      n.addEventListener("mouseleave", leave);
    });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", move);
      el.remove();
    };
  }, []);
  return null;
}

const DesignerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug ?? "y-project";
  const reduced = useReducedMotion();
  const editionNum = useSiteContent("ausgabe_nummer");
  const edition = String(editionNum ?? "07");

  const [dbDesigner, setDbDesigner] = useState<DbDesigner | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextDesigner, setNextDesigner] = useState<{ slug: string; brand_name: string } | null>(null);
  const [campaignVideos, setCampaignVideos] = useState<Array<{ id: string; title: string; asset_url: string }>>([]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("designers")
        .select("id, slug, brand_name, location, country, story, quote, quote_role, tags, avatar_url, banner_url, hero_image_url, website, instagram, portrait_url, manifesto, atelier_image_url, atelier_caption, collection_title, house_number, created_at")
        .eq("slug", activeSlug)
        .eq("status", "active")
        .maybeSingle();
      if (!cancelled) setDbDesigner((data as unknown as DbDesigner) ?? null);
    })();
    (async () => {
      const { count } = await supabase.from("designers").select("id", { count: "exact", head: true }).eq("status", "active");
      if (!cancelled) setTotalCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [activeSlug]);

  // Fetch next active designer alphabetically for Act VI
  useEffect(() => {
    if (!dbDesigner) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("designers")
        .select("slug, brand_name")
        .eq("status", "active")
        .gt("brand_name", dbDesigner.brand_name)
        .order("brand_name", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        if (data) setNextDesigner(data as { slug: string; brand_name: string });
        else {
          const { data: first } = await supabase
            .from("designers").select("slug, brand_name")
            .eq("status", "active").neq("slug", dbDesigner.slug)
            .order("brand_name", { ascending: true }).limit(1).maybeSingle();
          setNextDesigner((first as { slug: string; brand_name: string }) ?? null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [dbDesigner]);

  // Freigegebene Video-Kampagnen laden — nur mit asset_url.
  useEffect(() => {
    if (!dbDesigner) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, status, kind, content, created_at")
        .eq("designer_id", dbDesigner.id)
        .in("status", ["approved", "published"])
        .eq("kind", "video")
        .order("created_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const rows = (data ?? []) as Array<{ id: string; title: string; content: { asset_url?: string } | null }>;
      const clips = rows
        .map((r) => ({ id: r.id, title: r.title, asset_url: r.content?.asset_url ?? "" }))
        .filter((r) => !!r.asset_url);
      setCampaignVideos(clips);
    })();
    return () => { cancelled = true; };
  }, [dbDesigner]);


  const coreDesigner = useStore((s) => marketplaceSelectors.getDesignerBySlug(s, activeSlug) ?? marketplaceSelectors.getAllDesigners(s)[0]);
  const coreProducts = useStore((s) => marketplaceSelectors.getProductsByDesignerId(s, coreDesigner.id));

  const designer = useMemo(() => {
    const base = toDesignerView(coreDesigner);
    if (!dbDesigner) return {
      ...base,
      name: base.name,
      story: base.bio,
      quote: null as string | null,
      quoteRole: null as string | null,
      portrait: null as string | null,
      atelierImage: null as string | null,
      atelierCaption: null as string | null,
      manifesto: null as string | null,
      collectionTitle: null as string | null,
      houseNumber: null as number | null,
      createdAt: null as string | null,
      tags: [] as string[],
    };
    return {
      ...base,
      name: dbDesigner.brand_name,
      slug: dbDesigner.slug,
      location: [dbDesigner.location, dbDesigner.country].filter(Boolean).join(", ") || base.location,
      story: dbDesigner.story ?? base.bio,
      quote: dbDesigner.quote,
      quoteRole: dbDesigner.quote_role,
      portrait: dbDesigner.portrait_url ?? dbDesigner.hero_image_url ?? dbDesigner.banner_url,
      atelierImage: dbDesigner.atelier_image_url ?? dbDesigner.banner_url,
      atelierCaption: dbDesigner.atelier_caption,
      manifesto: dbDesigner.manifesto ?? dbDesigner.quote,
      collectionTitle: dbDesigner.collection_title,
      houseNumber: dbDesigner.house_number,
      createdAt: dbDesigner.created_at,
      tags: dbDesigner.tags ?? [],
    };
  }, [coreDesigner, dbDesigner]);

  const designerProducts = useMemo(
    () => coreProducts.map((p) => toProductView(p, coreDesigner)),
    [coreProducts, coreDesigner],
  );

  // Refs for scroll-tracking
  const actIRef = useRef<HTMLElement | null>(null);
  const actIIRef = useRef<HTMLElement | null>(null);
  const actIIIRef = useRef<HTMLElement | null>(null);
  const actIVRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const pAct1 = useSectionProgress(actIRef);
  const pAct2 = useSectionProgress(actIIRef);
  const pAct3 = useSectionProgress(actIIIRef);
  const pAct4 = useSectionProgress(actIVRef);

  // Global scroll progress bar
  const [globalP, setGlobalP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setGlobalP(h > 0 ? Math.min(Math.max(window.scrollY / h, 0), 1) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Chapter rail
  const [activeChapter, setActiveChapter] = useState(0);
  useEffect(() => {
    const chapters = [actIRef, actIIRef, actIIIRef, actIVRef];
    const onScroll = () => {
      const y = window.scrollY + window.innerHeight * 0.4;
      let idx = 0;
      chapters.forEach((r, i) => {
        if (r.current && r.current.offsetTop <= y) idx = i;
      });
      setActiveChapter(idx);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Manifesto word reveal
  const manifestoWords = useMemo(
    () => (designer.manifesto ?? designer.story ?? "").split(/\s+/).filter(Boolean),
    [designer.manifesto, designer.story],
  );

  // Portrait breathes into view — text layers stay locked in place so they
  // register as a single monumental headline (front-layer clip-path handles
  // the "image cuts through the letters" illusion).
  const portraitScale = reduced ? 1 : 0.96 + pAct1 * 0.08;
  const portraitTranslate = reduced ? 0 : -pAct1 * 4;


  const houseLabel = designer.houseNumber ?? "—";
  const totalLabel = totalCount || "—";
  const houseSince = designer.createdAt
    ? new Date(designer.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })
    : "—";

  return (
    <PalaceLayout transparentHeader>
      <CustomCursor />
      {/* Fortschrittslinie */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[65] h-[2px] bg-transparent">
        <div className="h-full bg-[#000000] transition-[width] duration-150" style={{ width: `${globalP * 100}%` }} />
      </div>

      {/* Kapitel-Rail */}
      <nav aria-label="Kapitel" className="pointer-events-none fixed left-6 top-1/2 z-[62] hidden -translate-y-1/2 flex-col gap-4 lg:flex">
        {["Auftritt", "Haltung", "Kollektion", "Atelier"].map((label, i) => (
          <span
            key={label}
            className={`palace-eyebrow pointer-events-auto whitespace-nowrap transition-colors ${
              activeChapter === i ? "text-[#FFFFFF] mix-blend-difference" : "text-[#8F8B82]"
            }`}
          >
            0{i + 1} · {label}
          </span>
        ))}
        <span className="palace-eyebrow pointer-events-auto text-[#8F8B82]">05 · Im Haus</span>
      </nav>

      <div ref={pageRef}>
        {/* AKT I — AUFTRITT */}
        <section
          ref={actIRef as React.RefObject<HTMLElement>}
          className="relative bg-[#0A0A0C] text-[#FFFFFF]"
          style={{ height: reduced ? "auto" : "170vh" }}
        >
          <div className="pointer-events-none absolute right-4 top-24 z-30 md:right-8 md:top-28">
            <div className="pointer-events-auto">
              <PrevNextForDesigner slug={designer.slug} />
            </div>
          </div>

          <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
            {/* Back-text — full, locked in place */}
            <h1
              aria-hidden={false}
              className="absolute inset-0 z-[1] flex items-center justify-center px-6 text-center leading-[0.82] text-[#FFFFFF]"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 500,
                fontSize: "clamp(4rem, 17.5vw, 17.5rem)",
                letterSpacing: "-0.03em",
              }}
            >
              {designer.name}
            </h1>

            {/* Portrait — centered, larger, gently breathes on scroll */}
            <div
              className="relative z-[3]"
              style={{
                width: "min(42vw, 480px)",
                aspectRatio: "3 / 4",
                transform: `translateY(${portraitTranslate}%) scale(${portraitScale})`,
                boxShadow: "0 60px 120px -40px rgba(0,0,0,.7)",
                willChange: "transform",
              }}
            >
              <EditorialImage
                seed={`portrait-${designer.slug}`}
                src={designer.portrait}
                ratio="3/4"
                className="h-full w-full"
                priority
              />
            </div>

            {/* Front-text — identical placement, clipped so only the portion
                that lies OUTSIDE the portrait band shows, making the letters
                weave in front of the portrait. */}
            <h1
              aria-hidden
              className="absolute inset-0 z-[5] flex items-center justify-center px-6 text-center leading-[0.82] text-[#FFFFFF]"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontWeight: 500,
                fontSize: "clamp(4rem, 17.5vw, 17.5rem)",
                letterSpacing: "-0.03em",
                clipPath: "inset(72% 0 0 0)",
              }}
            >
              {designer.name}
            </h1>


            {/* Top eyebrow */}
            <p className="palace-eyebrow absolute left-6 top-24 z-[10] md:left-14" style={{ color: "rgba(241,238,231,0.72)" }}>
              PAWN präsentiert · Retrospektive · Ausgabe {edition}
            </p>

            {/* Bottom corners */}
            <div className="absolute inset-x-0 bottom-8 z-[10] flex items-end justify-between px-6 md:bottom-14 md:px-14">
              <div>
                <p className="palace-eyebrow" style={{ color: "rgba(241,238,231,0.7)" }}>Gründung</p>
                <p className="palace-serif mt-2 italic text-[1rem] text-[#FFFFFF]">{designer.location}</p>
              </div>
              <div className="text-right">
                <p className="palace-eyebrow" style={{ color: "rgba(241,238,231,0.7)" }}>
                  {designer.tags[0] ?? "Welt"} {designer.collectionTitle ? `· ${designer.collectionTitle}` : ""}
                </p>
                <p className="palace-serif mt-2 italic text-[1rem] text-[#FFFFFF]">Aktuelle Ausstellung</p>
              </div>
            </div>

            <div className="absolute bottom-2 left-1/2 z-[10] -translate-x-1/2 text-center">
              <span className="palace-eyebrow" style={{ color: "rgba(241,238,231,0.6)" }}>Der Vorhang öffnet sich</span>
              <span className="mx-auto mt-2 block h-6 w-px palace-drip bg-[#FFFFFF]/60" />
            </div>
          </div>
        </section>

        {/* BIGBAND — endloses Marquee */}
        <div className="overflow-hidden border-y border-[rgba(241,238,231,0.12)] bg-[#0A0A0C] py-8 text-[#FFFFFF]">
          <div className="palace-marquee flex whitespace-nowrap">
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="palace-serif px-6"
                style={{
                  fontSize: "clamp(2.6rem, 6vw, 6rem)",
                  fontWeight: 300,
                  fontStyle: i % 2 === 1 ? "italic" : "normal",
                  color: i % 2 === 1 ? "#FFFFFF" : "transparent",
                  WebkitTextStroke: i % 2 === 1 ? "0" : "1px rgba(241,238,231,0.4)",
                }}
              >
                {designer.name} ·
              </span>
            ))}
          </div>
        </div>

        {/* AKT II — HALTUNG (weiß) */}
        <section
          ref={actIIRef as React.RefObject<HTMLElement>}
          className="relative bg-white px-6 py-32 md:px-14 md:py-40"
        >
          <div className="mx-auto max-w-[1400px]">
            <p className="palace-eyebrow">Akt II · Haltung</p>
            <div className="mt-16 max-w-[1200px]">
              <p
                className="palace-serif font-light text-[#000000]"
                style={{
                  fontSize: "clamp(2rem, 5.2vw, 5.2rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.02em",
                }}
              >
                {manifestoWords.length === 0 ? (
                  <span className="italic text-[#000000]/40">Noch kein Manifest hinterlegt.</span>
                ) : (
                  manifestoWords.map((w, i) => {
                    const step = manifestoWords.length > 0 ? i / manifestoWords.length : 0;
                    const opacity = reduced ? 1 : Math.min(0.1 + pAct2 * 2.4 - step, 1);
                    return (
                      <span
                        key={i}
                        style={{ opacity: Math.max(opacity, 0.1), transition: "opacity .35s ease" }}
                      >
                        {w}{" "}
                      </span>
                    );
                  })
                )}
              </p>
            </div>

            <div className="mt-20 flex items-center gap-6">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-[rgba(0,0,0,.18)] md:h-20 md:w-20">
                <EditorialImage seed={`portrait-round-${designer.slug}`} src={designer.portrait} ratio="1/1" className="h-full w-full" />
              </div>
              <div>
                <p className="palace-serif italic text-[1.2rem] text-[#000000]">{designer.name}</p>
                <p className="palace-eyebrow mt-1">{designer.quoteRole ?? "Gründung"} · {designer.location}</p>
              </div>
            </div>
          </div>
        </section>

        {/* AKT III — KOLLEKTION (Cinema horizontal) */}
        <section
          ref={actIIIRef as React.RefObject<HTMLElement>}
          className="relative bg-[#FFFFFF]"
          style={{ height: reduced ? "auto" : "380vh" }}
        >
          <div className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">
            <div className="border-b border-[rgba(0,0,0,.18)] px-6 py-6 md:px-14">
              <div className="flex items-baseline justify-between gap-6">
                <div>
                  <p className="palace-eyebrow">Akt III · Kollektion</p>
                  <h3
                    className="palace-serif mt-3 font-light text-[#000000]"
                    style={{ fontSize: "clamp(1.6rem, 3vw, 2.6rem)", lineHeight: 1.05 }}
                  >
                    {designer.collectionTitle ?? "Was gerade das Atelier verlässt"}
                  </h3>
                </div>
                <div className="hidden gap-3 md:flex">
                  <TrackArrow direction="left" onClick={() => scrollBySection(-1)} />
                  <TrackArrow direction="right" onClick={() => scrollBySection(1)} />
                </div>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <div
                className="absolute inset-0 flex items-center gap-8 px-6 md:gap-14 md:px-14"
                style={{
                  transform: reduced ? "none" : `translateX(-${pAct3 * 78}%)`,
                  willChange: "transform",
                  transition: reduced ? undefined : "transform .12s linear",
                }}
              >
                {designerProducts.length === 0 && (
                  <p className="palace-serif italic text-[1.4rem] text-[#000000]/50">Kollektion in Vorbereitung.</p>
                )}
                {designerProducts.map((p, i) => {
                  const odd = i % 2 === 0;
                  return (
                    <Link
                      key={p.id}
                      to={`/product/${p.slug}`}
                      className="relative flex-none"
                      style={{
                        width: odd ? "min(46vw, 520px)" : "min(34vw, 380px)",
                        marginTop: odd ? 0 : "9vh",
                      }}
                    >
                      <span
                        aria-hidden
                        className="palace-serif absolute -top-6 left-0 font-light"
                        style={{
                          fontSize: "clamp(3rem, 8vw, 8rem)",
                          color: "transparent",
                          WebkitTextStroke: "1px rgba(0,0,0,.28)",
                          lineHeight: 0.9,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <EditorialImage seed={`d-${p.slug}`} ratio={odd ? "3/4" : "4/5"} />
                      <div className="mt-4 flex items-baseline justify-between gap-4">
                        <p className="palace-serif italic text-[1.15rem] text-[#000000]">{p.name}</p>
                        <p className="palace-eyebrow text-[#000000]">€{p.price.toLocaleString("de-DE")}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* AKT IV — ATELIER */}
        <section
          ref={actIVRef as React.RefObject<HTMLElement>}
          className="relative overflow-hidden bg-[#0A0A0C]"
          style={{ height: "100vh", minHeight: 560 }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: reduced ? "scale(1.05)" : `scale(1.15) translateY(${(pAct4 - 0.5) * 8}%)`,
              willChange: "transform",
            }}
          >
            <EditorialImage
              seed={`atelier-${designer.slug}`}
              src={designer.atelierImage}
              ratio="16/9"
              className="h-full w-full"
            />
            <div className="absolute inset-0 bg-[#0A0A0C]/30" />
          </div>
          <p
            className="absolute bottom-14 left-6 z-10 palace-serif italic md:bottom-20 md:left-14"
            style={{
              fontSize: "clamp(1.4rem, 2.6vw, 2.4rem)",
              mixBlendMode: "difference",
              color: "#FFFFFF",
              maxWidth: "34ch",
              lineHeight: 1.2,
            }}
          >
            {designer.atelierCaption ?? `${designer.location} · Im Atelier.`}
          </p>
          <p className="palace-eyebrow absolute left-6 top-24 z-10 md:left-14" style={{ color: "rgba(241,238,231,0.7)" }}>
            Akt IV · Atelier
          </p>
        </section>

        {/* AKT V — IM HAUS (Plakette) */}
        <section className="bg-[#0A0A0C] px-6 py-32 text-[#FFFFFF] md:px-14 md:py-40">
          <div className="mx-auto max-w-2xl">
            <p className="palace-eyebrow text-center" style={{ color: "rgba(241,238,231,0.7)" }}>
              <Editable as="span" contentKey="retro_plaque_act">Akt V · Im Haus</Editable>
            </p>
            <div
              className="relative mt-14 border border-[rgba(241,238,231,0.4)] px-10 py-16 text-center"
              style={{ boxShadow: "inset 0 0 0 1px rgba(241,238,231,0.05)" }}
            >
              <CornerSquare pos="tl" />
              <CornerSquare pos="tr" />
              <CornerSquare pos="bl" />
              <CornerSquare pos="br" />

              <p className="text-[2.4rem] leading-none" style={{ color: "#FFFFFF" }}>♟</p>
              <p
                className="palace-serif mt-8 font-light italic"
                style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)", lineHeight: 1.2 }}
              >
                <Editable as="span" contentKey="retro_plaque_headline">Aufgenommen in den PAWN-Katalog.</Editable>
              </p>
              <div className="mx-auto mt-10 h-px w-16 bg-[rgba(241,238,231,0.3)]" />
              <dl className="mx-auto mt-10 space-y-4 text-[0.9rem]" style={{ color: "rgba(241,238,231,0.85)" }}>
                <PlaqueRow labelNode={<Editable as="span" contentKey="retro_plaque_label_house">Haus №</Editable>} value={`${houseLabel} von ${totalLabel}`} />
                <PlaqueRow labelNode={<Editable as="span" contentKey="retro_plaque_label_since">Im Haus seit</Editable>} value={houseSince} />
                <PlaqueRow labelNode={<Editable as="span" contentKey="retro_plaque_label_curator">Kuratiert von</Editable>} value={`PAWN · Ausgabe ${edition}`} />
                <PlaqueRow labelNode={<Editable as="span" contentKey="retro_plaque_label_world">Welt · Stadt</Editable>} value={`${designer.tags[0] ?? "—"} · ${designer.location}`} />
              </dl>
            </div>
          </div>
        </section>

        {/* AKT VI — NÄCHSTES HAUS */}
        {nextDesigner && (
          <section className="group relative bg-[#0A0A0C] py-32 md:py-48">
            <div className="pointer-events-none mx-auto max-w-[1600px] text-center">
              <p className="palace-eyebrow" style={{ color: "rgba(241,238,231,0.6)" }}>Akt VI · Das nächste Haus</p>
            </div>
            <Link
              to={`/designer/${nextDesigner.slug}`}
              className="mt-10 block px-6 text-center md:px-14"
            >
              <h2
                className="palace-serif font-light transition-colors duration-500"
                style={{
                  fontSize: "clamp(3.5rem, 14vw, 14rem)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.03em",
                  color: "transparent",
                  WebkitTextStroke: "1px rgba(241,238,231,0.6)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#FFFFFF";
                  e.currentTarget.style.webkitTextStroke = "0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "transparent";
                  e.currentTarget.style.webkitTextStroke = "1px rgba(241,238,231,0.6)";
                }}
              >
                {nextDesigner.brand_name}
              </h2>
              <p className="palace-eyebrow mt-8" style={{ color: "rgba(241,238,231,0.7)" }}>
                Die Ausstellung endet nie — weiter →
              </p>
            </Link>
          </section>
        )}
      </div>

      {/* Custom cursor styles */}
      <style>{`
        .palace-cursor {
          position: fixed; top: 0; left: 0; z-index: 200;
          width: 12px; height: 12px; border-radius: 50%;
          background: #FFFFFF; mix-blend-mode: difference;
          pointer-events: none;
          transition: width .25s ease, height .25s ease, transform .05s linear;
        }
        .palace-cursor.is-over-link { width: 44px; height: 44px; transform-origin: center; }
        @media (pointer: coarse) { .palace-cursor { display: none; } }
      `}</style>
    </PalaceLayout>
  );
};

function scrollBySection(dir: -1 | 1) {
  window.scrollBy({ top: dir * window.innerHeight * 0.9, behavior: "smooth" });
}

function TrackArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === "left" ? "Zurück" : "Weiter"}
      className="flex h-11 w-11 items-center justify-center border border-[rgba(0,0,0,.28)] bg-white text-[#000000] transition-colors hover:bg-[#000000] hover:text-[#FFFFFF]"
    >
      <span className="text-lg leading-none">{direction === "left" ? "←" : "→"}</span>
    </button>
  );
}

function CornerSquare({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<string, string> = {
    tl: "left-[-4px] top-[-4px]",
    tr: "right-[-4px] top-[-4px]",
    bl: "left-[-4px] bottom-[-4px]",
    br: "right-[-4px] bottom-[-4px]",
  };
  return <span className={`absolute h-2 w-2 bg-[#FFFFFF] ${map[pos]}`} aria-hidden />;
}

function PlaqueRow({ label, labelNode, value }: { label?: string; labelNode?: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="palace-eyebrow" style={{ color: "rgba(241,238,231,0.55)" }}>{labelNode ?? label}</dt>
      <dd className="palace-serif italic">{value}</dd>
    </div>
  );
}

function PrevNextForDesigner({ slug }: { slug: string }) {
  const { prev, next } = useDesignerPrevNext(slug);
  if (!prev && !next) return null;
  return <PrevNext prev={prev} next={next} />;
}

export default DesignerPage;
