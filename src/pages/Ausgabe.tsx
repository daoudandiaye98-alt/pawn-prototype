/**
 * Teil 12c: die Ausgabe wird strukturell — jedes Haus mit veröffentlichter
 * Hausseite (Bausteine, Teil 12c) bildet darin eine Doppelseite. Anders als
 * /designers/all (permanentes A-Z-Verzeichnis) ist dies die laufende Nummer:
 * nur veröffentlichte Hausseiten, sortiert nach Veröffentlichung.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { useSiteContent } from "@/lib/siteContent";

interface HouseSpread {
  id: string;
  slug: string;
  brand_name: string;
  house_number: number | null;
  hero_image_url: string | null;
  portrait_url: string | null;
  page_published_at: string;
}

interface TopProduct { slug: string; name: string; price: number }

export default function Ausgabe() {
  const ausgabeNummer = useSiteContent("ausgabe_nummer");
  const [houses, setHouses] = useState<HouseSpread[]>([]);
  const [loading, setLoading] = useState(true);
  // Teil 15c: die Halle zeigt die Vielfalt — ein Farbakzent aus dem Haus-Thema je Karte,
  // ohne dass die Halle selbst ihre Strenge verliert.
  const [accentById, setAccentById] = useState<Record<string, string>>({});
  // Teil 16c: ein kurzer, sichtbarer Weg zum Kauf — nicht nur zur Doppelseite.
  const [topProductById, setTopProductById] = useState<Record<string, TopProduct>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("designers")
          .select("id, slug, brand_name, house_number, hero_image_url, portrait_url, page_published_at")
          .eq("status", "active")
          .not("page_published_at", "is", null)
          .order("page_published_at", { ascending: false });
        const rows = (data ?? []) as unknown as HouseSpread[];
        if (!cancelled) setHouses(rows);
        if (rows.length > 0) {
          const { data: themes } = await supabase.from("house_themes" as never)
            .select("designer_id, farbwelt").in("designer_id", rows.map((h) => h.id)).eq("is_current", true);
          const map: Record<string, string> = {};
          for (const t of (themes ?? []) as unknown as Array<{ designer_id: string; farbwelt: { accent?: string } }>) {
            if (t.farbwelt?.accent) map[t.designer_id] = t.farbwelt.accent;
          }
          if (!cancelled) setAccentById(map);

          const { data: prods } = await supabase.from("products")
            .select("designer_id, slug, name, price, created_at")
            .in("designer_id", rows.map((h) => h.id)).eq("status", "published")
            .order("created_at", { ascending: false });
          const topMap: Record<string, TopProduct> = {};
          for (const p of (prods ?? []) as unknown as Array<{ designer_id: string; slug: string; name: string; price: number }>) {
            if (!topMap[p.designer_id]) topMap[p.designer_id] = { slug: p.slug, name: p.name, price: p.price };
          }
          if (!cancelled) setTopProductById(topMap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="border-b border-[rgba(0,0,0,.18)] px-6 pt-36 pb-16 md:px-14 md:pt-44 md:pb-24">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <p className="palace-eyebrow">Die laufende Ausgabe</p>
            <h1
              className="palace-serif mt-8 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.94, letterSpacing: "-0.025em" }}
            >
              Ausgabe <span className="italic">{ausgabeNummer}</span>
            </h1>
            <p className="mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#000000]/70">
              Jedes Haus, das seine Hausseite veröffentlicht hat, erhält hier eine Doppelseite.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-20 md:px-14 md:py-28">
        <div className="mx-auto max-w-[1600px]">
          {loading ? (
            <div className="h-64 animate-pulse bg-[rgba(0,0,0,.04)]" />
          ) : houses.length === 0 ? (
            <div className="border border-dashed border-[rgba(0,0,0,.22)] p-16 text-center">
              <p className="palace-serif italic text-[1.4rem] text-[#000000]/60">Die ersten Doppelseiten entstehen gerade.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[rgba(0,0,0,.18)] border-y border-[rgba(0,0,0,.18)]">
              {houses.map((h, i) => (
                <Reveal key={h.slug} delay={Math.min(400, i * 60)}>
                  <li className="relative">
                    {accentById[h.id] && (
                      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accentById[h.id] }} aria-hidden="true" />
                    )}
                    <Link to={`/designer/${h.slug}`} className="group grid grid-cols-1 items-center gap-6 py-10 pl-4 md:grid-cols-[120px_1fr_auto] md:gap-10">
                      <span className="palace-eyebrow text-[#7C7972]">№ {String(h.house_number ?? i + 1).padStart(3, "0")}</span>
                      <div className="flex items-center gap-6">
                        <div className="h-20 w-16 shrink-0 overflow-hidden md:h-28 md:w-20">
                          <EditorialImage seed={`ausgabe-${h.slug}`} src={h.portrait_url ?? h.hero_image_url} ratio="3/4" className="h-full w-full" />
                        </div>
                        <p
                          className="palace-serif font-light text-[#000000] transition-opacity group-hover:opacity-60"
                          style={{ fontSize: "clamp(1.6rem, 3.4vw, 3rem)", lineHeight: 1.02, letterSpacing: "-0.02em" }}
                        >
                          {h.brand_name}
                        </p>
                      </div>
                      <span className="palace-eyebrow whitespace-nowrap text-[#7C7972] group-hover:text-[#000000]">Doppelseite öffnen →</span>
                    </Link>
                    {topProductById[h.id] && (
                      <Link
                        to={`/product/${topProductById[h.id].slug}`}
                        className="palace-eyebrow absolute bottom-3 right-0 text-[#7C7972] hover:text-[#000000] md:bottom-4"
                      >
                        Zum Stück · {topProductById[h.id].name} →
                      </Link>
                    )}
                  </li>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
}
