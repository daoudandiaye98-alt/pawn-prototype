import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload, X, Sparkles, Megaphone, HelpCircle, Check, ImageIcon, Share2, Package, Link2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TagInput } from "@/features/ontology/TagInput";
import { useOntology, type OntologyTerm } from "@/features/ontology/useOntology";
import { renderShareKit, downloadBlob, SHARE_FORMAT_LABEL, type ShareFormat } from "@/features/share/shareKit";
import { buildCreatorPackage } from "@/features/share/creatorPackage";
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

const WORLD_COPY: Record<World, { title: string; sub: string }> = {
  Mode: { title: "Mode", sub: "Kleidung, Accessoires, Schmuck" },
  Interior: { title: "Interior", sub: "Möbel, Objekte, Textilien" },
  Kunst: { title: "Kunst", sub: "Editionen, Skulptur, Malerei" },
};

export default function StudioProducts() {
  const { designer, loading } = useMyDesigner();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

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
    if (!dnaId || items.length === 0) return;
    const p = items.find((x) => x.id === dnaId);
    if (!p) return;
    setEditing(p);
    setTimeout(() => {
      document.getElementById("dna")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    searchParams.delete("dna");
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
    if (!editing.name || editing.name.trim().length < 2) return toast.error("Bitte gib deinem Stück einen Namen.");
    setBusy(true);
    const payload = buildPayload(editing);
    const q = editing.id
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert(payload).select("id").single();
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert.");
    // Fire-and-forget: let PAWN classify any unknown tags into the ontology.
    const world = String((editing as { world?: string }).world ?? "Mode");
    const tags = ((editing as { tags?: string[] }).tags ?? []).filter((t) => typeof t === "string" && t.length >= 2);
    for (const term of tags.slice(0, 12)) {
      supabase.functions.invoke("classify-term", { body: { term, world } }).catch(() => { /* soft */ });
    }
    setEditing(null);
    void refresh();
  };

  const togglePublish = async (p: ProductRow) => {
    const next: Status = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  const remove = async (p: ProductRow) => {
    if (!confirm(`"${p.name}" löschen?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  if (loading) return <StudioShell title="Kollektion"><div className="animate-pulse h-64 bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Kollektion"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <StudioShell title="Kollektion" eyebrow="Deine Kollektion">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} {total === 1 ? "Stück" : "Stücke"} · Seite {page + 1} / {totalPages}</p>
        <Link to="/studio/produkte/neu" className="flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-black">
          <Plus className="h-3 w-3" /> Neues Stück
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 border border-dashed border-border bg-white p-12 text-center">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Leer</p>
          <p className="mt-3 font-serif text-2xl font-medium">Noch keine Stücke.</p>
          <p className="mt-2 text-sm text-muted-foreground">Leg das erste Stück deiner Kollektion an — es dauert nur ein paar Minuten.</p>
          <Link to="/studio/produkte/neu" className="mt-6 inline-flex items-center gap-2 border border-foreground px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
            <Plus className="h-3 w-3" /> Erstes Stück anlegen
          </Link>
        </div>
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
                      {p.world} · €{p.price} · <span className={p.status === "published" ? "text-foreground" : ""}>{p.status === "published" ? "Live" : p.status === "draft" ? "Entwurf" : "Archiviert"}</span>
                      {p.inventory_mode === "made_to_order"
                        ? <> · <span className="text-foreground">Auf Anfertigung{p.lead_time_days ? ` · ${p.lead_time_days} Tage` : ""}</span></>
                        : soldOut ? <> · <span className="text-destructive">Ausverkauft</span></>
                        : lowStock ? <> · <span className="text-foreground">Nur noch {p.stock_quantity}</span></>
                        : <> · Lager {p.stock_quantity}</>}
                    </p>
                  </div>
                  <button onClick={() => togglePublish(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                    {p.status === "published" ? "Depublizieren" : "Veröffentlichen"}
                  </button>
                  <button onClick={() => setEditing(p)} className="text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">Bearbeiten</button>
                  <button onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "campaign_draft", product_id: p.id } });
                    if (error) return toast.error(error.message);
                    const d = data as { error?: string; message?: string; campaign_id?: string };
                    if (d?.error === "consent_missing") return toast.error(d.message ?? "Bildnutzungs-Einwilligung fehlt.");
                    if (d?.campaign_id) toast.success("Kampagnen-Entwurf angelegt.");
                  }} className="flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">
                    <Megaphone className="h-3 w-3" /> Kampagne
                  </button>
                  <button onClick={() => remove(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-destructive hover:text-destructive/70">Löschen</button>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Zurück</button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Weiter</button>
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
}

function ProductEditor({ initial, designer, userId, onCancel, save, busy, setEditing, buildPayload }: EditorProps) {
  const [local, setLocal] = useState<Partial<ProductRow>>(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [autoText, setAutoText] = useState(false);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotResult, setShotResult] = useState<{ source: string; result: string; isTryon?: boolean; style?: string } | null>(null);
  const [tryonPickerOpen, setTryonPickerOpen] = useState(false);
  const [shotDisclosure, setShotDisclosure] = useState<string>("Visualisierung mit KI-Model");
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
    if (!local.image_url) { toast.error("Zuerst ein Bild hochladen."); return; }
    if (!draftIdRef.current) { toast.error("Bitte kurz warten, bis der Entwurf gespeichert ist."); return; }
    setShotBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-shot", {
        body: { product_id: draftIdRef.current, source_url: local.image_url },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "PAWN konnte kein Studio-Foto erzeugen.");
      setShotResult({ source: local.image_url!, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg)
        ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
        : msg || "Fehler");
    } finally {
      setShotBusy(false);
    }
  };

  const requestTryonShot = async (style: "weiblich" | "männlich" | "divers") => {
    if (!local.image_url) { toast.error("Zuerst ein Bild hochladen."); return; }
    if (!draftIdRef.current) { toast.error("Bitte kurz warten, bis der Entwurf gespeichert ist."); return; }
    setTryonPickerOpen(false);
    setShotBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tryon", {
        body: { product_id: draftIdRef.current, source_image_url: local.image_url, mode: "shot", model_style: style },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "KI-Model-Shot fehlgeschlagen.");
      setShotResult({ source: local.image_url!, result: r.result_url, isTryon: true, style });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg)
        ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
        : msg || "Fehler");
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
      toast.error((e as Error).message || "Konnte die Grafik nicht erzeugen.");
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
      toast.error((e as Error).message || "Konnte das Paket nicht bauen.");
    } finally {
      setShareBusy(null);
    }
  };

  const copyPresseLink = () => {
    if (!local.slug) return;
    const url = `${window.location.origin}/presse/${local.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link kopiert.");
      logShareEvent("share.link_copied", local.id);
    }).catch(() => toast.error("Kopieren fehlgeschlagen."));
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
    if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild wählen."); return; }
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
    if (!draftIdRef.current) { toast.error("Bitte zuerst einen Namen eingeben — dann speichere ich einen Entwurf."); return; }
    setAutoText(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "product_text", product_id: draftIdRef.current } });
    setAutoText(false);
    if (error) return toast.error(error.message);
    const t = (data as { text?: string })?.text;
    if (t) { patch({ description: t }); toast.success("Vorschlag eingefügt."); }
  };
  const generateNote = async () => {
    if (!draftIdRef.current) { toast.error("Bitte zuerst einen Namen eingeben."); return; }
    setAutoNote(true);
    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "product_note", product_id: draftIdRef.current } });
    setAutoNote(false);
    if (error) return toast.error(error.message);
    const t = (data as { text?: string })?.text;
    if (t) { patch({ designer_note: t }); toast.success("Gedanke eingefügt."); }
  };

  const setVariant = (i: number, p: Partial<Variant>) => {
    const vs = [...(local.variants ?? [])];
    vs[i] = { ...vs[i], ...p } as Variant;
    patch({ variants: vs });
  };
  const addVariant = () => patch({ variants: [...(local.variants ?? []), { name: "Größe", options: [] }] });
  const removeVariant = (i: number) => patch({ variants: (local.variants ?? []).filter((_, k) => k !== i) });

  const nameMissing = !local.name || local.name.trim().length < 2;
  const priceMissing = !local.price || Number(local.price) <= 0;
  const imageMissing = !local.image_url;
  const materialMissing = (local.material_composition ?? []).filter((m) => m.material.trim()).length === 0;
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
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{local.id ? "Bearbeiten" : "Neues Stück"}</p>
            <h2 className="mt-0.5 truncate font-serif text-2xl font-medium">{local.name?.trim() || "Ohne Namen"}</h2>
          </div>
          <div className="flex items-center gap-4">
            <AutosaveBadge saving={autosaving} savedAt={savedAt} />
            <button onClick={onCancel} aria-label="Schließen" className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-8 overflow-y-auto px-8 py-6">
          {/* World cards */}
          <Section title="In welcher Welt lebt dein Stück?" help="Wähle die Welt, in der dein Stück gezeigt wird. Ein Möbelstück gehört in Interior, ein Kleid in Mode, eine Edition in Kunst.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["Mode", "Interior", "Kunst"] as World[]).map((w) => {
                const active = (local.world ?? "Mode") === w;
                return (
                  <button key={w} type="button" onClick={() => patch({ world: w })}
                    className={`group relative flex flex-col items-start gap-2 border p-5 text-left transition-all ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    <span className="font-serif text-xl font-medium">{WORLD_COPY[w].title}</span>
                    <span className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{WORLD_COPY[w].sub}</span>
                    {active && <span className="absolute right-3 top-3"><Check className="h-4 w-4" /></span>}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Name + price */}
          <Section title="Das Wichtigste" help="Ein klarer Name und ein ehrlicher Preis. Der Streichpreis ist optional — nur nutzen, wenn du echten Vergleich zeigen willst.">
            <Field label="Name deines Stücks" required missing={nameMissing}>
              <input value={local.name ?? ""} onChange={(e) => patch({ name: e.target.value })}
                placeholder="z. B. Kaschmirmantel Nº 3"
                className={`inp ${nameMissing ? "border-destructive/60" : ""}`} />
            </Field>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Endpreis in Euro (inkl. MwSt.)" required missing={priceMissing}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input type="number" min={0} value={local.price ?? 0}
                    onChange={(e) => patch({ price: Number(e.target.value) })}
                    className={`inp pl-8 ${priceMissing ? "border-destructive/60" : ""}`} />
                </div>
              </Field>
              <Field label="Ursprünglicher Preis (optional)" hint="Nur wenn dein Stück reduziert ist.">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input type="number" min={0} value={local.compare_at_price ?? ""}
                    onChange={(e) => patch({ compare_at_price: e.target.value ? Number(e.target.value) : null })}
                    className="inp pl-8" />
                </div>
              </Field>
              <Field label="Mehrwertsteuer (%)" hint={`Leer = Haus-Standard (${formatRate(houseVatRate)} %).`}>
                <input type="number" min={0} max={30} step={0.1} value={local.vat_rate ?? ""}
                  onChange={(e) => patch({ vat_rate: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder={formatRate(houseVatRate)} className="inp" />
              </Field>
            </div>
            <div className="mt-3 border-l-2 border-foreground bg-muted/40 px-3 py-2 text-xs">
              <p>
                Endpreis € {formatEuro(vat.gross)} · davon netto € {formatEuro(vat.net)} und € {formatEuro(vat.vat)} Mehrwertsteuer
                {vat.rate > 0 ? ` (${formatRate(vat.rate)} %)` : ""}.
              </p>
              <p className="mt-1 text-muted-foreground">Auf der Produktseite steht: „{vatNote(vat.rate)}“.</p>
            </div>
          </Section>

          {/* Image */}
          <Section title="Zeig dein Stück." help="Das erste Bild trägt alles. Ziehe eine Datei in das Feld oder wähle eine aus. Ideal: quadratisch oder hochkant, mindestens 1200 Pixel.">
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
                      Bild ersetzen
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                    </label>
                    <button type="button" onClick={() => patch({ image_url: null })} className="border border-border bg-white px-3 py-1.5 text-[0.68rem] hover:bg-muted">Entfernen</button>
                    <button type="button" onClick={requestStudioShot} disabled={shotBusy}
                      className="inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
                      <Sparkles className="h-3 w-3" /> {shotBusy ? "PAWN denkt…" : "Weiße Wand"}
                    </button>
                    <button type="button" onClick={() => setTryonPickerOpen((v) => !v)} disabled={shotBusy}
                      className="inline-flex items-center gap-1.5 border border-foreground bg-white px-3 py-1.5 text-[0.68rem] tracking-wide text-foreground hover:bg-muted disabled:opacity-60">
                      ✦ Mit KI-Model <span className="text-[0.55rem] uppercase tracking-widest text-muted-foreground">Beta</span>
                    </button>
                  </div>
                  {tryonPickerOpen && (
                    <div className="mt-2 flex flex-wrap justify-center gap-2 border border-border bg-white px-3 py-2">
                      <span className="self-center text-[0.62rem] uppercase tracking-widest text-muted-foreground">Model-Stil:</span>
                      {(["weiblich", "männlich", "divers"] as const).map((s) => (
                        <button key={s} type="button" onClick={() => requestTryonShot(s)}
                          className="border border-border bg-white px-3 py-1 text-[0.68rem] hover:border-foreground">
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[0.6rem] text-muted-foreground">Studio-Foto: weiße Wand · KI-Model: dein Stück auf einem virtuellen Model. Beides via fal.ai.</p>
                </>
              )}
              {!local.image_url && (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm">Zieh dein Bild hier hinein — oder</p>
                  <label className="cursor-pointer border border-foreground bg-white px-4 py-2 text-[0.68rem] hover:bg-foreground hover:text-background">
                    <Upload className="mr-1 inline h-3 w-3" /> Datei wählen
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  </label>
                  <p className="text-[0.62rem] text-muted-foreground">JPG oder PNG, mind. 1200 px</p>
                  {local.id && (
                    <Link to={`/studio/produkte/neu?product=${local.id}`} className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground underline hover:text-foreground">
                      Oder: PAWN inszeniert dein Stück
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
            <Section title="Weitergeben" help="Vier fertige Bildformate für Story, Post, Pin und Banner — sofort erzeugt, direkt aus deinem Produktbild. Kein Warten, keine Credits. Das Kreativpaket bündelt alles in einer Datei, der Link zeigt dieselben Inhalte ohne Download.">
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
                  <Package className="h-3 w-3" /> {shareBusy === "zip" ? "Paket wird gebaut…" : "Kreativpaket (ZIP)"}
                </button>
                <button type="button" onClick={copyPresseLink}
                  className="inline-flex items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:border-foreground">
                  <Link2 className="h-3 w-3" /> Teilbaren Link kopieren
                </button>
              </div>
            </Section>
          )}

          {/* Seitlicher Banner (Teil 12c) */}
          <Section title="Seitlicher Banner" help="Zeig auf der Produktseite ein Bild oder Video neben dem Stück — aus deiner Mediathek gewählt. Optional.">
            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch nichts in deiner Mediathek. Lade Material unter „Mediathek" hoch oder erzeuge es in einer Kampagne.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                <button type="button" onClick={() => patch({ banner_media_asset_id: null })}
                  className={`flex aspect-[3/4] items-center justify-center border text-[0.6rem] uppercase tracking-widest ${!local.banner_media_asset_id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>
                  Kein Banner
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
          <Section title="Erzähl von deinem Stück." help="Kurz und ehrlich — Material, Herkunft, was besonders ist. Wenn du festhängst, lass PAWN einen Vorschlag machen; du kannst ihn frei anpassen.">
            <button type="button" onClick={generateText} disabled={autoText}
              className="mb-2 inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> {autoText ? "Copilot schreibt…" : "Text von PAWN"}
            </button>
            <textarea value={local.description ?? ""} onChange={(e) => patch({ description: e.target.value })}
              placeholder="Ein Satz reicht zum Anfangen…"
              className="inp min-h-32" />
          </Section>

          {/* Der Gedanke dahinter */}
          <Section title="Der Gedanke dahinter" help="Warum existiert dieses Stück? Ein persönlicher Satz macht den Unterschied — Menschen kaufen Geschichten.">
            <button type="button" onClick={generateNote} disabled={autoNote}
              className="mb-2 inline-flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-60">
              <Sparkles className="h-3 w-3" /> {autoNote ? "PAWN denkt…" : "Text von PAWN"}
            </button>
            <textarea value={local.designer_note ?? ""} onChange={(e) => patch({ designer_note: e.target.value })}
              placeholder="Erzähl die Geschichte oder Idee dieses Stücks — persönlich, erste Person."
              rows={3}
              className="inp min-h-24" />
            <p className="mt-1 text-[0.62rem] text-muted-foreground">Erscheint auf deiner Produktseite als eigener Abschnitt.</p>
          </Section>

          {/* Details & Maße */}
          <DetailsSection
            local={local}
            patch={patch}
          />

          {/* Inventory */}
          <Section title="Verfügbarkeit" help="Lagerbestand ist gezählt — kann ausverkauft sein. Auf Anfertigung bedeutet: du fertigst nach Bestellung. Beides zusammen ist möglich, wenn du Anfragen erlaubst.">
            <div className="flex flex-col gap-3 sm:flex-row">
              {(["stock","made_to_order"] as InventoryMode[]).map((m) => {
                const active = local.inventory_mode === m;
                return (
                  <button key={m} type="button" onClick={() => patch({ inventory_mode: m })}
                    className={`flex-1 border p-4 text-left ${active ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    <p className="font-serif text-base font-medium">{m === "stock" ? "Ich habe es auf Lager" : "Ich fertige auf Bestellung"}</p>
                    <p className={`mt-1 text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{m === "stock" ? "Feste Stückzahl, wird bei Verkauf gezählt." : "Wird nach Bestellung angefertigt — mit Lieferzeit."}</p>
                  </button>
                );
              })}
            </div>
            {local.inventory_mode === "stock" ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Wie viele hast du auf Lager?" required>
                  <input type="number" min={0} value={local.stock_quantity ?? 0}
                    onChange={(e) => patch({ stock_quantity: Math.max(0, Number(e.target.value)) })}
                    className="inp" />
                </Field>
                <Field label="Gewicht in Gramm (optional)" hint="Hilft uns beim Versand.">
                  <input type="number" min={0} value={local.weight_grams ?? ""}
                    onChange={(e) => patch({ weight_grams: e.target.value ? Number(e.target.value) : null })}
                    className="inp" />
                </Field>
              </div>
            ) : (
              <Field label="Wie viele Tage brauchst du ungefähr?" hint="Ehrliche Angabe — Kunden schätzen Verlässlichkeit mehr als Geschwindigkeit." >
                <input type="number" min={1} value={local.lead_time_days ?? ""}
                  onChange={(e) => patch({ lead_time_days: e.target.value ? Number(e.target.value) : null })}
                  className="inp max-w-[200px]" placeholder="z. B. 14" />
              </Field>
            )}
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" checked={!!local.allow_custom_requests} onChange={(e) => patch({ allow_custom_requests: e.target.checked })} className="mt-1" />
              <span>Kunden dürfen mich zu diesem Stück direkt anfragen (Sonderwunsch, Maß, Farbe).</span>
            </label>
          </Section>

          {/* Größen mit eigenem Bestand */}
          <SizesSection local={local} patch={patch} />

          {/* Material & Pflege */}
          <MaterialSection local={local} patch={patch} />

          {/* Weitere Varianten (Farbe, Format …) */}
          <Section title="Weitere Varianten (optional)" help="Für alles außer Größe — etwa Farbe oder Format. Größen pflegst du oben in der Größentabelle.">
            {(local.variants ?? []).length === 0 && <p className="text-xs text-muted-foreground">Keine weiteren Varianten — passt für Unikate und Editionen.</p>}
            <div className="space-y-3">
              {(local.variants ?? []).map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
                  <Field label="Bezeichnung"><input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} className="inp" /></Field>
                  <Field label="Optionen (mit Komma trennen)"><input value={v.options.join(", ")} onChange={(e) => setVariant(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="inp" /></Field>
                  <button type="button" onClick={() => removeVariant(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">Entf.</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addVariant} className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">+ Variante hinzufügen</button>
          </Section>

          {/* Product DNA — Moleküle */}
          <Section title="DNA deines Stücks" help="Vier kurze Antworten helfen PAWN, dein Stück den richtigen Menschen zu zeigen. Wähle aus der Palette — was fehlt, kannst du in den Tags frei ergänzen." anchorId="dna">
            <ProductDNAEditor
              dna={local.product_dna ?? emptyDNA()}
              world={local.world ?? "Mode"}
              onChange={(dna) => patch({ product_dna: dna })}
            />
          </Section>

          {/* Tags + SKU */}
          <Section title="Details" help={'Tags helfen PAWN, dein Stück zu den richtigen Kunden zu bringen. Tippe los — Vorschläge kommen aus unserer Modewelt-Ontologie und werden normalisiert.'}>
            <Field label="Tags" hint="Enter oder Komma zum Bestätigen">
              <TagInput value={local.tags ?? []} onChange={(v) => patch({ tags: v })} world={local.world} />
            </Field>
            <Field label="SKU (optional)" hint="Deine interne Artikelnummer.">
              <input value={local.sku ?? ""} onChange={(e) => patch({ sku: e.target.value })} className="inp max-w-xs" />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-white px-8 py-4">
          <div className="text-xs text-muted-foreground">
            {!complete && <span>Noch fehlt: {[nameMissing && "Name", priceMissing && "Preis", imageMissing && "Bild", materialMissing && "Material", weightMissing && "Versandgewicht"].filter(Boolean).join(", ")}.</span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="border border-border bg-white px-5 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Abbrechen</button>
            <button onClick={() => { patch({ status: "draft" }); void save(); }} disabled={busy || nameMissing}
              className="border border-border bg-white px-5 py-2 text-[0.68rem] tracking-wide hover:bg-muted disabled:opacity-40">Als Entwurf</button>
            <button onClick={() => { patch({ status: "published" }); void save(); }} disabled={busy || !complete}
              className="border border-foreground bg-foreground px-5 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black disabled:opacity-40">
              {busy ? "…" : "Veröffentlichen"}
            </button>
          </div>
        </div>
      </div>

      {shotResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setShotResult(null)}>
          <div className="w-full max-w-4xl border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-xl">Vorher · Nachher</h3>
              <button onClick={() => setShotResult(null)} aria-label="Schließen" className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={shotResult.source} alt="Original" className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">Original</figcaption>
              </figure>
              <figure className="relative">
                <img src={shotResult.result} alt={shotResult.isTryon ? "KI-Model-Shot" : "Studio-Foto"} className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                {shotResult.isTryon && (
                  <span className="absolute right-2 top-2 border border-foreground bg-white px-2 py-0.5 text-[0.55rem] uppercase tracking-widest">KI-Model</span>
                )}
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">
                  {shotResult.isTryon ? `KI-Model-Shot (${shotResult.style})` : "PAWN Studio-Foto"}
                </figcaption>
                {shotResult.isTryon && (
                  <p className="mt-1 text-[0.62rem] italic text-muted-foreground">{shotDisclosure}</p>
                )}
              </figure>
            </div>
            {shotResult.isTryon && (
              <p className="mt-4 border-l-2 border-foreground bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Prüfe: Sitzt dein Stück exakt? Bei Abweichung bitte neu erzeugen.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setShotResult(null)} className="border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Verwerfen</button>
              {shotResult.isTryon && shotResult.style && (
                <button onClick={() => { const s = shotResult.style as "weiblich"|"männlich"|"divers"; setShotResult(null); void requestTryonShot(s); }}
                  className="border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Neu erzeugen</button>
              )}
              <button
                onClick={() => { patch({ image_url: shotResult.result }); setShotResult(null); toast.success(shotResult.isTryon ? "KI-Model-Shot übernommen." : "Studio-Foto übernommen."); }}
                className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">
                Übernehmen
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
  if (saving) return <span className="text-[0.68rem] text-muted-foreground">Wird gesichert…</span>;
  if (savedAt) return <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground"><Check className="h-3 w-3" /> Gespeichert</span>;
  return null;
}

function Section({ title, help, children, anchorId }: { title: string; help?: string; children: React.ReactNode; anchorId?: string }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <section id={anchorId}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-serif text-lg font-medium">{title}</h3>
        {help && (
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="text-muted-foreground hover:text-foreground" aria-label="Hilfe anzeigen">
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
          Kurze DNA — ein bis zwei Klicks pro Zeile reichen. Kann später ergänzt werden.
        </p>
      )}
      <DNAChipRow label={`Material · mehrfach (${dna.materials.length})`}
        options={materials.length ? materials.map((t) => t.term) : ["baumwolle","leinen","seide","wolle","kaschmir","leder","recycelt"]}
        selected={dna.materials} onToggle={(t) => toggle("materials", t, 6)} />
      <DNAChipRow label={`Silhouette · 1-2 (${dna.silhouette.length}/2)`}
        options={silhouettes.length ? silhouettes.map((t) => t.term) : ["oversized","tailliert","fließend","strukturiert","cropped","column"]}
        selected={dna.silhouette} onToggle={(t) => toggle("silhouette", t, 2)} />
      <DNAChipRow label={`Farbregister · 1-3 (${dna.colors.length}/3)`}
        options={colors.map((t) => t.term)}
        selected={dna.colors} onToggle={(t) => toggle("colors", t, 3)} />
      <DNAChipRow label={`Stimmung · 1-2 (${dna.mood.length}/2)`}
        options={moodOptions}
        selected={dna.mood} onToggle={(t) => toggle("mood", t, 2)} />
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
  const [open, setOpen] = useState(false);
  const filled = [local.length_cm, local.width_cm, local.height_cm, local.care_instructions, local.made_in, local.edition_info]
    .filter((v) => v != null && String(v).trim() !== "").length;
  return (
    <section>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border border-border bg-white px-4 py-3 text-left hover:border-foreground">
        <span className="font-serif text-lg font-medium">Details & Maße {filled > 0 && <span className="ml-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{filled} ausgefüllt</span>}</span>
        <span className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{open ? "Schließen" : "Öffnen"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border border-border bg-white p-5">
          <p className="text-xs text-muted-foreground">Alles optional — je genauer, desto weniger Rückfragen.</p>
          <Field label="Wie groß ist das Stück? (L × B × H in cm)" hint="Nur ausfüllen, was passt.">
            <div className="grid grid-cols-3 gap-2">
              <input type="number" min={0} step="0.1" placeholder="Länge" value={local.length_cm ?? ""}
                onChange={(e) => patch({ length_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
              <input type="number" min={0} step="0.1" placeholder="Breite" value={local.width_cm ?? ""}
                onChange={(e) => patch({ width_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
              <input type="number" min={0} step="0.1" placeholder="Höhe" value={local.height_cm ?? ""}
                onChange={(e) => patch({ height_cm: e.target.value ? Number(e.target.value) : null })} className="inp" />
            </div>
          </Field>
          <Field label="Wie pflegt man es?" hint="z. B. Handwäsche kalt, nicht bügeln.">
            <textarea rows={2} value={local.care_instructions ?? ""} onChange={(e) => patch({ care_instructions: e.target.value })} className="inp" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Wo gefertigt?" hint="Ort oder Land.">
              <input value={local.made_in ?? ""} onChange={(e) => patch({ made_in: e.target.value })} placeholder="z. B. Berlin, Deutschland" className="inp" />
            </Field>
            <Field label="Unikat oder Edition?" hint='z. B. "Unikat" oder "Edition von 8".'>
              <input value={local.edition_info ?? ""} onChange={(e) => patch({ edition_info: e.target.value })} placeholder="Unikat" className="inp" />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Größen mit eigenem Bestand + Maßtabelle ---------- */

function SizesSection({ local, patch }: { local: Partial<ProductRow>; patch: (p: Partial<ProductRow>) => void }) {
  const sizes: SizeVariant[] = local.size_variants ?? [];
  const measurements: Measurements = local.measurements ?? emptyMeasurements();
  const world = local.world ?? "Mode";
  const presets = MEASUREMENT_PRESETS[world] ?? MEASUREMENT_PRESETS.Mode;

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
    <Section title="Größen & Maße" help="Ein Stück kann in mehreren Größen existieren — je Größe eigener Bestand, optional Aufpreis und Artikelnummer. Ausverkaufte Größen sind im Shop nicht wählbar. Die Maßtabelle darunter beantwortet die häufigste Frage vor dem Kauf.">
      {sizes.length === 0
        ? <p className="text-xs text-muted-foreground">Keine Größen — dann gilt der allgemeine Bestand oben. Passt für Unikate.</p>
        : <p className="text-xs text-muted-foreground">Gesamtbestand aus allen Größen: <span className="text-foreground">{total}</span></p>}

      <div className="mt-3 space-y-2">
        {sizes.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2">
            <Field label="Größe"><input value={s.size} onChange={(e) => setSize(i, { size: e.target.value })} placeholder="M" className="inp" /></Field>
            <Field label="Bestand"><input type="number" min={0} value={s.stock} onChange={(e) => setSize(i, { stock: Math.max(0, Number(e.target.value)) })} className="inp" /></Field>
            <Field label="Aufpreis (€)"><input type="number" min={0} step="0.5" value={s.surcharge} onChange={(e) => setSize(i, { surcharge: Number(e.target.value) })} className="inp" /></Field>
            <Field label="SKU"><input value={s.sku ?? ""} onChange={(e) => setSize(i, { sku: e.target.value || null })} className="inp" /></Field>
            <button type="button" onClick={() => removeSize(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">Entf.</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addSize} className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">+ Größe hinzufügen</button>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">Maßtabelle (cm)</p>
        {columns.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Trag zuerst mindestens eine Größe ein — dann kannst du je Größe messen.</p>
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
                      <th className="py-2 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Maß</th>
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
                          <button type="button" onClick={() => removeRow(row)} className="px-2 text-[0.6rem] uppercase tracking-[0.24em] text-destructive">Entf.</button>
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
  const [v, setV] = useState("");
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Eigene Maßzeile" className="inp max-w-xs" />
      <button type="button" onClick={() => { onAdd(v); setV(""); }}
        className="border border-border px-3 py-2 text-[0.62rem] uppercase tracking-[0.24em] hover:border-foreground">Hinzufügen</button>
    </div>
  );
}

/* ---------- Material & Pflege ---------- */

function MaterialSection({ local, patch }: { local: Partial<ProductRow>; patch: (p: Partial<ProductRow>) => void }) {
  const parts: MaterialPart[] = local.material_composition ?? [];
  const care = local.care_symbols ?? [];
  const sum = materialSum(parts);

  const setPart = (i: number, p: Partial<MaterialPart>) => patch({ material_composition: parts.map((m, k) => (k === i ? { ...m, ...p } : m)) });
  const addPart = () => patch({ material_composition: [...parts, { material: "", percent: 0 }] });
  const removePart = (i: number) => patch({ material_composition: parts.filter((_, k) => k !== i) });
  const toggleCare = (key: string) =>
    patch({ care_symbols: care.includes(key) ? care.filter((c) => c !== key) : [...care, key] });

  return (
    <Section title="Material & Pflege" help="Die Zusammensetzung ist Pflicht, damit dein Stück veröffentlicht werden kann — Käufer:innen und Gesetz erwarten sie. Die Summe sollte 100 % ergeben.">
      <div className="space-y-2">
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_auto] items-end gap-2">
            <Field label="Material"><input value={p.material} onChange={(e) => setPart(i, { material: e.target.value })} placeholder="z. B. Wolle" className="inp" /></Field>
            <Field label="Anteil (%)"><input type="number" min={0} max={100} value={p.percent} onChange={(e) => setPart(i, { percent: Number(e.target.value) })} className="inp" /></Field>
            <button type="button" onClick={() => removePart(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">Entf.</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <button type="button" onClick={addPart} className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">+ Material hinzufügen</button>
        {parts.length > 0 && (
          <span className={`text-xs ${sum === 100 ? "text-muted-foreground" : "text-destructive"}`}>
            Summe: {formatRate(sum)} %{sum === 100 ? "" : " — sollte 100 % ergeben."}
          </span>
        )}
      </div>

      <Field label="Futter, Beschläge, Details (optional)">
        <input value={local.lining_hardware ?? ""} onChange={(e) => patch({ lining_hardware: e.target.value })}
          placeholder="z. B. Futter aus Bemberg, Messingknöpfe" className="inp" />
      </Field>

      <div className="mt-4">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">Pflegehinweise</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARE_SYMBOLS.map((c) => {
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

      <Field label="Ergänzung zur Pflege (optional)">
        <textarea rows={2} value={local.care_instructions ?? ""} onChange={(e) => patch({ care_instructions: e.target.value })} className="inp" />
      </Field>

      <Field label="Nachhaltigkeit / Herkunft (optional)" hint="Ein Satz zu Material-Herkunft, Resten, Reparatur.">
        <textarea rows={2} value={local.sustainability_note ?? ""} onChange={(e) => patch({ sustainability_note: e.target.value })} className="inp" />
      </Field>
    </Section>
  );
}
