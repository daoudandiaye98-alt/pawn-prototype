/**
 * Teil 17a: Vom Foto zum kaufbaren Stück — ein einziger linearer Weg, keine Verzweigung.
 * Foto hoch → PAWN erkennt das Objekt → passende Inszenierungen → Varianten → eine übernehmen →
 * Stück ist live. Jede Variante lässt sich mit einem Griff übernehmen, kein Umweg über
 * Mediathek oder Download.
 *
 * Mit ?product=<id> wird ein bestehendes Stück ohne Bild (aus StudioProducts.tsx) direkt in
 * die Inszenierung geführt, statt nur gewarnt zu werden — dieselbe Seite, nur ohne das
 * Minimal-Formular, weil Name/Preis/Welt schon existieren.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlanQuota, type Plan } from "@/features/campaign/quota";
import { ladePlanGate, weltenErlaubt, naechsterPlanFuerMehrWelten } from "@/lib/planGate";
import { Upload, ArrowRight } from "lucide-react";
import { CoverMoment } from "@/features/studio/CoverMoment";
import { useI18n } from "@/lib/i18n";

type World = "Mode" | "Interior" | "Kunst";
const WORLD_LABEL_KEY: Record<World, string> = { Mode: "studio.stueckNeu.world.mode", Interior: "studio.stueckNeu.world.interior", Kunst: "studio.stueckNeu.world.kunst" };

// PART 51 Teil C — Kunst-Angebotstypen. `products` hat keine eigene Typ-Spalte, deshalb landet
// die Werkart in product_dna.kind (Konvention aus First Move/Rochade). Original ist immer ein
// Unikat (Bestand fest 1), Auftragsarbeit/Live-Porträt haben nie einen Warenkorb — "Anfragen"
// ist dort der einzige Weg (siehe ProductDetail.tsx).
type KunstKind = "original" | "print" | "auftragsarbeit" | "live_portrait";
const KUNST_KIND_ORDER: KunstKind[] = ["original", "print", "auftragsarbeit", "live_portrait"];
const KUNST_KIND_LABEL_KEY: Record<KunstKind, string> = {
  original: "studio.stueckNeu.kunstArt.original",
  print: "studio.stueckNeu.kunstArt.print",
  auftragsarbeit: "studio.stueckNeu.kunstArt.auftragsarbeit",
  live_portrait: "studio.stueckNeu.kunstArt.live_portrait",
};

interface StagingTemplate {
  id: string; label: string; description?: string; prompt: string;
  preview_url?: string; credits: number; active?: boolean; groessenbezug?: boolean;
}
interface StagingResult { template_id: string; label: string; result_url: string | null; error: string | null; media_asset_id: string | null }
const ART_LABEL_KEY: Record<string, string> = {
  kleidung: "studio.stueckNeu.art.kleidung", keramik: "studio.stueckNeu.art.keramik", malerei: "studio.stueckNeu.art.malerei", skulptur: "studio.stueckNeu.art.skulptur",
  moebel: "studio.stueckNeu.art.moebel", schmuck: "studio.stueckNeu.art.schmuck", textil: "studio.stueckNeu.art.textil", objekt: "studio.stueckNeu.art.objekt", sonstiges: "studio.stueckNeu.art.sonstiges",
};
const ART_ORDER = Object.keys(ART_LABEL_KEY);

interface LiveProduct { id: string; name: string; slug: string; price: number; image_url: string | null }

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function uploadPhoto(userId: string, file: File): Promise<string> {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${stamp}.${ext}`;
  const { error } = await supabase.storage.from("campaign-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage.from("campaign-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !data) throw signErr ?? new Error("sign_failed");
  return data.signedUrl;
}

export default function StudioStueckNeu() {
  const { t } = useI18n();
  const { user, hasRole } = useAuth();
  const { designer, loading } = useMyDesigner();
  const [searchParams] = useSearchParams();
  const existingProductId = searchParams.get("product");

  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = usePlanQuota(designer?.id, plan, hasRole("admin"));

  // Minimal-Formular — nur für ein frisches Stück ohne ?product=.
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [world, setWorld] = useState<World>("Mode");
  const [size, setSize] = useState("");
  const [story, setStory] = useState("");
  const [madeToOrder, setMadeToOrder] = useState(false);
  const [stock, setStock] = useState("1");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  // PART 51 Teil C — Kunst-Ontologie, nur relevant wenn world === "Kunst".
  const [kunstKind, setKunstKind] = useState<KunstKind>("original");
  const [technik, setTechnik] = useState("");
  const [medium, setMedium] = useState("");
  const [jahr, setJahr] = useState("");

  const [product, setProduct] = useState<LiveProduct | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!existingProductId);
  const [coverMoment, setCoverMoment] = useState<string | null>(null);

  // PART 48 AP4: "welten" ist eine Bestand-Grenze auf verschiedene Welten je Haus, nicht auf
  // Stückzahl — ein bisher ungenutztes Mode/Interior/Kunst braucht freies Kontingent.
  const [gateReady, setGateReady] = useState(false);
  const [existingWorlds, setExistingWorlds] = useState<World[]>([]);
  useEffect(() => { void ladePlanGate().then(() => setGateReady(true)); }, []);
  useEffect(() => {
    if (!designer) return;
    void supabase.from("products").select("world").eq("designer_id", designer.id)
      .then(({ data }) => setExistingWorlds(Array.from(new Set((data ?? []).map((r) => r.world as World)))));
  }, [designer]);
  const weltGesperrt = gateReady && !weltenErlaubt(plan, existingWorlds, world);
  const isKunst = world === "Kunst";
  const isUnikat = isKunst && kunstKind === "original";
  const isNoCheckoutKind = isKunst && (kunstKind === "auftragsarbeit" || kunstKind === "live_portrait");

  // Teil 27b: Der Cover-Moment — einmalig pro Stück, wenn es zum ersten Mal live geht.
  const maybeShowCover = async (productId: string, imageUrl: string | null) => {
    if (!imageUrl) return;
    const { data } = await supabase.from("products").select("cover_shown_at").eq("id", productId).maybeSingle();
    if (data && !(data as { cover_shown_at: string | null }).cover_shown_at) setCoverMoment(imageUrl);
  };
  const dismissCoverMoment = async (productId: string) => {
    await supabase.from("products").update({ cover_shown_at: new Date().toISOString() }).eq("id", productId);
    setCoverMoment(null);
  };

  // Inszenierung — identischer Ablauf wie im Kampagnen-Studio (Teil 16a).
  const [stagingTemplatesAll, setStagingTemplatesAll] = useState<Record<string, StagingTemplate[]>>({});
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);
  const [detectTried, setDetectTried] = useState(false);
  const [art, setArt] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState(false);
  const [fotoHinweis, setFotoHinweis] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stagingBusy, setStagingBusy] = useState(false);
  const [results, setResults] = useState<StagingResult[] | null>(null);

  useEffect(() => {
    void supabase.from("ai_config").select("value").eq("key", "staging_templates").maybeSingle()
      .then(({ data }) => setStagingTemplatesAll((data?.value as unknown as Record<string, StagingTemplate[]> | null) ?? {}));
  }, []);

  useEffect(() => {
    if (!existingProductId || !designer) { setLoadingExisting(false); return; }
    (async () => {
      const { data } = await supabase.from("products").select("id, name, slug, price, image_url")
        .eq("id", existingProductId).eq("designer_id", designer.id).maybeSingle();
      if (data) setProduct(data as LiveProduct);
      setLoadingExisting(false);
    })();
  }, [existingProductId, designer]);

  const templatesForArt = useMemo(
    () => (art ? (stagingTemplatesAll[art] ?? []).filter((tpl) => tpl.active !== false) : []),
    [art, stagingTemplatesAll],
  );



  useEffect(() => {
    if (!sourceUrl || detectTried || detectBusy || !designer) return;
    setDetectTried(true);
    setDetectBusy(true);
    void supabase.functions.invoke("detect-object", { body: { designer_id: designer.id, source_url: sourceUrl } })
      .then(({ data }) => {
        const r = data as { ok?: boolean; art?: string; ambiguous?: boolean; foto_hinweis?: string | null } | null;
        if (r?.ok && r.art) { setArt(r.art); setAmbiguous(r.ambiguous === true); setFotoHinweis(r.foto_hinweis ?? null); }
      })
      .catch(() => { /* fällt still auf die manuelle Art-Auswahl zurück */ })
      .finally(() => setDetectBusy(false));
  }, [sourceUrl, detectTried, detectBusy, designer]);

  useEffect(() => { if (art) setSelectedIds(templatesForArt.map((tpl) => tpl.id)); }, [art, templatesForArt]);

  const toggleTemplate = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const runStaging = async () => {
    if (!designer || !sourceUrl || !art || selectedIds.length === 0) return;
    setStagingBusy(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-staging-shot", {
        body: { designer_id: designer.id, product_id: product?.id ?? null, source_url: sourceUrl, art, template_ids: selectedIds },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; results?: StagingResult[]; message?: string; error?: string } | null;
      if (!r?.ok && !r?.results?.length) throw new Error(r?.message ?? r?.error ?? t("studio.stueckNeu.toast.stagingFailed"));
      setResults(r.results ?? []);
      void quota.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStagingBusy(false);
    }
  };

  const onPickPhoto = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error(t("studio.stueckNeu.toast.pickImage")); return; }
    setUploading(true);
    try {
      const url = await uploadPhoto(user.id, file);
      setSourceUrl(url);
      setDetectTried(false); setArt(null); setAmbiguous(false); setFotoHinweis(null); setSelectedIds([]); setResults(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop: React.DragEventHandler = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onPickPhoto(f); };

  const createProduct = async () => {
    if (!designer) return;
    if (!name.trim() || name.trim().length < 2) { toast.error(t("studio.stueckNeu.toast.nameRequired")); return; }
    const priceNum = Math.round(Number(price));
    if (!price || isNaN(priceNum) || priceNum <= 0) { toast.error(t("studio.stueckNeu.toast.priceRequired")); return; }
    if (!sourceUrl) { toast.error(t("studio.stueckNeu.toast.photoRequired")); return; }
    if (weltGesperrt) {
      const naechster = naechsterPlanFuerMehrWelten(plan);
      toast.error(naechster
        ? `Diese Welt ist im Plan ${plan === "haus" ? "Haus" : plan === "atelier" ? "Atelier" : "Maison"} noch nicht frei — wechsle in ${naechster === "maison" ? "Maison" : "Atelier"}, um in mehr als einer Welt zu führen.`
        : "Diese Welt ist für dein Haus noch nicht frei.");
      return;
    }
    // Original ist immer Unikat (Bestand fest 1); Auftragsarbeit/Live-Porträt haben nie Bestand,
    // weil sie nie über den Warenkorb laufen — beide Fälle brauchen keine Bestandsabfrage.
    const effectiveMadeToOrder = isNoCheckoutKind ? true : isUnikat ? false : madeToOrder;
    const effectiveStock = isUnikat ? 1 : isNoCheckoutKind ? 0 : Math.max(0, Math.floor(Number(stock) || 0));
    if (!isUnikat && !isNoCheckoutKind && !effectiveMadeToOrder && effectiveStock < 1) {
      toast.error(t("studio.stueckNeu.toast.stockRequired")); return;
    }
    setBusy(true);
    try {
      const description = [story.trim(), size.trim() ? `Größe: ${size.trim()}` : null].filter(Boolean).join("\n\n") || null;
      const slug = `${slugify(designer.brand_name)}-${slugify(name)}-${Date.now().toString(36)}`;
      const productDna = isKunst
        ? { kind: kunstKind, ...(technik.trim() ? { technik: technik.trim() } : {}), ...(medium.trim() ? { medium: medium.trim() } : {}), ...(jahr.trim() ? { jahr: jahr.trim() } : {}) }
        : null;
      const { data, error } = await supabase.from("products").insert({
        designer_id: designer.id, name: name.trim(), slug, price: priceNum, world, description,
        image_url: sourceUrl, status: "published",
        inventory_mode: effectiveMadeToOrder ? "made_to_order" : "stock",
        stock_quantity: effectiveStock,
        ...(productDna ? { product_dna: productDna } : {}),
      }).select("id, name, slug, price, image_url").single();
      if (error) throw error;
      setProduct(data as LiveProduct);
      toast.success(t("studio.stueckNeu.toast.productLive"));
      await maybeShowCover((data as LiveProduct).id, sourceUrl);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const adopt = async (result: StagingResult) => {
    if (!result.result_url || !product) return;
    try {
      const { error } = await supabase.from("products").update({ image_url: result.result_url, status: "published" }).eq("id", product.id);
      if (error) throw error;
      if (result.media_asset_id) {
        await supabase.from("media_assets" as never).update({
          usages: [{ type: "produkt", product_id: product.id }], product_id: product.id,
        } as never).eq("id", result.media_asset_id);
      }
      setProduct((p) => (p ? { ...p, image_url: result.result_url } : p));
      toast.success(t("studio.stueckNeu.toast.adopted"));
      await maybeShowCover(product.id, result.result_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || loadingExisting) return <StudioShell title={t("studio.stueckNeu.title")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.stueckNeu.title")}><p className="text-muted-foreground">{t("studio.stueckNeu.noAccess")}</p></StudioShell>;
  if (existingProductId && !product) return <StudioShell title={t("studio.stueckNeu.title")}><p className="text-muted-foreground">{t("studio.stueckNeu.productNotFound")}</p></StudioShell>;

  const photoUploader = (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="border border-dashed border-border p-8 text-center">
      {sourceUrl ? <img src={sourceUrl} alt="" className="mx-auto max-h-64 w-auto object-contain" /> : <Upload className="mx-auto h-6 w-6 text-muted-foreground" />}
      <p className="mt-3 text-sm">{sourceUrl ? t("studio.stueckNeu.photo.changePhoto") : t("studio.stueckNeu.photo.dropHint")}</p>
      <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
        {uploading ? t("studio.stueckNeu.photo.uploading") : t("studio.stueckNeu.photo.chooseFile")}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])} />
      </label>
    </div>
  );

  return (
    <StudioShell title={t("studio.stueckNeu.title")} eyebrow={t("studio.stueckNeu.eyebrow")}>
      <div className="mx-auto max-w-2xl">
        {!product ? (
          <>
            <p className="editorial-eyebrow">{t("studio.stueckNeu.section.photo")}</p>
            <div className="mt-2">{photoUploader}</div>

            <p className="editorial-eyebrow mt-8">{t("studio.stueckNeu.section.piece")}</p>
            <div className="mt-2 space-y-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("studio.stueckNeu.form.namePlaceholder")}
                className="w-full border border-border bg-white p-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="1" placeholder={t("studio.stueckNeu.form.pricePlaceholder")}
                    className="w-full border border-border bg-white p-3 text-sm" />
                  <p className="mt-1 text-[0.62rem] uppercase tracking-[0.14em] opacity-50">{t("studio.stueckNeu.form.priceHint")}</p>
                </div>
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder={t("studio.stueckNeu.form.sizePlaceholder")}
                  className="border border-border bg-white p-3 text-sm" />
              </div>
              <div className="flex gap-2">
                {(["Mode", "Interior", "Kunst"] as World[]).map((w) => {
                  const gesperrt = gateReady && !weltenErlaubt(plan, existingWorlds, w);
                  return (
                    <button key={w} type="button" onClick={() => setWorld(w)}
                      className={`flex-1 border p-2 text-sm ${world === w ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"} ${gesperrt ? "opacity-40" : ""}`}>
                      {t(WORLD_LABEL_KEY[w])}
                    </button>
                  );
                })}
              </div>
              {weltGesperrt && (
                <p className="text-xs text-muted-foreground">
                  Diese Welt ist in deinem Plan noch nicht frei — {naechsterPlanFuerMehrWelten(plan) === "maison" ? "Maison" : "Atelier"} erlaubt mehr Welten gleichzeitig.
                </p>
              )}
              <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder={t("studio.stueckNeu.form.storyPlaceholder")} rows={2}
                className="w-full border border-border bg-white p-3 text-sm" />
            </div>

            {isKunst && (
              <>
                <p className="editorial-eyebrow mt-8">{t("studio.stueckNeu.section.kunstArt")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {KUNST_KIND_ORDER.map((k) => (
                    <button key={k} type="button" onClick={() => setKunstKind(k)}
                      className={`min-h-[36px] flex-1 border px-3 py-2 text-sm ${kunstKind === k ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
                      {t(KUNST_KIND_LABEL_KEY[k])}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <input value={technik} onChange={(e) => setTechnik(e.target.value)} placeholder={t("studio.stueckNeu.form.technikPlaceholder")}
                    className="border border-border bg-white p-3 text-sm" />
                  <input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder={t("studio.stueckNeu.form.mediumPlaceholder")}
                    className="border border-border bg-white p-3 text-sm" />
                  <input value={jahr} onChange={(e) => setJahr(e.target.value)} placeholder={t("studio.stueckNeu.form.jahrPlaceholder")}
                    className="border border-border bg-white p-3 text-sm" />
                </div>
              </>
            )}

            <p className="editorial-eyebrow mt-8">{t("studio.stueckNeu.section.availability")}</p>
            <div className="mt-2 space-y-3">
              {isNoCheckoutKind ? (
                <p className="text-xs text-muted-foreground">{t("studio.stueckNeu.kunstArt.noCheckoutHint")}</p>
              ) : isUnikat ? (
                <p className="text-xs text-muted-foreground">{t("studio.stueckNeu.kunstArt.unikatHint")}</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMadeToOrder(false)}
                      className={`flex-1 border p-2 text-sm ${!madeToOrder ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
                      {t("studio.stueckNeu.availability.inStock")}
                    </button>
                    <button type="button" onClick={() => setMadeToOrder(true)}
                      className={`flex-1 border p-2 text-sm ${madeToOrder ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
                      {t("studio.stueckNeu.availability.madeToOrder")}
                    </button>
                  </div>
                  {!madeToOrder ? (
                    <label className="block">
                      <span className="text-xs text-muted-foreground">{t("studio.stueckNeu.availability.stockLabel")}</span>
                      <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" min="1" step="1"
                        className="mt-1 w-full border border-border bg-white p-3 text-sm" />
                    </label>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("studio.stueckNeu.availability.madeToOrderHint")}</p>
                  )}
                </>
              )}
            </div>


            <button onClick={createProduct} disabled={busy}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 border border-foreground bg-foreground px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
              {busy ? t("studio.stueckNeu.form.creating") : t("studio.stueckNeu.form.submit")} <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">{t("studio.stueckNeu.form.moreLaterHint")}</p>
          </>
        ) : (
          <>
            <div className="border-[1.5px] border-foreground bg-white p-6">
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.stueckNeu.live.badge")}</p>
              <div className="mt-3 flex items-center gap-4">
                {product.image_url && <img src={product.image_url} alt="" className="h-20 w-20 object-cover" />}
                <div>
                  <p className="font-serif text-xl">{product.name}</p>
                  <p className="text-sm text-muted-foreground">€ {product.price.toLocaleString("de-DE")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`/studio/produkte?edit=${product.id}`} className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-background hover:bg-black">{t("studio.stueckNeu.live.addDetails")}</Link>
                <Link to={`/product/${product.slug}`} className="border border-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">{t("studio.stueckNeu.live.viewPiece")}</Link>
                <Link to="/studio/produkte" className="border border-border px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-muted">{t("studio.stueckNeu.live.toCollection")}</Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("studio.stueckNeu.live.detailsHint")}
              </p>

            </div>

            <div className="mt-8 border-t border-border pt-8">
              <p className="editorial-eyebrow">{t("studio.stueckNeu.improveImage.heading")}</p>
              {!sourceUrl && <div className="mt-3">{photoUploader}</div>}
              {detectBusy && <p className="mt-3 text-sm text-muted-foreground">{t("studio.stueckNeu.improveImage.detecting")}</p>}
              {fotoHinweis && <p className="mt-3 border-l-2 border-foreground pl-3 text-sm text-muted-foreground">{fotoHinweis}</p>}
              {sourceUrl && !detectBusy && (
                <div className="mt-3">
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.stueckNeu.improveImage.artLabel")}{ambiguous ? ` — ${t("studio.stueckNeu.improveImage.pleaseConfirm")}` : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ART_ORDER.map((a) => (
                      <button key={a} type="button" onClick={() => setArt(a)}
                        className={`min-h-[32px] border px-3 py-1 text-[0.62rem] tracking-wide ${art === a ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {t(ART_LABEL_KEY[a])}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {art && templatesForArt.length > 0 && (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {templatesForArt.map((tpl) => (
                      <label key={tpl.id} className={`flex cursor-pointer gap-3 border p-3 ${selectedIds.includes(tpl.id) ? "border-foreground" : "border-border"}`}>
                        <input type="checkbox" className="mt-1" checked={selectedIds.includes(tpl.id)} onChange={() => toggleTemplate(tpl.id)} />
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            {tpl.preview_url ? (
                              <img src={tpl.preview_url} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-border text-[0.5rem] text-muted-foreground">{t("studio.stueckNeu.improveImage.exampleComing")}</div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{tpl.label}</p>
                              {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
                            </div>
                          </div>

                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedIds.length === 0 ? t("studio.stueckNeu.improveImage.selectAtLeastOne") : t("studio.stueckNeu.improveImage.durationHint", { n: selectedIds.length })}
                    </p>
                    <button type="button" onClick={() => void runStaging()}
                      disabled={stagingBusy || selectedIds.length === 0 || !quota.canDo("shots")}
                      className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                      {stagingBusy ? t("studio.stueckNeu.improveImage.staging") : t("studio.stueckNeu.improveImage.startStaging")}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("studio.stueckNeu.improveImage.stagingHint")}
                  </p>
                </>
              )}
              {results && (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.stueckNeu.improveImage.resultHeading")}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {results.map((r) => (
                      <div key={r.template_id} className="border border-border">
                        {r.result_url ? (
                          <>
                            <img src={r.result_url} alt={r.label} className="aspect-square w-full object-cover" />
                            <div className="p-2">
                              <p className="truncate text-xs">{r.label}</p>
                              <button type="button" onClick={() => void adopt(r)}
                                className="mt-1 w-full border border-foreground bg-foreground px-1 py-1 text-[0.6rem] uppercase tracking-wide text-background hover:bg-black">
                                {t("studio.stueckNeu.improveImage.adoptButton")}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex aspect-square items-center justify-center p-2 text-center text-[0.62rem] text-muted-foreground">{r.error ?? t("studio.stueckNeu.improveImage.failed")}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {coverMoment && (
        <CoverMoment
          imageUrl={coverMoment}
          brandName={designer.brand_name}
          houseNumber={designer.house_number}
          variant="product"
          onDone={() => void dismissCoverMoment(product!.id)}
        />
      )}
    </StudioShell>
  );
}
