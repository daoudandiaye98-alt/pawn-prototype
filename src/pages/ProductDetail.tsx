import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { supabase } from "@/integrations/supabase/client";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { merkeAbflug, useAnkunft, werkSchluessel } from "@/hooks/useFlug";
import { Reveal } from "@/components/palace/Reveal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { ProductView } from "@/core";
import { usePersonalization, explainMatchWithBeleg } from "@/features/personalization";
import { usePageVisit } from "@/features/personalization/usePageVisit";
import { merkeAngesehen } from "@/features/personalization/sitzungsspur";
import { useConsent } from "@/lib/consent";
import { useSiteContent } from "@/lib/siteContent";

import { useCustomerEvents } from "@/features/events/useCustomerEvents";
import { useCart } from "@/store/cart";
import { useRoomShift } from "@/features/os/roomShift";
import { useDbProductBySlug } from "@/features/products/useDbProduct";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { createCustomRequestThread } from "@/features/messages/customRequest";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { formatPrice, formatCreditLine } from "@/lib/format";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrevNext } from "@/components/palace/PrevNext";
import { useProductPrevNext } from "@/features/navigation/usePrevNext";
import { DEFAULT_HOUSE_THEME, resolveTheme, themeCssVars, type HouseTheme } from "@/features/houseTheme/theme";
import { PawnBlinkButton } from "@/components/pawn/PawnBlinkButton";
import { BauerSpruch } from "@/components/pawn/BauerSpruch";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { ProductServiceSheet } from "@/components/palace/ProductServiceSheet";
import { ErrorBoundary } from "@/components/palace/ErrorBoundary";
import { ProductDetailsAccordion } from "@/components/palace/ProductDetailsAccordion";
import { ProductLightbox } from "@/components/palace/ProductLightbox";
import { JsonLd, SITE_URL } from "@/components/palace/JsonLd";

import { MediaImg } from "@/components/palace/MediaImg";
import { gefuellteFelder, type Welt as WeltName } from "@/lib/weltFelder";
import { ladeWerkzertifikat, zertifikatSinnvoll } from "@/features/share/werkzertifikat";
import { useMediaUrl } from "@/lib/media";
import {
  effectiveVatRate, vatNote, formatEuro,
  type SizeVariant,
} from "@/features/studio/productDetails";

type TFn = ReturnType<typeof useI18n>["t"];

// PART 51 Teil C — Budget-Vorstellung bei Anfragen ist eine Tap-Auswahl, kein Pflichtfeld-Freitext.
function budgetChips(t: TFn) {
  return [
    t("product.budget.upTo200"),
    t("product.budget.200to500"),
    t("product.budget.500to1000"),
    t("product.budget.1000plus"),
  ];
}

