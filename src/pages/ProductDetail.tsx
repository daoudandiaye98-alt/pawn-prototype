import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { supabase } from "@/integrations/supabase/client";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { toast } from "@/components/ui/sonner";
import type { ProductView } from "@/core";
import { useDnaMatch } from "@/features/dna/hooks";
import { usePersonalization, explainMatch } from "@/features/personalization";
import { usePageVisit } from "@/features/personalization/usePageVisit";

import { useCustomerEvents } from "@/features/events/useCustomerEvents";
import { useCart } from "@/store/cart";
import { useRoomShift } from "@/features/os/roomShift";
import { useDbProductBySlug } from "@/features/products/useDbProduct";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { createCustomRequestThread } from "@/features/messages/customRequest";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrevNext } from "@/components/palace/PrevNext";
import { useProductPrevNext } from "@/features/navigation/usePrevNext";
import { DEFAULT_HOUSE_THEME, resolveTheme, themeCssVars, type HouseTheme } from "@/features/houseTheme/theme";
import { PasstDas } from "@/components/palace/PasstDas";
import { ErrorBoundary } from "@/components/palace/ErrorBoundary";
import { ProductDetailsAccordion } from "@/components/palace/ProductDetailsAccordion";

import {
  effectiveVatRate, vatNote, formatEuro, worldProfile,
  type SizeVariant,
} from "@/features/studio/productDetails";


