/**
 * Kampagnen-Studio: eine Arbeitsfläche statt einer Schrittfolge (Teil 13). Links eine
 * durchgehende Vorschau, rechts eine ruhige Spalte mit allen Abschnitten in fester
 * Reihenfolge — jeder immer sichtbar, erst scharf wenn er dran ist, jederzeit frei
 * anspringbar. Kein Weiter/Zurück mehr.
 *
 * Kette bei Video mit Model: Ausgangsfoto → Model-Shot (generate-tryon, fotorealistischer
 * Mensch trägt das Stück) → erst DAS wird zu Bewegung (generate-broll). Ohne Model geht
 * das Ausgangsfoto direkt in die Bewegung — richtig so, wenn niemand darauf zu sehen sein
 * soll. Echte Bewegung ist eine bewusste Wahl (nie stillschweigend Standbilder statt
 * angeforderter Bewegung, Teil 13a) — ohne Entscheidung startet nichts.
 *
 * Video-Clips entstehen roh (Produktion) und werden im selben Zug zu einem Video
 * zusammengesetzt (client-seitig, renderCampaign). Bilder werden ohne Umweg gespeichert.
 * Beides legt eine campaigns-Row mit status='proposed' an — Freigabe passiert auf
 * /studio/kampagnen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderCampaign, blobPreviewUrl, type Tempo, type Format } from "@/features/campaign/renderer";
import { randomSeed } from "@/features/campaign/prng";
import { useCredits, planLabel, type Plan } from "@/features/campaign/quota";
import {
  Check, Upload, Sparkles, Music, Wand2, Shuffle, Image as ImageIcon, Clapperboard,
  ChevronUp, ArrowDown, Download, AlertTriangle, Clock,
} from "lucide-react";

interface ProductLite {
  id: string; name: string; slug: string; world: string;
  image_url: string | null;
}

interface HouseSignature {
  id: string; name: string;
  recipe: { licht?: string; palette?: string; kamerafahrt?: string; schnittrhythmus?: string; typo?: string; musik_tempo?: string; wunsch?: boolean };
}

interface HouseModelRow {
  id: string; name: string;
  ausstrahlung: string | null; altersgruppe: string | null; haar: string | null; hautton: string | null; statur: string | null; freitext: string | null;
}

interface ModelCatalogEntry { id: string; label: string; kind: "image" | "video"; strength: string; credits: number; active: boolean }

interface RecentShot { url: string; at: string }

type OutputType = "bild" | "video";
type ModelMode = "keins" | "beschreiben" | "gespeichert";
/** null = noch keine Entscheidung, "none" = bewusst keine Bewegung, sonst model_catalog-ID. */
type MotionChoice = null | "none" | string;
type DurationS = 5 | 10;

interface UploadedPhoto { url: string; path: string; }

interface DraftContent {
  asset_url: string;
  asset_path: string;
  mime: string;
  caption: string;
  hashtags: string[];
  hook: string;
  prompt: string;
  tempo: Tempo;
  product_id?: string | null;
  image_urls: string[];
}

