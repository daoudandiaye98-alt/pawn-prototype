/**
 * Première — kuratierte Designer-Videos auf der Startseite. Stumm-Autoplay,
 * Haus-Credit + Shop-Link. Zählt premiere_views/shop_clicks in video_assets.performance.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { supabase } from "@/integrations/supabase/client";

interface PremiereItem {
  id: string;
  url: string;
  designers: { brand_name: string; slug: string; house_number: number | null } | null;
  campaigns: { title: string; products: { slug: string; name: string } | null } | null;
}

export function PremiereSection() {
  const [items, setItems] = useState<PremiereItem[]>([]);
  const counted = useRef<Set<string>>(new Set());

  useEffect(() => {
    void supabase.from("video_assets" as never)
      .select("id, url, designers:designer_id(brand_name, slug, house_number), campaigns:campaign_id(title, products:product_id(slug, name))")
      .eq("premiere", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setItems((data ?? []) as unknown as PremiereItem[]));
  }, []);

  if (items.length === 0) return null;

  const bump = (id: string, metric: "premiere_views" | "shop_clicks") => {
    void supabase.rpc("bump_video_metric" as never, { p_asset_id: id, p_metric: metric } as never);
  };

  const onPlay = (id: string) => {
    if (counted.current.has(id)) return;
    counted.current.add(id);
    bump(id, "premiere_views");
  };

  return (
    <section className="mx-auto max-w-[1400px] px-6 py-24 md:px-10">
      <Reveal>
        <Editable as="p" contentKey="landing.premiere_eyebrow" className="editorial-eyebrow">Première</Editable>
        <Editable as="h2" contentKey="landing.premiere_headline" className="mt-3 font-serif text-3xl md:text-4xl">Aus den Häusern, gerade erst gezeigt.</Editable>
      </Reveal>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const shopHref = it.campaigns?.products?.slug
            ? `/product/${it.campaigns.products.slug}`
            : it.designers?.slug ? `/designer/${it.designers.slug}` : "/designers";
          return (
            <Reveal key={it.id}>
              <div className="group border border-[#000] bg-white">
                <div className="border-b border-[#000] bg-black">
                  <video
                    src={it.url}
                    muted autoPlay loop playsInline
                    onPlay={() => onPlay(it.id)}
                    className="aspect-[9/16] w-full bg-black object-contain"
                  />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-serif text-base">{it.designers?.brand_name ?? "PAWN"}</p>
                    {it.designers?.house_number != null && (
                      <p className="text-[0.62rem] uppercase tracking-[0.22em] text-[#000]/60">Haus №{it.designers.house_number}</p>
                    )}
                  </div>
                  <Link
                    to={shopHref}
                    onClick={() => bump(it.id, "shop_clicks")}
                    className="border border-[#000] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] hover:bg-[#000] hover:text-white"
                  >
                    Ansehen
                  </Link>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
