import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload, X, Sparkles, Megaphone, HelpCircle, Check, ImageIcon, Share2, Package, Link2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { TagInput } from "@/features/ontology/TagInput";
import { useOntology, type OntologyTerm } from "@/features/ontology/useOntology";
import { renderShareKit, downloadBlob, SHARE_FORMAT_LABEL, type ShareFormat } from "@/features/share/shareKit";
import { buildCreatorPackage } from "@/features/share/creatorPackage";
import { CoverMoment } from "@/features/studio/CoverMoment";
import { ladePlanGate, weltenErlaubt, naechsterPlanFuerMehrWelten, planLabel, type Plan } from "@/lib/planGate";
import {
  effectiveVatRate, emptyMeasurements, formatEuro, formatRate,
  materialSum, splitVat, vatNote, worldProfile,
  type MaterialPart, type Measurements, type SizeVariant,
} from "@/features/studio/productDetails";

type World = "Mode" | "Interior" | "Kunst";
type Status = "draft" | "published" | "archived";
type InventoryMode = "stock" | "made_to_order";
type Variant = { name: string; options: string[] };

interface ProductDNA {
  materials: string[];
  silhouette: string[];
  colors: string[];
  mood: string[];
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  world: World;
  price: number;
  compare_at_price: number | null;
  description: string | null;
  tags: string[];
  image_url: string | null;
  status: Status;
  inventory_mode: InventoryMode;
  stock_quantity: number;
  allow_custom_requests: boolean;
  sku: string | null;
  variants: Variant[];
  weight_grams: number | null;
  lead_time_days: number | null;
  product_dna: ProductDNA;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  care_instructions: string | null;
  made_in: string | null;
  edition_info: string | null;
  designer_note: string | null;
  banner_media_asset_id: string | null;
  size_variants: SizeVariant[];
  measurements: Measurements;
  material_composition: MaterialPart[];
  care_symbols: string[];
  lining_hardware: string | null;
  sustainability_note: string | null;
  vat_rate: number | null;
}

const emptyDNA = (): ProductDNA => ({ materials: [], silhouette: [], colors: [], mood: [] });

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const PAGE = 20;

function buildWorldCopy(t: (k: string) => string): Record<World, { title: string; sub: string }> {
  return {
    Mode: { title: t("nav.mode"), sub: t("studio.products.world.modeSub") },
    Interior: { title: t("nav.interior"), sub: t("studio.products.world.interiorSub") },
    Kunst: { title: t("nav.kunst"), sub: t("studio.products.world.kunstSub") },
  };
}

