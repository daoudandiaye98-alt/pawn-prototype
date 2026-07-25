/**
 * Teil 12c: gemeinsame Darstellung der Hausseiten-Bausteine — dieselbe Komponente rendert
 * die Vorschau im Studio-Editor und die öffentliche Hausseite. Strikt editoriales System:
 * harte Haarlinien, Playfair, viel Weiß, keine Rundungen, keine Schatten.
 */
import { Link } from "react-router-dom";

export type PageBlockKind =
  | "auftakt" | "editorial_text" | "zitat" | "produktreihe" | "lookbook_streifen" | "banner_seitlich" | "banner_vollbreite";

export interface PageBlockRow {
  id: string;
  kind: PageBlockKind;
  position: number;
  content: Record<string, unknown>;
}

export interface BlockMediaLite { id: string; url: string; kind: "bild" | "video"; }
export interface BlockProductLite { id: string; name: string; slug: string; price: number; image_url: string | null; }

function Media({ asset, className }: { asset?: BlockMediaLite; className?: string }) {
  if (!asset) return <div className={`bg-[rgba(0,0,0,.04)] ${className ?? ""}`} />;
  return asset.kind === "video"
    ? <video src={asset.url} muted playsInline autoPlay loop className={className}>{/* editorial: stumm, endlos */}</video>
    : <img src={asset.url} alt="" className={className} loading="lazy" />;
}

export function HausseiteBlocks({
  blocks, mediaById, products,
}: {
  blocks: PageBlockRow[];
  mediaById: Record<string, BlockMediaLite>;
  products: BlockProductLite[];
}) {
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  return (
    <div className="palace bg-white text-black">
      {[...blocks].sort((a, b) => a.position - b.position).map((b) => {
        const c = b.content as Record<string, unknown>;
        switch (b.kind) {
          case "auftakt": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)]">
                <Media asset={asset} className="aspect-[16/10] w-full object-cover md:aspect-[21/9]" />
              </section>
            );
          }
          case "editorial_text":
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)] px-6 py-16 md:px-14 md:py-24">
                <div className="mx-auto max-w-2xl">
                  {!!c.heading && (
                    <h2 className="palace-serif font-light" style={{ fontSize: "clamp(1.8rem,4vw,3rem)", lineHeight: 1.05 }}>
                      {String(c.heading)}
                    </h2>
                  )}
                  {!!c.text && <p className="mt-6 font-serif text-[1.05rem] leading-relaxed text-black/80">{String(c.text)}</p>}
                </div>
              </section>
            );
          case "zitat":
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)] px-6 py-20 text-center md:px-14 md:py-28">
                <blockquote className="mx-auto max-w-3xl palace-serif italic" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)", lineHeight: 1.15 }}>
                  „{String(c.quote ?? "")}"
                </blockquote>
                {!!c.author && <p className="palace-eyebrow mt-6">{String(c.author)}</p>}
              </section>
            );
          case "produktreihe": {
            const ids = (c.product_ids as string[]) ?? [];
            const items = ids.map((id) => productsById[id]).filter(Boolean) as BlockProductLite[];
            if (items.length === 0) return null;
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)] px-6 py-16 md:px-14 md:py-24">
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
                  {items.map((p) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="group block">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="aspect-[4/5] w-full object-cover" loading="lazy" />}
                      <p className="palace-serif mt-3 text-[1rem]">{p.name}</p>
                      <p className="palace-eyebrow mt-1">€{p.price.toLocaleString("de-DE")}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          case "lookbook_streifen": {
            const ids = (c.media_asset_ids as string[]) ?? [];
            const items = ids.map((id) => mediaById[id]).filter(Boolean) as BlockMediaLite[];
            if (items.length === 0) return null;
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)] overflow-x-auto">
                <div className="flex gap-px" style={{ minWidth: "max-content" }}>
                  {items.map((asset) => <Media key={asset.id} asset={asset} className="h-[60vh] w-auto max-w-[80vw] object-cover md:h-[70vh]" />)}
                </div>
              </section>
            );
          }
          case "banner_seitlich": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)] px-6 py-10 md:px-14">
                <Media asset={asset} className="aspect-[3/4] w-full max-w-sm object-cover md:aspect-[2/3]" />
              </section>
            );
          }
          case "banner_vollbreite": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <section key={b.id} className="border-b border-[rgba(0,0,0,.18)]">
                <Media asset={asset} className="aspect-[3/1] w-full object-cover md:aspect-[4/1]" />
              </section>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
