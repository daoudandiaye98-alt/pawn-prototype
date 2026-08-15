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
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_HOUSE_THEME, themeCssVars, type Flaechenrhythmus, type HouseTheme } from "@/features/houseTheme/theme";
import { MediaImg } from "@/components/palace/MediaImg";
import { BausteinText, speichereBausteinFeld } from "@/components/palace/Editable";
import { Bildwand, Bildblatt } from "@/components/palace/Bildwand";
import { AuftrittLeiste, BausteinGriffe, BausteinWahl, BAUSTEIN_NAME, LoeschFrage } from "@/components/palace/AuftrittWerkzeuge";
import { useEditMode } from "@/lib/editMode";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";

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

/**
 * Teil U1.3 — im Auftritt-Modus liegt über jedem Medium eine unsichtbare Fläche:
 * antippen öffnet die Bildwand. Außerhalb des Modus existiert sie nicht.
 */
function MediaGriff({ onWaehlen, leer, children }: {
  onWaehlen?: () => void; leer: boolean; children: React.ReactNode;
}) {
  if (!onWaehlen) return <>{children}</>;
  return (
    <span className="relative block">
      {children}
      <button
        type="button"
        onClick={onWaehlen}
        className="absolute inset-0 flex items-center justify-center outline-1 outline-dashed outline-offset-[-4px]"
        style={{ outlineColor: "currentColor" }}
      >
        <span
          className="palace-eyebrow border-[1.5px] px-2 py-1"
          style={{ borderColor: "var(--house-fg, #000)", background: "var(--house-bg, #fff)", color: "var(--house-fg, #000)" }}
        >
          {leer ? "Bild wählen" : "Bild ändern"}
        </span>
      </button>
    </span>
  );
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
  return <MediaImg src={asset.url} alt="" className={className} loading="lazy" style={style} />;
}

/** Teil 16c: ein kurzer, sichtbarer Weg zum Kauf — überall, wo ein Medium ein Stück zeigt.
    mediaAssetId (falls bekannt) bucht den Shop-Klick auf genau dieses Bild/Video. */