const ProductDetail = () => {
  const params = useParams<{ slug?: string; id?: string }>();
  const slug = params.slug ?? params.id ?? "asymmetric-coat";
  const { user } = useAuth();
  const { locale, t } = useI18n();

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
  const [reqName, setReqName] = useState("");
  const [reqBody, setReqBody] = useState("");
  const [reqBudget, setReqBudget] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  const personalization = usePersonalization();
  const matchExplanation = useMemo(
    () => explainMatchWithBeleg(product, personalization, personalization.designerDna),
    [product, personalization],
  );
  const { viewProduct, saveProduct } = useCustomerEvents();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");

  const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
  const [kaufleisteHeight, setKaufleisteHeight] = useState(72);
  const kaufleisteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = kaufleisteRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
      setKaufleisteHeight(height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
  // Teil S — für Gäste: eine flüchtige Spur im sessionStorage, damit
  // "Deine Boutique" auch ohne Konto etwas Belegtes zeigen kann. Sie stirbt mit
  // dem Fenster und braucht die erteilte Einwilligung. Eingeloggte brauchen sie
  // nicht — die haben ihr Geschmacksprofil.
  const { allowsPersistence } = useConsent();
  useEffect(() => {
    if (user || !dbProduct?.slug) return;
    merkeAngesehen(allowsPersistence, {
      slug: dbProduct.slug,
      welt: dbProduct.world ?? null,
      haus: dbProduct.designers?.slug ?? null,
    });
  }, [user, allowsPersistence, dbProduct?.slug, dbProduct?.world, dbProduct?.designers?.slug]);

  useEffect(() => {
    setSize(product.sizes[0]);
    setColor(product.colors[0]);
  }, [product.id, product.sizes, product.colors]);

  const wished = dbProduct ? wishlist.has(dbProduct.id) : false;
  const isMto = dbProduct?.inventory_mode === "made_to_order";
  const stock = dbProduct?.inventory_mode === "stock" ? dbProduct.stock_quantity : null;
  const soldOut = stock === 0;
  const lowStock = stock !== null && stock > 0 && stock < 5;
  // PART 45/51 Teil C — der Kaufknopf bleibt ruhig, solange das Haus kein Geld empfangen kann.
  // `kauf_freigeschaltet` ist dieselbe Wahrheit wie `verkaufsbereit`, plus die Admin-Haus-Ausnahme
  // (Haus Nr. 1 verkauft direkt an PAWN, auch ohne eigenes Stripe-Connect-Konto).
  const hausKannVerkaufen = dbProduct?.designers?.kauf_freigeschaltet !== false;
  // Kunst-Angebotstypen: Auftragsarbeit/Live-Porträt haben nie einen Warenkorb — "Anfragen" ist
  // dort der einzige Weg, unabhängig vom Checkout-Status des Hauses.
  const kunstKind = (dbProduct?.product_dna as { kind?: string } | null)?.kind;
  const noCartKind = kunstKind === "auftragsarbeit" || kunstKind === "live_portrait";
  const canBuy = hausKannVerkaufen && !noCartKind;
  // Solange kein Kauf möglich ist (Übergangslösung ohne Connect, oder Werkart ohne Warenkorb),
  // wird "Anfragen" zum einzigen — und damit stets verfügbaren — Kaufweg.
  const canRequest = !!dbProduct?.allow_custom_requests || !canBuy;

  function addToBag() {
    if (soldOut) { toast.error(t("product.toast.soldOut")); return; }
    cart.add(product, size);
    push(`${product.name} betritt das Brett.`);
    toast.success(t("product.toast.addedToBag"));
  }

  const [buyBusy, setBuyBusy] = useState(false);
  async function buyNow() {
    if (soldOut && !isMto) { toast.error(t("product.toast.soldOut")); return; }
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
        const msg = (data as { message?: string })?.message ?? t("product.toast.paymentUnavailable");
        toast.message(msg);
        return;
      }
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error)?.message ?? t("product.toast.checkoutError"));
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
    if (!user) { toast.error(t("product.toast.pleaseSignIn")); return; }
    if (!dbProduct?.designers?.id) { toast.error(t("product.toast.designerUnavailable")); return; }
    if (reqBody.trim().length < 10) { toast.error(t("product.toast.requestTooShort")); return; }
    setReqBusy(true);
    try {
      await createCustomRequestThread({
        userId: user.id,
        designerId: dbProduct.designers.id,
        productId: dbProduct.id,
        productName: dbProduct.name,
        body: reqBody.trim(),
        budget: reqBudget || undefined,
        name: reqName.trim() || undefined,
      });
      toast.success(t("product.toast.requestSent"));
      track("anfrage_gesendet");
      setReqOpen(false); setReqName(""); setReqBody(""); setReqBudget("");
    } catch (e) {
      toast.error((e as Error)?.message ?? t("product.toast.sendError"));
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
  const creditLine = useMemo(() => {
    if (!dbProduct?.designers) return null;
    const dna = (dbProduct.product_dna ?? {}) as { materials?: string[] };
    const material = Array.isArray(dna.materials) ? dna.materials[0] : null;
    return formatCreditLine({
      houseNumber: dbProduct.designers.house_number,
      brandName: dbProduct.designers.brand_name,
      third: material || dbProduct.designers.location,
    });
  }, [dbProduct]);
  const gallery = useMemo(() => {
    const dna = (dbProduct?.product_dna ?? {}) as { images?: unknown };
    const list = Array.isArray(dna.images) ? (dna.images as unknown[]) : [];
    return list.filter((u): u is string => typeof u === "string" && u.trim() !== "" && u !== heroImage).slice(0, 3);
  }, [dbProduct, heroImage]);

  // Teil J1 — alle Werkbilder (Hauptfoto + Galerie) in Anzeigereihenfolge, für die Lightbox.
  const allImages = useMemo(
    () => [heroImage, ...gallery].filter((u): u is string => !!u),
    [heroImage, gallery],
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /* Teil S — das Werk kommt aus seiner Kachel angeflogen. Mobil- und
     Desktop-Fassung stehen beide im Baum; nur die sichtbare fängt den Flug. */
  const heldMobil = useRef<HTMLDivElement>(null);
  const heldDesktop = useRef<HTMLDivElement>(null);
  const flugSchluessel = dbProduct?.slug ? werkSchluessel(dbProduct.slug) : null;
  useAnkunft(flugSchluessel, heldMobil);
  useAnkunft(flugSchluessel, heldDesktop);
  const lichttischSchluessel = dbProduct?.slug ? `lichttisch:${dbProduct.slug}` : null;
  /* Ein Original im Sinne von Teil S6: Welt Kunst UND als Unikat angelegt
     (`product_dna.typ === "original"`, siehe src/lib/weltFelder.ts). Eine
     Auflage von 25 ist kein Original — dort stimmt der Satz nicht. */
  /* Teil S5 — das alte Bild bleibt 260 ms liegen und zieht hinaus, während
     das neue von unten hereinkommt. Zwei Bilder für einen Moment, danach eins. */
  const [vorigesBild, setVorigesBild] = useState<string | null>(null);
  const letztesBild = useRef<string | null>(null);
  useEffect(() => {
    if (letztesBild.current && heroImage && letztesBild.current !== heroImage) {
      setVorigesBild(letztesBild.current);
      const weg = setTimeout(() => setVorigesBild(null), 300);
      letztesBild.current = heroImage;
      return () => clearTimeout(weg);
    }
    letztesBild.current = heroImage ?? null;
  }, [heroImage]);

  const istKunstOriginal = dbProduct?.world === "Kunst"
    && (dbProduct?.product_dna as { typ?: string } | null)?.typ === "original";

  /* Teil S3 — der Rückweg. Beim Zurückgehen (Browser-Pfeil oder Wischgeste)
     hält die Werkseite ihr Kopfbild durchgehend abflugbereit; die Kachel in
     der Halle fängt es wieder auf. Beim Rollen wird die Messung nachgeführt,
     höchstens einmal je Bild. Es fliegt die Fassung, die gerade sichtbar ist. */
  useEffect(() => {
    if (!flugSchluessel || lightboxIndex !== null) return;
    let angemeldet = 0;
    const bereit = () => {
      angemeldet = 0;
      const held = [heldMobil.current, heldDesktop.current]
        .find((el) => el && el.getBoundingClientRect().width >= 1) ?? null;
      merkeAbflug(flugSchluessel, held, true);
    };
    const spaeter = () => { if (!angemeldet) angemeldet = requestAnimationFrame(bereit); };
    bereit();
    window.addEventListener("scroll", spaeter, { passive: true });
    window.addEventListener("resize", spaeter);
    return () => {
      if (angemeldet) cancelAnimationFrame(angemeldet);
      window.removeEventListener("scroll", spaeter);
      window.removeEventListener("resize", spaeter);
    };
  }, [flugSchluessel, lightboxIndex]);
  /* Teil S4 — von hier wächst das Werk weiter auf den Lichttisch. */
  const oeffneLichttisch = (von: HTMLElement | null, index = 0) => {
    if (lichttischSchluessel && index === 0) merkeAbflug(lichttischSchluessel, von);
    setLightboxIndex(index);
  };
  // Für das Werkzertifikat: eine frisch signierte Adresse des Titelbilds.
  const zertifikatBild = useMediaUrl(heroImage ?? null);

  // Teil L2 — Barrierefreiheit: beschreibender Alt-Text aus Titel + Technik + Haus,
  // statt nur des Produktnamens.
  const imageAlt = useMemo(() => {
    const dna = (dbProduct?.product_dna ?? {}) as { technik?: string; medium?: string };
    return [product.name, dna.technik || dna.medium, product.designer].filter(Boolean).join(" — ");
  }, [product.name, product.designer, dbProduct]);

  // Teil L3 (L6) — "Mehr aus diesem Haus": maximal 3 weitere Werke desselben Hauses,
  // bewusst NUR aus diesem Haus — keine hausübergreifenden Automatismen.
  const [moreFromHouse, setMoreFromHouse] = useState<Array<{ id: string; slug: string; name: string; price: number; image_url: string | null }>>([]);
  useEffect(() => {
    let cancelled = false;
    const designerId = dbProduct?.designers?.id;
    if (!designerId || !dbProduct?.id) { setMoreFromHouse([]); return; }
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, price, image_url")
        .eq("designer_id", designerId)
        .eq("status", "published")
        .neq("id", dbProduct.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!cancelled) setMoreFromHouse((data as typeof moreFromHouse) ?? []);
    })();
    return () => { cancelled = true; };
  }, [dbProduct?.id, dbProduct?.designers?.id]);

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
          <p className="palace-eyebrow">{t("product.notFound.eyebrow")}</p>
          <h1 className="palace-serif mt-6 text-[2.4rem] font-light leading-tight text-[#000000]">
            {t("product.notFound.title")}
          </h1>
          <p className="mt-6 font-serif italic text-[1.05rem] text-[#000000]/70">
            {t("product.notFound.sub")}
          </p>
          <Button asChild variant="editorial" size="chip" className="mt-10">
            <Link to="/shop">{t("product.notFound.cta")}</Link>
          </Button>
        </section>
      </PalaceLayout>
    );
  }

  // Teil 36 — geteilte Bausteine: identischer Inhalt/identische Logik in der mobilen
  // Kaufleiste und im Desktop-Kaufblock (bzw. in der Gesetzten Strecke und der
  // Desktop-Textspalte) — nur die umgebende Anordnung unterscheidet sich je Breite.
  const priceAndSplit = (
    <div className="flex flex-col">
      <p className="house-serif house-ink text-[1.2rem] tabular-nums">
        {formatPrice(dbProduct?.price ?? product.price, locale)}
      </p>
      {product.designer && (
        <p className="house-ink text-[0.58rem] uppercase tracking-[0.14em] opacity-50">
          {t("product.split", { name: product.designer })}
        </p>
      )}
    </div>
  );

  const badges = (
    <>
      {dbProduct?.compare_at_price && dbProduct.compare_at_price > (dbProduct?.price ?? 0) && (
        <span className="house-ink palace-eyebrow opacity-60 line-through">{formatPrice(Number(dbProduct.compare_at_price), locale)}</span>
      )}
      {noCartKind && (
        <span className="house-hair house-ink border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]">
          {kunstKind === "live_portrait" ? t("studio.stueckNeu.kunstArt.live_portrait") : t("studio.stueckNeu.kunstArt.auftragsarbeit")}
        </span>
      )}
      {isMto && !noCartKind && (
        <span className="house-hair house-ink border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]">
          {t("product.badge.mto")}{dbProduct?.lead_time_days ? ` · ${t("product.badge.mtoLeadTime", { days: dbProduct.lead_time_days })}` : ""}
        </span>
      )}
      {!isMto && soldOut && (
        <span className="border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]" style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}>{t("product.badge.soldOut")}</span>
      )}
      {!isMto && lowStock && (
        <span className="house-hair house-ink border px-2 py-1 text-[0.56rem] uppercase tracking-[0.28em]">{t("product.badge.lowStock", { n: stock })}</span>
      )}
    </>
  );

  const actionButtons = (
    <>
      {!canBuy ? (
        <Button
          type="button"
          variant="editorial"
          size="chip"
          onClick={() => setReqOpen(true)}
          style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}
        >
          {t("product.action.request")}
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="editorial"
            size="chip"
            onClick={buyNow}
            loading={buyBusy}
            disabled={soldOut && !isMto}
            style={{ borderColor: "var(--house-fg)", background: "var(--house-fg)", color: "var(--house-bg)" }}
          >
            {soldOut && !isMto ? t("product.action.soldOut") : t("product.action.buyNow")}
          </Button>
          <Button
            type="button"
            variant="editorial"
            size="chip"
            onClick={addToBag}
            disabled={soldOut && !isMto}
            className="house-ink house-hair"
            style={{ background: "var(--house-bg)" }}
          >
            {soldOut && !isMto ? t("product.action.soldOut") : isMto ? t("product.action.orderMade") : t("product.action.addToBag")}
          </Button>
        </>
      )}
      <Button
        type="button"
        variant="editorial"
        size="chip"
        onClick={onSave}
        aria-label={t("product.action.saveAria")}
        className="house-hair"
        style={(saved || wished) ? { background: "var(--house-fg)", color: "var(--house-bg)" } : { background: "var(--house-bg)", color: "var(--house-fg)" }}
      >
        <Heart className={cn("h-3 w-3", (saved || wished) && "fill-current")} strokeWidth={1.4} />
      </Button>
      {/* Teil S4 — auf dem Lichttisch ist nur das Werk. Der Bauer tritt ab. */}
      {lightboxIndex === null && (
        <div className="relative shrink-0">
          {/* Teil S6 — zwei Sätze, je höchstens einmal pro Sitzung. Sie kommen
              nacheinander, damit nie zwei Blasen gleichzeitig stehen. */}
          <BauerSpruch schluessel="werkseite" text={t("spruch.werkseite")} verzoegerungMs={1200}
            className="absolute bottom-full right-0 mb-3" />
          <BauerSpruch schluessel="original" text={t("spruch.original")} verzoegerungMs={6200}
            wenn={istKunstOriginal} className="absolute bottom-full right-0 mb-3" />
          <PawnBlinkButton onClick={() => setServiceSheetOpen((v) => !v)} ariaLabel={t("product.pawnButtonAria")} />
        </div>
      )}
    </>
  );

  const variantPickers = (product.colors.length > 1 || product.sizes.length > 1) && (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      {product.colors.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="house-ink palace-eyebrow opacity-60">{t("product.variant.colorLabel")}</span>
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
          <span className="house-ink palace-eyebrow opacity-60">{t(`product.variant.publicLabel.${product.world}`)}</span>
          {product.sizes.map((s) => {
            const variant = sizeVariants.find((v) => v.size === s);
            const outOfStock = !!variant && !isMto && Number(variant.stock) <= 0;
            return (
              <button
                key={s}
                onClick={() => !outOfStock && setSize(s)}
                disabled={outOfStock}
                title={outOfStock ? t(`product.variant.soldOut.${product.world}`) : undefined}
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
  );

  const vatNoteLine = (
    <p className="house-ink text-[0.6rem] uppercase tracking-[0.22em] opacity-50">
      {vatNote(effectiveVatRate(dbProduct?.vat_rate as number | null, (dbProduct?.designers as { vat_rate?: number } | null)?.vat_rate ?? 19), locale)} · {t("product.vat.paymentMethods")}
    </p>
  );

  const storyAndFacts = (
    <>
      {(dbProduct?.description || product.description) && (
        <Reveal>
          <p className="house-ink text-[1.02rem] leading-relaxed opacity-80">
            {dbProduct?.description || product.description}
          </p>
        </Reveal>
      )}

      {dbProduct?.designer_note?.trim() && (
        <Reveal className="house-hair mt-12 border-t pt-10">
          <p className="house-ink palace-eyebrow">{t("product.story.title")}</p>
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

      {/* Personalisierung nur mit Beleg (Teil 35): erscheint nur eingeloggt + mit echtem
          Engagement-Beleg — sonst nichts, kein Platzhalter, keine generische Zeile. */}
      {user && matchExplanation && (
        <Reveal className="mt-10 flex gap-4 border-[1.5px] border-black p-6" style={{ boxShadow: "8px 8px 0 0 #000" }}>
          <PawnFigurSvg className="h-[45px] w-[34px] shrink-0" aria-hidden="true" />
          <div>
            <p className="font-serif italic text-[1.05rem] leading-snug text-black">{matchExplanation.these}</p>
            <p className="mt-3 border-t border-black/10 pt-3 text-[0.8rem] text-black/70">
              <b className="font-medium text-black">{t("product.persona.beleg")}</b> {matchExplanation.beleg}
            </p>
          </div>
        </Reveal>
      )}

      <Reveal className="mt-4">
        <ErrorBoundary label={t("product.detailsUnavailable")}>
          <ProductDetailsAccordion dbProduct={dbProduct} onPickSize={(s) => setSize(s)} />
        </ErrorBoundary>
      </Reveal>

      {/* Welten-Gleichstand: die Angaben dieser Welt. Was leer ist, steht hier
          gar nicht — kein Strich, kein „k. A.", keine erfundene Zeile. */}
      {(() => {
        const angaben = gefuellteFelder(
          (product.world ?? "Mode") as WeltName,
          (dbProduct?.product_dna ?? null) as Record<string, unknown> | null,
        );
        if (angaben.length === 0) return null;
        return (
          <Reveal className="house-hair mt-10 border-t pt-6">
            <p className="house-ink palace-eyebrow opacity-60">{t("product.angaben.title")}</p>
            <dl className="mt-4 grid gap-x-10 gap-y-2 sm:grid-cols-2">
              {angaben.map(({ feld, wert }) => (
                <div key={feld.schluessel} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-current/10 py-1.5">
                  <dt className="house-ink text-[0.62rem] uppercase tracking-[0.18em] opacity-60">{feld.label}</dt>
                  <dd className="house-ink text-sm">{wert}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        );
      })()}

      {/* Das Werkzertifikat ergibt nur bei Kunst und Interior Sinn — ein Kleid
          braucht keins, ein Unikat schon. Wird im Browser gebaut, ohne Deploy. */}
      {zertifikatSinnvoll((product.world ?? "Mode") as WeltName) && dbProduct?.designers && (
        <Reveal className="mt-6">
          <button type="button"
            onClick={() => void ladeWerkzertifikat({
              welt: (product.world ?? "Kunst") as WeltName,
              werk: product.name,
              haus: dbProduct.designers!.brand_name,
              hausOrt: dbProduct.designers!.location ?? null,
              hausNummer: (dbProduct.designers as { house_number?: number }).house_number ?? null,
              dna: (dbProduct.product_dna ?? null) as Record<string, unknown> | null,
              bildUrl: zertifikatBild,
              datum: new Date(),
            })}
            className="house-ink text-[0.6rem] uppercase tracking-[0.24em] underline underline-offset-4 hover:opacity-70">
            {t("product.zertifikat.link")}
          </button>
        </Reveal>
      )}

      {/* Werkstatt-Zeile (Teil 35): echte Haus-Daten, "Zum Haus" führt zur Hausseite. */}
      {dbProduct?.designers && (
        <Reveal className="house-hair mt-10 flex flex-wrap items-baseline justify-between gap-4 border-t pt-6">
          <div>
            <h3 className="house-serif house-ink text-[1.3rem] font-light">{dbProduct.designers.brand_name}</h3>
            <p className="house-ink mt-1 text-[0.62rem] uppercase tracking-[0.18em] opacity-60">
              {[dbProduct.designers.location, product.world, ausgabeNummer != null ? t("product.werkstatt.since", { n: ausgabeNummer }) : null]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          <Link to={`/designer/${dbProduct.designers.slug}`} className="house-ink text-[0.6rem] uppercase tracking-[0.24em] underline underline-offset-4 hover:opacity-70">
            {t("product.werkstatt.link")}
          </Link>
        </Reveal>
      )}
    </>
  );

  const askLinks = (
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
        {t("product.ask.askPawn")}
      </button>
      {canRequest && canBuy && (
        <button
          type="button"
          onClick={() => setReqOpen(true)}
          className="house-ink inline-flex text-[0.62rem] uppercase tracking-[0.32em] underline underline-offset-4 hover:opacity-70"
        >
          {t("product.ask.customRequest")}
        </button>
      )}
    </Reveal>
  );

  const galleryBlock = gallery.length > 0 && (
    <section className="px-6 py-16 md:px-14 md:py-24">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 md:grid-cols-12">
        {gallery.map((url, i) => (
          <Reveal
            key={url}
            delay={i * 80}
            className={i === 0 ? "md:col-span-7" : i === 1 ? "md:col-span-5" : "md:col-span-12"}
          >
            <button
              type="button"
              onClick={() => oeffneLichttisch(null, Math.max(0, allImages.indexOf(url)))}
              aria-label={t("product.gallery.moreView", { name: product.name })}
              className="block w-full text-left"
            >
              <EditorialImage
                src={url}
                seed={`prd-${product.slug}-gal-${i}`}
                ratio={i === 2 ? "16/9" : "4/5"}
                className="w-full [&_.palace-image-inner]:transition-transform [&_.palace-image-inner]:duration-[900ms] [&_.palace-image-inner]:ease-[cubic-bezier(.76,0,.18,1)] [&:hover_.palace-image-inner]:scale-[1.03]"
                alt={imageAlt}
                color
              />
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );

  // Teil L3 — Product-Schema (schema.org): brand = Haus; bei Kunst zusätzlich Urheber-Angabe.
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: `${SITE_URL}/product/${product.slug}`,
    ...(allImages.length ? { image: allImages } : {}),
    ...(dbProduct?.description ? { description: dbProduct.description } : {}),
    ...(product.designer ? { brand: { "@type": "Brand", name: product.designer } } : {}),
    ...(product.world === "Kunst" && product.designer
      ? { creator: { "@type": "Person", name: product.designer } }
      : {}),
    offers: {
      "@type": "Offer",
      price: Number(dbProduct?.price ?? product.price),
      priceCurrency: "EUR",
      availability: soldOut && !isMto
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      url: `${SITE_URL}/product/${product.slug}`,
    },
  };

  // Teil L3 (L6) — kleine kuratierte Reihe: bis zu 3 weitere Werke DESSELBEN Hauses.
  const moreFromHouseBlock = moreFromHouse.length > 0 && (
    <section className="house-hair border-t px-6 py-16 md:px-14 md:py-24">
      <div className="mx-auto max-w-[1600px]">
        <p className="house-ink palace-eyebrow">{t("product.moreFromHouse.title")}</p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {moreFromHouse.map((p, i) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="group block">
              <EditorialImage
                src={p.image_url}
                seed={`more-${p.slug}`}
                ratio="4/5"
                alt={`${p.name} — ${product.designer}`}
                color
                className="[&_.palace-image-inner]:transition-transform [&_.palace-image-inner]:duration-[900ms] [&:hover_.palace-image-inner]:scale-[1.03]"
              />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <p className="house-serif house-ink italic text-[1.05rem] leading-tight">{p.name}</p>
                <p className="house-ink palace-eyebrow tabular-nums">{formatPrice(Number(p.price), locale)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );

  const bannerBlock = banner && (
    <section className="house-hair border-t px-6 py-16 md:px-14 md:py-24">
      <Reveal className="mx-auto max-w-[1600px]">
        <p className="house-accent palace-eyebrow">{t("product.banner.fromHouse")}</p>
        {banner.kind === "video"
          ? <video src={banner.url} className="house-media mt-6 aspect-[16/9] w-full max-w-2xl object-cover" muted autoPlay loop playsInline />
          : <MediaImg src={banner.url} alt="" className="house-media mt-6 aspect-[16/9] w-full max-w-2xl object-cover" loading="lazy" />}
      </Reveal>
    </section>
  );

  return (
    <PalaceLayout transparentHeader={false}>
      <div className="palace house-theme" data-typografie={themeForPage.typografie} data-textur={themeForPage.hintergrundtextur.typ} style={themeCssVars(themeForPage)}>

      {/* ===== MOBIL/TABLET (<1024px): Cover als bildschirmfüllender Held (Teil 27b) ===== */}
      <section className="relative pt-20 md:pt-24 lg:hidden">
        <Reveal>
          <div ref={heldMobil} className="relative h-[70svh] min-h-[420px] w-full overflow-hidden bg-black md:h-[84svh]">
            {vorigesBild && (
              <MediaImg src={vorigesBild} alt="" aria-hidden className="werk-raus absolute inset-0 z-[1] h-full w-full object-cover object-center" />
            )}
            {heroImage ? (
              <button
                type="button"
                onClick={() => oeffneLichttisch(heldMobil.current)}
                aria-label={t("product.lightbox.openAria")}
                className="group/held absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
              >
                {/* Teil Q — formatfüllend statt eingepasst. Vorher stand hier ab md
                    `object-contain` auf schwarzem Grund: ein quadratisches Werkfoto in
                    diesem hohen Rahmen bekam dadurch schwarze Balken über und unter dem
                    Bild. Das vollständige Bild zeigt die Lightbox (ein Tipp darauf). */}
                <MediaImg key={heroImage} src={heroImage} alt={imageAlt} className="werk-rein h-full w-full object-cover object-center" />
              </button>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <span className="palace-eyebrow text-white/50">{t("product.gallery.noImage")}</span>
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
              {creditLine && (
                <p className="mt-3 text-[0.56rem] uppercase tracking-[0.24em] text-white/60">{creditLine}</p>
              )}
            </div>
          </div>
        </Reveal>
        <div className="pointer-events-none absolute right-4 top-24 z-30 md:right-8 md:top-28">
          <div className="pointer-events-auto">
            <PrevNextForProduct slug={product.slug} />
          </div>
        </div>
      </section>

      {/* ===== DESKTOP (≥1024px): Doppelseite — sticky Bildspalte + Textspalte (Teil 36) ===== */}
      <section className="hidden lg:flex lg:items-start">
        <div ref={heldDesktop} className="sticky top-0 flex h-screen w-[56%] shrink-0 items-center justify-center overflow-hidden bg-black">
          {vorigesBild && (
            <MediaImg src={vorigesBild} alt="" aria-hidden className="werk-raus absolute inset-0 z-[1] h-full w-full object-cover object-center" />
          )}
          {heroImage ? (
            <button
              type="button"
              onClick={() => oeffneLichttisch(heldDesktop.current)}
              aria-label={t("product.lightbox.openAria")}
              className="group/held flex h-full w-full cursor-zoom-in items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
            >
              {/* Teil Q — dieselbe Korrektur auf der Doppelseite: festes 4:5, füllend
                  und mittig beschnitten. Vollständig sehen: Lightbox. */}
              <MediaImg
                key={heroImage}
                src={heroImage}
                alt={imageAlt}
                className="werk-rein h-full w-full object-cover object-center"
              />
              {/* Erscheint beim Darüberfahren — auf Touch gibt es kein Hover,
                  dort führt der Tipp aufs Bild direkt zum Lichttisch. */}
              <span className="pointer-events-none absolute bottom-6 right-6 border-[1.5px] border-white/70 px-3 py-1.5 text-[0.56rem] uppercase tracking-[0.28em] text-white opacity-0 transition-opacity duration-200 group-hover/held:opacity-100 group-focus-visible/held:opacity-100">
                {t("product.lichttisch.hinweis")}
              </span>
            </button>
          ) : (
            <span className="palace-eyebrow text-white/50">{t("product.gallery.noImage")}</span>
          )}
          {creditLine && (
            <p className="absolute bottom-6 left-8 z-[2] text-[0.56rem] uppercase tracking-[0.24em] text-white/60">{creditLine}</p>
          )}
          <div className="pointer-events-none absolute right-8 top-8 z-30">
            <div className="pointer-events-auto">
              <PrevNextForProduct slug={product.slug} />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-10 py-16 xl:px-16">
          <div className="max-w-[65ch]">
            <p className="palace-eyebrow house-ink opacity-60">{product.world}</p>
            <h1
              className="palace-serif house-ink mt-3 font-light"
              style={{ fontSize: "clamp(2.2rem, 3vw, 3.4rem)", lineHeight: 1.04, letterSpacing: "-0.01em" }}
            >
              {product.name}
            </h1>
            {product.designer && (
              <Link to={`/designer/${product.designerSlug}`} className="house-ink palace-eyebrow uline mt-4 inline-block">
                {product.designer}
              </Link>
            )}
          </div>

          {/* Kaufblock: sitzt oben in der Textspalte und bleibt sticky, während Geschichte/
              Fakten darunter durchscrollen — der Kauf hat Vorrang (Teil 35/36). */}
          <div
            className="sticky top-24 z-20 mt-8 max-w-[65ch] border-[1.5px] border-black p-6"
            style={{ background: "var(--house-bg)", boxShadow: "6px 6px 0 0 #000" }}
          >
            <div className="flex flex-wrap items-baseline gap-3">
              {priceAndSplit}
              {badges}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {actionButtons}
            </div>
            {variantPickers && <div className="mt-4">{variantPickers}</div>}
            <div className="mt-3">{vatNoteLine}</div>
            <ProductServiceSheet
              variant="panel"
              open={serviceSheetOpen}
              onClose={() => setServiceSheetOpen(false)}
              productSlug={product.slug}
              productName={product.name}
            />
          </div>

          <div key={product.slug} className="mt-16 max-w-[65ch]">
            {storyAndFacts}
            {askLinks}
            <WerkWegweiser slug={product.slug} />
          </div>
        </div>
      </section>

      {/* Platzhalter im Fluss, damit der Inhalt nicht hinter der fixierten Kaufleiste verschwindet */}
      <div aria-hidden className="lg:hidden" style={{ height: kaufleisteHeight }} />

      {/* ===== MOBIL/TABLET (<1024px): Kaufleiste — fixiert am unteren Viewport-Rand, einziges
          PAWN-Element unten auf Kaufseiten (Teil 35) ===== */}
      <section
        ref={kaufleisteRef}
        className="house-hair fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
        style={{ background: "var(--house-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-[1600px] px-6 py-5 md:px-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-baseline gap-3">
              <Link to={`/designer/${product.designerSlug}`} className="house-ink palace-eyebrow uline">
                {product.designer}
              </Link>
              <span className="house-ink opacity-30">·</span>
              {priceAndSplit}
              {badges}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {actionButtons}
            </div>
          </div>

          {variantPickers && <div className="house-hair mt-4 border-t pt-4">{variantPickers}</div>}

          <div className="mt-3">{vatNoteLine}</div>
        </div>
      </section>

      <div className="lg:hidden">
        <ProductServiceSheet
          variant="sheet"
          open={serviceSheetOpen}
          onClose={() => setServiceSheetOpen(false)}
          bottomOffset={kaufleisteHeight}
          productSlug={product.slug}
          productName={product.name}
        />
      </div>

      {/* GALERIE: unter der Doppelseite in voller Breite, große ungleiche Flächen (Teil 36) */}
      {galleryBlock}

      {moreFromHouseBlock}

      {bannerBlock}

      <JsonLd data={productLd} />

      {/* GESETZTE STRECKE (mobil/tablet): auf Desktop lebt derselbe Inhalt in der Textspalte oben */}
      <section className="house-hair border-t px-6 py-16 md:px-14 md:py-24 lg:hidden">
        <div className="mx-auto max-w-[760px]">
          {storyAndFacts}
          {askLinks}
        </div>
      </section>

      <div className="h-32" />

      {reqOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6" onClick={() => setReqOpen(false)}>
          <div className="house-hair w-full max-w-lg border p-8" style={{ background: "var(--house-bg)" }} onClick={(e) => e.stopPropagation()}>
            <p className="house-ink palace-eyebrow">{t("product.requestModal.title")}</p>
            <h3 className="house-serif house-ink mt-3 text-[1.8rem] font-light leading-tight">{dbProduct?.name}</h3>
            <p className="house-ink mt-3 text-[0.9rem] opacity-60">
              {t("product.requestModal.body")}
            </p>
            <label className="mt-6 block">
              <span className="house-ink palace-eyebrow">{t("product.requestModal.nameLabel")}</span>
              <input value={reqName} onChange={(e) => setReqName(e.target.value)} className="house-hair house-ink mt-2 w-full border bg-transparent p-3 text-[0.95rem] focus:outline-none" />
            </label>
            <label className="mt-4 block">
              <span className="house-ink palace-eyebrow">{t("product.requestModal.wishLabel")}</span>
              <textarea value={reqBody} onChange={(e) => setReqBody(e.target.value)} rows={5} className="house-hair house-ink mt-2 w-full border bg-transparent p-3 text-[0.95rem] focus:outline-none" />
            </label>
            <div className="mt-4">
              <span className="house-ink palace-eyebrow">{t("product.requestModal.budgetLabel")}</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {budgetChips(t).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setReqBudget((v) => (v === chip ? "" : chip))}
                    className="house-hair house-ink min-h-[36px] border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em]"
                    style={reqBudget === chip ? { background: "var(--house-fg)", color: "var(--house-bg)" } : undefined}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="editorial" size="chip" onClick={() => setReqOpen(false)} className="house-hair house-ink" style={{ background: "var(--house-bg)" }}>{t("product.requestModal.cancel")}</Button>
              <Button type="button" variant="editorial" size="chip" onClick={submitRequest} loading={reqBusy} style={{ background: "var(--house-fg)", color: "var(--house-bg)" }}>
                {t("product.requestModal.send")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ProductLightbox
        images={allImages}
        alt={imageAlt}
        flugSchluessel={lichttischSchluessel}
        open={lightboxIndex !== null}
        initialIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
      </div>
    </PalaceLayout>
  );

};

function PrevNextForProduct({ slug }: { slug: string }) {
  const { prev, next } = useProductPrevNext(slug);
  if (!prev && !next) return null;
  return <PrevNext prev={prev} next={next} />;
}

/**
 * Teil S5 — zwei Wege unter der Textspalte, jeweils mit dem Titel darunter.
 * Es ist derselbe Weg wie zuvor (`/product/:slug`), also bleibt die Seite
 * stehen: React Router tauscht nur die Kennung, nichts wird neu aufgebaut.
 * Bewegen tut sich deshalb allein das Bild (siehe `werk-raus`/`werk-rein`).
 */
function WerkWegweiser({ slug }: { slug: string }) {
  const { t } = useI18n();
  const { prev, next } = useProductPrevNext(slug);
  if (!prev && !next) return null;
  return (
    <nav className="mt-16 grid gap-px border-t-[1.5px] border-black bg-[rgba(0,0,0,.18)] sm:grid-cols-2">
      {prev ? (
        <Link to={prev.to} className="group/weg block bg-white px-1 py-6 transition-colors hover:bg-black">
          <span className="palace-eyebrow block text-black/60 group-hover/weg:text-white/70">‹ {t("product.wegweiser.voriges")}</span>
          <span className="palace-serif mt-2 block text-[1.05rem] italic leading-tight text-black group-hover/weg:text-white">{prev.label}</span>
        </Link>
      ) : <span className="hidden bg-white sm:block" />}
      {next ? (
        <Link to={next.to} className="group/weg block bg-white px-1 py-6 text-right transition-colors hover:bg-black sm:text-right">
          <span className="palace-eyebrow block text-black/60 group-hover/weg:text-white/70">{t("product.wegweiser.naechstes")} ›</span>
          <span className="palace-serif mt-2 block text-[1.05rem] italic leading-tight text-black group-hover/weg:text-white">{next.label}</span>
        </Link>
      ) : <span className="hidden bg-white sm:block" />}
    </nav>
  );
}

export default ProductDetail;

