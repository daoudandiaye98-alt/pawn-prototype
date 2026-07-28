/**
 * Teil 12c: gemeinsame Darstellung der Hausseiten-Bausteine — dieselbe Komponente rendert
 * die Vorschau im Studio-Editor und die öffentliche Hausseite.
 *
 * Teil 15a: trägt zusätzlich das Haus-Thema (Vibecoding) — Farbwelt, Typografie-Paarung,
 * Flächenrhythmus, Kantenhärte, Bewegungscharakter, Hintergrundtextur — als eigener,
 * geschachtelter CSS-Variablen-Scope (`.house-theme`, siehe index.css). Ohne eigenes Thema
 * (theme=undefined) sieht die Seite exakt wie zuvor aus: hart, schwarz-weiß, editorial.
 *
 * Teil 15b: variable Räume — neuer Baustein "Überlappend" (zwei versetzte Medien), eigene
 * Abstände je Baustein (content.abstand überschreibt den Flächenrhythmus des Themas), Ton
 * optional bei Video-Bausteinen (content.ton), und Scroll-Verhalten passend zum
 * Bewegungscharakter (ruhig = sanftes Einblenden, gestaffelt = versetzt je Element,
 * ausdrucksstark = leichter Parallax-Versatz bei ganzseitigen Flächen).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_HOUSE_THEME, themeCssVars, type Flaechenrhythmus, type HouseTheme } from "@/features/houseTheme/theme";

export type PageBlockKind =
  | "auftakt" | "editorial_text" | "zitat" | "produktreihe" | "lookbook_streifen"
  | "banner_seitlich" | "banner_vollbreite" | "ueberlappend";

export interface PageBlockRow {
  id: string;
  kind: PageBlockKind;
  position: number;
  content: Record<string, unknown>;
}

export interface BlockMediaLite { id: string; url: string; kind: "bild" | "video"; }
export interface BlockProductLite { id: string; name: string; slug: string; price: number; image_url: string | null; }

const ABSTAND_PADDING: Record<Flaechenrhythmus, string> = { eng: "2.5rem", ruhig: "4.5rem", luftig: "6.5rem", episch: "9rem" };
function abstandStyle(abstand: unknown): React.CSSProperties | undefined {
  const v = typeof abstand === "string" && abstand in ABSTAND_PADDING ? (abstand as Flaechenrhythmus) : null;
  return v ? { paddingTop: ABSTAND_PADDING[v], paddingBottom: ABSTAND_PADDING[v] } : undefined;
}

/** Leichter Parallax-Versatz für ganzseitige Flächen — nur bei bewegungscharakter="ausdrucksstark". */
function useParallax(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const progress = Math.min(Math.max((vh - rect.top) / (vh + rect.height), 0), 1);
        setOffset((progress - 0.5) * 32);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return { ref, offset };
}

function Media({ asset, className, allowTon, style }: {
  asset?: BlockMediaLite; className?: string; allowTon?: boolean; style?: React.CSSProperties;
}) {
  const [muted, setMuted] = useState(true);
  if (!asset) return <div className={`bg-[rgba(0,0,0,.04)] ${className ?? ""}`} />;
  if (asset.kind === "video") {
    return (
      <div className="relative">
        <video src={asset.url} muted={muted} playsInline autoPlay loop className={className} style={style}>{/* endlos */}</video>
        {allowTon && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-3 right-3 border px-2 py-1 text-[0.58rem] uppercase tracking-widest"
            style={{ borderColor: "var(--house-fg, #000)", color: "var(--house-fg, #000)", background: "var(--house-bg, #fff)" }}
          >
            {muted ? "Ton an" : "Ton aus"}
          </button>
        )}
      </div>
    );
  }
  return <img src={asset.url} alt="" className={className} loading="lazy" style={style} />;
}

/** Ganzseitige Fläche mit optionalem, leichtem Parallax-Versatz (eigene Komponente, damit
    der Scroll-Effekt-Hook unabhängig von der Block-Reihenfolge im Elternteil aufgerufen wird). */
function ParallaxSection({ active, className, style, children }: {
  active: boolean; className: string; style?: React.CSSProperties; children: (offset: number) => React.ReactNode;
}) {
  const { ref, offset } = useParallax(active);
  return <section ref={ref} className={className} style={style}>{children(offset)}</section>;
}

