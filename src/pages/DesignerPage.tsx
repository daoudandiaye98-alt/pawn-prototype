import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { useStore, marketplaceSelectors, toDesignerView, toProductView } from "@/core";
import { useDnaAlignment } from "@/features/dna/hooks";
import { useCustomerEvents } from "@/features/events/useCustomerEvents";

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
}

const DesignerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const activeSlug = slug ?? "y-project";

  const [dbDesigner, setDbDesigner] = useState<DbDesigner | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("designers")
        .select("id, slug, brand_name, location, country, story, quote, quote_role, tags, avatar_url, banner_url, hero_image_url, website, instagram")
        .eq("slug", activeSlug)
        .eq("status", "active")
        .maybeSingle();
      if (!cancelled) setDbDesigner((data as DbDesigner) ?? null);
    })();
    return () => { cancelled = true; };
  }, [activeSlug]);

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
      heroImage: null as string | null,
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
      heroImage: dbDesigner.hero_image_url ?? dbDesigner.banner_url,
      tags: dbDesigner.tags ?? [],
    };
  }, [coreDesigner, dbDesigner]);

  const designerProducts = useMemo(
    () => coreProducts.map((p) => toProductView(p, coreDesigner)),
    [coreProducts, coreDesigner],
  );
  const alignment = useDnaAlignment(coreDesigner.id);
  const { followDesigner } = useCustomerEvents();
  const [following, setFollowing] = useState(false);

  function onFollow() {
    followDesigner(coreDesigner.id);
    setFollowing(true);
    toast.success(`${designer.name} — im Blick.`);
  }

  return (
    <PalaceLayout transparentHeader>
      {/* Full-bleed hero with mix-blend-difference brand name */}
      <section className="relative h-[92vh] min-h-[560px] w-full overflow-hidden">
        <EditorialImage
          seed={`designer-hero-${designer.slug}`}
          src={designer.heroImage}
          ratio="16/9"
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-[#0C0C0E]/10" />
        <div className="relative flex h-full flex-col justify-end px-6 pb-14 md:px-14 md:pb-20">
          <p className="palace-eyebrow text-white/70" style={{ mixBlendMode: "difference" }}>
            {designer.location} {designer.tags?.length ? `· ${designer.tags.slice(0, 3).join(" · ")}` : ""}
          </p>
          <h1
            className="palace-serif mt-6 font-light text-white"
            style={{
              mixBlendMode: "difference",
              fontSize: "clamp(3rem, 12vw, 12rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
            }}
          >
            {designer.name}
          </h1>
        </div>
      </section>

      {/* Story + Quote (2 columns) */}
      <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-14 md:grid-cols-[1.15fr_1fr] md:gap-24">
          <Reveal>
            <p className="palace-eyebrow">Die Handschrift</p>
            <h2 className="palace-serif mt-6 font-light text-[clamp(1.8rem,3.2vw,2.8rem)] leading-[1.05]">
              {designer.name}. <span className="italic">In eigener Erzählung.</span>
            </h2>
            <p className="mt-8 max-w-xl text-[0.98rem] leading-relaxed text-[#0C0C0E]/80">
              {designer.story}
            </p>
            <div className="mt-10 flex items-center gap-6">
              <button
                type="button"
                onClick={onFollow}
                className={`palace-btn ${following ? "bg-[#0C0C0E] text-[#F1EEE7]" : ""}`}
              >
                {following ? "Im Blick" : "Studio folgen"}
              </button>
              {alignment.percent > 0 && (
                <span className="palace-eyebrow">
                  {alignment.percent}% deiner DNA
                </span>
              )}
            </div>
          </Reveal>

          {designer.quote && (
            <Reveal delay={120}>
              <blockquote className="border-l border-[rgba(12,12,14,.28)] pl-8">
                <p
                  className="palace-serif italic font-light text-[#0C0C0E]"
                  style={{ fontSize: "clamp(1.6rem, 2.6vw, 2.4rem)", lineHeight: 1.15 }}
                >
                  „{designer.quote}"
                </p>
                <cite className="mt-8 block not-italic palace-eyebrow">
                  {designer.quoteRole ?? designer.name}
                </cite>
              </blockquote>
            </Reveal>
          )}
        </div>
      </section>

      {/* Product grid */}
      {designerProducts.length > 0 && (
        <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[1400px]">
            <Reveal>
              <p className="palace-eyebrow">Arbeiten</p>
              <h3 className="palace-serif mt-6 font-light text-[clamp(1.8rem,3.2vw,2.8rem)] leading-[1.05]">
                Was gerade das Atelier verlässt.
              </h3>
            </Reveal>
            <div className="mt-16 grid grid-cols-12 gap-6 md:gap-8">
              {designerProducts.map((p, i) => {
                const layouts = [
                  { span: "col-span-12 md:col-span-6", ratio: "4/5" as const },
                  { span: "col-span-12 md:col-span-6", ratio: "4/5" as const },
                  { span: "col-span-12 md:col-span-4", ratio: "3/4" as const },
                  { span: "col-span-12 md:col-span-4", ratio: "3/4" as const },
                  { span: "col-span-12 md:col-span-4", ratio: "3/4" as const },
                ];
                const l = layouts[i % layouts.length];
                return (
                  <Reveal key={p.id} delay={i * 50} className={l.span}>
                    <Link to={`/product/${p.slug}`} className="block">
                      <EditorialImage seed={`d-${p.slug}`} ratio={l.ratio} />
                      <div className="mt-4 flex items-baseline justify-between gap-4">
                        <div>
                          <p className="palace-serif italic text-[1.15rem] text-[#0C0C0E]">{p.name}</p>
                          <p className="palace-eyebrow mt-2">{p.world} · {p.category}</p>
                        </div>
                        <p className="palace-eyebrow text-[#0C0C0E]">€{p.price.toLocaleString("de-DE")}</p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </PalaceLayout>
  );
};

export default DesignerPage;