function ShopLink({ product, mediaAssetId }: { product?: BlockProductLite; mediaAssetId?: string }) {
  const { locale } = useI18n();
  if (!product) return null;
  return (
    <Link
      to={`/product/${product.slug}`}
      onClick={() => { if (mediaAssetId) void supabase.rpc("bump_media_metric" as never, { p_media_asset_id: mediaAssetId, p_metric: "shop_clicks" } as never); }}
      className="house-accent mt-3 inline-flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.2em] hover:underline"
    >
      Zum Stück · {product.name} · {formatPrice(product.price, locale)}
    </Link>
  );
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
  blocks, mediaById, products, theme, designerId, medien, onAenderung, seiteIstLive,
}: {
  blocks: PageBlockRow[];
  mediaById: Record<string, BlockMediaLite>;
  products: BlockProductLite[];
  theme?: HouseTheme;
  /** Nur im Auftritt-Modus gebraucht: wem gehört diese Seite (für Upload + Bildwand). */
  designerId?: string;
  /** Dieselben Medien wie `mediaById`, aber als Liste in der Reihenfolge neueste zuerst. */
  medien?: BlockMediaLite[];
  /** Nach einer Änderung: das Elternteil lädt neu. */
  onAenderung?: () => void;
  /** Ist die Hausseite veröffentlicht? Entscheidet nur den Satz in der Leiste (U1.6). */
  seiteIstLive?: boolean;
}) {
  const t = theme ?? DEFAULT_HOUSE_THEME;
  const { locale } = useI18n();
  // Teil U1.2: derselbe Baum, nur bearbeitbar. Wahr im Auftritt-Modus des eigenen Hauses
  // (oder für Admins) — sonst rendert alles exakt wie zuvor.
  const { enabled: bearbeiten } = useEditMode();
  // Teil U1.3 — welches Feld welches Bausteins gerade in der Bildwand liegt.
  const [blatt, setBlatt] = useState<{ block: PageBlockRow; feld: string; mehrfach?: boolean } | null>(null);
  const [, neuZeichnen] = useState(0);
  const wandOffen = bearbeiten && !!designerId;
  const griff = (block: PageBlockRow, feld: string, mehrfach?: boolean) =>
    wandOffen ? () => setBlatt({ block, feld, mehrfach }) : undefined;

  const waehle = async (id: string) => {
    if (!blatt) return;
    const c = blatt.block.content;
    if (blatt.mehrfach) {
      const bisher = (c[blatt.feld] as string[] | undefined) ?? [];
      const naechste = bisher.includes(id) ? bisher.filter((x) => x !== id) : [...bisher, id];
      if (await speichereBausteinFeld(blatt.block.id, c, blatt.feld, naechste)) {
        c[blatt.feld] = naechste;
        neuZeichnen((n) => n + 1);
        onAenderung?.();
      }
      return;
    }
    if (await speichereBausteinFeld(blatt.block.id, c, blatt.feld, id)) {
      c[blatt.feld] = id;
      setBlatt(null);
      neuZeichnen((n) => n + 1);
      onAenderung?.();
    }
  };

  /* ——— Teil U1.5 / U1.4: Bausteine anlegen, verdoppeln, löschen, verschieben ——— */
  const navigiere = useNavigate();
  const ort = useLocation();
  const sortierteBloecke = useMemo(() => [...blocks].sort((a, b) => a.position - b.position), [blocks]);
  const bausteinRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [wahlOffen, setWahlOffen] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState<PageBlockRow | null>(null);
  const [zieht, setZieht] = useState<{ id: string; von: number; nach: number } | null>(null);
  const ruhig = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /** Positionen aller Bausteine neu schreiben — dieselbe Logik wie `move()` im Formular. */
  const schreibeReihenfolge = async (liste: PageBlockRow[]) => {
    const antworten = await Promise.all(liste.map((x, i) =>
      supabase.from("designer_page_blocks" as never).update({ position: i } as never).eq("id", x.id).select("id")));
    const blockiert = antworten.some((r) => r.error || !((r.data as unknown[] | null)?.length));
    if (blockiert) toast.error("Reihenfolge nicht gespeichert.");
    onAenderung?.();
  };

  const verschieben = async (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= sortierteBloecke.length) return;
    const neu = [...sortierteBloecke];
    [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
    await schreibeReihenfolge(neu);
  };

  const bausteinAnlegen = async (kind: PageBlockKind) => {
    if (!designerId) return;
    const { data, error } = await supabase.from("designer_page_blocks" as never)
      .insert({ designer_id: designerId, kind, position: sortierteBloecke.length, content: {} } as never)
      .select("id");
    if (error || !((data as unknown[] | null)?.length)) { toast.error("Baustein nicht angelegt."); return; }
    setWahlOffen(false);
    onAenderung?.();
  };

  const verdoppeln = async (b: PageBlockRow) => {
    if (!designerId) return;
    const { data, error } = await supabase.from("designer_page_blocks" as never)
      .insert({ designer_id: designerId, kind: b.kind, position: sortierteBloecke.length, content: { ...b.content } } as never)
      .select("id, kind, position, content");
    const zeile = ((data as unknown as PageBlockRow[] | null) ?? [])[0];
    if (error || !zeile) { toast.error("Nicht verdoppelt."); return; }
    // Die Kopie soll direkt unter dem Original liegen.
    const ohne = sortierteBloecke.filter((x) => x.id !== zeile.id);
    const stelle = ohne.findIndex((x) => x.id === b.id);
    const neu = [...ohne];
    neu.splice(stelle + 1, 0, zeile);
    await schreibeReihenfolge(neu);
  };

  const loeschen = async (b: PageBlockRow) => {
    const { data, error } = await supabase.from("designer_page_blocks" as never).delete().eq("id", b.id).select("id");
    setLoeschFrage(null);
    if (error || !((data as unknown[] | null)?.length)) { toast.error("Nicht entfernt."); return; }
    onAenderung?.();
  };

  /* Ziehen (U1.4) — Pointer Events, kein dragstart (das trägt auf iOS nicht).
     Bewegt wird ausschließlich `transform`; Layout bleibt unberührt. */
  const zug = useRef<{
    id: string; von: number; nach: number; startY: number; letzteY: number;
    hoehe: number; masse: { id: string; hoehe: number }[]; timer?: number; aktiv: boolean; raf?: number;
  } | null>(null);

  const rollenWennNahAmRand = () => {
    const z = zug.current;
    if (!z?.aktiv) return;
    const rand = 90;
    if (z.letzteY < rand) window.scrollBy(0, -14);
    else if (z.letzteY > window.innerHeight - rand) window.scrollBy(0, 14);
    z.raf = requestAnimationFrame(rollenWennNahAmRand);
  };

  const ziehStart = (b: PageBlockRow, index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const timer = window.setTimeout(() => {
      const z = zug.current;
      if (!z) return;
      z.masse = sortierteBloecke.map((x) => ({
        id: x.id, hoehe: bausteinRefs.current[x.id]?.getBoundingClientRect().height ?? 0,
      }));
      z.hoehe = z.masse[index]?.hoehe ?? 0;
      z.aktiv = true;
      setZieht({ id: b.id, von: index, nach: index });
      z.raf = requestAnimationFrame(rollenWennNahAmRand);
    }, 350);
    zug.current = { id: b.id, von: index, nach: index, startY, letzteY: startY, hoehe: 0, masse: [], timer, aktiv: false };
  };

  const ziehBewegung = (e: React.PointerEvent) => {
    const z = zug.current;
    if (!z) return;
    z.letzteY = e.clientY;
    if (!z.aktiv) {
      // Vor den 350 ms ist jede größere Bewegung ein Rollen, kein Ziehen.
      if (Math.abs(e.clientY - z.startY) > 10) { window.clearTimeout(z.timer); zug.current = null; }
      return;
    }
    e.preventDefault();
    const dy = e.clientY - z.startY;
    let nach = z.von;
    let summe = 0;
    if (dy > 0) {
      for (let i = z.von + 1; i < z.masse.length; i++) {
        summe += z.masse[i].hoehe;
        if (dy > summe - z.masse[i].hoehe / 2) nach = i;
      }
    } else {
      for (let i = z.von - 1; i >= 0; i--) {
        summe += z.masse[i].hoehe;
        if (-dy > summe - z.masse[i].hoehe / 2) nach = i;
      }
    }
    z.nach = nach;
    setZieht({ id: z.id, von: z.von, nach });
    const eigen = bausteinRefs.current[z.id];
    if (eigen) eigen.style.transform = ruhig ? `translateY(${dy}px)` : `translateY(${dy}px) scale(1.015)`;
    if (ruhig) return;   // „Bewegung reduzieren": kein Anheben, kein Ausweichen der Nachbarn
    sortierteBloecke.forEach((x, i) => {
      if (x.id === z.id) return;
      const n = bausteinRefs.current[x.id];
      if (!n) return;
      let versatz = 0;
      if (nach > z.von && i > z.von && i <= nach) versatz = -z.hoehe;
      if (nach < z.von && i >= nach && i < z.von) versatz = z.hoehe;
      n.style.transition = "transform .18s ease";
      n.style.transform = versatz ? `translateY(${versatz}px)` : "";
    });
  };

  const ziehEnde = async () => {
    const z = zug.current;
    zug.current = null;
    if (!z) return;
    window.clearTimeout(z.timer);
    if (z.raf) cancelAnimationFrame(z.raf);
    sortierteBloecke.forEach((x) => {
      const n = bausteinRefs.current[x.id];
      if (n) { n.style.transform = ""; n.style.transition = ""; }
    });
    setZieht(null);
    if (!z.aktiv || z.nach === z.von) return;
    const neu = [...sortierteBloecke];
    const [weg] = neu.splice(z.von, 1);
    neu.splice(z.nach, 0, weg);
    await schreibeReihenfolge(neu);
  };

  const gestaffelt = t.bewegungscharakter === "gestaffelt";
  const parallaxOn = t.bewegungscharakter === "ausdrucksstark";
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <div
      className="palace house-theme"
      data-typografie={t.typografie}
      data-textur={t.hintergrundtextur.typ}
      style={{ ...themeCssVars(t), ...(wandOffen ? { paddingBottom: "5.5rem" } : null) }}
    >
      {sortierteBloecke.map((b, blockIndex) => {
        const c = b.content as Record<string, unknown>;
        const staggerStyle = gestaffelt ? { animationDelay: `${(blockIndex % 6) * 80}ms` } : undefined;
        const inhalt = ((): React.ReactNode => {
        switch (b.kind) {
          case "auftakt": {
            const asset = mediaById[c.media_asset_id as string];
            return (
              <ParallaxSection key={b.id} active={parallaxOn} className="house-hair house-reveal overflow-hidden border-b" style={staggerStyle}>
                {(offset) => (
                  <MediaGriff leer={!asset} onWaehlen={griff(b, "media_asset_id")}>
                    <Media asset={asset} allowTon={!!c.ton}
                      style={parallaxOn ? { transform: `translateY(${offset}px) scale(1.08)` } : undefined}
                      className="house-media aspect-[16/10] w-full object-cover md:aspect-[21/9]" />
                  </MediaGriff>
                )}
              </ParallaxSection>
            );
          }
          case "editorial_text":
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="mx-auto max-w-2xl">
                  {(bearbeiten || !!c.heading) && (
                    <BausteinText
                      block={b} feld="heading" platzhalter="Überschrift" as="h2"
                      className="house-serif block font-light"
                      style={{ fontSize: "clamp(1.8rem,4vw,3rem)", lineHeight: 1.05 }}
                    />
                  )}
                  {(bearbeiten || !!c.text) && (
                    <BausteinText
                      block={b} feld="text" platzhalter="Text" as="p" multiline
                      className="house-body mt-6 block text-[1.05rem] leading-relaxed opacity-80"
                    />
                  )}
                </div>
              </section>
            );
          case "zitat":
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 text-center md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <blockquote className="house-serif mx-auto max-w-3xl italic" style={{ fontSize: "clamp(1.6rem,3.4vw,2.6rem)", lineHeight: 1.15 }}>
                  „<BausteinText block={b} feld="quote" platzhalter="Zitat" multiline />"
                </blockquote>
                {(bearbeiten || !!c.author) && (
                  <p className="house-accent palace-eyebrow mt-6">
                    <BausteinText block={b} feld="author" platzhalter="Name" />
                  </p>
                )}
              </section>
            );
          case "produktreihe": {
            const ids = (c.product_ids as string[]) ?? [];
            const items = ids.map((id) => productsById[id]).filter(Boolean) as BlockProductLite[];
            if (items.length === 0 && !bearbeiten) return null;
            if (items.length === 0) {
              // Im Auftritt-Modus bleibt auch ein leerer Baustein sichtbar — sonst ließe er
              // sich weder füllen noch entfernen.
              return (
                <section key={b.id} className="house-hair house-gap-y border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                  <p className="palace-eyebrow opacity-50">Produktreihe — noch keine Stücke gewählt.</p>
                </section>
              );
            }
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
                  {items.map((p, i) => (
                    <Link key={p.id} to={`/product/${p.slug}`} className="group block" style={gestaffelt ? { transitionDelay: `${i * 60}ms` } : undefined}>
                      {p.image_url && <MediaImg src={p.image_url} alt={p.name} className="house-media aspect-[4/5] w-full object-cover" loading="lazy" />}
                      <p className="house-serif mt-3 text-[1rem]">{p.name}</p>
                      <p className="house-accent palace-eyebrow mt-1">{formatPrice(p.price, locale)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          }
          case "lookbook_streifen": {
            const ids = (c.media_asset_ids as string[]) ?? [];
            const items = ids.map((id) => mediaById[id]).filter(Boolean) as BlockMediaLite[];
            if (items.length === 0 && !bearbeiten) return null;
            const product = productsById[c.product_id as string];
            return (
              <section key={b.id} className="house-hair house-reveal border-b" style={staggerStyle}>
                {wandOffen && (
                  <div className="px-6 pt-6 md:px-14">
                    <button
                      type="button"
                      onClick={griff(b, "media_asset_ids", true)}
                      className="palace-eyebrow border-[1.5px] px-3 py-1.5"
                      style={{ borderColor: "var(--house-fg, #000)", background: "var(--house-bg, #fff)", color: "var(--house-fg, #000)" }}
                    >
                      {items.length === 0 ? "Bilder wählen" : `Bilder ändern (${items.length})`}
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <div className="flex gap-px" style={{ minWidth: "max-content" }}>
                    {items.map((asset) => <Media key={asset.id} asset={asset} allowTon={!!c.ton} className="house-media h-[60vh] w-auto max-w-[80vw] object-cover md:h-[70vh]" />)}
                  </div>
                </div>
                {product && <div className="px-6 pb-6 md:px-14"><ShopLink product={product} mediaAssetId={items[0]?.id} /></div>}
              </section>
            );
          }
          case "banner_seitlich": {
            const asset = mediaById[c.media_asset_id as string];
            const product = productsById[c.product_id as string];
            return (
              <section key={b.id} className="house-hair house-reveal border-b px-6 py-10 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <MediaGriff leer={!asset} onWaehlen={griff(b, "media_asset_id")}>
                  <Media asset={asset} allowTon={!!c.ton} className="house-media aspect-[3/4] w-full max-w-sm object-cover md:aspect-[2/3]" />
                </MediaGriff>
                <ShopLink product={product} mediaAssetId={asset?.id} />
              </section>
            );
          }
          case "banner_vollbreite": {
            const asset = mediaById[c.media_asset_id as string];
            const product = productsById[c.product_id as string];
            return (
              <section key={b.id} className="house-hair house-reveal overflow-hidden border-b" style={staggerStyle}>
                <ParallaxSection active={parallaxOn} className="">
                  {(offset) => (
                    <MediaGriff leer={!asset} onWaehlen={griff(b, "media_asset_id")}>
                      <Media asset={asset} allowTon={!!c.ton}
                        style={parallaxOn ? { transform: `translateY(${offset}px) scale(1.08)` } : undefined}
                        className="house-media aspect-[3/1] w-full object-cover md:aspect-[4/1]" />
                    </MediaGriff>
                  )}
                </ParallaxSection>
                {product && <div className="px-6 py-4 md:px-14"><ShopLink product={product} mediaAssetId={asset?.id} /></div>}
              </section>
            );
          }
          case "ueberlappend": {
            const assetA = mediaById[c.media_asset_id_a as string];
            const assetB = mediaById[c.media_asset_id_b as string];
            const product = productsById[c.product_id as string];
            return (
              <section key={b.id} className="house-hair house-reveal house-gap-y relative border-b px-6 md:px-14" style={{ ...staggerStyle, ...abstandStyle(c.abstand) }}>
                <div className="relative mx-auto max-w-4xl">
                  <div className="w-[70%]">
                    <MediaGriff leer={!assetA} onWaehlen={griff(b, "media_asset_id_a")}>
                      <Media asset={assetA} className="house-media aspect-[4/5] w-full object-cover" />
                    </MediaGriff>
                  </div>
                  <div className="absolute bottom-[-10%] right-0 w-[55%]">
                    <MediaGriff leer={!assetB} onWaehlen={griff(b, "media_asset_id_b")}>
                      <Media asset={assetB} className="house-media aspect-[4/5] w-full object-cover" style={{ boxShadow: "0 0 0 1.5px var(--house-bg, #fff)" }} />
                    </MediaGriff>
                  </div>
                </div>
                {product && <div className="mx-auto max-w-4xl pt-[14%]"><ShopLink product={product} mediaAssetId={assetB?.id ?? assetA?.id} /></div>}
              </section>
            );
          }
          default:
            return null;
        }
        })();
        if (!wandOffen || !inhalt) return inhalt;
        // Teil U1.5 — dieselbe Darstellung, nur mit drei Griffen an der Kante.
        return (
          <div
            key={b.id}
            ref={(n) => { bausteinRefs.current[b.id] = n; }}
            className="relative"
            data-baustein={b.id}
            style={zieht?.id === b.id && !ruhig
              ? { zIndex: 5, boxShadow: "6px 6px 0 var(--house-fg, #000)" }
              : undefined}
          >
            {inhalt}
            <BausteinGriffe
              name={BAUSTEIN_NAME[b.kind]}
              ziehGriff={{
                onPointerDown: ziehStart(b, blockIndex),
                onPointerMove: ziehBewegung,
                onPointerUp: () => void ziehEnde(),
                onPointerCancel: () => void ziehEnde(),
              }}
              onHoch={() => void verschieben(blockIndex, -1)}
              onRunter={() => void verschieben(blockIndex, 1)}
              onVerdoppeln={() => void verdoppeln(b)}
              onLoeschen={() => setLoeschFrage(b)}
            />
          </div>
        );
      })}

      {/* Teil U1.3 — die Bildwand. Mobil ein Blatt von unten, ab Bildschirmbreite rechts. */}
      {/* Teil U1.5 — genau eine Bedienfläche, unten fixiert. */}
      {wandOffen && (
        <AuftrittLeiste
          live={!!seiteIstLive}
          onBaustein={() => setWahlOffen(true)}
          onFertig={() => navigiere(ort.pathname, { replace: true })}
        />
      )}
      {wahlOffen && (
        <BausteinWahl
          arten={["auftakt", "editorial_text", "zitat", "produktreihe", "lookbook_streifen", "banner_seitlich", "banner_vollbreite", "ueberlappend"]}
          onWahl={(k) => void bausteinAnlegen(k)}
          onSchliessen={() => setWahlOffen(false)}
        />
      )}
      {loeschFrage && (
        <LoeschFrage
          name={BAUSTEIN_NAME[loeschFrage.kind]}
          onJa={() => void loeschen(loeschFrage)}
          onNein={() => setLoeschFrage(null)}
        />
      )}

      {blatt && designerId && (
        <Bildblatt
          offen
          onSchliessen={() => setBlatt(null)}
          titel={blatt.mehrfach ? "Bilder wählen" : "Bild wählen"}
        >
          <Bildwand
            designerId={designerId}
            medien={medien ?? Object.values(mediaById)}
            mehrfach={blatt.mehrfach}
            ohneTitel
            gewaehlt={blatt.mehrfach
              ? ((blatt.block.content[blatt.feld] as string[] | undefined) ?? [])
              : ((blatt.block.content[blatt.feld] as string | undefined) ?? null)}
            onWahl={(id) => void waehle(id)}
            onNeu={onAenderung}
          />
        </Bildblatt>
      )}
    </div>
  );
}