export function HausseiteBlocks({
  blocks, mediaById, products, theme,
}: {
  blocks: PageBlockRow[];
  mediaById: Record<string, BlockMediaLite>;
  products: BlockProductLite[];
  theme?: HouseTheme;
}) {
  const t = theme ?? DEFAULT_HOUSE_THEME;
  const gestaffelt = t.bewegungscharakter === "gestaffelt";
  const parallaxOn = t.bewegungscharakter === "ausdrucksstark";
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <div
      className="palace house-theme"
      data-typografie={t.typografie}
      data-textur={t.hintergrundtextur.typ}
      style={themeCssVars(t)}
    >
      {[...blocks].sort((a, b) => a.position - b.position).map((b, blockIndex) => {
        const c = b.content as Record<string, unknown>;
        const staggerStyle = gestaffelt ? { animationDelay: `${(blockIndex % 6) * 80}ms` } : undefined;
        switch (b.kind) {
          case "auftakt": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <ParallaxSection key={b.id} active={parallaxOn} className="house-hair house-reveal overflow-hidden border-b" style={staggerStyle}>
                {(offset) => (
                  <Media asset={asset} allowTon={!!c.ton}
                    style={parallaxOn ? { transform: `translateY(${offset}px) scale(1.08)` } : undefined}
                    className="house-media aspect-[16/10] w-full object-cover md:aspect-[21/9]" />
                )}
              </ParallaxSection>
            );
          }
          case "editorial_text":
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="mx-auto max-w-2xl">
                  {!!c.heading && (
                    <h2 className="house-serif font-light" style={{ fontSize: "clamp(1.8rem,4vw,3rem)", lineHeight: 1.05 }}>
                      {String(c.heading)}
                    </h2>
                  )}
                  {!!c.text && <p className="house-body mt-6 text-[1.05rem] leading-relaxed opacity-80">{String(c.text)}</p>}
                </div>
              </section>
            );
          case "zitat":
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 text-center md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <blockquote className="house-serif mx-auto max-w-3xl italic" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)", lineHeight: 1.15 }}>
                  „{String(c.quote ?? "")}"
                </blockquote>
                {!!c.author && <p className="house-accent palace-eyebrow mt-6">{String(c.author)}</p>}
              </section>
            );
          case "produktreihe": {
            const ids = (c.product_ids as string[]) ?? [];
            const items = ids.map((id) => productsById[id]).filter(Boolean) as BlockProductLite[];
            if (items.length === 0) return null;
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
                  {items.map((p, i) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="group block" style={gestaffelt ? { transitionDelay: `${i * 60}ms` } : undefined}>
                      {p.image_url && <img src={p.image_url} alt={p.name} className="house-media aspect-[4/5] w-full object-cover" loading="lazy" />}
                      <p className="house-serif mt-3 text-[1rem]">{p.name}</p>
                      <p className="house-accent palace-eyebrow mt-1">€{p.price.toLocaleString("de-DE")}</p>
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
              <section key={b.id} className="house-hair house-reveal overflow-x-auto border-b" style={staggerStyle}>
                <div className="flex gap-px" style={{ minWidth: "max-content" }}>
                  {items.map((asset) => <Media key={asset.id} asset={asset} allowTon={!!c.ton} className="house-media h-[60vh] w-auto max-w-[80vw] object-cover md:h-[70vh]" />)}
                </div>
              </section>
            );
          }
          case "banner_seitlich": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <section key={b.id} className="house-hair house-reveal border-b px-6 py-10 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <Media asset={asset} allowTon={!!c.ton} className="house-media aspect-[3/4] w-full max-w-sm object-cover md:aspect-[2/3]" />
              </section>
            );
          }
          case "banner_vollbreite": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <ParallaxSection key={b.id} active={parallaxOn} className="house-hair house-reveal overflow-hidden border-b" style={staggerStyle}>
                {(offset) => (
                  <Media asset={asset} allowTon={!!c.ton}
                    style={parallaxOn ? { transform: `translateY(${offset}px) scale(1.08)` } : undefined}
                    className="house-media aspect-[3/1] w-full object-cover md:aspect-[4/1]" />
                )}
              </ParallaxSection>
            );
          }
          case "ueberlappend": {
            const assetA = mediaById[c.media_asset_id_a as string];
            const assetB = mediaById[c.media_asset_id_b as string];
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y relative border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="relative mx-auto max-w-4xl">
                  <Media asset={assetA} className="house-media aspect-[4/5] w-[70%] object-cover" />
                  <div className="absolute bottom-[-10%] right-0 w-[55%]">
                    <Media asset={assetB} className="house-media aspect-[4/5] w-full object-cover" style={{ boxShadow: "0 0 0 1.5px var(--house-bg, #fff)" }} />
                  </div>
                </div>
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
