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
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCredits, type Plan } from "@/features/campaign/quota";
import { Upload, ArrowRight } from "lucide-react";

type World = "Mode" | "Interior" | "Kunst";
const WORLD_LABEL: Record<World, string> = { Mode: "Mode", Interior: "Interior", Kunst: "Kunst" };

interface StagingTemplate {
  id: string; label: string; description?: string; prompt: string;
  preview_url?: string; credits: number; active?: boolean; groessenbezug?: boolean;
}
interface StagingResult { template_id: string; label: string; result_url: string | null; error: string | null; media_asset_id: string | null }
const ART_LABEL: Record<string, string> = {
  kleidung: "Kleidung", keramik: "Keramik", malerei: "Malerei/Grafik", skulptur: "Skulptur",
  moebel: "Möbel", schmuck: "Schmuck", textil: "Textil", objekt: "Objekt", sonstiges: "Sonstiges",
};
const ART_ORDER = Object.keys(ART_LABEL);

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
  const { user, hasRole } = useAuth();
  const { designer, loading } = useMyDesigner();
  const [searchParams] = useSearchParams();
  const existingProductId = searchParams.get("product");

  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const credits = useCredits(designer?.id, plan, hasRole("admin"));

  // Minimal-Formular — nur für ein frisches Stück ohne ?product=.
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [world, setWorld] = useState<World>("Mode");
  const [size, setSize] = useState("");
  const [story, setStory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [product, setProduct] = useState<LiveProduct | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!existingProductId);

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
    () => (art ? (stagingTemplatesAll[art] ?? []).filter((t) => t.active !== false) : []),
    [art, stagingTemplatesAll],
  );
  const totalCredits = useMemo(
    () => templatesForArt.filter((t) => selectedIds.includes(t.id)).reduce((s, t) => s + (t.credits ?? 0), 0),
    [templatesForArt, selectedIds],
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

  useEffect(() => { if (art) setSelectedIds(templatesForArt.map((t) => t.id)); }, [art, templatesForArt]);

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
      if (!r?.ok && !r?.results?.length) throw new Error(r?.message ?? r?.error ?? "Inszenierung fehlgeschlagen.");
      setResults(r.results ?? []);
      void credits.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStagingBusy(false);
    }
  };

  const onPickPhoto = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) { toast.error("Bitte ein Bild wählen."); return; }
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
    if (!name.trim() || name.trim().length < 2) { toast.error("Bitte gib deinem Stück einen Namen."); return; }
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) { toast.error("Bitte einen Preis eintragen."); return; }
    if (!sourceUrl) { toast.error("Bitte zuerst ein Foto hochladen."); return; }
    setBusy(true);
    try {
      const description = [story.trim(), size.trim() ? `Größe: ${size.trim()}` : null].filter(Boolean).join("\n\n") || null;
      const slug = `${slugify(designer.brand_name)}-${slugify(name)}-${Date.now().toString(36)}`;
      const { data, error } = await supabase.from("products").insert({
        designer_id: designer.id, name: name.trim(), slug, price: priceNum, world, description,
        image_url: sourceUrl, status: "published",
      }).select("id, name, slug, price, image_url").single();
      if (error) throw error;
      setProduct(data as LiveProduct);
      toast.success("Stück ist live.");
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
      toast.success("Als Produktbild übernommen.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading || loadingExisting) return <StudioShell title="Neues Stück"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Neues Stück"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;
  if (existingProductId && !product) return <StudioShell title="Neues Stück"><p className="text-muted-foreground">Stück nicht gefunden.</p></StudioShell>;

  const photoUploader = (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="border border-dashed border-border p-8 text-center">
      {sourceUrl ? <img src={sourceUrl} alt="" className="mx-auto max-h-64 w-auto object-contain" /> : <Upload className="mx-auto h-6 w-6 text-muted-foreground" />}
      <p className="mt-3 text-sm">{sourceUrl ? "Anderes Foto wählen" : "Zieh dein Foto hierher, oder wähle es aus."}</p>
      <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
        {uploading ? "Lädt…" : "Datei wählen"}
        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && onPickPhoto(e.target.files[0])} />
      </label>
    </div>
  );

  return (
    <StudioShell title="Neues Stück" eyebrow="Vom Foto zum kaufbaren Stück">
      <div className="mx-auto max-w-2xl">
        {!product ? (
          <>
            <p className="editorial-eyebrow">Foto</p>
            <div className="mt-2">{photoUploader}</div>

            <p className="editorial-eyebrow mt-8">Das Stück</p>
            <div className="mt-2 space-y-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name deines Stücks"
                className="w-full border border-border bg-white p-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="Preis in €"
                  className="border border-border bg-white p-3 text-sm" />
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Maße oder Größe"
                  className="border border-border bg-white p-3 text-sm" />
              </div>
              <div className="flex gap-2">
                {(["Mode", "Interior", "Kunst"] as World[]).map((w) => (
                  <button key={w} type="button" onClick={() => setWorld(w)}
                    className={`flex-1 border p-2 text-sm ${world === w ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
                    {WORLD_LABEL[w]}
                  </button>
                ))}
              </div>
              <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="Ein Satz Geschichte" rows={2}
                className="w-full border border-border bg-white p-3 text-sm" />
            </div>

            <button onClick={createProduct} disabled={busy}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 border border-foreground bg-foreground px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
              {busy ? "Legt an…" : "Stück ist live"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">Alles Weitere — Beschreibung, Maße im Detail, Varianten — kannst du jederzeit in deiner Kollektion ergänzen.</p>
          </>
        ) : (
          <>
            <div className="border-[1.5px] border-foreground bg-white p-6">
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Stück ist live</p>
              <div className="mt-3 flex items-center gap-4">
                {product.image_url && <img src={product.image_url} alt="" className="h-20 w-20 object-cover" />}
                <div>
                  <p className="font-serif text-xl">{product.name}</p>
                  <p className="text-sm text-muted-foreground">€ {product.price.toLocaleString("de-DE")}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`/product/${product.slug}`} className="border border-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">Zum Stück ansehen</Link>
                <Link to="/studio/produkte" className="border border-border px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-muted">Zur Kollektion</Link>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-8">
              <p className="editorial-eyebrow">Bild verbessern (optional)</p>
              {!sourceUrl && <div className="mt-3">{photoUploader}</div>}
              {detectBusy && <p className="mt-3 text-sm text-muted-foreground">PAWN sieht sich das Foto an…</p>}
              {fotoHinweis && <p className="mt-3 border-l-2 border-foreground pl-3 text-sm text-muted-foreground">{fotoHinweis}</p>}
              {sourceUrl && !detectBusy && (
                <div className="mt-3">
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">Art{ambiguous ? " — bitte bestätigen" : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ART_ORDER.map((a) => (
                      <button key={a} type="button" onClick={() => setArt(a)}
                        className={`min-h-[32px] border px-3 py-1 text-[0.62rem] tracking-wide ${art === a ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {ART_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {art && templatesForArt.length > 0 && (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {templatesForArt.map((t) => (
                      <label key={t.id} className={`flex cursor-pointer gap-3 border p-3 ${selectedIds.includes(t.id) ? "border-foreground" : "border-border"}`}>
                        <input type="checkbox" className="mt-1" checked={selectedIds.includes(t.id)} onChange={() => toggleTemplate(t.id)} />
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            {t.preview_url ? (
                              <img src={t.preview_url} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-border text-[0.5rem] text-muted-foreground">Beispiel folgt</div>
                            )}
                            <div>
                              <p className="text-sm font-medium">{t.label}</p>
                              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                            </div>
                          </div>
                          <p className="mt-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">{t.credits} Credits</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedIds.length === 0 ? "Wähle mindestens eine Variante." : `Dieser Lauf kostet ${totalCredits} Credits, dauert etwa 20–40 Sekunden für ${selectedIds.length} Varianten.`}
                    </p>
                    <button type="button" onClick={() => void runStaging()}
                      disabled={stagingBusy || selectedIds.length === 0 || !credits.canAfford(totalCredits)}
                      className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                      {stagingBusy ? "PAWN inszeniert…" : "Inszenierung starten"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Die Inszenierung ändert nur Umgebung, Licht und Blickwinkel — Form, Farbe, Material und Zustand des Stücks bleiben, wie sie sind.
                  </p>
                </>
              )}
              {results && (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">Ergebnis</p>
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
                                Als Produktbild übernehmen
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex aspect-square items-center justify-center p-2 text-center text-[0.62rem] text-muted-foreground">{r.error ?? "Fehlgeschlagen"}</div>
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
    </StudioShell>
  );
}