export default function StudioProducts() {
  const { designer, loading } = useMyDesigner();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverMoment, setCoverMoment] = useState<{ imageUrl: string; productId: string } | null>(null);
  const { user } = useAuth();
  const { t, locale } = useI18n();

  // Teil 27b: Der Cover-Moment — einmalig pro Stück, wenn es zum ersten Mal live geht.
  const maybeShowCover = async (product: { id: string; image_url: string | null }) => {
    if (!product.image_url) return;
    const { data } = await supabase.from("products").select("cover_shown_at").eq("id", product.id).maybeSingle();
    if (data && !(data as { cover_shown_at: string | null }).cover_shown_at) {
      setCoverMoment({ imageUrl: product.image_url, productId: product.id });
    }
  };
  const dismissCoverMoment = async () => {
    if (coverMoment) await supabase.from("products").update({ cover_shown_at: new Date().toISOString() }).eq("id", coverMoment.productId);
    setCoverMoment(null);
  };

  const refresh = async () => {
    if (!designer) return;
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, count } = await supabase.from("products")
      .select("id, name, slug, world, price, compare_at_price, description, tags, image_url, status, inventory_mode, stock_quantity, allow_custom_requests, sku, variants, weight_grams, lead_time_days, product_dna, length_cm, width_cm, height_cm, care_instructions, made_in, edition_info, designer_note, banner_media_asset_id, size_variants, measurements, material_composition, care_symbols, lining_hardware, sustainability_note, vat_rate", { count: "exact" })
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    setItems(((data ?? []) as unknown) as ProductRow[]);
    setTotal(count ?? 0);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designer?.id, page]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const dnaId = searchParams.get("dna");
    const editId = searchParams.get("edit");
    const targetId = dnaId ?? editId;
    if (!targetId || items.length === 0) return;
    const p = items.find((x) => x.id === targetId);
    if (!p) return;
    setEditing(p);
    setTimeout(() => {
      document.getElementById(dnaId ? "dna" : "details")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    searchParams.delete("dna");
    searchParams.delete("edit");
    setSearchParams(searchParams, { replace: true });
  }, [items, searchParams, setSearchParams]);


  const buildPayload = (e: Partial<ProductRow>) => ({
    designer_id: designer!.id,
    name: (e.name ?? "").trim(),
    slug: e.slug?.trim() || `${slugify(designer!.brand_name)}-${slugify(e.name ?? "")}`,
    world: (e.world ?? "Mode") as World,
    price: Number(e.price ?? 0),
    compare_at_price: e.compare_at_price != null && Number(e.compare_at_price) > 0 ? Number(e.compare_at_price) : null,
    description: e.description ?? null,
    tags: e.tags ?? [],
    image_url: e.image_url ?? null,
    status: (e.status ?? "draft") as Status,
    inventory_mode: (e.inventory_mode ?? "stock") as InventoryMode,
    stock_quantity: (e.size_variants ?? []).length > 0
      ? (e.size_variants ?? []).reduce((s, v) => s + Math.max(0, Number(v.stock) || 0), 0)
      : Math.max(0, Number(e.stock_quantity ?? 0)),
    allow_custom_requests: !!e.allow_custom_requests,
    sku: e.sku?.trim() || null,
    variants: (e.variants ?? []) as unknown as never,
    weight_grams: e.weight_grams != null ? Number(e.weight_grams) : null,
    lead_time_days: e.lead_time_days != null ? Number(e.lead_time_days) : null,
    product_dna: (e.product_dna ?? emptyDNA()) as unknown as never,
    length_cm: e.length_cm != null && !isNaN(Number(e.length_cm)) ? Number(e.length_cm) : null,
    width_cm: e.width_cm != null && !isNaN(Number(e.width_cm)) ? Number(e.width_cm) : null,
    height_cm: e.height_cm != null && !isNaN(Number(e.height_cm)) ? Number(e.height_cm) : null,
    care_instructions: e.care_instructions?.trim() || null,
    made_in: e.made_in?.trim() || null,
    edition_info: e.edition_info?.trim() || null,
    designer_note: e.designer_note?.trim() || null,
    banner_media_asset_id: e.banner_media_asset_id ?? null,
    size_variants: (e.size_variants ?? []) as unknown as never,
    measurements: (e.measurements ?? emptyMeasurements()) as unknown as never,
    material_composition: (e.material_composition ?? []) as unknown as never,
    care_symbols: e.care_symbols ?? [],
    lining_hardware: e.lining_hardware?.trim() || null,
    sustainability_note: e.sustainability_note?.trim() || null,
    vat_rate: e.vat_rate != null && !isNaN(Number(e.vat_rate)) ? Number(e.vat_rate) : null,
  });

  const save = async () => {
    if (!designer || !editing) return;
    if (!editing.name || editing.name.trim().length < 2) return toast.error(t("studio.products.nameRequired"));
    // PART 48 AP4: "welten" ist eine Bestand-Grenze auf verschiedene Welten je Haus — nur beim
    // Anlegen relevant, ein bereits laufendes Stück darf seine Welt weiter behalten.
    if (!editing.id) {
      await ladePlanGate();
      const bestehendeWelten = Array.from(new Set(items.map((p) => p.world)));
      const gewaehlteWelt = (editing.world ?? "Mode") as string;
      const plan: Plan = designer.plan ?? "haus";
      if (!weltenErlaubt(plan, bestehendeWelten, gewaehlteWelt)) {
        const naechster = naechsterPlanFuerMehrWelten(plan);
        toast.error(naechster
          ? `Diese Welt ist in deinem Plan noch nicht frei — wechsle in ${planLabel(naechster)}, um in mehr als einer Welt zu führen.`
          : "Diese Welt ist für dein Haus noch nicht frei.");
        return;
      }
    }
    setBusy(true);
    const payload = buildPayload(editing);
    const q = editing.id
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert(payload).select("id").single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("studio.products.saved"));
    // Fire-and-forget: let PAWN classify any unknown tags into the ontology.
    const world = String((editing as { world?: string }).world ?? "Mode");
    const tags = ((editing as { tags?: string[] }).tags ?? []).filter((t) => typeof t === "string" && t.length >= 2);
    for (const term of tags.slice(0, 12)) {
      supabase.functions.invoke("classify-term", { body: { term, world } }).catch(() => { /* soft */ });
    }
    if (payload.status === "published") {
      const productId = editing.id ?? (data as { id: string } | null)?.id;
      if (productId) await maybeShowCover({ id: productId, image_url: payload.image_url });
    }
    setEditing(null);
    void refresh();
  };

  const togglePublish = async (p: ProductRow) => {
    const next: Status = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (next === "published") await maybeShowCover(p);
    void refresh();
  };

  const remove = async (p: ProductRow) => {
    if (!confirm(t("studio.products.confirmDelete", { name: p.name }))) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  if (loading) return <StudioShell title={t("studioShell.nav.produkte")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.produkte")}><p className="text-muted-foreground">{t("studio.products.noStudioAccess")}</p></StudioShell>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <StudioShell title={t("studioShell.nav.produkte")} eyebrow={t("studio.products.eyebrow")}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} {total === 1 ? t("studio.products.pieceSingular") : t("studio.products.piecePlural")} · {t("studio.products.pageInfo", { page: page + 1, total: totalPages })}</p>
        <Link to="/studio/produkte/neu" className="flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-black">
          <Plus className="h-3 w-3" /> {t("studio.products.newPiece")}
        </Link>
      </div>

      {items.length === 0 ? (
        <PawnEmptyState
          className="mt-8 bg-white p-12"
          title={t("studio.products.emptyTitle")}
          description={t("studio.products.emptyBody")}
          action={
            <Link to="/studio/produkte/neu" className="inline-flex items-center gap-2 border border-foreground px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
              <Plus className="h-3 w-3" /> {t("studio.products.firstPieceCta")}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border border border-border bg-white">
            {items.map((p) => {
              const lowStock = p.inventory_mode === "stock" && p.stock_quantity > 0 && p.stock_quantity < 3;
              const soldOut = p.inventory_mode === "stock" && p.stock_quantity === 0;
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden bg-muted">
                    {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.world} · €{p.price} · <span className={p.status === "published" ? "text-foreground" : ""}>{p.status === "published" ? t("studio.products.status.live") : p.status === "draft" ? t("studio.products.status.draft") : t("studio.products.status.archived")}</span>
                      {p.inventory_mode === "made_to_order"
                        ? <> · <span className="text-foreground">{t("studio.products.madeToOrder")}{p.lead_time_days ? ` · ${t("studio.products.leadTimeDays", { n: p.lead_time_days })}` : ""}</span></>
                        : soldOut ? <> · <span className="text-destructive">{t("studio.products.soldOut")}</span></>
                        : lowStock ? <> · <span className="text-foreground">{t("studio.products.lowStock", { n: p.stock_quantity })}</span></>
                        : <> · {t("studio.products.stockLabel", { n: p.stock_quantity })}</>}
                    </p>
                  </div>
                  <button onClick={() => togglePublish(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                    {p.status === "published" ? t("studio.products.unpublish") : t("studio.products.publish")}
                  </button>
                  <button onClick={() => setEditing(p)} className="text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">{t("studio.products.edit")}</button>
                  <button onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "campaign_draft", product_id: p.id, locale } });
                    if (error) return toast.error(error.message);
                    const d = data as { error?: string; message?: string; campaign_id?: string };
                    if (d?.error === "consent_missing") return toast.error(d.message ?? t("studio.products.consentMissing"));
                    if (d?.campaign_id) toast.success(t("studio.products.campaignDraftCreated"));
                  }} className="flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">
                    <Megaphone className="h-3 w-3" /> {t("studio.products.campaign")}
                  </button>
                  <button onClick={() => remove(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-destructive hover:text-destructive/70">{t("common.delete")}</button>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">{t("common.back")}</button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">{t("studio.products.next")}</button>
            </div>
          )}
        </>
      )}

      {editing && (
        <ProductEditor
          key={editing.id ?? "new"}
          initial={editing}
          designer={designer}
          userId={user?.id}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
          buildPayload={buildPayload}
          save={save}
          busy={busy}
          setEditing={setEditing}
          plan={designer.plan ?? "haus"}
          existingWorlds={Array.from(new Set(items.map((p) => p.world)))}
        />
      )}

      {coverMoment && designer && (
        <CoverMoment
          imageUrl={coverMoment.imageUrl}
          brandName={designer.brand_name}
          houseNumber={designer.house_number}
          variant="product"
          onDone={() => void dismissCoverMoment()}
        />
      )}
    </StudioShell>
  );
}

/* ---------- Editor (Klartext, autosave, drag&drop, help tips) ---------- */

interface EditorProps {
  initial: Partial<ProductRow>;
  designer: { id: string; brand_name: string; slug: string; avatar_url: string | null; story: string | null; vat_rate?: number };
  userId?: string;
  onCancel: () => void;
  onSaved: () => void;
  buildPayload: (e: Partial<ProductRow>) => Record<string, unknown>;
  save: () => Promise<unknown>;
  busy: boolean;
  setEditing: (e: Partial<ProductRow> | null) => void;
  plan: Plan;
  existingWorlds: string[];
}

function ProductEditor({ initial, designer, userId, onCancel, save, busy, setEditing, buildPayload, plan, existingWorlds }: EditorProps) {
  const { t, locale } = useI18n();
  const worldCopy = buildWorldCopy(t);
  // PART 48 AP4: "welten" gilt nur beim Anlegen — ein laufendes Stück behält seine Welt.
  const isNewProduct = !initial.id;
  const [local, setLocal] = useState<Partial<ProductRow>>(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [autoText, setAutoText] = useState(false);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotResult, setShotResult] = useState<{ source: string; result: string; isTryon?: boolean; style?: string } | null>(null);
  const [tryonPickerOpen, setTryonPickerOpen] = useState(false);
  const [shotDisclosure, setShotDisclosure] = useState<string>(t("studio.products.shotDisclosureDefault"));
  const [media, setMedia] = useState<Array<{ id: string; url: string; kind: "bild" | "video"; title: string | null }>>([]);
  const draftIdRef = useRef<string | undefined>(initial.id);
  const firstRender = useRef(true);
  const [shareBusy, setShareBusy] = useState<ShareFormat | "zip" | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("media_assets" as never).select("id, url, kind, title").eq("designer_id", designer.id).order("created_at", { ascending: false });
      setMedia((data ?? []) as unknown as Array<{ id: string; url: string; kind: "bild" | "video"; title: string | null }>);
    })();
  }, [designer.id]);

  // Sync back to parent so save() (which reads `editing`) has fresh data.
  useEffect(() => { setEditing(local); /* eslint-disable-next-line */ }, [local]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
      const v = (data as { value?: { shot_disclosure?: string } } | null)?.value;
      if (v?.shot_disclosure) setShotDisclosure(v.shot_disclosure);
    })();
  }, []);

  const patch = useCallback((p: Partial<ProductRow>) => setLocal((prev) => ({ ...prev, ...p })), []);

  const requestStudioShot = async () => {
    if (!local.image_url) { toast.error(t("studio.products.uploadImageFirst")); return; }
    if (!draftIdRef.current) { toast.error(t("studio.products.waitForDraftSave")); return; }
    setShotBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-shot", {
        body: { product_id: draftIdRef.current, source_url: local.image_url },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? t("studio.products.studioShotFailed"));
      setShotResult({ source: local.image_url!, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg)
        ? t("studio.products.falCreditsMissing")
        : msg || t("studio.products.genericError"));
    } finally {
      setShotBusy(false);
    }
  };

  const requestTryonShot = async (style: "weiblich" | "männlich" | "divers") => {
    if (!local.image_url) { toast.error(t("studio.products.uploadImageFirst")); return; }
    if (!draftIdRef.current) { toast.error(t("studio.products.waitForDraftSave")); return; }
    setTryonPickerOpen(false);
    setShotBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tryon", {
        body: { product_id: draftIdRef.current, source_image_url: local.image_url, mode: "shot", model_style: style },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? t("studio.products.tryonShotFailed"));
      setShotResult({ source: local.image_url!, result: r.result_url, isTryon: true, style });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg)
        ? t("studio.products.falCreditsMissing")
        : msg || t("studio.products.genericError"));
    } finally {
      setShotBusy(false);
    }
  };


  // ---- Weitergeben (Teil 17b): vorlagenbasiert, ohne KI, ohne Credits, ohne Wartezeit ----
  // Jede Nutzung schreibt ein leichtes domain_events-Ereignis — daraus leitet Teil 17c den
  // Weg-Schritt "Erstmals geteilt" ab, ohne ein eigenes Checklisten-Flag zu speichern.
  const logShareEvent = (type: string, productId?: string) => {
    void supabase.from("domain_events").insert({
      type, actor: userId ?? designer.id, payload: { designer_id: designer.id, product_id: productId ?? null },
    } as never);
  };

  const downloadShareFormat = async (format: ShareFormat) => {
    if (!local.image_url || !local.name || !local.price) return;
    setShareBusy(format);
    try {
      const blob = await renderShareKit(format, {
        imageUrl: local.image_url, brandName: designer.brand_name, productName: local.name, price: Number(local.price),
      });
      downloadBlob(blob, `${slugify(local.name)}-${format}.png`);
      logShareEvent("share.kit_downloaded", local.id);
    } catch (e) {
      toast.error((e as Error).message || t("studio.products.graphicGenerationFailed"));
    } finally {
      setShareBusy(null);
    }
  };

  const downloadCreatorPackage = async () => {
    if (!local.image_url || !local.name || !local.price || !local.slug) return;
    setShareBusy("zip");
    try {
      const zip = await buildCreatorPackage({
        brandName: designer.brand_name, brandStory: designer.story, logoUrl: designer.avatar_url,
        productName: local.name, productImageUrl: local.image_url, price: Number(local.price),
        productLink: `${window.location.origin}/product/${local.slug}`, world: local.world ?? "Mode",
      });
      downloadBlob(zip, `${slugify(local.name)}-creator-package.zip`);
      logShareEvent("share.package_downloaded", local.id);
    } catch (e) {
      toast.error((e as Error).message || t("studio.products.packageBuildFailed"));
    } finally {
      setShareBusy(null);
    }
  };

  const copyPresseLink = () => {
    if (!local.slug) return;
    const url = `${window.location.origin}/presse/${local.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success(t("studio.products.linkCopied"));
      logShareEvent("share.link_copied", local.id);
    }).catch(() => toast.error(t("studio.products.copyFailed")));
  };

  // ---- Autosave (debounced) ----
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!local.name || local.name.trim().length < 2) return; // need a name
    const handle = window.setTimeout(async () => {
      setAutosaving(true);
      const payload = buildPayload({ ...local, status: local.status ?? "draft" }) as never;
      if (draftIdRef.current) {
        const { error } = await supabase.from("products").update(payload).eq("id", draftIdRef.current);
        if (!error) setSavedAt(new Date());
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (!error && data?.id) {
          draftIdRef.current = data.id;
          setLocal((prev) => ({ ...prev, id: data.id }));
          setSavedAt(new Date());
        }
      }

      setAutosaving(false);
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [local, buildPayload]);

  // ---- Image upload ----
  const uploadImage = async (file: File) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) { toast.error(t("studio.products.pleaseChooseImage")); return; }
    setUploadPct(5);
    const path = `${userId}/products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    // Fake progress ramp (Supabase JS doesn't stream progress reliably).
    const ramp = window.setInterval(() => setUploadPct((p) => (p != null && p < 85 ? p + 8 : p)), 120);
    const { error } = await supabase.storage.from("designer-media").upload(path, file, { upsert: false });
    window.clearInterval(ramp);
    if (error) { setUploadPct(null); toast.error(error.message); return; }
    setUploadPct(95);
    const { data } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    setUploadPct(100);
    patch({ image_url: data?.signedUrl ?? null });
    window.setTimeout(() => setUploadPct(null), 400);
  };

  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadImage(f);
  };

  // ---- Text von PAWN ----
  const [autoNote, setAutoNote] = useState(false);
  const generateText = async () => {
    if (!draftIdRef.current) { toast.error(t("studio.products.nameFirstForDraft")); return; }
    setAutoText(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "product_text", product_id: draftIdRef.current, locale } });
    setAutoText(false);
    if (error) return toast.error(error.message);
    const generated = (data as { text?: string })?.text;
    if (generated) { patch({ description: generated }); toast.success(t("studio.products.suggestionInserted")); }
  };
  const generateNote = async () => {
    if (!draftIdRef.current) { toast.error(t("studio.products.nameFirst")); return; }
    setAutoNote(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "product_note", product_id: draftIdRef.current, locale } });
    setAutoNote(false);
    if (error) return toast.error(error.message);
    const generated = (data as { text?: string })?.text;
    if (generated) { patch({ designer_note: generated }); toast.success(t("studio.products.thoughtInserted")); }
  };

  const setVariant = (i: number, p: Partial<Variant>) => {
    const vs = [...(local.variants ?? [])];
    vs[i] = { ...vs[i], ...p } as Variant;
    patch({ variants: vs });
  };
  const addVariant = () => patch({ variants: [...(local.variants ?? []), { name: t("cart.size"), options: [] }] });
  const removeVariant = (i: number) => patch({ variants: (local.variants ?? []).filter((_, k) => k !== i) });

  const editorProfile = worldProfile(local.world);
  const nameMissing = !local.name || local.name.trim().length < 2;
  const priceMissing = !local.price || Number(local.price) <= 0;
  const imageMissing = !local.image_url;
  const materialMissing = editorProfile.materialRequired
    && (local.material_composition ?? []).filter((m) => m.material.trim()).length === 0;
  const weightMissing = local.weight_grams == null || Number(local.weight_grams) <= 0;
  const complete = !nameMissing && !priceMissing && !imageMissing && !materialMissing && !weightMissing;

  const houseVatRate = Number(designer.vat_rate ?? 19);
  const vat = splitVat(Number(local.price ?? 0), effectiveVatRate(local.vat_rate, houseVatRate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 md:p-6" onClick={onCancel}>
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-border bg-white" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-8 py-5">
          <div className="min-w-0">
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{local.id ? t("studio.products.editingBadge") : t("studio.products.newPiece")}</p>
            <h2 className="mt-0.5 truncate font-serif text-2xl font-medium">{local.name?.trim() || t("studio.products.unnamed")}</h2>
          </div>
          <div className="flex items-center gap-4">
            <AutosaveBadge saving={autosaving} savedAt={savedAt} />
            <button onClick={onCancel} aria-label={t("studio.products.close")} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-8 py-6">
          {/* World cards */}
          <Section title={t("studio.products.sectionWorld.title")} help={t("studio.products.sectionWorld.help")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["Mode", "Interior", "Kunst"] as World[]).map((w) => {
                const active = (local.world ?? "Mode") === w;
                const gesperrt = isNewProduct && !weltenErlaubt(plan, existingWorlds, w);
                return (
                  <button key={w} type="button" onClick={() => patch({ world: w })}
                    className={`group relative flex flex-col items-start gap-2 border p-5 text-left transition-all ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"} ${gesperrt ? "opacity-40" : ""}`}>
                    <span className="font-serif text-xl font-medium">{worldCopy[w].title}</span>
                    <span className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{worldCopy[w].sub}</span>
                    {active && <span className="absolute right-3 top-3"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
            {isNewProduct && !weltenErlaubt(plan, existingWorlds, (local.world ?? "Mode") as string) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Diese Welt ist in deinem Plan noch nicht frei — {naechsterPlanFuerMehrWelten(plan) === "maison" ? "Maison" : "Atelier"} erlaubt mehr Welten gleichzeitig.
              </p>
            )}
          </Section>

          {/* Name + price */}
          <Section title={t("studio.products.sectionEssentials.title")} help={t("studio.products.sectionEssentials.help")}>
            <Field label={t("studio.products.nameLabel")} required missing={nameMissing}>
              <input value={local.name ?? ""} onChange={(e) => patch({ name: e.target.value })}
                placeholder={t("studio.products.namePlaceholder")}
                className={`inp ${nameMissing ? "border-destructive/60" : ""}`} />
            </Field>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("studio.products.priceLabel")} required missing={priceMissing}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input type="number" min={0} value={local.price ?? 0}
                    onChange={(e) => patch({ price: Number(e.target.value) })}
                    className={`inp pl-8 ${priceMissing ? "border-destructive/60" : ""}`} />
                </div>
              </Field>
              <Field label={t("studio.products.comparePriceLabel")} hint={t("studio.products.comparePriceHint")}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input type="number" min={0} value={local.compare_at_price ?? ""}
                    onChange={(e) => patch({ compare_at_price: e.target.value ? Number(e.target.value) : null })}
                    className="inp pl-8" />
                </div>
              </Field>
              <Field label={t("studio.products.vatLabel")} hint={t("studio.products.vatHint", { rate: formatRate(houseVatRate) })}>
                <input type="number" min={0} max={30} step={0.1} value={local.vat_rate ?? ""}
                  onChange={(e) => patch({ vat_rate: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder={formatRate(houseVatRate)} className="inp" />
              </Field>
            </div>
            <div className="mt-3 border-l-2 border-foreground bg-muted/40 px-3 py-2 text-xs">
              <p>
                {t("studio.products.vatBreakdown", {
                  gross: formatEuro(vat.gross), net: formatEuro(vat.net), vat: formatEuro(vat.vat),
                  rateSuffix: vat.rate > 0 ? ` (${formatRate(vat.rate)} %)` : "",
                })}
              </p>
              <p className="mt-1 text-muted-foreground">{t("studio.products.vatNoteLine", { note: vatNote(vat.rate, locale) })}</p>
            </div>
          </Section>

          {/* Image */}
          <Section title={t("studio.products.sectionImage.title")} help={t("studio.products.sectionImage.help")}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition-colors ${dragOver ? "border-foreground bg-muted" : "border-border bg-white"}`}>
              {local.image_url && (
                <>
                  <img src={local.image_url} alt="" className="max-h-64 w-auto object-contain" />
                  <div className="flex flex-wrap justify-center gap-2">
                    <label className="cursor-pointer border border-border bg-white px-3 py-1.5 text-[0.68rem] hover:bg-muted">
                      {t("studio.products.replaceImage")}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                    </label>
                    <button type="button" onClick={() => patch({ image_url: null })} className="border border-border bg-white px-3 py-1.5 text-[0.68rem] hover:bg-muted">{t("cart.remove")}</button>
                    <button type="button" onClick={requestStudioShot} disabled={shotBusy}
                      className="inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
                      <Sparkles className="h-3 w-3" /> {shotBusy ? t("studio.products.pawnThinking") : t("studio.products.whiteWall")}
                    </button>
                    <button type="button" onClick={() => setTryonPickerOpen((v) => !v)} disabled={shotBusy}
                      className="inline-flex items-center gap-1.5 border border-foreground bg-white px-3 py-1.5 text-[0.68rem] tracking-wide text-foreground hover:bg-muted disabled:opacity-60">
                      ✦ {t("studio.products.withAiModel")} <span className="text-[0.55rem] uppercase tracking-widest text-muted-foreground">{t("studio.products.beta")}</span>
                    </button>
                  </div>
                  {tryonPickerOpen && (
                    <div className="mt-2 flex flex-wrap justify-center gap-2 border border-border bg-white px-3 py-2">
                      <span className="self-center text-[0.62rem] uppercase tracking-widest text-muted-foreground">{t("studio.products.modelStyleLabel")}</span>
                      {(["weiblich", "männlich", "divers"] as const).map((s) => (
                        <button key={s} type="button" onClick={() => requestTryonShot(s)}
                          className="border border-border bg-white px-3 py-1 text-[0.68rem] hover:border-foreground">
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[0.6rem] text-muted-foreground">{t("studio.products.shotExplainer")}</p>
                </>
              )}
              {!local.image_url && (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm">{t("studio.products.dragImageHere")}</p>
                  <label className="cursor-pointer border border-foreground bg-white px-4 py-2 text-[0.68rem] hover:bg-foreground hover:text-background">
                    <Upload className="mr-1 inline h-3 w-3" /> {t("studio.products.chooseFile")}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  </label>
                  <p className="text-[0.62rem] text-muted-foreground">{t("studio.products.imageRequirements")}</p>
                  {local.id && (
                    <Link to={`/studio/produkte/neu?product=${local.id}`} className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground underline hover:text-foreground">
                      {t("studio.products.orPawnStages")}
                    </Link>
                  )}
                </>
              )}
              {uploadPct != null && (
                <div className="mt-2 h-1 w-full bg-muted">
                  <div className="h-full bg-foreground transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
              )}
            </div>
          </Section>

          {/* Weitergeben (Teil 17b): fertige Formate ohne KI, ohne Credits, ohne Wartezeit */}
          {local.id && local.image_url && local.slug && (
            <Section title={t("studio.products.sectionShare.title")} help={t("studio.products.sectionShare.help")}>
              <div className="flex flex-wrap gap-2">
                {(["story_9x16", "post_1x1", "pin_2x3", "banner"] as ShareFormat[]).map((f) => (
                  <button key={f} type="button" onClick={() => downloadShareFormat(f)} disabled={shareBusy !== null}
                    className="inline-flex items-center gap-1.5 border border-foreground bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background disabled:opacity-50">
                    <Share2 className="h-3 w-3" /> {shareBusy === f ? "…" : SHARE_FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={downloadCreatorPackage} disabled={shareBusy !== null}
                  className="inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-50">
                  <Package className="h-3 w-3" /> {shareBusy === "zip" ? t("studio.products.packageBuilding") : t("studio.products.creatorPackageZip")}
                </button>
                <button type="button" onClick={copyPresseLink}
                  className="inline-flex items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:border-foreground">
                  <Link2 className="h-3 w-3" /> {t("studio.products.copyShareableLink")}
                </button>
              </div>
            </Section>
          )}

          {/* Seitlicher Banner (Teil 12c) */}
          <Section title={t("studio.products.sectionBanner.title")} help={t("studio.products.sectionBanner.help")}>
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("studio.products.mediaLibraryEmpty")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <button type="button" onClick={() => patch({ banner_media_asset_id: null })}
                  className={`flex aspect-[3/4] items-center justify-center border text-[0.6rem] uppercase tracking-widest ${!local.banner_media_asset_id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>
                  {t("studio.products.noBanner")}
                </button>
                {media.map((m) => {
                  const active = local.banner_media_asset_id === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => patch({ banner_media_asset_id: m.id })}
                      className={`relative aspect-[3/4] overflow-hidden border ${active ? "border-foreground" : "border-border hover:border-foreground"}`}>
                      {m.kind === "video"
                        ? <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                        : <img src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      {active && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center bg-foreground text-background"><Check className="h-3 w-3" /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Description */}
          <Section title={t("studio.products.sectionDescription.title")} help={t("studio.products.sectionDescription.help")}>
            <button type="button" onClick={generateText} disabled={autoText}
              className="mb-2 inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> {autoText ? t("studio.products.copilotWriting") : t("studio.products.textFromPawn")}
            </button>
            <textarea value={local.description ?? ""} onChange={(e) => patch({ description: e.target.value })}
              placeholder={t("studio.products.descriptionPlaceholder")}
              className="inp min-h-32" />
          </Section>

          {/* Der Gedanke dahinter */}
          <Section title={t("studio.products.sectionThought.title")} help={t("studio.products.sectionThought.help")}>
            <button type="button" onClick={generateNote} disabled={autoNote}
              className="mb-2 inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> {autoNote ? t("studio.products.pawnThinking") : t("studio.products.textFromPawn")}
            </button>
            <textarea value={local.designer_note ?? ""} onChange={(e) => patch({ designer_note: e.target.value })}
              placeholder={t("studio.products.notePlaceholder")}
              rows={3}
              className="inp min-h-24" />
            <p className="mt-1 text-[0.62rem] text-muted-foreground">{t("studio.products.noteHint")}</p>
          </Section>

          {/* Details & Maße */}
          <DetailsSection
            local={local}
            patch={patch}
          />

          {/* Inventory */}
          <Section title={t("studio.products.sectionAvailability.title")} help={t("studio.products.sectionAvailability.help")}>
            <div className="flex flex-col gap-3 sm:flex-row">
              {(["stock","made_to_order"] as InventoryMode[]).map((m) => {
                const active = local.inventory_mode === m;
                return (
                  <button key={m} type="button" onClick={() => patch({ inventory_mode: m })}
                    className={`flex-1 border p-4 text-left ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    <p className="font-serif text-base font-medium">{m === "stock" ? t("studio.products.stockOption") : t("studio.products.madeToOrderOption")}</p>
                    <p className={`mt-1 text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{m === "stock" ? t("studio.products.stockOptionHint") : t("studio.products.madeToOrderHint")}</p>
                  </button>
                );
              })}
            </div>
            {local.inventory_mode === "stock" ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("studio.products.stockQtyLabel")} required>
                  <input type="number" min={0} value={local.stock_quantity ?? 0}
                    onChange={(e) => patch({ stock_quantity: Math.max(0, Number(e.target.value)) })}
                    className="inp" />
                </Field>
                <Field label={t("studio.products.weightLabel")} hint={t("studio.products.weightHint")}>
                  <input type="number" min={0} value={local.weight_grams ?? ""}
                    onChange={(e) => patch({ weight_grams: e.target.value ? Number(e.target.value) : null })}
                    className="inp" />
                </Field>
              </div>
            ) : (
              <Field label={t("studio.products.leadTimeLabel")} hint={t("studio.products.leadTimeHint")} >
                <input type="number" min={1} value={local.lead_time_days ?? ""}
                  onChange={(e) => patch({ lead_time_days: e.target.value ? Number(e.target.value) : null })}
                  className="inp max-w-[200px]" placeholder={t("studio.products.leadTimePlaceholder")} />
              </Field>
            )}
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={!!local.allow_custom_requests} onChange={(e) => patch({ allow_custom_requests: e.target.checked })} className="mt-1" />
              <span>{t("studio.products.allowCustomRequests")}</span>
            </label>
          </Section>

          {/* Größen mit eigenem Bestand */}
          <div id="details" className="scroll-mt-24">
            <SizesSection local={local} patch={patch} />
          </div>

          {/* Material & Pflege */}
          <MaterialSection local={local} patch={patch} />


          {/* Weitere Varianten (Farbe, Format …) */}
          <Section title={t("studio.products.sectionVariants.title")} help={t("studio.products.sectionVariants.help")}>
            {(local.variants ?? []).length === 0 && <p className="text-xs text-muted-foreground">{t("studio.products.noVariants")}</p>}
            <div className="space-y-3">
              {(local.variants ?? []).map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
                  <Field label={t("studio.products.variantNameLabel")}><input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} className="inp" /></Field>
                  <Field label={t("studio.products.variantOptionsLabel")}><input value={v.options.join(", ")} onChange={(e) => setVariant(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="inp" /></Field>
                  <button type="button" onClick={() => removeVariant(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">{t("studio.products.removeShort")}</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addVariant} className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">+ {t("studio.products.addVariant")}</button>
          </Section>

          {/* Product DNA — Moleküle */}
          <Section title={t("studio.products.sectionDna.title")} help={t("studio.products.sectionDna.help")} anchorId="dna">
            <ProductDNAEditor
              dna={local.product_dna ?? emptyDNA()}
              world={local.world ?? "Mode"}
              onChange={(dna) => patch({ product_dna: dna })}
            />
          </Section>

          {/* Tags + SKU */}
          <Section title={t("studio.products.sectionDetails.title")} help={t("studio.products.sectionDetails.help")}>
            <Field label={t("studio.products.tagsLabel")} hint={t("studio.products.tagsHint")}>
              <TagInput value={local.tags ?? []} onChange={(v) => patch({ tags: v })} world={local.world} />
            </Field>
            <Field label={t("studio.products.skuLabel")} hint={t("studio.products.skuHint")}>
              <input value={local.sku ?? ""} onChange={(e) => patch({ sku: e.target.value })} className="inp max-w-xs" />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-white px-8 py-4">
          <div className="text-xs text-muted-foreground">
            {!complete && <span>{t("studio.products.missingPrefix", { list: [nameMissing && t("studio.products.missingName"), priceMissing && t("studio.products.missingPrice"), imageMissing && t("studio.products.missingImage"), materialMissing && editorProfile.materialLabel, weightMissing && t("studio.products.missingWeight")].filter(Boolean).join(", ") })}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="border border-border bg-white px-5 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("common.cancel")}</button>
            <button onClick={() => { patch({ status: "draft" }); void save(); }} disabled={busy || nameMissing}
              className="border border-border bg-white px-5 py-2 text-[0.68rem] tracking-wide hover:bg-muted disabled:opacity-40">{t("studio.products.saveAsDraft")}</button>
            <button onClick={() => { patch({ status: "published" }); void save(); }} disabled={busy || !complete}
              className="border border-foreground bg-foreground px-5 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-40">
              {busy ? "…" : t("studio.products.publish")}
            </button>
          </div>
        </div>
      </div>

      {shotResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setShotResult(null)}>
          <div className="w-full max-w-4xl border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-xl">{t("studio.products.beforeAfter")}</h3>
              <button onClick={() => setShotResult(null)} aria-label={t("studio.products.close")} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={shotResult.source} alt={t("studio.products.original")} className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">{t("studio.products.original")}</figcaption>
              </figure>
              <figure className="relative">
                <img src={shotResult.result} alt={shotResult.isTryon ? t("studio.products.aiModelShotAlt") : t("studio.products.studioPhotoAlt")} className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                {shotResult.isTryon && (
                  <span className="absolute right-2 top-2 border border-foreground bg-white px-2 py-0.5 text-[0.55rem] uppercase tracking-widest">{t("studio.products.aiModelBadge")}</span>
                )}
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">
                  {shotResult.isTryon ? t("studio.products.aiModelShotCaption", { style: shotResult.style ?? "" }) : t("studio.products.studioPhotoCaption")}
                </figcaption>
                {shotResult.isTryon && (
                  <p className="mt-1 text-[0.62rem] italic text-muted-foreground">{shotDisclosure}</p>
                )}
              </figure>
            </div>
            {shotResult.isTryon && (
              <p className="mt-4 border-l-2 border-foreground bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {t("studio.products.tryonCheckHint")}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setShotResult(null)} className="border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("studio.products.discard")}</button>
              {shotResult.isTryon && shotResult.style && (
                <button onClick={() => { const s = shotResult.style as "weiblich"|"männlich"|"divers"; setShotResult(null); void requestTryonShot(s); }}
                  className="border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("studio.products.regenerate")}</button>
              )}
              <button
                onClick={() => { patch({ image_url: shotResult.result }); setShotResult(null); toast.success(shotResult.isTryon ? t("studio.products.aiModelShotApplied") : t("studio.products.studioPhotoApplied")); }}
                className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">
                {t("studio.products.apply")}
              </button>
            </div>
          </div>
        </div>
      )}



      <style>{`.inp { width:100%; border:1px solid hsl(var(--border)); background:hsl(var(--background)); padding: 0.65rem 0.85rem; font-size: 0.9rem; transition: border-color .15s; }
      .inp:focus { outline: none; border-color: hsl(var(--foreground)); }`}</style>
    </div>
  );
}

function AutosaveBadge({ saving, savedAt }: { saving: boolean; savedAt: Date | null }) {
  const { t } = useI18n();
  if (saving) return <span className="text-[0.68rem] text-muted-foreground">{t("studio.products.savingBadge")}</span>;
  if (savedAt) return <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground"><Check className="h-3 w-3" /> {t("studio.products.savedBadge")}</span>;
  return null;
}

function Section({ title, help, children, anchorId }: { title: string; help?: string; children: React.ReactNode; anchorId?: string }) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  return (
    <section id={anchorId}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-serif text-lg font-medium">{title}</h3>
        {help && (
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="text-muted-foreground hover:text-foreground" aria-label={t("studio.products.helpAriaLabel")}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showHelp && help && (
        <p className="mb-3 border-l-2 border-foreground bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{help}</p>
      )}
      {children}
    </section>
  );
}

function Field({ label, hint, required, missing, children }: { label: string; hint?: string; required?: boolean; missing?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
        {required && <span className={missing ? "text-destructive" : "text-foreground"}>*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[0.68rem] text-muted-foreground">{hint}</span>}
    </label>
  );
}

interface DNAEditorProps { dna: ProductDNA; world: World; onChange: (d: ProductDNA) => void }

function ProductDNAEditor({ dna, world, onChange }: DNAEditorProps) {
  const { t } = useI18n();
  const { terms } = useOntology(world);
  const materials = terms.filter((t) => t.kind === "material");
  const silhouettes = terms.filter((t) => t.kind === "silhouette");
  const colors = terms.filter((t) => t.kind === "color");
  const moods = terms.filter((t) => t.kind === "mood");
  // Wenn Ontologie noch keine mood-Terme hat, kurze Startliste anbieten
  const fallbackMoods = ["ruhig", "streng", "romantisch", "spannungsvoll", "warm", "verspielt"];
  const moodOptions = moods.length ? moods.map((t) => t.term) : fallbackMoods;

  const toggle = (group: keyof ProductDNA, term: string, max: number) => {
    const cur = dna[group] ?? [];
    if (cur.includes(term)) {
      onChange({ ...dna, [group]: cur.filter((x) => x !== term) });
    } else if (cur.length < max) {
      onChange({ ...dna, [group]: [...cur, term] });
    }
  };

  const complete = (dna.materials?.length ?? 0) > 0
    && (dna.silhouette?.length ?? 0) > 0
    && (dna.colors?.length ?? 0) > 0
    && (dna.mood?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {!complete && (
        <p className="border-l-2 border-foreground bg-muted/40 px-3 py-2 text-xs">
          {t("studio.products.dnaShortHint")}
        </p>
      )}
      <DNAChipRow label={t("studio.products.dnaMaterialLabel", { n: dna.materials.length })}
        options={materials.length ? materials.map((term) => term.term) : ["baumwolle","leinen","seide","wolle","kaschmir","leder","recycelt"]}
        selected={dna.materials} onToggle={(term) => toggle("materials", term, 6)} />
      <DNAChipRow label={t("studio.products.dnaSilhouetteLabel", { n: dna.silhouette.length })}
        options={silhouettes.length ? silhouettes.map((term) => term.term) : ["oversized","tailliert","fließend","strukturiert","cropped","column"]}
        selected={dna.silhouette} onToggle={(term) => toggle("silhouette", term, 2)} />
      <DNAChipRow label={t("studio.products.dnaColorLabel", { n: dna.colors.length })}
        options={colors.map((term) => term.term)}
        selected={dna.colors} onToggle={(term) => toggle("colors", term, 3)} />
      <DNAChipRow label={t("studio.products.dnaMoodLabel", { n: dna.mood.length })}
        options={moodOptions}
        selected={dna.mood} onToggle={(term) => toggle("mood", term, 2)} />
    </div>
  );
}

function DNAChipRow({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (t: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.slice(0, 24).map((term) => {
          const active = selected.includes(term);
          return (
            <button key={term} type="button" onClick={() => onToggle(term)}
              className={`border px-3 py-1.5 text-xs transition-all ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
              {term}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailsSection({ local, patch }: { local: Partial<ProductRow>; patch: (p: Partial<ProductRow>) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const profile = worldProfile(local.world);
  const filled = [local.length_cm, local.width_cm, local.height_cm, local.made_in, local.edition_info]
    .filter((v) => v != null && String(v).trim() !== "").length;
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border border-border bg-white px-4 py-3 text-left hover:border-foreground">
        <span className="font-serif text-lg font-medium">{t("studio.products.originMeasures")} {filled > 0 && <span className="ml-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.products.filledCount", { n: filled })}</span>}</span>
        <span className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{open ? t("studio.products.close") : t("studio.products.open")}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border border-border bg-white p-5">
          <p className="text-xs text-muted-foreground">{t("studio.products.allOptionalHint")}</p>
          <Field label={profile.dimensionsLabel} hint={profile.dimensionsHint}>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min={0} step="0.1" placeholder={t("studio.products.lengthPlaceholder")} value={local.length_cm ?? ""}
                onChange={(e) => patch({ length_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
              <input type="number" min={0} step="0.1" placeholder={t("studio.products.widthPlaceholder")} value={local.width_cm ?? ""}
                onChange={(e) => patch({ width_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
              <input type="number" min={0} step="0.1" placeholder={t("studio.products.heightPlaceholder")} value={local.height_cm ?? ""}
                onChange={(e) => patch({ height_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={profile.originLabel} hint={t("studio.products.originHint")}>
              <input value={local.made_in ?? ""} onChange={(e) => patch({ made_in: e.target.value })} placeholder={t("studio.products.originPlaceholder")} className="inp" />
            </Field>
            <Field label={profile.editionLabel} hint={t("studio.products.editionHint")}>
              <input value={local.edition_info ?? ""} onChange={(e) => patch({ edition_info: e.target.value })} placeholder={profile.editionPlaceholder} className="inp" />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}


/* ---------- Größen mit eigenem Bestand + Maßtabelle ---------- */

function SizesSection({ local, patch }: { local: Partial<ProductRow>; patch: (p: Partial<ProductRow>) => void }) {
  const { t } = useI18n();
  const sizes: SizeVariant[] = local.size_variants ?? [];
  const measurements: Measurements = local.measurements ?? emptyMeasurements();
  const profile = worldProfile(local.world);
  const presets = profile.measurementRows;

  const setSize = (i: number, p: Partial<SizeVariant>) => {
    const next = sizes.map((s, k) => (k === i ? { ...s, ...p } : s));
    patch({ size_variants: next });
  };
  const addSize = () => patch({ size_variants: [...sizes, { size: "", stock: 0, surcharge: 0, sku: null }] });
  const removeSize = (i: number) => {
    const removed = sizes[i]?.size;
    const values = { ...measurements.values };
    for (const row of Object.keys(values)) {
      if (removed && values[row]) { const copy = { ...values[row] }; delete copy[removed]; values[row] = copy; }
    }
    patch({ size_variants: sizes.filter((_, k) => k !== i), measurements: { ...measurements, values } });
  };

  const addRow = (row: string) => {
    const name = row.trim();
    if (!name || measurements.rows.includes(name)) return;
    patch({ measurements: { rows: [...measurements.rows, name], values: { ...measurements.values, [name]: {} } } });
  };
  const removeRow = (row: string) => {
    const values = { ...measurements.values };
    delete values[row];
    patch({ measurements: { rows: measurements.rows.filter((r) => r !== row), values } });
  };
  const setValue = (row: string, size: string, v: string) => {
    patch({
      measurements: {
        ...measurements,
        values: { ...measurements.values, [row]: { ...(measurements.values[row] ?? {}), [size]: v } },
      },
    });
  };

  const columns = sizes.map((s) => s.size).filter((s) => s.trim() !== "");
  const total = sizes.reduce((s, v) => s + Math.max(0, Number(v.stock) || 0), 0);

  return (
    <Section title={profile.variantTitle} help={profile.variantHelp}>
      {sizes.length === 0
        ? <p className="text-xs text-muted-foreground">{profile.variantEmpty}</p>
        : <p className="text-xs text-muted-foreground">{t("studio.products.totalStockFrom", { unit: profile.variantSingular === "Größe" ? "Größen" : `${profile.variantSingular}en` })} <span className="text-foreground">{total}</span></p>}

      <div className="mt-3 space-y-2">
        {sizes.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2">
            <Field label={profile.variantSingular}><input value={s.size} onChange={(e) => setSize(i, { size: e.target.value })} placeholder={profile.variantPlaceholder} className="inp" /></Field>
            <Field label={t("studio.products.stockFieldLabel")}><input type="number" min={0} value={s.stock} onChange={(e) => setSize(i, { stock: Math.max(0, Number(e.target.value)) })} className="inp" /></Field>
            <Field label={t("studio.products.surchargeLabel")}><input type="number" min={0} step="0.5" value={s.surcharge} onChange={(e) => setSize(i, { surcharge: Number(e.target.value) })} className="inp" /></Field>
            <Field label={t("studio.products.skuFieldLabel")}><input value={s.sku ?? ""} onChange={(e) => setSize(i, { sku: e.target.value || null })} className="inp" /></Field>
            <button type="button" onClick={() => removeSize(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">{t("studio.products.removeShort")}</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addSize} className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">{t("studio.products.addUnit", { unit: profile.variantSingular })}</button>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{profile.measurementTitle}</p>
        {columns.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{profile.measurementHint}</p>

        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.filter((p) => !measurements.rows.includes(p)).map((p) => (
                <button key={p} type="button" onClick={() => addRow(p)} className="border border-border bg-white px-3 py-1 text-xs hover:border-foreground">+ {p}</button>
              ))}
            </div>
            {measurements.rows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-foreground text-left">
                      <th className="py-2 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.products.measureColumnHeader")}</th>
                      {columns.map((c) => <th key={c} className="py-2 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{c}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.rows.map((row) => (
                      <tr key={row} className="border-b border-border">
                        <td className="py-2 pr-3">{row}</td>
                        {columns.map((c) => (
                          <td key={c} className="py-1 pr-2">
                            <input value={measurements.values[row]?.[c] ?? ""} onChange={(e) => setValue(row, c, e.target.value)}
                              className="inp" inputMode="decimal" placeholder="—" />
                          </td>
                        ))}
                        <td className="py-1">
                          <button type="button" onClick={() => removeRow(row)} className="px-2 text-[0.6rem] uppercase tracking-[0.24em] text-destructive">{t("studio.products.removeShort")}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <AddCustomRow onAdd={addRow} />
          </>
        )}
      </div>
    </Section>
  );
}

function AddCustomRow({ onAdd }: { onAdd: (row: string) => void }) {
  const { t } = useI18n();
  const [v, setV] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("studio.products.customMeasureRowPlaceholder")} className="inp max-w-xs" />
      <button type="button" onClick={() => { onAdd(v); setV(""); }}
        className="border border-border px-3 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:border-foreground">{t("studio.products.addButton")}</button>
    </div>
  );
}

/* ---------- Material & Pflege ---------- */

function MaterialSection({ local, patch }: { local: Partial<ProductRow>; patch: (p: Partial<ProductRow>) => void }) {
  const { t } = useI18n();
  const parts: MaterialPart[] = local.material_composition ?? [];
  const care = local.care_symbols ?? [];
  const sum = materialSum(parts);
  const profile = worldProfile(local.world);

  const setPart = (i: number, p: Partial<MaterialPart>) => patch({ material_composition: parts.map((m, k) => (k === i ? { ...m, ...p } : m)) });
  const addPart = () => patch({ material_composition: [...parts, { material: "", percent: 0 }] });
  const removePart = (i: number) => patch({ material_composition: parts.filter((_, k) => k !== i) });
  const toggleCare = (key: string) =>
    patch({ care_symbols: care.includes(key) ? care.filter((c) => c !== key) : [...care, key] });

  return (
    <Section title={profile.materialTitle} help={profile.materialHelp}>
      <div className="space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_auto] items-end gap-2">
            <Field label={profile.materialLabel}><input value={p.material} onChange={(e) => setPart(i, { material: e.target.value })} placeholder={profile.materialPlaceholder} className="inp" /></Field>
            <Field label={t("studio.products.percentLabel")}><input type="number" min={0} max={100} value={p.percent} onChange={(e) => setPart(i, { percent: Number(e.target.value) })} className="inp" /></Field>
            <button type="button" onClick={() => removePart(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">{t("studio.products.removeShort")}</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={addPart} className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">{t("studio.products.addUnit", { unit: profile.materialLabel })}</button>
        {parts.length > 0 && (
          <span className={`text-xs ${sum === 100 ? "text-muted-foreground" : "text-destructive"}`}>
            {t("studio.products.materialSum", { percent: formatRate(sum) })}{sum === 100 ? "" : t("studio.products.materialSumWarning")}
          </span>
        )}
      </div>

      <Field label={profile.detailLabel}>
        <input value={local.lining_hardware ?? ""} onChange={(e) => patch({ lining_hardware: e.target.value })}
          placeholder={profile.detailPlaceholder} className="inp" />
      </Field>

      <div className="mt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{profile.careTitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.careSymbols.map((c) => {

            const active = care.includes(c.key);
            return (
              <button key={c.key} type="button" onClick={() => toggleCare(c.key)}
                className={`border px-3 py-1.5 text-xs ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field label={t("studio.products.careNotesLabel")}>
        <textarea rows={2} value={local.care_instructions ?? ""} onChange={(e) => patch({ care_instructions: e.target.value })} className="inp" />
      </Field>

      <Field label={t("studio.products.sustainabilityLabel")} hint={t("studio.products.sustainabilityHint")}>
        <textarea rows={2} value={local.sustainability_note ?? ""} onChange={(e) => patch({ sustainability_note: e.target.value })} className="inp" />
      </Field>
    </Section>
  );
}
