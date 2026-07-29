/**
 * Teil 17b: der "teilbare Link" zum Creator Package — eine öffentliche, kuratierte Seite
 * zu einem Stück, gedacht zum Weiterreichen an Presse, Stylisten oder Multiplikatoren, die
 * kein ZIP herunterladen wollen. Kein Login nötig, keine Kaufabsicht — reine Übergabe.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, buildCaption, fetchShareKitTexts } from "@/features/share/shareKit";
import { toast } from "sonner";

interface PresseData {
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  world: string;
  designer: { brand_name: string; slug: string; avatar_url: string | null; story: string | null };
}

export default function Presse() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PresseData | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); return; }
    (async () => {
      try {
        const { data: row } = await supabase.from("products")
          .select("name, slug, price, image_url, world, designers ( brand_name, slug, avatar_url, story )")
          .eq("slug", slug).eq("status", "published").maybeSingle();
        if (!alive) return;
        const d = row as unknown as (PresseData & { designers: PresseData["designer"] }) | null;
        if (d) {
          setData({ ...d, designer: d.designers });
          const texts = await fetchShareKitTexts();
          if (!alive) return;
          const link = `${window.location.origin}/product/${d.slug}`;
          setCaption(buildCaption(texts.caption_template, {
            brand: d.designers.brand_name, name: d.name, price: formatPrice(d.price), link,
          }));
          setHashtags((texts.hashtag_sets[d.world] ?? []).join(" "));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} kopiert.`)).catch(() => toast.error("Kopieren fehlgeschlagen."));
  };

  if (loading) return <PalaceLayout><div className="mx-auto max-w-3xl px-6 py-24"><div className="h-96 animate-pulse bg-muted" /></div></PalaceLayout>;
  if (!data) return <PalaceLayout><div className="mx-auto max-w-3xl px-6 py-24 text-center"><p className="font-serif text-2xl">Stück nicht gefunden.</p></div></PalaceLayout>;

  return (
    <PalaceLayout>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="editorial-eyebrow">Pressemappe</p>
        <h1 className="mt-2 font-serif text-3xl font-medium sm:text-4xl">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data.designer.brand_name} · {formatPrice(data.price)}</p>

        {data.image_url && (
          <img src={data.image_url} alt={data.name} className="mt-8 w-full border border-border object-cover" style={{ aspectRatio: "4 / 5" }} />
        )}

        <div className="mt-8 flex items-center gap-4">
          {data.designer.avatar_url && (
            <img src={data.designer.avatar_url} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
          )}
          <div>
            <p className="font-serif text-lg">{data.designer.brand_name}</p>
            {data.designer.story && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{data.designer.story}</p>}
          </div>
        </div>

        <div className="mt-10 border-[1.5px] border-foreground bg-white p-6">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Bildunterschrift-Vorschlag</p>
          <p className="mt-2 whitespace-pre-line text-sm">{caption}</p>
          {hashtags && <p className="mt-3 text-sm text-muted-foreground">{hashtags}</p>}
          <button type="button" onClick={() => copy(`${caption}${hashtags ? `\n${hashtags}` : ""}`, "Text")}
            className="mt-4 border border-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
            Text kopieren
          </button>
        </div>

        <Link to={`/product/${data.slug}`} className="mt-8 inline-block border border-border px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:border-foreground">
          Zum Stück im Shop
        </Link>
      </div>
    </PalaceLayout>
  );
}