const ProductDetail = () => {
  const params = useParams<{ slug?: string; id?: string }>();
  const slug = params.slug ?? params.id ?? "asymmetric-coat";
  const { user } = useAuth();
  const { locale } = useI18n();

  const { product: dbProduct, loading: productLoading } = useDbProductBySlug(slug);
  const cart = useCart();
  const { push } = useRoomShift();
  const wishlist = useWishlist();

  // Baut die Produktansicht direkt aus der Datenbank auf — der alte Mock-Katalog
  // (core-Store) hat absichtlich leere Seed-Arrays (keine Markennamen, keine Fake-Daten) und
  // lieferte hier immer "kein Treffer", was die ganze Seite zum Absturz brachte.
  const sizeVariants = useMemo(
    () => (Array.isArray(dbProduct?.size_variants) ? dbProduct.size_variants : [] as unknown[])
      .filter((v): v is SizeVariant => !!(v as SizeVariant)?.size?.trim()),
    [dbProduct],
  );

  const product = useMemo(() => {
    const dna = (dbProduct?.product_dna ?? {}) as { colors?: string[] };
    const variants = (dbProduct?.variants ?? []) as { name: string; options: string[] }[];
    const sizeVariant = variants.find((v) => /gr(ö|oe)ße|size/i.test(v.name));
    return {
      id: dbProduct?.id ?? "",
      slug: dbProduct?.slug ?? slug,
      name: dbProduct?.name ?? "",
      designer: dbProduct?.designers?.brand_name ?? "",
      designerSlug: dbProduct?.designers?.slug ?? "",
      price: dbProduct?.price ?? 0,
      category: "",
      gender: "",
      world: dbProduct?.world ?? "Mode",
      colors: dna.colors ?? [],
      sizes: sizeVariants.length > 0 ? sizeVariants.map((v) => v.size) : (sizeVariant?.options ?? []),
      status: dbProduct?.status ?? "draft",
      description: dbProduct?.description ?? "",
      genomeAffinity: {},
      tags: dbProduct?.tags ?? [],
    } as unknown as ProductView;
  }, [dbProduct, slug, sizeVariants]);

  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors[0]);
  const [saved, setSaved] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqBody, setReqBody] = useState("");
  const [reqBudget, setReqBudget] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  const match = useDnaMatch(product.id);
  const personalization = usePersonalization();
  const dnaReason = useMemo(
    () => explainMatch(product, personalization, personalization.designerDna),
    [product, personalization],
  );
  const { viewProduct, saveProduct } = useCustomerEvents();

  const [banner, setBanner] = useState<{ url: string; kind: "bild" | "video" } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!dbProduct?.banner_media_asset_id) { setBanner(null); return; }
    (async () => {
      const { data } = await supabase.from("media_assets" as never).select("url, kind").eq("id", dbProduct.banner_media_asset_id).maybeSingle();
      if (!cancelled) setBanner((data as unknown as { url: string; kind: "bild" | "video" }) ?? null);
    })();
    return () => { cancelled = true; };
  }, [dbProduct?.banner_media_asset_id]);

  // Teil 15a: Wenn das Haus ein eigenes Thema hat (und seine Hausseite veröffentlicht ist —
  // die RLS von house_themes gibt sonst nichts zurück), trägt der "Aus dem Haus"-Banner es.
  const [houseTheme, setHouseTheme] = useState<HouseTheme | null>(null);
  useEffect(() => {
    let cancelled = false;
    const designerId = dbProduct?.designers?.id;
    if (!designerId) { setHouseTheme(null); return; }
    (async () => {
      const { data } = await supabase.from("house_themes" as never).select("*").eq("designer_id", designerId).eq("is_current", true).maybeSingle();
      // Fehlt ein eigenes Thema, gilt das PAWN-Standardthema statt gar keins.
      if (!cancelled) setHouseTheme(resolveTheme((data as unknown as Partial<HouseTheme>) ?? null));
    })();
    return () => { cancelled = true; };
  }, [dbProduct?.designers?.id]);

  useEffect(() => { viewProduct(product.id); }, [product.id, viewProduct]);

  // Teil 16c: Erfolg wird am Verkauf gemessen — dafür zählt jedes Stück seine Aufrufe.
  useEffect(() => {
    if (!dbProduct?.id) return;
    supabase.rpc("bump_product_view" as never, { p_product_id: dbProduct.id } as never).then(() => {}, () => {});
  }, [dbProduct?.id]);

  usePageVisit("product", dbProduct?.id);

  useEffect(() => {
    setSize(product.sizes[0]);
    setColor(product.colors[0]);
  }, [product.id, product.sizes, product.colors]);

  const wished = dbProduct ? wishlist.has(dbProduct.id) : false;
  const isMto = dbProduct?.inventory_mode === "made_to_order";
  const stock = dbProduct?.inventory_mode === "stock" ? dbProduct.stock_quantity : null;
  const soldOut = stock === 0;
  const lowStock = stock !== null && stock > 0 && stock < 5;
  const canRequest = !!dbProduct?.allow_custom_requests;

  function addToBag() {
    if (soldOut) { toast.error("Ausverkauft."); return; }
    cart.add(product, size);
    push(`${product.name} betritt das Brett.`);
    toast.success("Zur Tasche hinzugefügt.");
  }

  const [buyBusy, setBuyBusy] = useState(false);
  async function buyNow() {
    if (soldOut && !isMto) { toast.error("Ausverkauft."); return; }
    setBuyBusy(true);
    try {
      const price = dbProduct?.price ?? product.price;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "payment",
          items: [{
            name: product.name,
            unit_amount: Math.round(price * 100),
            qty: 1,
            slug: product.slug,
            size,
          }],
          customer_email: user?.email ?? undefined,
          locale,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) {
        const msg = (data as { message?: string })?.message ?? "Zahlung ist gerade nicht verfügbar.";
        toast.message(msg);
        return;
      }
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error)?.message ?? "Fehler beim Checkout.");
    } finally {
      setBuyBusy(false);
    }
  }

  function onSave() {
    saveProduct(product.id);
    setSaved(true);
    if (dbProduct) void wishlist.toggle(dbProduct.id);
  }

  async function submitRequest() {
    if (!user) { toast.error("Bitte anmelden."); return; }
    if (!dbProduct?.designers?.id) { toast.error("Designer nicht verfügbar."); return; }
    if (reqBody.trim().length < 10) { toast.error("Bitte beschreibe deinen Wunsch etwas ausführlicher."); return; }
    setReqBusy(true);
    try {
      await createCustomRequestThread({
        userId: user.id,
        designerId: dbProduct.designers.id,
        productId: dbProduct.id,
        productName: dbProduct.name,
        body: reqBody.trim(),
        budget: reqBudget.trim() || undefined,
      });
      toast.success("Anfrage gesendet.");
      setReqOpen(false); setReqBody(""); setReqBudget("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Fehler beim Senden.");
    } finally {
      setReqBusy(false);
    }
  }


  // Teil 15b: Produktseiten erben den Raum ihres Hauses vollständig (die Kasse — eine
  // eigene Route — bleibt davon unberührt und PAWN-streng).
  const themeForPage = houseTheme ?? DEFAULT_HOUSE_THEME;
  // Echtes Produktfoto statt Platzhalter. Zusatzbilder kommen — falls hinterlegt —
  // aus dem Bildfeld der Produkt-DNA; ohne Bild bleibt die Fläche ehrlich leer.
  const heroImage = dbProduct?.image_url ?? null;
  const gallery = useMemo(() => {
    const dna = (dbProduct?.product_dna ?? {}) as { images?: unknown };
    const list = Array.isArray(dna.images) ? (dna.images as unknown[]) : [];
    return list.filter((u): u is string => typeof u === "string" && u.trim() !== "" && u !== heroImage).slice(0, 3);
  }, [dbProduct, heroImage]);

  if (productLoading) {
    return (
      <PalaceLayout transparentHeader={false}>
        <section className="mx-auto max-w-[1600px] px-6 pt-40 pb-32 md:px-14">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
            <div className="aspect-[4/5] w-full animate-pulse border border-[rgba(0,0,0,.12)]" />
            <div className="space-y-4">
              <div className="h-4 w-32 animate-pulse bg-black/10" />
              <div className="h-10 w-2/3 animate-pulse bg-black/10" />
              <div className="h-4 w-24 animate-pulse bg-black/10" />
            </div>
          </div>
        </section>
      </PalaceLayout>
    );
  }

  if (!dbProduct) {
    return (
      <PalaceLayout transparentHeader={false}>
        <section className="mx-auto max-w-[720px] px-6 pt-40 pb-32 text-center md:px-14">
          <p className="palace-eyebrow">Nicht gefunden</p>
          <h1 className="palace-serif mt-6 text-[2.4rem] font-light leading-tight text-[#000000]">
            Dieses Stück steht nicht mehr im Raum.
          </h1>
          <p className="mt-6 font-serif italic text-[1.05rem] text-[#000000]/70">
            Vielleicht ist es verkauft oder das Haus hat es zurückgezogen.
          </p>
          <Link to="/shop" className="palace-btn mt-10 inline-flex hover:bg-[#000000] hover:text-[#FFFFFF]">
            Zur Boutique
          </Link>
        </section>
      </PalaceLayout>
    );
  }


  return (
    <PalaceLayout transparentHeader={false}>
      <div className="palace house-theme" data-typografie={themeForPage.typografie} data-textur={themeForPage.hintergrundtextur.typ} style={themeCssVars(themeForPage)}>
      {/* COVER: das Bild ist der Held — bildschirmfüllend, Titel und Haus auf dem Bild (Teil 27b) */}
      <section className="relative pt-20 md:pt-24">
        <Reveal>
          <div className="relative h-[70svh] min-h-[420px] w-full overflow-hidden bg-black md:h-[84svh]">
            {heroImage ? (
              <img src={heroImage} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <span className="palace-eyebrow text-white/50">Ohne Bild</span>
              </div>
            )}
            {/* Schwarzer Balken-Unterleger statt Verlauf — Gesetz 1 */}
            <div className="absolute inset-x-0 bottom-0 bg-black px-6 py-6 md:px-14 md:py-10">
              <p className="palace-eyebrow text-white/70">
                {product.world}{product.designer ? ` · ${product.designer}` : ""}
              </p>
              <h1
                className="palace-serif mt-3 font-light text-white"
                style={{ fontSize: "clamp(2rem, 5.2vw, 4.6rem)", lineHeight: 1.02, letterSpacing: "-0.01em" }}
              >
                {product.name}
              </h1>
            </div>
          </div>
        </Reveal>
        <div className="pointer-events-none absolute right-4 top-24 z-30 md:right-8 md:top-28">
          <div className="pointer-events-auto">
            <PrevNextForProduct slug={product.slug} />
          </div>
        </div>
      </section>

      {/* KAUFLEISTE: eine schmale, ruhige Zeile statt gestapelter Blöcke */}
      <section className="house-hair border-b">
        <div className="mx-auto max-w-[1600px] px-6 py-5 md:px-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-baseline gap-3">
              <Link to={`/designer/${product.designerSlug}`} className="house-ink palace-eyebrow uline">
                {product.designer}
              </Link>
              <span className="house-ink opacity-30">·</span>
              <p className="house-serif house-ink text-[1.2rem] tabular-nums">
                {formatPrice(dbProduct?.price ?? product.price, locale)}
              </p>
              {dbProduct?.compare_at_price && dbProduct.compare_at_price > (dbProduct?.price ?? 0) && (
                <span className="house-ink palace-eyebrow opacity-60 line-through">{formatPrice(Number(dbProduct.compare_at_price), locale)}</span>
              )}
              {isMto && (
                <span className="house-hair house-ink border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]">
                  Auf Anfertigung{dbProduct?.lead_time_days ? ` · ca. ${dbProduct.lead_time_days} Tage` : ""}
                </span>
              )}
              {!isMto && soldOut && (
                <span className="border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]" style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}>Ausverkauft</span>
              )}
              {!isMto && lowStock && (
                <span className="house-hair house-ink border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]">Noch {stock} verfügbar</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={buyNow}
                disabled={buyBusy || (soldOut && !isMto)}
                className="palace-btn text-center disabled:opacity-40"
                style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}
              >
                {buyBusy ? "Öffne Kasse…" : soldOut && !isMto ? "Ausverkauft" : "Direkt kaufen"}
              </button>
              <button
                type="button"
                onClick={addToBag}
                disabled={soldOut && !isMto}
                className="palace-btn house-ink house-hair border text-center disabled:opacity-40"
                style={{ background: "var(--house-bg)" }}
              >
                {soldOut && !isMto ? "Ausverkauft" : isMto ? "Anfertigen lassen" : "In die Tasche"}
              </button>
              <button
                type="button"
                onClick={onSave}
                aria-label="Merken"
                className="palace-btn house-hair border text-center"
                style={(saved || wished) ? { background: "var(--house-fg)", color: "var(--house-bg)" } : { background: "var(--house-bg)", color: "var(--house-fg)" }}
              >
                <Heart className={cn("h-3 w-3", (saved || wished) && "fill-current")} strokeWidth={1.4} />
              </button>
            </div>
          </div>

          {(product.colors.length > 1 || product.sizes.length > 1) && (
            <div className="house-hair mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-t pt-4">
              {product.colors.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="house-ink palace-eyebrow opacity-60">Farbe</span>
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="house-ink border px-3 py-1.5 text-[0.58rem] uppercase tracking-[0.28em] transition-colors duration-300"
                      style={c === color
                        ? { borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }
                        : { borderColor: "color-mix(in srgb, var(--house-fg) 22%, transparent)" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              {product.sizes.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="house-ink palace-eyebrow opacity-60">{worldProfile(product.world).variantPublicLabel}</span>
                  {product.sizes.map((s) => {
                    const variant = sizeVariants.find((v) => v.size === s);
                    const outOfStock = !!variant && !isMto && Number(variant.stock) <= 0;
                    return (
                      <button
                        key={s}
                        onClick={() => !outOfStock && setSize(s)}
                        disabled={outOfStock}
                        title={outOfStock ? worldProfile(product.world).variantSoldOut : undefined}
                        className={cn(
                          "house-ink border px-3 py-1.5 text-[0.58rem] uppercase tracking-[0.28em] transition-colors duration-300",
                          outOfStock && "cursor-not-allowed line-through opacity-40",
                        )}
                        style={s === size && !outOfStock
                          ? { borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }
                          : { borderColor: "color-mix(in srgb, var(--house-fg) 22%, transparent)" }}
                      >
                        {s}
                        {variant && variant.surcharge > 0 && !outOfStock ? ` +€${formatEuro(variant.surcharge)}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p className="house-ink mt-3 text-[0.6rem] uppercase tracking-[0.22em] opacity-50">
            {vatNote(effectiveVatRate(dbProduct?.vat_rate as number | null, (dbProduct?.designers as { vat_rate?: number } | null)?.vat_rate ?? 19))} · zzgl. Versand · Apple Pay · Google Pay · PayPal · Klarna · Karte
          </p>
        </div>
      </section>

      {/* GALERIE: große ungleiche Flächen statt Thumbnails */}
      {gallery.length > 0 && (
        <section className="px-6 py-16 md:px-14 md:py-24">
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 md:grid-cols-12">
            {gallery.map((url, i) => (
              <Reveal
                key={url}
                delay={i * 80}
                className={i === 0 ? "md:col-span-7" : i === 1 ? "md:col-span-5" : "md:col-span-12"}
              >
                <EditorialImage src={url} seed={`prd-${product.slug}-gal-${i}`} ratio={i === 2 ? "16/9" : "4/5"} className="w-full" alt={product.name} color />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {banner && (
        <section className="house-hair border-t px-6 py-16 md:px-14 md:py-24">
          <Reveal className="mx-auto max-w-[1600px]">
            <p className="house-accent palace-eyebrow">Aus dem Haus</p>
            {banner.kind === "video"
              ? <video src={banner.url} className="house-media mt-6 aspect-[16/9] w-full max-w-2xl object-cover" muted autoPlay loop playsInline />
              : <img src={banner.url} alt="" className="house-media mt-6 aspect-[16/9] w-full max-w-2xl object-cover" loading="lazy" />}
          </Reveal>
        </section>
      )}

      {/* GESETZTE STRECKE: Beschreibung, Geschichte, Maße/Material/Versand, Fragen — als ruhige Textfolge */}
      <section className="house-hair border-t px-6 py-16 md:px-14 md:py-24">
        <div className="mx-auto max-w-[760px]">
          {(dbProduct?.description || product.description) && (
            <Reveal>
              <p className="house-ink text-[1.02rem] leading-relaxed opacity-80">
                {dbProduct?.description || product.description}
              </p>
            </Reveal>
          )}

          {dbProduct?.designer_note?.trim() && (
            <Reveal className="house-hair mt-12 border-t pt-10">
              <p className="house-ink palace-eyebrow">Die Geschichte dahinter</p>
              <p className="house-serif house-ink mt-4 italic" style={{ fontSize: "1.2rem", lineHeight: 1.6 }}>
                {dbProduct.designer_note}
              </p>
              <p className="house-ink mt-3 text-[0.62rem] uppercase tracking-[0.32em] opacity-60">
                — {product.designer}
                {dbProduct?.designers && "house_number" in (dbProduct.designers as Record<string, unknown>)
                  ? `, Haus № ${(dbProduct.designers as { house_number?: number }).house_number ?? ""}` : ""}
              </p>
            </Reveal>
          )}

          <Reveal className="mt-4">
            <ErrorBoundary label="Die Detailangaben zu diesem Stück lassen sich gerade nicht anzeigen.">
              <ProductDetailsAccordion dbProduct={dbProduct} onPickSize={(s) => setSize(s)} />
            </ErrorBoundary>
          </Reveal>

          {(dnaReason || match.percent > 0) && (
            <Reveal className="house-hair mt-10 border-t pt-6">
              <p className="house-ink palace-eyebrow">Ausgewählt für dich, weil</p>
              <p className="house-ink mt-3 font-serif italic text-[1.05rem] leading-snug opacity-80">
                {dnaReason ?? match.rationale}
              </p>
            </Reveal>
          )}

          <Reveal className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <button
              type="button"
              onClick={() => {
                const msg = `Ich schaue mir gerade ${product.name} von ${product.designer} an.`;
                window.dispatchEvent(new CustomEvent("palace:open-chat"));
                setTimeout(() => window.dispatchEvent(new CustomEvent("palace:chat-send", {
                  detail: { message: msg, page_context: { route: "/product/" + product.slug, product_slug: product.slug } }
                })), 220);
              }}
              className="house-ink inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.32em] underline underline-offset-4 hover:opacity-70"
            >
              Frag PAWN zu diesem Stück →
            </button>
            {canRequest && (
              <button
                type="button"
                onClick={() => setReqOpen(true)}
                className="house-ink inline-flex text-[0.62rem] uppercase tracking-[0.32em] underline underline-offset-4 hover:opacity-70"
              >
                Individuelle Anfrage stellen →
              </button>
            )}
          </Reveal>

          {/* "Steht mir das?" bleibt erreichbar, tritt hinter das Bild zurück */}
          <Reveal className="mt-10">
            <PasstDas productSlug={product.slug} productName={product.name} />
          </Reveal>
        </div>
      </section>

      <div className="h-32" />

      {reqOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" onClick={() => setReqOpen(false)}>
          <div className="house-hair w-full max-w-lg border p-8" style={{ background: "var(--house-bg)" }} onClick={(e) => e.stopPropagation()}>
            <p className="house-ink palace-eyebrow">Individuelle Anfrage</p>
            <h3 className="house-serif house-ink mt-3 text-[1.8rem] font-light leading-tight">{dbProduct?.name}</h3>
            <p className="house-ink mt-3 text-[0.9rem] opacity-60">
              Deine Nachricht geht direkt an die Designer:in. Beschreibe, was du dir vorstellst — Maße, Materialien, Anlass.
            </p>
            <label className="mt-6 block">
              <span className="house-ink palace-eyebrow">Wunsch</span>
              <textarea value={reqBody} onChange={(e) => setReqBody(e.target.value)} rows={5} className="house-hair house-ink mt-2 w-full border bg-transparent p-3 text-[0.95rem] focus:outline-none" />
            </label>
            <label className="mt-4 block">
              <span className="house-ink palace-eyebrow">Budget (optional)</span>
              <input value={reqBudget} onChange={(e) => setReqBudget(e.target.value)} placeholder="z.B. 800–1200 €" className="house-hair house-ink mt-2 w-full border bg-transparent p-3 text-[0.95rem] focus:outline-none" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setReqOpen(false)} className="palace-btn house-hair house-ink border" style={{ background: "var(--house-bg)" }}>Abbrechen</button>
              <button type="button" onClick={submitRequest} disabled={reqBusy} className="palace-btn disabled:opacity-50" style={{ background: "var(--house-fg)", color: "var(--house-bg)" }}>
                {reqBusy ? "Sende …" : "Anfrage senden"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PalaceLayout>
  );

};

function PrevNextForProduct({ slug }: { slug: string }) {
  const { prev, next } = useProductPrevNext(slug);
  if (!prev && !next) return null;
  return <PrevNext prev={prev} next={next} />;
}

export default ProductDetail;

