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
import {
  careLabel, effectiveVatRate, materialLine, vatNote, formatEuro,
  type MaterialPart, type Measurements, type SizeVariant,
} from "@/features/studio/productDetails";

const ProductDetail = () => {
  const params = useParams<{ slug?: string; id?: string }>();
  const slug = params.slug ?? params.id ?? "asymmetric-coat";
  const { user } = useAuth();
  const { locale } = useI18n();

  const { product: dbProduct } = useDbProductBySlug(slug);
  const cart = useCart();
  const { push } = useRoomShift();
  const wishlist = useWishlist();

  // Baut die Produktansicht direkt aus der Datenbank auf — der alte Mock-Katalog
  // (core-Store) hat absichtlich leere Seed-Arrays (keine Markennamen, keine Fake-Daten) und
  // lieferte hier immer "kein Treffer", was die ganze Seite zum Absturz brachte.
  const sizeVariants = useMemo(
    () => ((dbProduct?.size_variants ?? []) as unknown as SizeVariant[]).filter((v) => v?.size?.trim()),
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
  const dbVariants = (dbProduct?.variants ?? []) as { name: string; options: string[] }[];
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

  return (
    <PalaceLayout transparentHeader={false}>
      <div className="palace house-theme" data-typografie={themeForPage.typografie} data-textur={themeForPage.hintergrundtextur.typ} style={themeCssVars(themeForPage)}>
      {/* Banner: hero image always first, directly under the nav */}
      <section className="relative pt-20 md:pt-24">
        <Reveal>
          <EditorialImage
            seed={`prd-${product.slug}-hero`}
            ratio="16/9"
            className="w-full"
          />
        </Reveal>
        <div className="pointer-events-none absolute right-4 top-24 z-30 md:right-8 md:top-28">
          <div className="pointer-events-auto">
            <PrevNextForProduct slug={product.slug} />
          </div>
        </div>
      </section>

      <section className="px-6 pt-12 md:px-14 md:pt-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          {/* Left: gallery thumbnails */}
          <Reveal>
            <EditorialImage seed={`prd-${product.slug}`} ratio="4/5" className="w-full" />
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <EditorialImage key={i} seed={`prd-${product.slug}-${i}`} ratio="1/1" />
              ))}
            </div>
          </Reveal>

          {banner && (
            <Reveal>
              <div className="house-hair mt-8 border-t pt-8">
                <p className="house-accent palace-eyebrow">Aus dem Haus</p>
                {banner.kind === "video"
                  ? <video src={banner.url} className="house-media mt-4 aspect-[3/4] w-full max-w-sm object-cover" muted autoPlay loop playsInline />
                  : <img src={banner.url} alt="" className="house-media mt-4 aspect-[3/4] w-full max-w-sm object-cover" loading="lazy" />}
              </div>
            </Reveal>
          )}


          {/* Right: sticky detail */}
          <div>
            <div className="md:sticky md:top-28">
              <Reveal>
                <p className="house-ink palace-eyebrow">{product.world} · {product.category}</p>
                <h1
                  className="house-serif house-ink mt-6 font-light"
                  style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1.02, letterSpacing: "-0.01em" }}
                >
                  {product.name}
                </h1>
                <Link
                  to={`/designer/${product.designerSlug}`}
                  className="house-ink palace-eyebrow uline mt-4 inline-block"
                >
                  {product.designer} →
                </Link>
                <div className="mt-8 flex items-baseline gap-3">
                  <p className="house-serif house-ink text-[1.4rem] tabular-nums">
                    {formatPrice(dbProduct?.price ?? product.price, locale)}
                  </p>
                  {dbProduct?.compare_at_price && dbProduct.compare_at_price > (dbProduct?.price ?? 0) && (
                    <span className="house-ink palace-eyebrow opacity-60 line-through">{formatPrice(Number(dbProduct.compare_at_price), locale)}</span>
                  )}
                </div>
                <p className="house-ink mt-2 text-[0.7rem] opacity-70">
                  {vatNote(effectiveVatRate(dbProduct?.vat_rate as number | null, (dbProduct?.designers as { vat_rate?: number } | null)?.vat_rate ?? 19))} · zzgl. Versand
                </p>

                {/* Availability badges */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {isMto && (
                    <span className="house-hair house-ink border px-3 py-1 text-[0.58rem] uppercase tracking-[0.32em]">
                      Auf Anfertigung{dbProduct?.lead_time_days ? ` · ca. ${dbProduct.lead_time_days} Tage` : ""}
                    </span>
                  )}
                  {!isMto && soldOut && (
                    <span className="border px-3 py-1 text-[0.58rem] uppercase tracking-[0.32em]" style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}>Ausverkauft</span>
                  )}
                  {!isMto && lowStock && (
                    <span className="house-hair house-ink border px-3 py-1 text-[0.58rem] uppercase tracking-[0.32em]">Noch {stock} verfügbar</span>
                  )}
                </div>

                <p className="house-ink mt-8 max-w-md text-[0.98rem] leading-relaxed opacity-80">
                  {dbProduct?.description || product.description}
                </p>

                {/* Der Gedanke dahinter */}
                {dbProduct?.designer_note?.trim() && (
                  <div className="house-hair mt-10 border-t pt-8">
                    <p className="house-ink palace-eyebrow">Der Gedanke dahinter</p>
                    <p className="house-serif house-ink mt-4 italic" style={{ fontSize: "1.15rem", lineHeight: 1.55, maxWidth: "55ch" }}>
                      {dbProduct.designer_note}
                    </p>
                    <p className="house-ink mt-3 text-[0.62rem] uppercase tracking-[0.32em] opacity-60">
                      — {product.designer}
                      {dbProduct?.designers && "house_number" in (dbProduct.designers as Record<string, unknown>)
                        ? `, Haus № ${(dbProduct.designers as { house_number?: number }).house_number ?? ""}` : ""}
                    </p>
                  </div>
                )}

                {/* Detail-Tabelle */}
                <ProductDetailsTable dbProduct={dbProduct} />

                {/* Frag PAWN zu diesem Stück */}
                <button
                  type="button"
                  onClick={() => {
                    const msg = `Ich schaue mir gerade ${product.name} von ${product.designer} an.`;
                    window.dispatchEvent(new CustomEvent("palace:open-chat"));
                    setTimeout(() => window.dispatchEvent(new CustomEvent("palace:chat-send", {
                      detail: { message: msg, page_context: { route: "/product/" + product.slug, product_slug: product.slug } }
                    })), 220);
                  }}
                  className="house-ink mt-6 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.32em] underline underline-offset-4 hover:opacity-70"
                >
                  Frag PAWN zu diesem Stück →
                </button>

                {/* Steht mir das? (Teil 21c) */}
                <div className="mt-4">
                  <PasstDas productSlug={product.slug} productName={product.name} />
                </div>


                {/* DB variants */}
                {dbVariants.length > 0 && (
                  <div className="mt-8 space-y-6">
                    {dbVariants.map((v) => (
                      <div key={v.name}>
                        <p className="house-ink palace-eyebrow">{v.name}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {v.options.map((o) => (
                            <button key={o} type="button" className="house-hair house-ink border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] hover:opacity-70">
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}


                {/* Provenance */}
                {(dnaReason || match.percent > 0) && (
                  <div className="house-hair mt-10 border-t pt-6">
                    <p className="house-ink palace-eyebrow">Ausgewählt für dich, weil</p>
                    <p className="house-ink mt-3 font-serif italic text-[1.05rem] leading-snug opacity-80">
                      {dnaReason ?? match.rationale}
                    </p>
                  </div>

                )}

                {/* Color */}
                {product.colors.length > 1 && (
                  <div className="mt-10">
                    <p className="house-ink palace-eyebrow">Farbe · <span>{color}</span></p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className="house-ink border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300"
                          style={c === color
                            ? { borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }
                            : { borderColor: "color-mix(in srgb, var(--house-fg) 22%, transparent)" }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Size */}
                {product.sizes.length > 1 && (
                  <div className="mt-6">
                    <p className="house-ink palace-eyebrow">Format · <span>{size}</span></p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.sizes.map((s) => {
                        const variant = sizeVariants.find((v) => v.size === s);
                        const outOfStock = !!variant && !isMto && Number(variant.stock) <= 0;
                        return (
                          <button
                            key={s}
                            onClick={() => !outOfStock && setSize(s)}
                            disabled={outOfStock}
                            title={outOfStock ? "Diese Größe ist ausverkauft." : undefined}
                            className={cn(
                              "house-ink border px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] transition-colors duration-300",
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
                  </div>
                )}

                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={buyNow}
                    disabled={buyBusy || (soldOut && !isMto)}
                    className="palace-btn flex-1 justify-center text-center disabled:opacity-40"
                    style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}
                  >
                    {buyBusy ? "Öffne Kasse…" : soldOut && !isMto ? "Ausverkauft" : "Direkt kaufen"}
                  </button>
                  <button
                    type="button"
                    onClick={addToBag}
                    disabled={soldOut && !isMto}
                    className="palace-btn house-ink house-hair flex-1 justify-center border text-center disabled:opacity-40"
                    style={{ background: "var(--house-bg)" }}
                  >
                    {soldOut && !isMto ? "Ausverkauft" : isMto ? "Anfertigen lassen" : "In die Tasche"}
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    aria-label="Merken"
                    className="palace-btn house-hair justify-center border text-center"
                    style={(saved || wished) ? { background: "var(--house-fg)", color: "var(--house-bg)" } : { background: "var(--house-bg)", color: "var(--house-fg)" }}
                  >
                    <Heart className={cn("mr-2 inline h-3 w-3", (saved || wished) && "fill-current")} strokeWidth={1.4} />
                    {(saved || wished) ? "Gemerkt" : "Merken"}
                  </button>
                </div>
                <p className="house-ink mt-3 text-[0.62rem] uppercase tracking-[0.24em] opacity-60">
                  Apple Pay · Google Pay · PayPal · Klarna · Karte
                </p>

                {canRequest && (
                  <button
                    type="button"
                    onClick={() => setReqOpen(true)}
                    className="house-ink mt-4 inline-flex text-[0.62rem] uppercase tracking-[0.32em] underline underline-offset-4 hover:opacity-70"
                  >
                    Individuelle Anfrage stellen →
                  </button>
                )}


                <p className="house-hair house-ink mt-10 border-t pt-6 text-[0.8rem] leading-relaxed opacity-60">
                  Versichert weltweit versendet · Rückgabe innerhalb von 14 Tagen · Direkt aus dem Atelier.
                </p>
              </Reveal>
            </div>
          </div>
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

function ProductDetailsTable({ dbProduct }: { dbProduct: ReturnType<typeof useDbProductBySlug>["product"] }) {
  if (!dbProduct) return null;
  const dims = [
    dbProduct.length_cm && `L ${dbProduct.length_cm} cm`,
    dbProduct.width_cm && `B ${dbProduct.width_cm} cm`,
    dbProduct.height_cm && `H ${dbProduct.height_cm} cm`,
  ].filter(Boolean).join(" × ");
  const dna = (dbProduct.product_dna ?? {}) as { materials?: string[] };
  const parts = (dbProduct.material_composition ?? []) as unknown as MaterialPart[];
  const composition = materialLine(parts);
  const materials = composition || (Array.isArray(dna.materials) && dna.materials.length ? dna.materials.join(", ") : null);
  const weight = dbProduct.weight_grams ? `${dbProduct.weight_grams} g` : null;
  const care = ((dbProduct.care_symbols ?? []) as string[]).map(careLabel).join(" · ");
  const careText = [care || null, dbProduct.care_instructions ?? null].filter(Boolean).join("\n");
  const measurements = (dbProduct.measurements ?? { rows: [], values: {} }) as unknown as Measurements;
  const sizes = ((dbProduct.size_variants ?? []) as unknown as SizeVariant[]).filter((s) => s?.size?.trim());
  const showTable = measurements.rows.length > 0 && sizes.length > 0;

  const rows: [string, string | null][] = [
    ["Maße", dims || null],
    ["Gewicht", weight],
    ["Material", materials],
    ["Futter & Details", dbProduct.lining_hardware ?? null],
    ["Pflege", careText || null],
    ["Gefertigt in", dbProduct.made_in ?? null],
    ["Edition", dbProduct.edition_info ?? null],
    ["Nachhaltigkeit", dbProduct.sustainability_note ?? null],
    ["Lieferzeit (Anfertigung)", dbProduct.inventory_mode === "made_to_order" && dbProduct.lead_time_days ? `ca. ${dbProduct.lead_time_days} Tage` : null],
  ];
  const filled = rows.filter(([, v]) => v && String(v).trim() !== "");
  if (filled.length === 0 && !showTable) return null;
  return (
    <div className="mt-10 border-t border-[rgba(0,0,0,.18)] pt-8">
      <p className="palace-eyebrow">Details</p>
      {filled.length > 0 && (
        <dl className="mt-4 divide-y divide-[rgba(0,0,0,.12)] border-y border-[rgba(0,0,0,.12)]">
          {filled.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[140px_1fr] items-baseline gap-4 py-3">
              <dt className="text-[0.62rem] uppercase tracking-[0.28em] text-[#7C7972]">{label}</dt>
              <dd className="text-[0.92rem] leading-relaxed text-[#000000]/85 whitespace-pre-line">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {showTable && (
        <div className="mt-8">
          <p className="palace-eyebrow">Maßtabelle (cm)</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[380px] text-[0.9rem]">
              <thead>
                <tr className="border-b border-[rgba(0,0,0,.3)] text-left">
                  <th className="py-2 pr-4 text-[0.62rem] uppercase tracking-[0.28em] text-[#7C7972]">Maß</th>
                  {sizes.map((s) => (
                    <th key={s.size} className="py-2 pr-4 text-[0.62rem] uppercase tracking-[0.28em] text-[#7C7972]">{s.size}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {measurements.rows.map((row) => (
                  <tr key={row} className="border-b border-[rgba(0,0,0,.12)]">
                    <td className="py-2 pr-4">{row}</td>
                    {sizes.map((s) => (
                      <td key={s.size} className="py-2 pr-4 tabular-nums">{measurements.values[row]?.[s.size] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;

