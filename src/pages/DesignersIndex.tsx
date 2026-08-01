import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable, useContentValue } from "@/components/palace/Editable";
import { useStore, marketplaceSelectors } from "@/core";
import { supabase } from "@/integrations/supabase/client";

const DesignersIndex = () => {
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  const atelierCta = useContentValue("dindex_item_cta", "Zum Atelier →");

  // Teil 17d: gebündelte Reichweite sichtbar machen — das Netzwerk, nicht nur das einzelne Haus.
  const [totalViews, setTotalViews] = useState<number | null>(null);
  useEffect(() => {
    void supabase.from("products").select("view_count").eq("status", "published")
      .then(({ data }) => setTotalViews(((data ?? []) as { view_count: number | null }[]).reduce((s, p) => s + (p.view_count ?? 0), 0)));
  }, []);

  // Teil 15c: die Halle zeigt die Vielfalt — ein Farbakzent aus dem Haus-Thema je Karte.
  const [accentBySlug, setAccentBySlug] = useState<Record<string, string>>({});
  useEffect(() => {
    if (designers.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase.from("designers").select("id, slug").in("slug", designers.map((d) => d.slug));
      const bySlug = new Map(((rows ?? []) as { id: string; slug: string }[]).map((r) => [r.id, r.slug]));
      if (bySlug.size === 0) return;
      const { data: themes } = await supabase.from("house_themes" as never)
        .select("designer_id, farbwelt").in("designer_id", Array.from(bySlug.keys())).eq("is_current", true);
      const map: Record<string, string> = {};
      for (const t of (themes ?? []) as unknown as Array<{ designer_id: string; farbwelt: { accent?: string } }>) {
        const slug = bySlug.get(t.designer_id);
        if (slug && t.farbwelt?.accent) map[slug] = t.farbwelt.accent;
      }
      if (!cancelled) setAccentBySlug(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designers.length]);
  return (
    <PalaceLayout transparentHeader={false}>
      {/* Hero */}
      <section className="border-b border-[rgba(0,0,0,.18)] px-6 pt-36 pb-16 md:px-14 md:pt-44 md:pb-24">
        <div className="mx-auto grid max-w-[1600px] gap-10 md:grid-cols-[2fr_1fr] md:items-end">
          <Reveal>
            <Editable as="p" contentKey="dindex_eyebrow" className="palace-eyebrow">
              Alle Häuser · A–Z
            </Editable>
            <h1
              className="palace-serif mt-8 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.94, letterSpacing: "-0.025em" }}
            >
              <Editable as="span" contentKey="dindex_headline_a">Die Häuser, </Editable>
              <Editable as="span" contentKey="dindex_headline_b" className="italic">die wir sammeln.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="dindex_subline"
              className="mt-8 block max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#000000]/70"
              multiline
            >
              Unabhängige Studios, die ganze Welten um ihre Stücke bauen. Jedes einzeln kuratiert.
            </Editable>
          </Reveal>
          <Reveal delay={120} className="flex md:justify-end">
            <Link
              to="/apply"
              className="palace-btn whitespace-nowrap"
            >
              <Editable as="span" contentKey="dindex_cta">Als Designer bewerben →</Editable>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Directory grid */}
      <section className="px-6 py-20 md:px-14 md:py-28">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-14 flex items-end justify-between">
            <Editable as="p" contentKey="dindex_dir_eyebrow" className="palace-eyebrow">Verzeichnis</Editable>
            <span className="palace-eyebrow text-black/60">
              {designers.length} Ateliers{totalViews != null && totalViews > 0 ? ` · gemeinsam ${totalViews.toLocaleString("de-DE")} Aufrufe` : ""}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {designers.map((d, i) => (
              <Reveal key={d.slug} delay={Math.min(400, i * 40)}>
                <li>
                  <Link to={`/designer/${d.slug}`} className="group block">
                    <div className="relative">
                      {accentBySlug[d.slug] && (
                        <span className="absolute left-0 top-0 z-10 h-[3px] w-10" style={{ background: accentBySlug[d.slug] }} aria-hidden="true" />
                      )}
                      <EditorialImage seed={`dir-${d.slug}`} ratio="4/5" />
                    </div>
                    <div className="mt-4 flex items-baseline justify-between gap-4">
                      <div>
                        <p className="palace-eyebrow text-black/60">
                          № {String(i + 1).padStart(3, "0")}
                        </p>
                        <p
                          className="palace-serif mt-2 font-light text-[#000000]"
                          style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)", lineHeight: 1, letterSpacing: "-0.015em" }}
                        >
                          {d.name}
                        </p>
                      </div>
                      <span className="palace-eyebrow text-black/60 group-hover:text-[#000000]">{atelierCta}</span>
                    </div>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </PalaceLayout>
  );
};

export default DesignersIndex;