async function uploadFile(userId: string, file: File | Blob, ext: string): Promise<{ path: string; signedUrl: string }> {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${stamp}.${ext}`;
  const { error: upErr } = await supabase.storage.from("campaign-assets").upload(path, file, {
    contentType: file instanceof File ? file.type : "video/webm",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: signed, error: signErr } = await supabase.storage
    .from("campaign-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed) throw signErr ?? new Error("sign_failed");
  return { path, signedUrl: signed.signedUrl };
}

const ORT_PRESETS = ["Studio, neutral", "Straße", "Natur", "Interieur", "Laufsteg"];
const MOVEMENT_CHIPS = ["Langsame Kamerafahrt", "Kamera fährt näher heran", "Stoff im Wind", "Statisch, Model dreht sich", "Schnelle Schnitte"];

export default function StudioCampaignNew() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { designer, loading } = useMyDesigner();
  const nav = useNavigate();
  const [outputType, setOutputType] = useState<OutputType>("video");

  // Rechte
  const [consentOk, setConsentOk] = useState<boolean | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [mediaRightsGranted, setMediaRightsGranted] = useState<boolean | null>(null);
  const [mediaRightsBusy, setMediaRightsBusy] = useState(false);

  // Material
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [chosenProduct, setChosenProduct] = useState<ProductLite | null>(null);
  const [uploaded, setUploaded] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recentShots, setRecentShots] = useState<RecentShot[]>([]);

  // Freisteller (weißer Hintergrund)
  const [freistellerBusy, setFreistellerBusy] = useState<number | "product" | null>(null);
  const [freistellerPreview, setFreistellerPreview] = useState<{ index: number | "product"; source: string; result: string } | null>(null);
  const [productShotResult, setProductShotResult] = useState<string | null>(null);

  // Besetzung & Ort
  const [modelMode, setModelMode] = useState<ModelMode>("keins");
  const [houseModels, setHouseModels] = useState<HouseModelRow[]>([]);
  const [chosenHouseModelId, setChosenHouseModelId] = useState<string | null>(null);
  const [modelAusstrahlung, setModelAusstrahlung] = useState("");
  const [modelAltersgruppe, setModelAltersgruppe] = useState("");
  const [modelHaar, setModelHaar] = useState("");
  const [modelHautton, setModelHautton] = useState("");
  const [modelStatur, setModelStatur] = useState("");
  const [modelFreitext, setModelFreitext] = useState("");
  const [saveAsHouseModel, setSaveAsHouseModel] = useState(false);
  const [newHouseModelName, setNewHouseModelName] = useState("");
  const [ortPreset, setOrtPreset] = useState<string | null>(null);
  const [ortFreitext, setOrtFreitext] = useState("");
  const [tryonStyle, setTryonStyle] = useState<"weiblich"|"männlich"|"divers">("weiblich");
  const [tryonDisclosure, setTryonDisclosure] = useState<string>("Visualisierung mit KI-Model");

  // Model-Shot (die fehlende Mitte, Teil 13a): Ausgangsfoto → Mensch trägt das Stück.
  const [modelShotUrl, setModelShotUrl] = useState<string | null>(null);
  const [modelShotBusy, setModelShotBusy] = useState(false);
  const [modelShotPreview, setModelShotPreview] = useState<{ source: string; result: string } | null>(null);

  // Video-Text
  const [prompt, setPrompt] = useState("");
  const [tempo, setTempo] = useState<Tempo>("ruhig");
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>([]);
  const [modelCatalogLoaded, setModelCatalogLoaded] = useState(false);

  // Modell & Länge
  const [motionChoice, setMotionChoice] = useState<MotionChoice>(null);
  const [durationS, setDurationS] = useState<DurationS>(5);
  const [stillsAcknowledged, setStillsAcknowledged] = useState(false);
  const [runningModelLabel, setRunningModelLabel] = useState<string | null>(null);

  // Produktion (roh) + Schnitt
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>("video/webm");
  const [format, setFormat] = useState<Format>("9:16");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [cinematicStage, setCinematicStage] = useState<null | "submitting" | "polling" | "ready" | "failed">(null);
  const [cinematicProgress, setCinematicProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [cinematicError, setCinematicError] = useState<string | null>(null);
  const [rawClips, setRawClips] = useState<Array<string | null>>([]);
  const [clipOrder, setClipOrder] = useState<number[]>([]);
  const [includeIntro, setIncludeIntro] = useState(false);
  const [includeOutro, setIncludeOutro] = useState(false);
  const [introText, setIntroText] = useState("");
  const [showLogo, setShowLogo] = useState(false);
  const [sceneSeconds, setSceneSeconds] = useState(2);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const [instagramHandle, setInstagramHandle] = useState<string>("hausofpawn");
  const [savingImage, setSavingImage] = useState(false);

  // Signaturen (der Regisseur)
  const [signatures, setSignatures] = useState<HouseSignature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [chosenSignatureId, setChosenSignatureId] = useState<string | null>(null);
  const [wishName, setWishName] = useState("");
  const [wishPrompt, setWishPrompt] = useState("");
  const [wishBusy, setWishBusy] = useState(false);
  const [lastDurationMs, setLastDurationMs] = useState<number>(0);

  // Credits
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const credits = useCredits(designer?.id, plan, isAdmin);
  const cinematic = typeof motionChoice === "string" && motionChoice !== "none";
  const chosenModelEntry = cinematic ? modelCatalog.find((m) => m.id === motionChoice) ?? null : null;

  // Laden: Rechte, Produkte, Haus-Models, letzte Aufnahmen.
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [{ data: d }, { data: prods }, { data: hm }, { data: shots }] = await Promise.all([
        supabase.from("designers").select("image_usage_consent, media_rights_granted_at").eq("id", designer.id).maybeSingle(),
        supabase.from("products").select("id, name, slug, world, image_url").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("house_models" as never).select("id, name, ausstrahlung, altersgruppe, haar, hautton, statur, freitext").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("product_shot_requests" as never).select("result_url, created_at").eq("designer_id", designer.id).eq("status", "done").order("created_at", { ascending: false }).limit(6),
      ]);
      const dd = d as unknown as { image_usage_consent?: boolean; media_rights_granted_at?: string | null } | null;
      setConsentOk(dd?.image_usage_consent === true);
      setMediaRightsGranted(!!dd?.media_rights_granted_at);
      setProducts((prods ?? []) as ProductLite[]);
      setHouseModels((hm ?? []) as unknown as HouseModelRow[]);
      const shotRows = (shots ?? []) as unknown as Array<{ result_url: string | null; created_at: string }>;
      setRecentShots(shotRows.filter((s) => s.result_url).map((s) => ({ url: s.result_url!, at: s.created_at })));
    })();
  }, [designer]);

  // Modell-Katalog (Teil 11b): Video-Modelle, die der Designer selbst wählen kann.
  useEffect(() => {
    void supabase.from("ai_config").select("value").eq("key", "model_catalog").maybeSingle()
      .then(({ data }) => {
        const all = ((data?.value as unknown as ModelCatalogEntry[] | null) ?? []).filter((m) => m.kind === "video" && m.active);
        setModelCatalog(all);
        setModelCatalogLoaded(true);
      });
  }, []);

  // Signaturen: der Regisseur destilliert sie einmalig beim ersten Öffnen dieser Seite.
  useEffect(() => {
    if (!designer) return;
    setSignaturesLoading(true);
    void supabase.functions.invoke("generate-signatures", { body: { mode: "single" } })
      .then(({ data }) => {
        const r = data as { signatures?: HouseSignature[]; error?: string } | null;
        setSignatures(r?.signatures ?? []);
      })
      .finally(() => setSignaturesLoading(false));
  }, [designer?.id]);

  // Instagram-Handle + Try-On Disclosure aus Config.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle();
      const v = (data as { value?: { instagram?: string } } | null)?.value;
      const raw = v?.instagram?.trim();
      if (raw) setInstagramHandle(raw.replace(/^@/, ""));
    })();
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
      const d = (data as { value?: { shot_disclosure?: string } } | null)?.value?.shot_disclosure;
      if (d) setTryonDisclosure(d);
    })();
  }, []);

  const requestWishSignature = async () => {
    if (!wishName.trim() || !wishPrompt.trim()) { toast.error("Name und Beschreibung ausfüllen."); return; }
    setWishBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signatures", {
        body: { mode: "wish", wish_name: wishName.trim(), wish_prompt: wishPrompt.trim() },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string; message?: string } | null;
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? "Wunsch-Signatur fehlgeschlagen.");
      toast.success("Wunsch-Signatur erzeugt.");
      const { data: refreshed } = await supabase.functions.invoke("generate-signatures", { body: { mode: "single" } });
      setSignatures((refreshed as { signatures?: HouseSignature[] } | null)?.signatures ?? []);
      setWishName(""); setWishPrompt("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWishBusy(false);
    }
  };

  const applySignatureSuggestion = () => {
    const sig = signatures.find((s) => s.id === chosenSignatureId);
    if (!sig?.recipe) return;
    const bits = [sig.recipe.licht, sig.recipe.kamerafahrt, sig.recipe.musik_tempo].filter(Boolean);
    if (bits.length === 0) return;
    setPrompt(bits.join(", "));
  };

  // Besetzung & Ort → Vorschlag für den Video-Text. Wird nie automatisch eingesetzt.
  const composedCastingText = useMemo(() => {
    const parts: string[] = [];
    if (modelMode === "beschreiben") {
      const bits = [modelAusstrahlung, modelAltersgruppe, modelHaar, modelHautton, modelStatur, modelFreitext].filter(Boolean);
      if (bits.length) parts.push(`Model: ${bits.join(", ")}`);
    } else if (modelMode === "gespeichert") {
      const hm = houseModels.find((m) => m.id === chosenHouseModelId);
      if (hm) parts.push(`Model: ${hm.name}`);
    }
    const ort = ortFreitext.trim() || ortPreset;
    if (ort && outputType === "video") parts.push(`Ort: ${ort}`);
    return parts.join(". ");
  }, [modelMode, modelAusstrahlung, modelAltersgruppe, modelHaar, modelHautton, modelStatur, modelFreitext, houseModels, chosenHouseModelId, ortFreitext, ortPreset, outputType]);

  const applyCastingSuggestion = () => {
    if (!composedCastingText) return;
    setPrompt((prev) => [prev, composedCastingText].filter(Boolean).join(". "));
    toast.success("In den Video-Text übernommen.");
  };

  // Ein neuer Besetzungs-Modus oder ein neues Material macht den bisherigen Model-Shot ungültig.
  useEffect(() => { setModelShotUrl(null); }, [modelMode, chosenHouseModelId]);
  // Die Bewegungs-Entscheidung muss neu getroffen werden, wenn sich Besetzung/Ort ändert —
  // sonst könnte eine alte "Keine Bewegung"-Bestätigung eine neue, unpassende Situation stumm übernehmen.
  useEffect(() => { setStillsAcknowledged(false); }, [motionChoice, composedCastingText]);

  const createHouseModel = async () => {
    if (!designer || !newHouseModelName.trim()) { toast.error("Bitte einen Namen für das Haus-Model vergeben."); return; }
    const { data, error } = await supabase.from("house_models" as never).insert({
      designer_id: designer.id, name: newHouseModelName.trim(),
      ausstrahlung: modelAusstrahlung || null, altersgruppe: modelAltersgruppe || null,
      haar: modelHaar || null, hautton: modelHautton || null, statur: modelStatur || null, freitext: modelFreitext || null,
    } as never).select("id, name, ausstrahlung, altersgruppe, haar, hautton, statur, freitext").single();
    if (error) { toast.error(error.message); return; }
    const row = data as unknown as HouseModelRow;
    setHouseModels((prev) => [row, ...prev]);
    setChosenHouseModelId(row.id);
    setModelMode("gespeichert");
    setSaveAsHouseModel(false);
    setNewHouseModelName("");
    toast.success("Haus-Model gespeichert — ab jetzt wiederverwendbar.");
  };

  // Upload handlers
  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    if (chosenProduct) { setChosenProduct(null); setProductShotResult(null); }
    const arr = Array.from(files).slice(0, 4 - uploaded.length);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const f of arr) {
        if (!f.type.startsWith("image/")) continue;
        const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const { path, signedUrl } = await uploadFile(user.id, f, ext);
        setUploaded((prev) => [...prev, { url: signedUrl, path }]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files); };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) void handleFiles(e.target.files); };
  const reuseRecentShot = (url: string) => {
    if (uploaded.length >= 4) { toast.error("Schon 4 Fotos gewählt."); return; }
    if (chosenProduct) { setChosenProduct(null); setProductShotResult(null); }
    setUploaded((prev) => [...prev, { url, path: "" }]);
    toast.success("Aufnahme übernommen.");
  };

  // Rohes Ausgangsmaterial (vor einem möglichen Model-Shot).
  const rawMaterialImage = chosenProduct ? (productShotResult ?? chosenProduct.image_url) : (uploaded[0]?.url ?? null);

  // Was tatsächlich weiterverwendet wird: mit bestätigtem Model-Shot ersetzt der Mensch,
  // der das Stück trägt, alle rohen Fotos (auch wenn mehrere hochgeladen wurden) — genau
  // das schließt die fehlende Mitte, damit Bewegung nie eine Schaufensterpuppe animiert.
  const chosenImages = useMemo(() => {
    if (modelShotUrl) return [modelShotUrl];
    if (chosenProduct?.image_url) return [productShotResult ?? chosenProduct.image_url];
    return uploaded.map((u) => u.url);
  }, [chosenProduct, uploaded, modelShotUrl, productShotResult]);

  useEffect(() => { setClipOrder(chosenImages.map((_, i) => i)); }, [chosenImages.length]);

  const materialReady = chosenImages.length > 0;
  const needsModelShot = modelMode !== "keins" && !modelShotUrl;
  const promptReady = outputType === "bild" || prompt.trim().length > 0;
  const motionDecided = motionChoice !== null;
  const stillsContradiction = motionChoice === "none" && !!composedCastingText;

  // Ask AI for hook/caption/hashtags
  const askAI = async () => {
    if (!designer) return;
    setAiBusy(true);
    try {
      if (chosenProduct) {
        const { data } = await supabase.functions.invoke("studio-ai", {
          body: { mode: "campaign_draft", product_id: chosenProduct.id },
        });
        const r = data as { caption?: string; hashtags?: string[] } | null;
        if (r?.caption) setCaption(r.caption);
        if (r?.hashtags) setHashtags(r.hashtags);
        if (!hook) setHook(prompt.split(/[.!?]/)[0]?.trim().slice(0, 60) || "");
      } else {
        const { data } = await supabase.functions.invoke("studio-ai", {
          body: {
            mode: "chat",
            question: `Entwirf für eine ${outputType === "bild" ? "Bild-" : "Reel-"}Kampagne eine kurze Hook-Zeile (max 6 Wörter), eine Caption (max 2 Sätze) und 4-6 englische Hashtags. Ausgangs-Beschreibung: "${prompt}". Nur JSON zurückgeben: {"hook":"…","caption":"…","hashtags":["#..","#.."]}`,
          },
        });
        const reply = (data as { reply?: string })?.reply ?? "";
        try {
          const m = reply.match(/\{[\s\S]*\}/);
          if (m) {
            const p = JSON.parse(m[0]) as { hook?: string; caption?: string; hashtags?: string[] };
            if (p.hook) setHook(p.hook);
            if (p.caption) setCaption(p.caption);
            if (p.hashtags) setHashtags(p.hashtags);
          }
        } catch { /* keep manual */ }
      }
      toast.success("Vorschläge übernommen — du kannst alles anpassen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  // Freisteller (weißer Hintergrund) — Produktbild oder eigenes Foto.
  const requestFreistellerForProduct = async () => {
    if (!chosenProduct?.id || !chosenProduct.image_url) return;
    setFreistellerBusy("product");
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-shot", {
        body: { product_id: chosenProduct.id, source_url: chosenProduct.image_url },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "Freisteller fehlgeschlagen.");
      setFreistellerPreview({ index: "product", source: chosenProduct.image_url, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg) ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen." : msg || "Fehler");
    } finally {
      setFreistellerBusy(null);
    }
  };

  const requestFreistellerForUpload = async (index: number) => {
    if (!designer) return;
    const photo = uploaded[index];
    if (!photo) return;
    setFreistellerBusy(index);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-shot", {
        body: { designer_id: designer.id, source_url: photo.url },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "Freisteller fehlgeschlagen.");
      setFreistellerPreview({ index, source: photo.url, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg) ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen." : msg || "Fehler");
    } finally {
      setFreistellerBusy(null);
    }
  };

  const acceptFreisteller = () => {
    if (!freistellerPreview) return;
    if (freistellerPreview.index === "product") {
      setProductShotResult(freistellerPreview.result);
    } else {
      setUploaded((prev) => prev.map((u, i) => (i === freistellerPreview.index ? { ...u, url: freistellerPreview.result } : u)));
    }
    toast.success("Neutraler Hintergrund übernommen.");
    setFreistellerPreview(null);
  };

  // Model-Shot: die fehlende Mitte. product_id, falls ein Produkt gewählt ist — sonst
  // designer_id, damit auch ein hochgeladenes Foto (Puppe, Bügel) durchlaufen kann.
  const requestModelShot = async () => {
    if (!designer || !rawMaterialImage) return;
    setModelShotBusy(true);
    try {
      const body: Record<string, unknown> = {
        source_image_url: rawMaterialImage, mode: "shot", model_style: tryonStyle,
        house_model_id: modelMode === "gespeichert" ? chosenHouseModelId ?? undefined : undefined,
      };
      if (chosenProduct?.id) body.product_id = chosenProduct.id; else body.designer_id = designer.id;
      const { data, error } = await supabase.functions.invoke("generate-tryon", { body });
      if (error) { console.error("[generate-tryon] invoke error:", error); throw error; }
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "Model-Shot fehlgeschlagen.");
      setModelShotPreview({ source: rawMaterialImage, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.error("[generate-tryon] failed:", e);
      toast.error(/guthaben|402|credit/i.test(msg) ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen." : msg || "Fehler");
    } finally {
      setModelShotBusy(false);
    }
  };

  const acceptModelShot = () => {
    if (!modelShotPreview) return;
    setModelShotUrl(modelShotPreview.result);
    setModelShotPreview(null);
    toast.success("Model-Shot bestätigt — wird als Material verwendet.");
  };

  const grantConsent = async () => {
    if (!designer || !user) return;
    setConsentBusy(true);
    const { error } = await supabase.from("designers")
      .update({ image_usage_consent: true, image_usage_consent_at: new Date().toISOString() } as never)
      .eq("id", designer.id);
    setConsentBusy(false);
    if (error) return toast.error(error.message);
    setConsentOk(true);
    toast.success("Einwilligung gespeichert.");
  };

  const grantMediaRights = async () => {
    if (!designer || !user) return;
    setMediaRightsBusy(true);
    const { error } = await supabase.from("designers")
      .update({ media_rights_granted_at: new Date().toISOString() } as never)
      .eq("id", designer.id);
    setMediaRightsBusy(false);
    if (error) return toast.error(error.message);
    setMediaRightsGranted(true);
    toast.success("Rechte-Haken gesetzt.");
  };

  // Kosten- und Dauer-Schätzung für die fixierte Kopfzeile.
  const perClipCredits = (chosenModelEntry?.credits ?? credits.costs.clip_standard ?? 5) * (durationS === 10 ? 2 : 1);
  const clipsToProduce = Math.min(chosenImages.length, 3);
  const estimatedCost =
    (needsModelShot ? (credits.costs.tryon_shot ?? 2) : 0) +
    (outputType === "video" && cinematic ? perClipCredits * Math.max(clipsToProduce, 1) : 0);
  const estimatedDurationS = outputType === "video"
    ? (cinematic ? clipsToProduce * durationS : Math.round(chosenImages.length * sceneSeconds))
    : 0;

  // Produktion (roh): erzeugt entweder Standbilder (keine Bewegung) oder echte Clips.
  // Gibt zurück, ob die Produktion erfolgreich war, damit der Aufrufer direkt weiterschneiden kann.
  const produceRaw = async (): Promise<boolean> => {
    if (!designer) return false;
    if (chosenImages.length < 1) { toast.error("Mindestens 1 Bild."); return false; }
    setCinematicError(null);
    const baseImages = chosenImages.slice(0, 4);

    if (!cinematic) {
      setRawClips(baseImages.map(() => null));
      setRunningModelLabel(null);
      return true;
    }

    const inputImages = baseImages.slice(0, 3);
    try {
      const { data: campRow, error: campErr } = await supabase.from("campaigns").insert({
        designer_id: designer.id,
        title: `${designer.brand_name} · Draft`,
        kind: "video",
        status: "draft",
        content: { image_urls: inputImages, cinematic: true } as unknown as Record<string, unknown>,
        created_by: user?.id ?? null,
      } as never).select("id").single();
      if (campErr || !campRow) throw new Error(campErr?.message ?? "Kampagnen-Draft konnte nicht angelegt werden.");
      const campaign_id = (campRow as { id: string }).id;

      setCinematicStage("submitting");
      setCinematicProgress({ done: 0, total: inputImages.length });
      const castingBits = composedCastingText || undefined;
      const { data: submitData, error: submitErr } = await supabase.functions.invoke("generate-broll", {
        body: {
          campaign_id, image_urls: inputImages,
          motion_prompt: [prompt, castingBits].filter(Boolean).join(". "),
          signature_id: chosenSignatureId ?? undefined,
          model_id: motionChoice ?? undefined,
          duration_s: durationS,
        },
      });
      if (submitErr) {
        const msg = submitErr.message ?? String(submitErr);
        setCinematicStage("failed");
        throw new Error(msg.includes("provider_not_configured")
          ? "Echte Bewegung ist nicht eingerichtet (FAL_KEY fehlt)."
          : "Aufnahme konnte nicht gestartet werden. Bitte versuch es gleich noch einmal.");
      }
      const respModel = (submitData as { model?: string } | null)?.model ?? null;
      setRunningModelLabel(chosenModelEntry?.label ?? respModel);

      type SubOK = { id: string; request_id?: string; image_url?: string };
      type SubErr = { image_url: string; error: string; status?: number };
      type Sub = SubOK | SubErr;
      const allSubs = ((submitData as { submissions?: Sub[] })?.submissions ?? []);
      const submissions = allSubs.filter((s): s is SubOK => "id" in s);
      const failedSubs = allSubs.filter((s): s is SubErr => "error" in s);
      if (submissions.length === 0) {
        setCinematicStage("failed");
        const firstErr = failedSubs[0];
        const isPawnCredits = firstErr && /nicht genug credits/i.test(firstErr.error);
        const isFalGuthaben = firstErr && !isPawnCredits && (firstErr.status === 402 || /guthaben|credit|insufficient/i.test(firstErr.error));
        throw new Error(isPawnCredits
          ? firstErr.error
          : isFalGuthaben
            ? "fal.ai-Guthaben fehlt — bitte im fal.ai-Konto Credits aufladen und erneut versuchen."
            : `Provider hat keine Aufträge angenommen: ${firstErr?.error ?? "unbekannter Fehler"}`);
      }

      setCinematicStage("polling");
      const perImageClip = new Map<string, string | null>();
      const idToImage = new Map<string, string>();
      for (const s of submissions) if (s.image_url) idToImage.set(s.id, s.image_url);
      const requestIds = submissions.map((s) => s.id);
      const deadline = Date.now() + 240_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const { data: pollData, error: pollErr } = await supabase.functions.invoke("poll-broll", { body: { request_ids: requestIds } });
        if (pollErr) continue;
        const results = (pollData as { results?: Array<{ id: string; status: string; result_url?: string; error?: string }> })?.results ?? [];
        const doneCount = results.filter((r) => r.status === "done" || r.status === "failed").length;
        setCinematicProgress({ done: doneCount, total: requestIds.length });
        for (const r of results) {
          const img = idToImage.get(r.id);
          if (!img) continue;
          if (r.status === "done" && r.result_url) perImageClip.set(img, r.result_url);
          else if (r.status === "failed") perImageClip.set(img, null);
        }
        if (results.every((r) => r.status === "done" || r.status === "failed")) break;
      }

      const aligned = baseImages.map((img) => (inputImages.includes(img) ? perImageClip.get(img) ?? null : null));
      const successful = aligned.filter((c) => !!c).length;
      if (successful === 0) {
        setCinematicStage("failed");
        throw new Error("Keine der Aufnahmen ist gelungen. Prüfe später erneut oder deaktiviere echte Bewegung.");
      }
      setRawClips(aligned);
      setCinematicStage("ready");
      toast.success(`${successful} von ${inputImages.length} Aufnahmen gelungen.`);
      return true;
    } catch (e) {
      console.error("[produceRaw] failed:", e);
      const msg = (e as Error).message || "Aufnahme fehlgeschlagen.";
      setCinematicError(msg);
      setCinematicStage("failed");
      toast.error(msg);
      return false;
    }
  };

  // Schnitt: setzt die (neu geordneten) rohen Aufnahmen zu einem Video zusammen.
  const composeVideo = async () => {
    if (!designer) return;
    setRenderBusy(true); setRenderPct(0); setVideoBlob(null); setVideoUrl(null);
    try {
      const orderedImages = clipOrder.map((i) => chosenImages[i]);
      const orderedClips = clipOrder.map((i) => rawClips[i] ?? null);
      const sources = orderedImages.map((img, i) => (orderedClips[i] ? { clip: orderedClips[i]!, image: img } : { image: img }));
      const houseNo = (designer as unknown as { house_number?: number | null })?.house_number ?? null;
      const result = await renderCampaign({
        brandName: designer.brand_name,
        houseNumber: houseNo,
        hookLine: introText || hook || null,
        sources,
        tempo,
        productLabel: chosenProduct ? `${chosenProduct.world} · ${designer.brand_name}` : designer.brand_name,
        productName: chosenProduct?.name ?? designer.brand_name,
        format,
        seed,
        instagramHandle,
        showEmblem: showLogo,
        signatureRecipe: signatures.find((s) => s.id === chosenSignatureId)?.recipe ?? null,
        includeIntro,
        includeOutro,
        sceneDurationMsOverride: Math.max(1600, sceneSeconds * 1000),
      }, {
        onProgress: (p) => setRenderPct(Math.round(p.fraction * 100)),
        onCanvas: (c) => {
          if (previewMountRef.current) {
            previewMountRef.current.innerHTML = "";
            c.style.width = "100%";
            c.style.height = "auto";
            c.style.maxHeight = "60vh";
            c.style.background = "#000";
            previewMountRef.current.appendChild(c);
          }
        },
      });
      setVideoBlob(result.blob);
      setVideoMime(result.mimeType);
      setVideoUrl(blobPreviewUrl(result.blob));
      setLastDurationMs(result.durationMs);
      toast.success("Video steht.");
    } catch (e) {
      console.error("[composeVideo] failed:", e);
      toast.error((e as Error).message);
    } finally {
      setRenderBusy(false);
    }
  };

  // Ein Knopf: Produktion und Schnitt laufen im selben Zug.
  const generateVideo = async () => {
    const ok = await produceRaw();
    if (ok) await composeVideo();
  };

  const moveClip = (from: number, dir: -1 | 1) => {
    setClipOrder((prev) => {
      const to = from + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const saveForApproval = async () => {
    if (!designer || !user || !videoBlob) return;
    try {
      const ext = videoMime.includes("mp4") ? "mp4" : "webm";
      const { path, signedUrl } = await uploadFile(user.id, videoBlob, ext);
      const hasModelShot = !!modelShotUrl;
      const finalCaption = hasModelShot && !caption.includes(tryonDisclosure)
        ? `${caption}${caption.trim() ? "\n\n" : ""}${tryonDisclosure}`
        : caption;
      const content: DraftContent = {
        asset_url: signedUrl,
        asset_path: path,
        mime: videoMime,
        caption: finalCaption, hashtags, hook, prompt, tempo,
        product_id: chosenProduct?.id ?? null,
        image_urls: chosenImages,
      };
      const title = chosenProduct
        ? `${chosenProduct.name} · Kampagne`
        : `${designer.brand_name} · Reel`;
      const { data: campRow, error } = await supabase.from("campaigns").insert({
        designer_id: designer.id,
        product_id: chosenProduct?.id ?? null,
        title,
        kind: "video",
        status: "proposed",
        content: { ...content, tryon: hasModelShot } as unknown as Record<string, unknown>,
        created_by: user.id,
      } as never).select("id").single();
      if (error) throw error;

      const rightsGranted = mediaRightsGranted === true;
      const chosenSignature = signatures.find((s) => s.id === chosenSignatureId) ?? null;
      const hookTyp = hook.trim() ? "custom" : chosenProduct ? "product" : "brand";
      const { data: videoAssetRow } = await supabase.from("video_assets").insert({
        designer_id: designer.id,
        campaign_id: (campRow as { id: string } | null)?.id ?? null,
        url: signedUrl,
        source: "designer",
        video_dna: {
          signatur: chosenSignature?.name ?? null,
          hook_typ: hookTyp,
          schnittrhythmus: chosenSignature?.recipe?.schnittrhythmus ?? tempo,
          palette: chosenSignature?.recipe?.palette ?? "standard-mono",
          laenge_s: Math.round(lastDurationMs / 1000),
          modelltyp: cinematic && chosenModelEntry ? chosenModelEntry.id : "editorial-client",
          clip_laenge_s: cinematic ? durationS : null,
          tempo, seed, format, cinematic,
        } as unknown as Record<string, unknown>,
        rights_granted: rightsGranted,
      } as never).select("id").single();
      // Mediathek (Teil 12b): jedes fertige Video landet zusätzlich hier, verlinkt mit video_assets.
      await supabase.from("media_assets" as never).insert({
        designer_id: designer.id, kind: "video", origin: "erzeugt", url: signedUrl,
        title, rights_granted: rightsGranted,
        video_asset_id: (videoAssetRow as { id: string } | null)?.id ?? null,
        campaign_id: (campRow as { id: string } | null)?.id ?? null,
      } as never);

      toast.success("Zur Freigabe gespeichert.");
      nav("/studio/kampagnen");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveImageForApproval = async () => {
    if (!designer || !user) return;
    const hero = chosenImages[0];
    if (!hero) { toast.error("Kein Bild ausgewählt."); return; }
    setSavingImage(true);
    try {
      const hasModelShot = !!modelShotUrl;
      const finalCaption = hasModelShot && !caption.includes(tryonDisclosure)
        ? `${caption}${caption.trim() ? "\n\n" : ""}${tryonDisclosure}`
        : caption;
      const title = chosenProduct ? `${chosenProduct.name} · Bild` : `${designer.brand_name} · Bild`;
      const { data: campRow, error } = await supabase.from("campaigns").insert({
        designer_id: designer.id,
        product_id: chosenProduct?.id ?? null,
        title,
        kind: "post",
        status: "proposed",
        content: {
          asset_url: hero, caption: finalCaption, hashtags, hook,
          product_id: chosenProduct?.id ?? null, tryon: hasModelShot,
        } as unknown as Record<string, unknown>,
        created_by: user.id,
      } as never).select("id").single();
      if (error) throw error;
      await supabase.from("media_assets" as never).insert({
        designer_id: designer.id, kind: "bild", origin: "erzeugt", url: hero, title,
        rights_granted: mediaRightsGranted === true,
        campaign_id: (campRow as { id: string } | null)?.id ?? null,
      } as never);
      toast.success("Zur Freigabe gespeichert.");
      nav("/studio/kampagnen");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingImage(false);
    }
  };

  if (loading) return <StudioShell title="Neue Kampagne"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Neue Kampagne"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const rightsPending = consentOk !== true || mediaRightsGranted !== true;

  // Für den Begleiter: der nächste Abschnitt, der noch Aufmerksamkeit braucht.
  const focusedSection = !materialReady ? "material"
    : needsModelShot ? "besetzung"
    : !promptReady ? "text"
    : (outputType === "video" && !motionDecided) ? "modell"
    : "schnitt";

  const canGenerateVideo = materialReady && !needsModelShot && promptReady && motionDecided
    && (!stillsContradiction || stillsAcknowledged)
    && !(renderBusy || cinematicStage === "submitting" || cinematicStage === "polling");
  const canSaveImage = materialReady && !needsModelShot && !savingImage;

  return (
    <StudioShell title="Neue Kampagne" eyebrow="Kampagnen-Studio" begleiterStep={`${outputType}-${focusedSection}`}>
      {/* Fixierte Kopfzeile: Guthaben, geschätzte Kosten, geschätzte Dauer */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:border sm:px-4">
        <span className="text-sm text-muted-foreground">{planLabel(plan)}-Plan</span>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="tabular-nums font-medium">{credits.balance} / {credits.grant} Credits</span>
          {outputType === "video" && (
            <>
              <span className="text-muted-foreground">Nächster Lauf: <span className="tabular-nums font-medium text-foreground">~{estimatedCost} Cr.</span></span>
              {estimatedDurationS > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> <span className="tabular-nums">{estimatedDurationS}s</span></span>
              )}
            </>
          )}
        </div>
      </div>

      {rightsPending ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="border border-border bg-white p-5">
            <p className="editorial-eyebrow">Bildrechte</p>
            {consentOk === null ? <p className="mt-2 text-sm text-muted-foreground">wird geprüft…</p> :
              <div className="mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">Für Kampagnen brauchen wir deine Einwilligung, dass PAWN deine Produktbilder in Reels und Posts verwenden darf.</p>
                <button onClick={grantConsent} disabled={consentBusy}
                  className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                  {consentBusy ? "Speichere…" : "Ich stimme zu"}
                </button>
              </div>}
          </div>
          <div className="border border-border bg-white p-5">
            <p className="editorial-eyebrow">Medien-Rechte</p>
            {mediaRightsGranted === null ? <p className="mt-2 text-sm text-muted-foreground">wird geprüft…</p> :
              <div className="mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">PAWN darf ausgewählte Videos mit Credit und Verlinkung auf der Plattform und den PAWN-Kanälen zeigen.</p>
                <button onClick={grantMediaRights} disabled={mediaRightsBusy}
                  className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                  {mediaRightsBusy ? "Speichere…" : "Ich stimme zu"}
                </button>
              </div>}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          {/* LINKS — durchgehende Vorschau */}
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="border border-border bg-black p-4">
              {videoUrl ? (
                <video src={videoUrl} controls playsInline className={`mx-auto ${format === "1:1" ? "aspect-square" : "aspect-[9/16]"} w-full max-w-sm bg-black`} />
              ) : renderBusy || cinematicStage === "ready" ? (
                <div ref={previewMountRef} className={`mx-auto ${format === "1:1" ? "aspect-square" : "aspect-[9/16]"} w-full max-w-sm bg-black`} />
              ) : rawClips.some(Boolean) ? (
                <video src={rawClips.find(Boolean)!} muted loop autoPlay playsInline className="mx-auto aspect-square w-full max-w-sm object-cover" />
              ) : chosenImages[0] ? (
                <img src={chosenImages[0]} alt="Material" className="mx-auto aspect-square w-full max-w-sm object-cover" />
              ) : (
                <div className="flex aspect-square w-full max-w-sm items-center justify-center text-sm text-muted-foreground/70">Noch kein Material gewählt.</div>
              )}
            </div>
            {(cinematicStage === "submitting" || cinematicStage === "polling") && (
              <div className="border border-foreground bg-white p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  <span>
                    {cinematicStage === "submitting" && "Übergabe an die Kamera…"}
                    {cinematicStage === "polling" && (
                      <>
                        Aufnahmen entstehen mit „{runningModelLabel ?? "Modell"}" — ca. 1–2 Minuten
                        {cinematicProgress.total > 0 && <span className="ml-2 tabular-nums text-muted-foreground">({cinematicProgress.done}/{cinematicProgress.total} fertig)</span>}
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
            {cinematicStage === "failed" && (
              <div className="flex items-start gap-2 border border-foreground bg-white p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cinematicError ?? "Aufnahme fehlgeschlagen."}</span>
              </div>
            )}
            {rawClips.length > 0 && (
              <div>
                <p className="editorial-eyebrow">Reihenfolge</p>
                <div className="mt-3 space-y-2">
                  {clipOrder.map((idx, pos) => (
                    <div key={idx} className="flex items-center gap-3 border border-border bg-white p-2">
                      <div className="h-12 w-12 shrink-0 border border-border bg-black">
                        {rawClips[idx] ? <video src={rawClips[idx]!} muted className="h-full w-full object-cover" /> : <img src={chosenImages[idx]} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <span className="flex-1 text-sm text-muted-foreground">Aufnahme {pos + 1}</span>
                      <button onClick={() => moveClip(pos, -1)} disabled={pos === 0} className="p-1 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                      <button onClick={() => moveClip(pos, 1)} disabled={pos === clipOrder.length - 1} className="p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(rawClips.some(Boolean) || chosenImages[0]) && (
              <a href={rawClips.find(Boolean) ?? chosenImages[0]} download className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> Rohaufnahmen herunterladen
              </a>
            )}
          </div>

          {/* RECHTS — Abschnitte */}
          <div className="space-y-5">
            {/* 1 — Bild oder Video */}
            <Section n={1} title="Bild oder Video" ready>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setOutputType("bild")}
                  className={`flex min-h-[44px] items-center gap-2 border p-4 text-left transition-colors ${outputType === "bild" ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                  <ImageIcon className="h-4 w-4" /> <span className="font-serif text-base">Bild</span>
                </button>
                <button type="button" onClick={() => setOutputType("video")}
                  className={`flex min-h-[44px] items-center gap-2 border p-4 text-left transition-colors ${outputType === "video" ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                  <Clapperboard className="h-4 w-4" /> <span className="font-serif text-base">Video</span>
                </button>
              </div>
            </Section>

            {/* 2 — Material */}
            <Section n={2} title="Material" ready={materialReady}>
              <p className="editorial-eyebrow">Aus deiner Kollektion</p>
              {products.length === 0 ? (
                <div className="mt-3 border border-border bg-white p-4">
                  <p className="text-sm text-muted-foreground">Noch keine Produkte hinterlegt.</p>
                  <Link to="/studio/produkte" className="mt-3 inline-flex min-h-[40px] items-center border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background">Stück anlegen</Link>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {products.map((p) => (
                    <button key={p.id} onClick={() => { setChosenProduct(p); setUploaded([]); setProductShotResult(null); }}
                      className={`group border p-2 text-left transition-all ${chosenProduct?.id === p.id ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border hover:border-foreground"}`}>
                      <div className="aspect-[4/5] bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition" loading="lazy" />}</div>
                      <p className="mt-2 truncate font-serif text-sm">{p.name}</p>
                    </button>
                  ))}
                </div>
              )}
              {chosenProduct && (
                <button type="button" onClick={requestFreistellerForProduct} disabled={freistellerBusy === "product" || !credits.canAfford(credits.costs.product_shot ?? 1)}
                  className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 border border-foreground bg-white px-3 py-1.5 text-[0.68rem] uppercase tracking-wide hover:bg-foreground hover:text-background disabled:opacity-60">
                  <Sparkles className="h-3 w-3" /> {freistellerBusy === "product" ? "…" : `Freisteller · ${credits.costs.product_shot ?? 1} Credits`}
                </button>
              )}

              <p className="editorial-eyebrow mt-6">Oder eigenes Foto</p>
              <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="mt-3 border-2 border-dashed border-border bg-white p-6 text-center">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm">Zieh 1 bis 4 Fotos hierher, oder wähle sie aus.</p>
                <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                  Fotos auswählen
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
                </label>
                {uploading && <p className="mt-2 text-xs text-muted-foreground">Lade hoch…</p>}
                {uploaded.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {uploaded.map((u, i) => (
                      <div key={i} className="border border-border bg-white p-1">
                        <img src={u.url} alt="" className="aspect-square w-full object-cover grayscale" />
                        <button type="button" onClick={() => requestFreistellerForUpload(i)} disabled={freistellerBusy === i || !credits.canAfford(credits.costs.product_shot ?? 1)}
                          className="mt-1 flex min-h-[32px] w-full items-center justify-center gap-1.5 border border-foreground bg-white px-2 py-1 text-[0.6rem] uppercase tracking-wide hover:bg-foreground hover:text-background disabled:opacity-60">
                          <Sparkles className="h-3 w-3" /> {freistellerBusy === i ? "…" : `Freisteller · ${credits.costs.product_shot ?? 1} Cr.`}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {recentShots.length > 0 && (
                <>
                  <p className="editorial-eyebrow mt-6">Zuletzt erzeugt</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {recentShots.map((s, i) => (
                      <button key={i} type="button" onClick={() => reuseRecentShot(s.url)} className="group relative h-16 w-16 border border-border hover:border-foreground">
                        <img src={s.url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[0.55rem] uppercase tracking-widest text-transparent group-hover:bg-black/60 group-hover:text-white">Nutzen</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* 3 — Besetzung & Ort */}
            <Section n={3} title="Besetzung & Ort" ready={!needsModelShot}>
              <p className="editorial-eyebrow">Model</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {([
                  { v: "keins" as const, l: "Kein Model" },
                  { v: "beschreiben" as const, l: "Model beschreiben" },
                  { v: "gespeichert" as const, l: "Gespeichertes Haus-Model" },
                ]).map((o) => (
                  <button key={o.v} onClick={() => setModelMode(o.v)}
                    className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${modelMode === o.v ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    {o.l}
                  </button>
                ))}
              </div>

              {modelMode === "beschreiben" && (
                <div className="mt-4 grid gap-4 border border-border bg-white p-4 sm:grid-cols-2">
                  <label className="block"><span className="editorial-eyebrow">Ausstrahlung</span>
                    <input value={modelAusstrahlung} onChange={(e) => setModelAusstrahlung(e.target.value)} placeholder="z. B. selbstbewusst, warm" className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">Altersgruppe</span>
                    <input value={modelAltersgruppe} onChange={(e) => setModelAltersgruppe(e.target.value)} placeholder="z. B. jung, mittleres Alter" className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">Haar</span>
                    <input value={modelHaar} onChange={(e) => setModelHaar(e.target.value)} placeholder="z. B. kurz, dunkel" className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">Hautton</span>
                    <input value={modelHautton} onChange={(e) => setModelHautton(e.target.value)} placeholder="z. B. hell, olivfarben" className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">Statur</span>
                    <input value={modelStatur} onChange={(e) => setModelStatur(e.target.value)} placeholder="z. B. schlank, athletisch" className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block sm:col-span-2"><span className="editorial-eyebrow">Freitext</span>
                    <textarea value={modelFreitext} onChange={(e) => setModelFreitext(e.target.value)} rows={2} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <p className="text-xs text-muted-foreground sm:col-span-2 border-l-2 border-foreground pl-3">
                    Nur erfundene Beschreibungen, keine realen Personen oder Prominenten.
                  </p>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={saveAsHouseModel} onChange={(e) => setSaveAsHouseModel(e.target.checked)} />
                      Als Haus-Model speichern — dasselbe Gesicht dann bei jeder Kampagne wiederverwendbar
                    </label>
                    {saveAsHouseModel && (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input value={newHouseModelName} onChange={(e) => setNewHouseModelName(e.target.value)} placeholder="Name (z. B. Unser Studio-Model)" className="flex-1 border border-border bg-background p-2 text-sm" />
                        <button type="button" onClick={createHouseModel} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background">Speichern</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modelMode === "gespeichert" && (
                houseModels.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Noch kein Haus-Model gespeichert — beschreibe zuerst eins und speichere es.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {houseModels.map((hm) => (
                      <button key={hm.id} onClick={() => setChosenHouseModelId(hm.id)}
                        className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenHouseModelId === hm.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {hm.name}
                      </button>
                    ))}
                  </div>
                )
              )}

              {modelMode !== "keins" && (
                <div className="mt-4 border border-border bg-white p-4">
                  <p className="editorial-eyebrow">Model-Shot</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aus deinem Foto entsteht ein Foto deines Stücks an einem fotorealistischen Menschen — erst das wird zur Bewegung, nicht die Schaufensterpuppe oder der Bügel.
                    Kostet {credits.costs.tryon_shot ?? 2} Credits — du hast {credits.balance}.
                  </p>
                  <p className="mt-1 text-[0.62rem] italic text-muted-foreground">{tryonDisclosure}</p>
                  {!rawMaterialImage && <p className="mt-2 text-sm text-muted-foreground">Wähle zuerst Material oben.</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(["weiblich","männlich","divers"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setTryonStyle(s)} disabled={modelShotBusy}
                        className={`min-h-[36px] border px-3 py-1 text-[0.68rem] ${tryonStyle === s ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                    <button type="button" onClick={requestModelShot} disabled={modelShotBusy || !rawMaterialImage || !credits.canAfford(credits.costs.tryon_shot ?? 2)}
                      className="min-h-[40px] border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] uppercase tracking-widest text-background disabled:opacity-60">
                      {modelShotBusy ? "PAWN arbeitet…" : modelShotUrl ? "Neu erzeugen" : `Model-Shot erzeugen · ${credits.costs.tryon_shot ?? 2} Credits`}
                    </button>
                  </div>
                  {modelShotUrl && (
                    <div className="mt-4 flex items-center gap-4">
                      <img src={modelShotUrl} alt="Model-Shot" className="h-24 w-24 border border-foreground object-cover" />
                      <div className="flex-1 text-xs">
                        <span className="inline-block border border-foreground bg-white px-2 py-0.5 text-[0.55rem] uppercase tracking-widest">Bestätigt</span>
                        <p className="mt-2 text-muted-foreground">Wird als Material verwendet.</p>
                        <button type="button" onClick={() => setModelShotUrl(null)} className="mt-2 text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground">Verwerfen</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {outputType === "video" && (
                <>
                  <p className="editorial-eyebrow mt-6">Ort</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ORT_PRESETS.map((o) => (
                      <button key={o} onClick={() => setOrtPreset(o === ortPreset ? null : o)}
                        className={`min-h-[36px] border px-3 py-1.5 text-[0.68rem] tracking-wide ${ortPreset === o ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                  <input value={ortFreitext} onChange={(e) => setOrtFreitext(e.target.value)} placeholder="Oder eigener Ort in Worten" className="mt-3 w-full border border-border bg-white p-2 text-sm" />
                </>
              )}

              {composedCastingText && (
                <div className="mt-4 border border-border bg-white p-4">
                  <p className="editorial-eyebrow">Vorschlag für den Video-Text</p>
                  <p className="mt-2 text-sm text-muted-foreground">{composedCastingText}</p>
                  <button type="button" onClick={applyCastingSuggestion} className="mt-3 min-h-[36px] border border-border bg-white px-3 py-1.5 text-[0.62rem] uppercase tracking-wide hover:border-foreground">
                    In den Video-Text übernehmen
                  </button>
                </div>
              )}
            </Section>

            {/* 4 — Video-Text */}
            <Section n={4} title="Video-Text" ready={promptReady}>
              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder={outputType === "bild" ? "z. B. klar, warm, für den Alltag" : "z. B. langsame Kamerafahrt von links nach rechts, Stoff schwingt leicht im Wind, ruhiges Tempo"}
                className="min-h-32 w-full border border-border bg-white p-4 text-base"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {outputType === "bild"
                  ? "Beschreib in deinen Worten, wie das Bild wirken soll — PAWN nutzt das für Caption und Hashtags."
                  : "Beschreib die Bewegung, nicht die Werbebotschaft: Kamera (fahrt, schwenk, statisch), Tempo, Stoffverhalten. Kein Marketing-Text."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(outputType === "bild" ? ["Klar · reduziert", "Warm · persönlich", "Editorial · direkt"] : MOVEMENT_CHIPS).map((chip) => (
                  <button key={chip} onClick={() => setPrompt((prev) => (outputType === "bild" ? chip : [prev, chip].filter(Boolean).join(", ")))}
                    className="min-h-[36px] border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">
                    {chip}
                  </button>
                ))}
              </div>

              {outputType === "video" && (
                <>
                  <p className="editorial-eyebrow mt-6">Tempo</p>
                  <div className="mt-3 flex gap-3">
                    {(["ruhig", "spannungsvoll"] as Tempo[]).map((t) => (
                      <button key={t} onClick={() => setTempo(t)}
                        className={`min-h-[44px] border px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] ${tempo === t ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <p className="editorial-eyebrow mt-6">Signatur</p>
                  {signaturesLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground">Der Regisseur denkt nach…</p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setChosenSignatureId(null)}
                          className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenSignatureId === null ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                          Standard
                        </button>
                        {signatures.map((s) => (
                          <button key={s.id} onClick={() => setChosenSignatureId(s.id)}
                            className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenSignatureId === s.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                            {s.name}{s.recipe?.wunsch ? " ✦" : ""}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <p className="text-xs text-muted-foreground">Dein Stil-Rezept aus Licht, Kamerafahrt und Schnittrhythmus — vom Regisseur aus deiner Brand-DNA destilliert.</p>
                        {chosenSignatureId && (
                          <button type="button" onClick={applySignatureSuggestion} className="min-h-[32px] shrink-0 border border-border bg-white px-3 py-1 text-[0.62rem] uppercase tracking-wide hover:border-foreground">
                            Vorschlag ins Textfeld übernehmen
                          </button>
                        )}
                      </div>
                      {plan === "maison" && (
                        <div className="mt-4 border border-border bg-white p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">Wunsch-Signatur</p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input value={wishName} onChange={(e) => setWishName(e.target.value)} placeholder="Name" className="border border-border bg-background p-2 text-sm sm:w-40" />
                            <input value={wishPrompt} onChange={(e) => setWishPrompt(e.target.value)} placeholder="Beschreibung (Stimmung, Licht, Tempo …)" className="flex-1 border border-border bg-background p-2 text-sm" />
                            <button onClick={requestWishSignature} disabled={wishBusy} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background disabled:opacity-50">
                              {wishBusy ? "…" : "Anfragen"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <p className="editorial-eyebrow">PAWN schreibt mit</p>
                  <button onClick={askAI} disabled={aiBusy || !prompt.trim()} className="flex min-h-[36px] items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-background disabled:opacity-40">
                    <Sparkles className="h-3 w-3" /> {aiBusy ? "…" : "Vorschlag"}
                  </button>
                </div>
                {outputType === "video" && (
                  <label className="mt-4 block"><span className="editorial-eyebrow">Hook (Intro-Zeile, optional)</span>
                    <input value={hook} onChange={(e) => setHook(e.target.value)} maxLength={60} className="mt-2 w-full border border-border bg-background p-2 text-sm" /></label>
                )}
                <label className="mt-4 block"><span className="editorial-eyebrow">Caption</span>
                  <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-2 min-h-24 w-full border border-border bg-background p-2 text-sm" /></label>
                <label className="mt-4 block"><span className="editorial-eyebrow">Hashtags</span>
                  <input value={hashtags.join(" ")} onChange={(e) => setHashtags(e.target.value.split(/\s+/).filter(Boolean))} className="mt-2 w-full border border-border bg-background p-2 text-sm" /></label>
              </div>
            </Section>

            {/* 5 — Modell & Länge (nur Video) */}
            {outputType === "video" && (
              <Section n={5} title="Modell & Länge" ready={motionDecided}>
                <p className="editorial-eyebrow">Echte Bewegung (statt Standbildern)</p>
                <p className="mt-2 text-sm text-muted-foreground">Eine bewusste Wahl — PAWN erzeugt nie stillschweigend ein Standbild-Reel, wenn Bewegung erwartet wird.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setMotionChoice("none")}
                    className={`min-h-[44px] border px-4 py-2 text-left text-[0.7rem] uppercase tracking-[0.18em] ${motionChoice === "none" ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    Keine Bewegung
                  </button>
                  {modelCatalog.map((m) => {
                    const affordable = credits.canAfford(m.credits * (durationS === 10 ? 2 : 1));
                    return (
                      <button key={m.id} disabled={!affordable} onClick={() => setMotionChoice(m.id)}
                        className={`min-h-[44px] border px-4 py-2 text-left text-[0.7rem] uppercase tracking-[0.18em] disabled:opacity-40 ${motionChoice === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {m.label} · {m.credits * (durationS === 10 ? 2 : 1)} Cr.
                      </button>
                    );
                  })}
                </div>
                {modelCatalogLoaded && modelCatalog.length === 0 && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Echte Bewegung ist gerade nicht eingerichtet — kein Video-Modell aktiv im Katalog. Es entstehen Standbilder.
                  </p>
                )}
                {cinematic && chosenModelEntry && (
                  <p className="mt-2 text-xs text-muted-foreground">„{chosenModelEntry.label}" ({chosenModelEntry.strength}) — {chosenModelEntry.credits * (durationS === 10 ? 2 : 1)} Credits pro Foto, du hast {credits.balance}.</p>
                )}

                {cinematic && (
                  <>
                    <p className="editorial-eyebrow mt-6">Länge je Aufnahme</p>
                    <div className="mt-3 flex gap-2">
                      {([5, 10] as DurationS[]).map((d) => (
                        <button key={d} onClick={() => setDurationS(d)}
                          className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${durationS === d ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                          {d}s {d === 10 ? "· doppelte Credits" : ""}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {stillsContradiction && (
                  <div className="mt-4 border border-foreground bg-white p-4">
                    <p className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      Du hast eine Besetzung oder einen Ort angegeben, aber „Keine Bewegung" gewählt — das Ergebnis wird ein Standbild-Reel ohne Bewegung.
                    </p>
                    <button type="button" onClick={() => setStillsAcknowledged(true)} disabled={stillsAcknowledged}
                      className="mt-3 min-h-[36px] border border-foreground bg-foreground px-3 py-1.5 text-[0.62rem] uppercase tracking-wide text-background disabled:opacity-50">
                      {stillsAcknowledged ? "Bestätigt — Standbilder" : "Ja, als Standbilder fortfahren"}
                    </button>
                  </div>
                )}
              </Section>
            )}

            {/* 6 — Schnitt (nur Video, optional) */}
            {outputType === "video" && (
              <Section n={6} title="Schnitt (optional)" ready={videoBlob != null}>
                <p className="editorial-eyebrow">Format</p>
                <div className="mt-3 flex gap-2">
                  {(["9:16", "1:1"] as Format[]).map((f) => (
                    <button key={f} onClick={() => setFormat(f)} className={`min-h-[44px] border px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] ${format === f ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {f === "9:16" ? "Reel · 9:16" : "Feed · 1:1"}
                    </button>
                  ))}
                </div>

                <p className="editorial-eyebrow mt-4">Länge je Einstellung im Schnitt</p>
                <input type="range" min={1} max={4} step={0.5} value={sceneSeconds} onChange={(e) => setSceneSeconds(Number(e.target.value))} className="w-full" />
                <p className="text-xs text-muted-foreground tabular-nums">{sceneSeconds.toFixed(1)}s pro Einstellung</p>

                <p className="editorial-eyebrow mt-4">Intro & Abspann</p>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeIntro} onChange={(e) => setIncludeIntro(e.target.checked)} /> Intro-Karte mit Textzeile</label>
                {includeIntro && <input value={introText} onChange={(e) => setIntroText(e.target.value)} placeholder="Textzeile für die Intro-Karte" className="w-full border border-border bg-white p-2 text-sm" />}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeOutro} onChange={(e) => setIncludeOutro(e.target.checked)} /> Abspann-Karte</label>
                {includeOutro && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> PAWN-Logo im Abspann zeigen</label>}

                {videoBlob && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => { setSeed(randomSeed()); void composeVideo(); }} className="flex min-h-[40px] items-center gap-2 border border-border bg-white px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-muted">
                      <Shuffle className="h-3 w-3" /> Neu schneiden
                    </button>
                  </div>
                )}
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Music className="mt-0.5 h-3 w-3 shrink-0" /> Bewusst ohne Ton: Musik wählst du direkt in Reels oder TikTok — dort ist sie lizenzsicher.
                </p>
              </Section>
            )}

            {/* Erzeugen / Speichern */}
            <div className="border border-foreground bg-white p-5">
              {outputType === "bild" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    1 Bild wird für deinen Post übernommen — {modelShotUrl ? "als Model-Shot" : productShotResult ? "mit neutralem Studio-Hintergrund" : "so, wie hochgeladen"}.
                  </p>
                  <button onClick={saveImageForApproval} disabled={!canSaveImage}
                    className="mt-4 flex min-h-[44px] items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                    {savingImage ? "Speichert…" : "Zur Freigabe speichern"}
                  </button>
                </>
              ) : videoBlob ? (
                <>
                  <p className="text-sm">Fertig. Sieh dir das Ergebnis links an.</p>
                  <button onClick={saveForApproval} className="mt-4 min-h-[44px] border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background">
                    Zur Freigabe speichern
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {chosenImages.length} Foto{chosenImages.length === 1 ? "" : "s"} werden zu einem Video —
                    {cinematic ? ` echte Bewegung mit „${chosenModelEntry?.label ?? "Modell"}", ${durationS}s je Aufnahme, ~${estimatedCost} Credits.` : " als ruhige Standbilder, ohne Credits."}
                  </p>
                  {needsModelShot && <p className="mt-2 text-sm text-foreground">Bestätige zuerst den Model-Shot oben, bevor die Bewegung startet.</p>}
                  {!motionDecided && <p className="mt-2 text-sm text-foreground">Wähle zuerst bei „Modell & Länge", ob eine echte Bewegung entstehen soll.</p>}
                  <button onClick={generateVideo} disabled={!canGenerateVideo}
                    className="mt-4 flex min-h-[44px] items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                    {renderBusy ? `PAWN schneidet… ${renderPct}%` : cinematicStage === "submitting" || cinematicStage === "polling" ? "PAWN nimmt auf…" : "Erzeugen"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Freisteller: Vorher/Nachher */}
      {freistellerPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setFreistellerPreview(null)}>
          <div className="w-full max-w-3xl border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-xl">Vorher · Nachher</h3>
              <button onClick={() => setFreistellerPreview(null)} aria-label="Schließen" className="rounded p-1 hover:bg-muted">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={freistellerPreview.source} alt="Original" className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">Original</figcaption>
              </figure>
              <figure>
                <img src={freistellerPreview.result} alt="Freisteller" className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">Neutraler Hintergrund</figcaption>
              </figure>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setFreistellerPreview(null)} className="min-h-[40px] border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Verwerfen</button>
              <button onClick={acceptFreisteller} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">Übernehmen</button>
            </div>
          </div>
        </div>
      )}

      {/* Model-Shot: Vorher/Nachher */}
      {modelShotPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setModelShotPreview(null)}>
          <div className="w-full max-w-3xl border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-xl">Model-Shot</h3>
              <button onClick={() => setModelShotPreview(null)} aria-label="Schließen" className="rounded p-1 hover:bg-muted">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={modelShotPreview.source} alt="Ausgangsfoto" className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">Ausgangsfoto</figcaption>
              </figure>
              <figure>
                <img src={modelShotPreview.result} alt="Model-Shot" className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">Model-Shot</figcaption>
              </figure>
            </div>
            <p className="mt-4 text-xs italic text-muted-foreground">{tryonDisclosure}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setModelShotPreview(null)} className="min-h-[40px] border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">Verwerfen</button>
              <button onClick={acceptModelShot} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">Übernehmen</button>
            </div>
          </div>
        </div>
      )}
    </StudioShell>
  );
}

function Section({ n, title, ready, children }: { n: number; title: string; ready: boolean; children: React.ReactNode }) {
  return (
    <section className={`border border-border bg-white p-5 transition-opacity ${ready ? "opacity-100" : "opacity-70"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[0.68rem] ${ready ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
          {ready ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <p className="editorial-eyebrow">{title}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
