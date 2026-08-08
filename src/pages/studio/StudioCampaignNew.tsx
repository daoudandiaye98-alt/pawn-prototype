/**
 * Kampagnen-Studio: eine ruhige, gestufte Arbeitsfläche (Teil 13c). Links eine
 * durchgehende Vorschau, rechts eine kurze Hauptfolge — Was entsteht → Material →
 * Model → Bewegung & Qualität — mit Caption/Bildsprache/Schnitt in einem geschlossenen
 * "Feinschliff", statt vieler gleichrangiger Boxen. Ein einziger Handlungsknopf.
 * Der Ask-PAWN-Begleiter erklärt je Abschnitt; hier steht nur das Nötigste.
 *
 * Kette bei Model: Ausgangsfoto → Model-Shot (generate-tryon, Nano-Banana-2-Basis +
 * fotorealistischer Mensch trägt das Stück) → erst DAS wird zu Bewegung (Kling, via
 * generate-broll). Das Rohfoto geht nie direkt ins Video, wenn ein Model gewählt ist.
 * Video bedeutet immer Bewegung — die Wahl zwischen Bild und Video oben entscheidet
 * das schon; eine Modellstufe ist vorausgewählt (die im Katalog als default markierte).
 * Katalog-Einträge mit active:false oder intern:true erscheinen nirgends, auch nicht
 * als Fallback.
 *
 * Bewegung (Teil 14a): die Bewegungs-Bausteine (MOVEMENT_CHIPS) zeigen ein deutsches
 * Label, tragen aber echte Kamerasprache (dolly-in, push-in, …), die strukturiert in
 * den an generate-broll gesendeten Prompt gefaltet wird — nicht als deutscher Fließtext
 * angehängt. "Bewegungsstärke" steuert Klings cfg_scale (0-1, aus ai_config.video_provider).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { renderCampaign, blobPreviewUrl, type Tempo, type Format } from "@/features/campaign/renderer";
import { randomSeed } from "@/features/campaign/prng";
import { usePlanQuota, planLabel, formatQuota, quotaExhaustedHint, type Plan } from "@/features/campaign/quota";
import {
  Check, Upload, Sparkles, Music, Wand2, Shuffle, Image as ImageIcon, Clapperboard,
  ChevronUp, ChevronDown, ArrowDown, Download, AlertTriangle, Clock,
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

interface ModelCatalogEntry {
  id: string; label: string; kind: "bild" | "video"; strength: string; credits: number;
  active: boolean; default?: boolean; intern?: boolean; dauer_hinweis?: string;
}

interface HouseSettingRow {
  id: string; name: string;
  ort: string | null; licht: string | null; stimmung: string | null; palette: string | null;
  referenzbilder: string[]; quelle: string;
}

interface CulturalCurrentLite {
  id: string; name: string; worlds: string[]; nahe_haeuser: string[];
  visuelle_merkmale: Record<string, string> | null;
}

interface RecentShot { url: string; at: string }
interface ModelPool { weiblich: string[]; männlich: string[]; divers: string[] }

interface StagingTemplate {
  id: string; label: string; description?: string; prompt: string;
  preview_url?: string; credits: number; active?: boolean; groessenbezug?: boolean;
}
interface StagingResult { template_id: string; label: string; result_url: string | null; error: string | null; media_asset_id: string | null }
// Werte sind i18n-Schlüssel (Teil 25) — an Renderstellen mit t(ART_LABEL[a]) auflösen.
const ART_LABEL: Record<string, string> = {
  kleidung: "studio.campaignNew.art.kleidung", keramik: "studio.campaignNew.art.keramik",
  malerei: "studio.campaignNew.art.malerei", skulptur: "studio.campaignNew.art.skulptur",
  moebel: "studio.campaignNew.art.moebel", schmuck: "studio.campaignNew.art.schmuck",
  textil: "studio.campaignNew.art.textil", objekt: "studio.campaignNew.art.objekt", sonstiges: "studio.campaignNew.art.sonstiges",
};
const ART_ORDER = Object.keys(ART_LABEL);

type OutputType = "bild" | "video";
type ModelMode = "keins" | "beschreiben" | "gespeichert" | "pawn_pool";
/** null = noch keine Entscheidung, sonst model_catalog-ID. Video heißt immer Bewegung. */
type MotionChoice = null | string;
type DurationS = 5 | 10;
type TryonStyle = "weiblich" | "männlich" | "divers";

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

// Werte sind i18n-Schlüssel (Teil 25) — an Renderstellen mit t(...) auflösen. ortPreset
// speichert also fortan den Schlüssel, nicht mehr das deutsche Wort selbst.
const ORT_PRESETS = [
  "studio.campaignNew.ort.studio", "studio.campaignNew.ort.strasse", "studio.campaignNew.ort.natur",
  "studio.campaignNew.ort.interieur", "studio.campaignNew.ort.laufsteg",
];
/** "label" ist ein i18n-Schlüssel fürs Studio, "camera" ist die echte Kamerasprache fürs Modell
 * (Teil 14a) — die Bausteine werden nicht als Fließtext angehängt, sondern strukturiert in den
 * Prompt gefaltet. */
const MOVEMENT_CHIPS: { id: string; label: string; camera: string }[] = [
  { id: "dolly_in", label: "studio.campaignNew.movement.dollyIn", camera: "slow dolly-in, the camera drifts smoothly toward the subject" },
  { id: "push_close", label: "studio.campaignNew.movement.pushClose", camera: "steady push-in, the frame gradually tightens on the garment" },
  { id: "fabric_wind", label: "studio.campaignNew.movement.fabricWind", camera: "a light breeze moves through the fabric, hem and sleeves drifting and settling" },
  { id: "orbit_static", label: "studio.campaignNew.movement.orbitStatic", camera: "the camera holds a static frame while the model turns slowly, revealing the garment from every side" },
  { id: "energetic", label: "studio.campaignNew.movement.energetic", camera: "brisk, energetic movement with a lively rhythm" },
];
// Schlüssel bleiben deutsche Wörter (dezent/spürbar/ausdrucksstark) — sie sind mit
// ai_config.video_provider.cfg_scale_options verzahnt (Vergleichswerte, s. state). Nur die
// Werte hier (Anzeige-Label) sind i18n-Schlüssel.
const MOVEMENT_STRENGTH_LABEL: Record<string, string> = {
  dezent: "studio.campaignNew.strength.dezent", spürbar: "studio.campaignNew.strength.spuerbar", ausdrucksstark: "studio.campaignNew.strength.ausdrucksstark",
};
const MODE_LABEL: Record<ModelMode, string> = {
  pawn_pool: "studio.campaignNew.mode.pawnPool", beschreiben: "studio.campaignNew.mode.beschreiben",
  gespeichert: "studio.campaignNew.mode.gespeichert", keins: "studio.campaignNew.mode.keins",
};
// Anzeige-Label für tryonStyle — die Werte "weiblich"/"männlich"/"divers" selbst bleiben
// unverändert (gehen als model_style an generate-tryon und sind DB-Schlüssel im Model-Pool).
const TRYON_STYLE_LABEL: Record<TryonStyle, string> = {
  weiblich: "studio.campaignNew.tryonStyle.weiblich", männlich: "studio.campaignNew.tryonStyle.maennlich", divers: "studio.campaignNew.tryonStyle.divers",
};
// Anzeige-Label für Tempo — die Werte "ruhig"/"spannungsvoll" bleiben unverändert (Tempo-Typ
// des Renderers, s. features/campaign/renderer.ts).
const TEMPO_LABEL: Record<Tempo, string> = { ruhig: "studio.campaignNew.tempo.ruhig", spannungsvoll: "studio.campaignNew.tempo.spannungsvoll" };

export default function StudioCampaignNew() {
  const { t, locale } = useI18n();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { designer, loading } = useMyDesigner();
  const nav = useNavigate();
  const [outputType, setOutputType] = useState<OutputType>("bild");

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

  // Teil 16c: jedes erzeugte Bild bekommt ein Ziel — ein Stück, oder wenn keins
  // gewählt ist, ein kurzer Zweck ("wofür wirbt das?").
  const [advertisesText, setAdvertisesText] = useState("");

  // Freisteller (weißer Hintergrund)
  const [freistellerBusy, setFreistellerBusy] = useState<number | "product" | null>(null);
  const [freistellerPreview, setFreistellerPreview] = useState<{ index: number | "product"; source: string; result: string } | null>(null);
  const [productShotResult, setProductShotResult] = useState<string | null>(null);

  // Model
  const [modelMode, setModelMode] = useState<ModelMode | null>(null);
  const [modelModeTouched, setModelModeTouched] = useState(false);
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
  const [tryonStyle, setTryonStyle] = useState<TryonStyle>("weiblich");
  const [tryonDisclosure, setTryonDisclosure] = useState<string>("Visualisierung mit KI-Model");
  const [modelPool, setModelPool] = useState<ModelPool>({ weiblich: [], männlich: [], divers: [] });
  const [chosenPoolImageUrl, setChosenPoolImageUrl] = useState<string | null>(null);

  // Model-Shot (die fehlende Mitte): Ausgangsfoto → Mensch trägt das Stück.
  const [modelShotUrl, setModelShotUrl] = useState<string | null>(null);
  const [modelShotBusy, setModelShotBusy] = useState(false);
  const [modelShotPreview, setModelShotPreview] = useState<{ source: string; result: string } | null>(null);
  const [bildModelId, setBildModelId] = useState<string | null>(null);

  // Bewegung & Qualität
  const [ortPreset, setOrtPreset] = useState<string | null>(null);
  const [ortFreitext, setOrtFreitext] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tempo, setTempo] = useState<Tempo>("ruhig");
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogEntry[]>([]);
  const [modelCatalogLoaded, setModelCatalogLoaded] = useState(false);
  const [motionChoice, setMotionChoice] = useState<MotionChoice>(null);
  const [durationS, setDurationS] = useState<DurationS>(5);
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
  const [movementStrength, setMovementStrength] = useState<string>("spürbar");
  const [cfgScaleOptions, setCfgScaleOptions] = useState<Record<string, number>>({ dezent: 0.35, spürbar: 0.5, ausdrucksstark: 0.65 });
  const [runningModelLabel, setRunningModelLabel] = useState<string | null>(null);
  const [runningModelDauer, setRunningModelDauer] = useState<string | null>(null);

  // DNA-Vorschlag & Settings (Teil 14c)
  const [culturalCurrents, setCulturalCurrents] = useState<CulturalCurrentLite[]>([]);
  const [houseSettings, setHouseSettings] = useState<HouseSettingRow[]>([]);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [newSettingName, setNewSettingName] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);

  // Inszenierungs-Dienst (Teil 16a): der neue Bild-Weg — Art erkennen, passende Varianten
  // anbieten, mehrere zugleich erzeugen.
  const [stagingTemplatesAll, setStagingTemplatesAll] = useState<Record<string, StagingTemplate[]>>({});
  const [stagingSourceUrl, setStagingSourceUrl] = useState<string | null>(null);
  const [stagingDetectBusy, setStagingDetectBusy] = useState(false);
  const [stagingDetectTried, setStagingDetectTried] = useState(false);
  const [stagingArt, setStagingArt] = useState<string | null>(null);
  const [stagingAmbiguous, setStagingAmbiguous] = useState(false);
  const [stagingFotoHinweis, setStagingFotoHinweis] = useState<string | null>(null);
  const [stagingSelectedIds, setStagingSelectedIds] = useState<string[]>([]);
  const [stagingBusy, setStagingBusy] = useState(false);
  const [stagingResults, setStagingResults] = useState<StagingResult[] | null>(null);

  // Feinschliff (geschlossen per Default)
  const [feinschliffOpen, setFeinschliffOpen] = useState(false);
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [chosenSignatureId, setChosenSignatureId] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<HouseSignature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [wishName, setWishName] = useState("");
  const [wishPrompt, setWishPrompt] = useState("");
  const [wishBusy, setWishBusy] = useState(false);
  const [format, setFormat] = useState<Format>("9:16");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [includeIntro, setIncludeIntro] = useState(false);
  const [includeOutro, setIncludeOutro] = useState(false);
  const [introText, setIntroText] = useState("");
  const [showLogo, setShowLogo] = useState(false);
  const [sceneSeconds, setSceneSeconds] = useState(2);
  const [clipOrder, setClipOrder] = useState<number[]>([]);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const [instagramHandle, setInstagramHandle] = useState<string>("hausofpawn");
  const [lastDurationMs, setLastDurationMs] = useState<number>(0);

  // Produktion (roh) + Schnitt
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>("video/webm");
  const [cinematicStage, setCinematicStage] = useState<null | "submitting" | "polling" | "ready" | "delayed" | "failed">(null);
  const [cinematicProgress, setCinematicProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [cinematicError, setCinematicError] = useState<string | null>(null);
  const [rawClips, setRawClips] = useState<Array<string | null>>([]);
  const [savingImage, setSavingImage] = useState(false);

  // Credits
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = usePlanQuota(designer?.id, plan, isAdmin);
  const videoModels = useMemo(() => modelCatalog.filter((m) => m.kind === "video"), [modelCatalog]);
  const bildModels = useMemo(() => modelCatalog.filter((m) => m.kind === "bild"), [modelCatalog]);
  const chosenModelEntry = videoModels.find((m) => m.id === motionChoice) ?? null;
  const chosenBildEntry = bildModels.find((m) => m.id === bildModelId) ?? null;
  const poolHasAny = Object.values(modelPool).some((arr) => arr.length > 0);
  const recommendedMode: ModelMode = poolHasAny ? "pawn_pool" : "beschreiben";

  // Laden: Rechte, Produkte, Haus-Models, letzte Aufnahmen.
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [{ data: d }, { data: prods }, { data: hm }, { data: shots }, { data: settings }, { data: currents }] = await Promise.all([
        supabase.from("designers").select("image_usage_consent, media_rights_granted_at").eq("id", designer.id).maybeSingle(),
        supabase.from("products").select("id, name, slug, world, image_url").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("house_models" as never).select("id, name, ausstrahlung, altersgruppe, haar, hautton, statur, freitext").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("product_shot_requests" as never).select("result_url, created_at").eq("designer_id", designer.id).eq("status", "done").order("created_at", { ascending: false }).limit(6),
        supabase.from("house_settings" as never).select("id, name, ort, licht, stimmung, palette, referenzbilder, quelle").eq("designer_id", designer.id).order("created_at", { ascending: false }),
        supabase.from("cultural_currents" as never).select("id, name, worlds, nahe_haeuser, visuelle_merkmale").limit(30),
      ]);
      const dd = d as unknown as { image_usage_consent?: boolean; media_rights_granted_at?: string | null } | null;
      setConsentOk(dd?.image_usage_consent === true);
      setMediaRightsGranted(!!dd?.media_rights_granted_at);
      setProducts((prods ?? []) as ProductLite[]);
      setHouseModels((hm ?? []) as unknown as HouseModelRow[]);
      const shotRows = (shots ?? []) as unknown as Array<{ result_url: string | null; created_at: string }>;
      setRecentShots(shotRows.filter((s) => s.result_url).map((s) => ({ url: s.result_url!, at: s.created_at })));
      setHouseSettings((settings ?? []) as unknown as HouseSettingRow[]);
      setCulturalCurrents((currents ?? []) as unknown as CulturalCurrentLite[]);
    })();
  }, [designer]);

  // Modell-Katalog (video + bild) und PAWN-Model-Galerie.
  useEffect(() => {
    void supabase.from("ai_config").select("value").eq("key", "model_catalog").maybeSingle()
      .then(({ data }) => {
        const all = ((data?.value as unknown as ModelCatalogEntry[] | null) ?? []).filter((m) => m.active !== false && !m.intern);
        setModelCatalog(all);
        setModelCatalogLoaded(true);
      });
    void supabase.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as { model_pool?: Partial<ModelPool>; shot_disclosure?: string } | null) ?? null;
        if (v?.model_pool) setModelPool({ weiblich: v.model_pool.weiblich ?? [], männlich: v.model_pool.männlich ?? [], divers: v.model_pool.divers ?? [] });
        if (v?.shot_disclosure) setTryonDisclosure(v.shot_disclosure);
      });
    void supabase.from("ai_config").select("value").eq("key", "video_provider").maybeSingle()
      .then(({ data }) => {
        const v = (data?.value as { cfg_scale_options?: Record<string, number>; cfg_scale_default?: string } | null) ?? null;
        if (v?.cfg_scale_options) setCfgScaleOptions((prev) => ({ ...prev, ...v.cfg_scale_options }));
        if (v?.cfg_scale_default) setMovementStrength(v.cfg_scale_default);
      });
    void supabase.from("ai_config").select("value").eq("key", "staging_templates").maybeSingle()
      .then(({ data }) => setStagingTemplatesAll((data?.value as unknown as Record<string, StagingTemplate[]> | null) ?? {}));
  }, []);

  const toggleMovementChip = (id: string) => {
    setSelectedMovementIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Standardwahl, sobald der Katalog da ist — nie stillschweigend "keine Bewegung",
  // solange ein echtes Modell aktiv ist. Nur wenn der Katalog wirklich leer ist,
  // bleibt es bei der ehrlichen "nicht eingerichtet"-Anzeige.
  useEffect(() => {
    if (!modelCatalogLoaded || motionChoice !== null) return;
    const def = videoModels.find((m) => m.default) ?? videoModels[0];
    if (def) setMotionChoice(def.id);
  }, [modelCatalogLoaded, videoModels, motionChoice]);

  useEffect(() => {
    if (!modelCatalogLoaded || bildModelId !== null) return;
    const def = bildModels.find((m) => m.default) ?? bildModels[0];
    if (def) setBildModelId(def.id);
  }, [modelCatalogLoaded, bildModels, bildModelId]);

  // Model-Mode: sobald die Galerie geladen ist, wird der empfohlene Weg (PAWN-Model,
  // sonst Model beschreiben) vorbelegt — "Kein Model" ist gleichwertig wählbar, aber
  // nicht länger der schwarz hervorgehobene Standard.
  useEffect(() => {
    if (modelModeTouched || modelMode !== null) return;
    setModelMode(recommendedMode);
  }, [modelModeTouched, modelMode, recommendedMode]);

  const setModelModeUser = (m: ModelMode) => { setModelModeTouched(true); setModelMode(m); };

  // Bildsprachen: der Regisseur destilliert sie einmalig beim ersten Öffnen dieser Seite.
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

  // Instagram-Handle aus Config.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle();
      const v = (data as { value?: { instagram?: string } } | null)?.value;
      const raw = v?.instagram?.trim();
      if (raw) setInstagramHandle(raw.replace(/^@/, ""));
    })();
  }, []);

  const requestWishSignature = async () => {
    if (!wishName.trim() || !wishPrompt.trim()) { toast.error(t("studio.campaignNew.toast.wishFillFields")); return; }
    setWishBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signatures", {
        body: { mode: "wish", wish_name: wishName.trim(), wish_prompt: wishPrompt.trim() },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string; message?: string } | null;
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? t("studio.campaignNew.error.wishSignatureFailed"));
      toast.success(t("studio.campaignNew.toast.wishSignatureCreated"));
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
      if (bits.length) parts.push(t("studio.campaignNew.casting.model", { value: bits.join(", ") }));
    } else if (modelMode === "gespeichert") {
      const hm = houseModels.find((m) => m.id === chosenHouseModelId);
      if (hm) parts.push(t("studio.campaignNew.casting.model", { value: hm.name }));
    } else if (modelMode === "pawn_pool" && chosenPoolImageUrl) {
      parts.push(t("studio.campaignNew.casting.model", { value: `${t("studio.campaignNew.casting.pawnModel")} (${t(TRYON_STYLE_LABEL[tryonStyle])})` }));
    }
    const ortValue = ortFreitext.trim() || (ortPreset ? t(ortPreset) : "");
    if (ortValue && outputType === "video") parts.push(t("studio.campaignNew.casting.location", { value: ortValue }));
    return parts.join(". ");
  }, [modelMode, modelAusstrahlung, modelAltersgruppe, modelHaar, modelHautton, modelStatur, modelFreitext, houseModels, chosenHouseModelId, chosenPoolImageUrl, tryonStyle, ortFreitext, ortPreset, outputType, t]);

  // DNA-Vorschlag (Teil 14c): liest Brand-DNA + nahestehende Kulturströmung und schlägt
  // Ort und Bewegung vor — sichtbar begründet, der Designer entscheidet, ob er übernimmt.
  const dnaSuggestion = useMemo(() => {
    const brandDna = (designer as unknown as { brand_dna?: { worlds?: Record<string, number>; signals?: string[] } } | null)?.brand_dna;
    const signals = brandDna?.signals ?? [];
    if (!signals.length) return null;
    const lower = signals.map((s) => s.toLowerCase());
    const has = (...words: string[]) => words.some((w) => lower.some((s) => s.includes(w)));

    // "ort" bleibt ein i18n-Schlüssel (aus ORT_PRESETS) — applyDnaSuggestion übergibt ihn
    // unverändert an setOrtPreset; erst bei der Anzeige (summary) wird er übersetzt.
    let ort: string | null = null;
    if (has("minimal", "reduziert", "editorial", "klar")) ort = "studio.campaignNew.ort.studio";
    else if (has("urban", "street", "stadt")) ort = "studio.campaignNew.ort.strasse";
    else if (has("natur", "organisch", "roh")) ort = "studio.campaignNew.ort.natur";
    else if (has("wohnlich", "interieur", "häuslich", "heimelig")) ort = "studio.campaignNew.ort.interieur";

    let movementId = "push_close";
    let strength = "spürbar";
    if (has("ruhig", "reduziert", "zurückhaltend", "minimal")) { movementId = "dolly_in"; strength = "dezent"; }
    else if (has("dynamisch", "energetisch", "laut", "kontrast")) { movementId = "energetic"; strength = "ausdrucksstark"; }

    const designerWorlds = Object.keys(brandDna?.worlds ?? {});
    const matchingCurrent = culturalCurrents.find((c) => c.nahe_haeuser.includes(designer?.id ?? ""))
      ?? culturalCurrents.find((c) => (c.worlds ?? []).some((w) => designerWorlds.includes(w)));

    const topSignals = signals.slice(0, 2).join(` ${t("studio.campaignNew.dna.and")} `);
    const movementLabelKey = MOVEMENT_CHIPS.find((m) => m.id === movementId)?.label;
    const movementLabel = movementLabelKey ? t(movementLabelKey) : movementId;
    const reason = [
      t("studio.campaignNew.dna.reasonBase", { signals: topSignals }),
      matchingCurrent ? t("studio.campaignNew.dna.reasonCurrent", { name: matchingCurrent.name }) : null,
    ].filter(Boolean).join(" ");
    const summary = [ort ? t(ort) : null, movementLabel].filter(Boolean).join(", ");

    return { ort, movementId, strength, reason, summary, currentName: matchingCurrent?.name ?? null };
  }, [designer, culturalCurrents, t]);

  const applyDnaSuggestion = () => {
    if (!dnaSuggestion) return;
    if (dnaSuggestion.ort) setOrtPreset(dnaSuggestion.ort);
    setSelectedMovementIds((prev) => Array.from(new Set([...prev, dnaSuggestion.movementId])));
    setMovementStrength(dnaSuggestion.strength);
    setSuggestionDismissed(true);
    toast.success(t("studio.campaignNew.toast.dnaApplied"));
    // Damit das Werkbuch (Teil 19a) zeigen kann, was die DNA tatsächlich bewirkt hat.
    if (user) {
      void supabase.from("domain_events").insert({
        type: "designer.dna_suggestion_accepted",
        actor: user.id,
        payload: { reason: dnaSuggestion.reason, summary: dnaSuggestion.summary, current_name: dnaSuggestion.currentName },
      } as never);
    }
  };

  const applyHouseSetting = (s: HouseSettingRow) => {
    if (s.ort) { setOrtFreitext(s.ort); setOrtPreset(null); }
    if (s.stimmung) setPrompt((prev) => (prev.trim() ? prev : s.stimmung!));
  };

  const saveHouseSetting = async () => {
    if (!designer || !newSettingName.trim()) { toast.error(t("studio.campaignNew.toast.nameRequired")); return; }
    setSavingSetting(true);
    try {
      const { data, error } = await supabase.from("house_settings" as never).insert({
        designer_id: designer.id, name: newSettingName.trim(),
        ort: ortFreitext.trim() || ortPreset || null, stimmung: prompt.trim() || null,
        licht: null, palette: null, referenzbilder: chosenImages.slice(0, 3),
        quelle: "manuell",
      } as never).select("id, name, ort, licht, stimmung, palette, referenzbilder, quelle").single();
      if (error) throw error;
      setHouseSettings((prev) => [data as unknown as HouseSettingRow, ...prev]);
      setNewSettingName("");
      toast.success(t("studio.campaignNew.toast.settingSaved"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSetting(false);
    }
  };

  // Ein neuer Besetzungs-Modus oder ein neues Material macht den bisherigen Model-Shot ungültig.
  useEffect(() => { setModelShotUrl(null); }, [modelMode, chosenHouseModelId, chosenPoolImageUrl]);
  useEffect(() => { setChosenPoolImageUrl(null); }, [tryonStyle]);

  const createHouseModel = async () => {
    if (!designer || !newHouseModelName.trim()) { toast.error(t("studio.campaignNew.toast.houseModelNameRequired")); return; }
    const { data, error } = await supabase.from("house_models" as never).insert({
      designer_id: designer.id, name: newHouseModelName.trim(),
      ausstrahlung: modelAusstrahlung || null, altersgruppe: modelAltersgruppe || null,
      haar: modelHaar || null, hautton: modelHautton || null, statur: modelStatur || null, freitext: modelFreitext || null,
    } as never).select("id, name, ausstrahlung, altersgruppe, haar, hautton, statur, freitext").single();
    if (error) { toast.error(error.message); return; }
    const row = data as unknown as HouseModelRow;
    setHouseModels((prev) => [row, ...prev]);
    setChosenHouseModelId(row.id);
    setModelModeUser("gespeichert");
    setSaveAsHouseModel(false);
    setNewHouseModelName("");
    toast.success(t("studio.campaignNew.toast.houseModelSaved"));
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
    if (uploaded.length >= 4) { toast.error(t("studio.campaignNew.toast.maxPhotos")); return; }
    if (chosenProduct) { setChosenProduct(null); setProductShotResult(null); }
    setUploaded((prev) => [...prev, { url, path: "" }]);
    toast.success(t("studio.campaignNew.toast.shotAdopted"));
  };

  // Rohes Ausgangsmaterial (vor einem möglichen Model-Shot).
  const rawMaterialImage = chosenProduct ? (productShotResult ?? chosenProduct.image_url) : (uploaded[0]?.url ?? null);

  // Was tatsächlich weiterverwendet wird: mit bestätigtem Model-Shot ersetzt der Mensch,
  // der das Stück trägt, alle rohen Fotos — genau das schließt die fehlende Mitte.
  const chosenImages = useMemo(() => {
    if (modelShotUrl) return [modelShotUrl];
    if (chosenProduct?.image_url) return [productShotResult ?? chosenProduct.image_url];
    return uploaded.map((u) => u.url);
  }, [chosenProduct, uploaded, modelShotUrl, productShotResult]);

  useEffect(() => { setClipOrder(chosenImages.map((_, i) => i)); }, [chosenImages.length]);

  // Inszenierungs-Dienst (Teil 16a): sobald ein Ausgangsfoto feststeht, wird die Art einmal
  // automatisch erkannt — mit einem Griff korrigierbar, nie erzwungen.
  const stagingTemplatesForArt = useMemo(
    () => (stagingArt ? (stagingTemplatesAll[stagingArt] ?? []).filter((t) => t.active !== false) : []),
    [stagingArt, stagingTemplatesAll],
  );

  useEffect(() => {
    const source = chosenImages[0] ?? null;
    if (source === stagingSourceUrl) return;
    setStagingSourceUrl(source);
    setStagingDetectTried(false);
    setStagingArt(null);
    setStagingAmbiguous(false);
    setStagingFotoHinweis(null);
    setStagingSelectedIds([]);
    setStagingResults(null);
  }, [chosenImages, stagingSourceUrl]);

  useEffect(() => {
    if (outputType !== "bild" || !designer || !stagingSourceUrl || stagingDetectTried || stagingDetectBusy) return;
    setStagingDetectTried(true);
    setStagingDetectBusy(true);
    void supabase.functions.invoke("detect-object", { body: { designer_id: designer.id, source_url: stagingSourceUrl } })
      .then(({ data }) => {
        const r = data as { ok?: boolean; art?: string; ambiguous?: boolean; foto_hinweis?: string | null } | null;
        if (r?.ok && r.art) {
          setStagingArt(r.art);
          setStagingAmbiguous(r.ambiguous === true);
          setStagingFotoHinweis(r.foto_hinweis ?? null);
        }
      })
      .catch(() => { /* fällt still auf die manuelle Art-Auswahl zurück */ })
      .finally(() => setStagingDetectBusy(false));
  }, [outputType, designer, stagingSourceUrl, stagingDetectTried, stagingDetectBusy]);

  // Sobald eine Art feststeht (erkannt oder gewählt), sind alle ihre Varianten vorbelegt —
  // ein Lauf erzeugt standardmäßig alle passenden Inszenierungen zugleich.
  useEffect(() => {
    if (stagingArt) setStagingSelectedIds(stagingTemplatesForArt.map((t) => t.id));
  }, [stagingArt, stagingTemplatesForArt]);

  const toggleStagingTemplate = (id: string) => {
    setStagingSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const runStaging = async () => {
    if (!designer || !stagingSourceUrl || !stagingArt || stagingSelectedIds.length === 0) return;
    setStagingBusy(true);
    setStagingResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-staging-shot", {
        body: {
          designer_id: designer.id, product_id: chosenProduct?.id ?? null,
          source_url: stagingSourceUrl, art: stagingArt, template_ids: stagingSelectedIds,
        },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; results?: StagingResult[]; message?: string; error?: string } | null;
      if (!r?.ok && !r?.results?.length) throw new Error(r?.message ?? r?.error ?? t("studio.campaignNew.error.stagingFailed"));
      setStagingResults(r.results ?? []);
      void quota.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStagingBusy(false);
    }
  };

  const adoptStagingResult = async (result: StagingResult, productId: string) => {
    if (!result.result_url || !productId) return;
    try {
      const { error } = await supabase.from("products").update({ image_url: result.result_url }).eq("id", productId);
      if (error) throw error;
      if (result.media_asset_id) {
        await supabase.from("media_assets" as never).update({
          usages: [{ type: "produkt", product_id: productId }],
          product_id: productId,
        } as never).eq("id", result.media_asset_id);
      }
      toast.success(t("studio.campaignNew.toast.stagingAdopted"));
    } catch (e) {
      toast.error((e as Error).message || t("studio.campaignNew.error.generic"));
    }
  };

  const materialReady = chosenImages.length > 0;
  const needsModelShot = modelMode !== null && modelMode !== "keins" && !modelShotUrl;
  const promptReady = outputType === "bild" || prompt.trim().length > 0;
  const motionDecided = motionChoice !== null;
  // Teil 16c: kein Medium ohne Ziel — entweder ein Stück, oder ein kurzer Zweck-Satz.
  const hasTarget = !!chosenProduct || advertisesText.trim().length > 0;

  // Ask AI for hook/caption/hashtags
  const askAI = async () => {
    if (!designer) return;
    setAiBusy(true);
    try {
      if (chosenProduct) {
        const { data } = await supabase.functions.invoke("studio-ai", {
          body: { mode: "campaign_draft", product_id: chosenProduct.id, locale: locale },
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
            locale: locale,
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
      toast.success(t("studio.campaignNew.toast.aiSuggestionsApplied"));
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
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? t("studio.campaignNew.error.freistellerFailed"));
      setFreistellerPreview({ index: "product", source: chosenProduct.image_url, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg) ? t("studio.campaignNew.error.falCredits") : msg || t("studio.campaignNew.error.generic"));
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
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? t("studio.campaignNew.error.freistellerFailed"));
      setFreistellerPreview({ index, source: photo.url, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/guthaben|402|credit/i.test(msg) ? t("studio.campaignNew.error.falCredits") : msg || t("studio.campaignNew.error.generic"));
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
    toast.success(t("studio.campaignNew.toast.freistellerAccepted"));
    setFreistellerPreview(null);
  };

  // Model-Shot: die fehlende Mitte. product_id, falls ein Produkt gewählt ist — sonst
  // designer_id. Bei PAWN-Model wird das gewählte Foto direkt als Basis übergeben.
  const requestModelShot = async () => {
    if (!designer || !rawMaterialImage) return;
    if (modelMode === "pawn_pool" && !chosenPoolImageUrl) { toast.error(t("studio.campaignNew.toast.choosePawnModelFirst")); return; }
    setModelShotBusy(true);
    try {
      const body: Record<string, unknown> = {
        source_image_url: rawMaterialImage, mode: "shot", model_style: tryonStyle,
        house_model_id: modelMode === "gespeichert" ? chosenHouseModelId ?? undefined : undefined,
        base_image_url: modelMode === "pawn_pool" ? chosenPoolImageUrl ?? undefined : undefined,
        base_model_id: bildModelId ?? undefined,
      };
      if (chosenProduct?.id) body.product_id = chosenProduct.id; else body.designer_id = designer.id;
      const { data, error } = await supabase.functions.invoke("generate-tryon", { body });
      if (error) { console.error("[generate-tryon] invoke error:", error); throw error; }
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? t("studio.campaignNew.error.modelShotFailed"));
      setModelShotPreview({ source: rawMaterialImage, result: r.result_url });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.error("[generate-tryon] failed:", e);
      toast.error(/guthaben|402|credit/i.test(msg) ? t("studio.campaignNew.error.falCredits") : msg || t("studio.campaignNew.error.generic"));
    } finally {
      setModelShotBusy(false);
    }
  };

  const acceptModelShot = () => {
    if (!modelShotPreview) return;
    setModelShotUrl(modelShotPreview.result);
    setModelShotPreview(null);
    toast.success(t("studio.campaignNew.toast.modelShotConfirmed"));
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
    toast.success(t("studio.campaignNew.toast.consentSaved"));
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
    toast.success(t("studio.campaignNew.toast.mediaRightsSaved"));
  };

  // Kosten- und Dauer-Schätzung für die fixierte Kopfzeile.
  const clipsToProduce = Math.min(chosenImages.length, 3);
  const estimatedDurationS = outputType === "video"
    ? (chosenModelEntry ? clipsToProduce * durationS : Math.round(chosenImages.length * sceneSeconds))
    : 0;

  // Produktion (roh): erzeugt entweder Standbilder (keine Bewegung) oder echte Clips.
  const produceRaw = async (): Promise<boolean> => {
    if (!designer) return false;
    if (chosenImages.length < 1) { toast.error(t("studio.campaignNew.toast.atLeastOneImage")); return false; }
    setCinematicError(null);
    const baseImages = chosenImages.slice(0, 4);
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
      if (campErr || !campRow) throw new Error(campErr?.message ?? t("studio.campaignNew.error.draftCreateFailed"));
      const campaign_id = (campRow as { id: string }).id;

      setCinematicStage("submitting");
      setCinematicProgress({ done: 0, total: inputImages.length });
      const castingBits = composedCastingText || undefined;
      const cameraBits = MOVEMENT_CHIPS.filter((m) => selectedMovementIds.includes(m.id)).map((m) => m.camera).join(", ") || undefined;
      const { data: submitData, error: submitErr } = await supabase.functions.invoke("generate-broll", {
        body: {
          campaign_id, image_urls: inputImages,
          motion_prompt: [prompt, cameraBits, castingBits].filter(Boolean).join(". "),
          signature_id: chosenSignatureId ?? undefined,
          model_id: motionChoice ?? undefined,
          duration_s: durationS,
          cfg_scale: cfgScaleOptions[movementStrength],
        },
      });
      if (submitErr) {
        const msg = submitErr.message ?? String(submitErr);
        setCinematicStage("failed");
        throw new Error(msg.includes("provider_not_configured")
          ? t("studio.campaignNew.error.motionNotConfigured")
          : t("studio.campaignNew.error.startFailed"));
      }
      const respModel = (submitData as { model?: string } | null)?.model ?? null;
      setRunningModelLabel(chosenModelEntry?.label ?? respModel);
      setRunningModelDauer(chosenModelEntry?.dauer_hinweis ?? null);

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
          ? quotaExhaustedHint(plan, t("studio.campaignNew.quota.videos"))
          : isFalGuthaben
            ? t("studio.campaignNew.error.falCreditsRetry")
            : t("studio.campaignNew.error.providerRejected", { error: firstErr?.error ?? t("studio.campaignNew.error.unknown") }));
      }

      setCinematicStage("polling");
      const perImageStatus = new Map<string, { status: "done" | "failed" | "running"; url?: string }>();
      for (const img of inputImages) perImageStatus.set(img, { status: "running" });
      const idToImage = new Map<string, string>();
      for (const s of submissions) if (s.image_url) idToImage.set(s.id, s.image_url);
      const requestIds = submissions.map((s) => s.id);
      // Meisterklasse braucht laut Katalog bis zu 10 Minuten — das Fenster hier muss
      // mindestens so lang sein, sonst wird eine laufende Aufnahme fälschlich als
      // gescheitert gemeldet, während sie am Provider noch fertig wird.
      const deadline = Date.now() + 600_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10_000));
        const { data: pollData, error: pollErr } = await supabase.functions.invoke("poll-broll", { body: { request_ids: requestIds } });
        if (pollErr) continue;
        const results = (pollData as { results?: Array<{ id: string; status: string; result_url?: string; error?: string }> })?.results ?? [];
        const doneCount = results.filter((r) => r.status === "done" || r.status === "failed").length;
        setCinematicProgress({ done: doneCount, total: requestIds.length });
        for (const r of results) {
          const img = idToImage.get(r.id);
          if (!img) continue;
          if (r.status === "done" && r.result_url) perImageStatus.set(img, { status: "done", url: r.result_url });
          else if (r.status === "failed") perImageStatus.set(img, { status: "failed" });
        }
        if (results.length > 0 && results.every((r) => r.status === "done" || r.status === "failed")) break;
      }

      const aligned = baseImages.map((img) => {
        const st = perImageStatus.get(img);
        return st?.status === "done" ? st.url ?? null : null;
      });
      const successful = aligned.filter((c) => !!c).length;
      const anyStillRunning = inputImages.some((img) => perImageStatus.get(img)?.status === "running");

      if (anyStillRunning) {
        setRawClips(aligned);
        setCinematicStage("delayed");
        return false;
      }
      if (successful === 0) {
        setCinematicStage("failed");
        throw new Error(t("studio.campaignNew.error.noShotsSucceeded"));
      }
      setRawClips(aligned);
      setCinematicStage("ready");
      toast.success(t("studio.campaignNew.toast.shotsSucceeded", { n: successful, total: inputImages.length }));
      return true;
    } catch (e) {
      console.error("[produceRaw] failed:", e);
      const msg = (e as Error).message || t("studio.campaignNew.error.aufnahmeFehlgeschlagen");
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
      toast.success(t("studio.campaignNew.toast.videoReady"));
    } catch (e) {
      console.error("[composeVideo] failed:", e);
      toast.error((e as Error).message);
    } finally {
      setRenderBusy(false);
    }
  };

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
    if (!chosenProduct && !advertisesText.trim()) { toast.error(t("studio.campaignNew.toast.needsTarget")); return; }
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
        ? t("studio.campaignNew.title.productCampaign", { name: chosenProduct.name })
        : t("studio.campaignNew.title.brandReel", { brand: designer.brand_name });
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
          modelltyp: chosenModelEntry?.id ?? "editorial-client",
          clip_laenge_s: durationS,
          tempo, seed, format, cinematic: true,
        } as unknown as Record<string, unknown>,
        rights_granted: rightsGranted,
      } as never).select("id").single();
      await supabase.from("media_assets" as never).insert({
        designer_id: designer.id, kind: "video", origin: "erzeugt", url: signedUrl,
        title, rights_granted: rightsGranted,
        video_asset_id: (videoAssetRow as { id: string } | null)?.id ?? null,
        campaign_id: (campRow as { id: string } | null)?.id ?? null,
        product_id: chosenProduct?.id ?? null,
        advertises_text: chosenProduct ? null : advertisesText.trim(),
      } as never);

      toast.success(t("studio.campaignNew.toast.savedForApproval"));
      nav("/studio/kampagnen");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveImageForApproval = async () => {
    if (!designer || !user) return;
    const hero = chosenImages[0];
    if (!hero) { toast.error(t("studio.campaignNew.toast.noImageSelected")); return; }
    if (!chosenProduct && !advertisesText.trim()) { toast.error(t("studio.campaignNew.toast.needsTarget")); return; }
    setSavingImage(true);
    try {
      const hasModelShot = !!modelShotUrl;
      const finalCaption = hasModelShot && !caption.includes(tryonDisclosure)
        ? `${caption}${caption.trim() ? "\n\n" : ""}${tryonDisclosure}`
        : caption;
      const title = chosenProduct
        ? t("studio.campaignNew.title.productImage", { name: chosenProduct.name })
        : t("studio.campaignNew.title.brandImage", { brand: designer.brand_name });
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
        product_id: chosenProduct?.id ?? null,
        advertises_text: chosenProduct ? null : advertisesText.trim(),
      } as never);
      toast.success(t("studio.campaignNew.toast.savedForApproval"));
      nav("/studio/kampagnen");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingImage(false);
    }
  };

  if (loading) return <StudioShell title={t("studio.campaignNew.pageTitle")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.campaignNew.pageTitle")}><p className="text-muted-foreground">{t("studio.campaignNew.noStudioAccess")}</p></StudioShell>;

  const rightsPending = consentOk !== true || mediaRightsGranted !== true;
  const activeModelMode = modelMode ?? recommendedMode;

  const focusedSection = !materialReady ? "material"
    : needsModelShot ? "model"
    : !promptReady || (outputType === "video" && !motionDecided) ? "bewegung"
    : "feinschliff";

  const canGenerateVideo = materialReady && !needsModelShot && promptReady && motionDecided
    && !(renderBusy || cinematicStage === "submitting" || cinematicStage === "polling");
  const canSaveImage = materialReady && !needsModelShot && !savingImage && hasTarget;

  return (
    <StudioShell title={t("studio.campaignNew.pageTitle")} eyebrow={t("studio.campaignNew.eyebrow")}>
      {/* Fixierte Kopfzeile: Guthaben, geschätzte Kosten, geschätzte Dauer */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <span className="text-sm text-muted-foreground">{t("studio.campaignNew.planSuffix", { plan: planLabel(plan) })}</span>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="tabular-nums font-medium">{formatQuota(quota.used.videos, quota.unlimited ? -1 : quota.limits.videos, t("studio.campaignNew.quota.videos"))} · {formatQuota(quota.used.shots, quota.unlimited ? -1 : quota.limits.shots, t("studio.campaignNew.quota.shots"))}</span>
          {outputType === "video" && (
            <>
              <span className="text-muted-foreground">{t("studio.campaignNew.header.nextRunLabel")} <span className="tabular-nums font-medium text-foreground">{Math.max(clipsToProduce, 1)} {Math.max(clipsToProduce, 1) === 1 ? t("studio.campaignNew.header.clip") : t("studio.campaignNew.header.clips")}</span></span>
              {estimatedDurationS > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> <span className="tabular-nums">{estimatedDurationS}s</span></span>
              )}
            </>
          )}
        </div>
      </div>

      {rightsPending ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="editorial-eyebrow">{t("studio.campaignNew.rights.imageTitle")}</p>
            {consentOk === null ? <p className="mt-2 text-sm text-muted-foreground">{t("studio.campaignNew.rights.checking")}</p> :
              <div className="mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">{t("studio.campaignNew.rights.imageBody")}</p>
                <button onClick={grantConsent} disabled={consentBusy}
                  className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                  {consentBusy ? t("common.saving") : t("studio.campaignNew.rights.agree")}
                </button>
              </div>}
          </div>
          <div>
            <p className="editorial-eyebrow">{t("studio.campaignNew.rights.mediaTitle")}</p>
            {mediaRightsGranted === null ? <p className="mt-2 text-sm text-muted-foreground">{t("studio.campaignNew.rights.checking")}</p> :
              <div className="mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">{t("studio.campaignNew.rights.mediaBody")}</p>
                <button onClick={grantMediaRights} disabled={mediaRightsBusy}
                  className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                  {mediaRightsBusy ? t("common.saving") : t("studio.campaignNew.rights.agree")}
                </button>
              </div>}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.15fr]">
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
                <img src={chosenImages[0]} alt={t("studio.campaignNew.alt.material")} className="mx-auto aspect-square w-full max-w-sm object-cover" />
              ) : (
                <div className="flex aspect-square w-full max-w-sm items-center justify-center text-sm text-muted-foreground/70">{t("studio.campaignNew.preview.noMaterial")}</div>
              )}
            </div>
            {(cinematicStage === "submitting" || cinematicStage === "polling") && (
              <div className="flex items-start gap-2 text-sm">
                <Wand2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {cinematicStage === "submitting" && t("studio.campaignNew.stage.submitting")}
                  {cinematicStage === "polling" && (
                    <>
                      {t("studio.campaignNew.stage.pollingText", { model: runningModelLabel ?? t("studio.campaignNew.stage.pollingModelFallback") })}{runningModelDauer ? ` — ${runningModelDauer}` : ""}.
                      {cinematicProgress.total > 0 && <span className="ml-2 tabular-nums text-muted-foreground">{t("studio.campaignNew.stage.progressDone", { done: cinematicProgress.done, total: cinematicProgress.total })}</span>}
                    </>
                  )}
                </span>
              </div>
            )}
            {cinematicStage === "delayed" && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t("studio.campaignNew.stage.delayedIntro")}{runningModelDauer ? ` (${runningModelDauer})` : ""}. {t("studio.campaignNew.stage.delayedRest")}
                </span>
              </div>
            )}
            {cinematicStage === "failed" && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cinematicError ?? t("studio.campaignNew.error.aufnahmeFehlgeschlagen")}</span>
              </div>
            )}
            {(rawClips.some(Boolean) || chosenImages[0]) && (
              <a href={rawClips.find(Boolean) ?? chosenImages[0]} download className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                <Download className="h-3.5 w-3.5" /> {t("studio.campaignNew.preview.downloadRaw")}
              </a>
            )}
          </div>

          {/* RECHTS — die kurze Hauptfolge */}
          <div>
            {/* Was entsteht */}
            <div className="flex gap-2 border-b border-border pb-3">
              <button type="button" onClick={() => setOutputType("bild")}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 border p-3 transition-colors ${outputType === "bild" ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                <ImageIcon className="h-4 w-4" /> <span className="font-serif text-base">{t("studio.campaignNew.output.image")}</span>
              </button>
              <button type="button" onClick={() => setOutputType("video")}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 border p-3 transition-colors ${outputType === "video" ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                <Clapperboard className="h-4 w-4" /> <span className="font-serif text-base">{t("studio.campaignNew.output.video")}</span>
                <span className="border border-current px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em]">{t("studio.campaignNew.output.betaBadge")}</span>
              </button>
            </div>
            {outputType === "video" && (
              <p className="border-b border-border pb-8 pt-3 text-xs text-muted-foreground">
                {t("studio.campaignNew.output.videoBetaNote")}
              </p>
            )}
            {outputType === "bild" && <div className="pb-8" />}

            {/* Material — Teil 16c: das Studio denkt vom Stück aus. */}
            <div className="border-b border-border py-8">
              <p className="editorial-eyebrow">{t("studio.campaignNew.material.eyebrow")}</p>
              {products.length === 0 ? (
                <div className="mt-4 text-sm text-muted-foreground">
                  {t("studio.campaignNew.material.noProducts")}{" "}
                  <Link to="/studio/produkte/neu" className="underline hover:text-foreground">{t("studio.campaignNew.material.createNow")}</Link> {t("studio.campaignNew.material.createNowSuffix")}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {products.map((p) => (
                    <button key={p.id} onClick={() => { setChosenProduct(p); setUploaded([]); setProductShotResult(null); setAdvertisesText(""); }}
                      className={`group border p-2 text-left transition-all ${chosenProduct?.id === p.id ? "border-foreground" : "border-transparent hover:border-border"}`}>
                      <div className="aspect-[4/5] bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition" loading="lazy" />}</div>
                      <p className="mt-2 truncate font-serif text-sm">{p.name}</p>
                    </button>
                  ))}
                </div>
              )}
              {chosenProduct && (
                <button type="button" onClick={requestFreistellerForProduct} disabled={freistellerBusy === "product" || !quota.canDo("shots")}
                  className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 text-[0.68rem] uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-60">
                  <Sparkles className="h-3 w-3" /> {freistellerBusy === "product" ? "…" : t("studio.campaignNew.material.freisteller")}
                </button>
              )}

              <p className="mt-6 text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.material.orOwnPhoto")}</p>
              <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="mt-2 border border-dashed border-border p-6 text-center">
                <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-sm">{t("studio.campaignNew.material.dropHint")}</p>
                <label className="mt-3 inline-flex min-h-[40px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                  {t("studio.campaignNew.material.selectPhotos")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
                </label>
                {uploading && <p className="mt-2 text-xs text-muted-foreground">{t("studio.campaignNew.material.uploading")}</p>}
                {uploaded.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {uploaded.map((u, i) => (
                      <div key={i}>
                        <img src={u.url} alt="" className="aspect-square w-full object-cover grayscale" />
                        <button type="button" onClick={() => requestFreistellerForUpload(i)} disabled={freistellerBusy === i || !quota.canDo("shots")}
                          className="mt-1 flex min-h-[28px] w-full items-center justify-center gap-1.5 text-[0.6rem] uppercase tracking-wide text-muted-foreground hover:text-foreground disabled:opacity-60">
                          <Sparkles className="h-3 w-3" /> {freistellerBusy === i ? "…" : t("studio.campaignNew.material.freisteller")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!chosenProduct && uploaded.length > 0 && (
                <div className="mt-4">
                  <label className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.material.advertisesLabel")}</label>
                  <input value={advertisesText} onChange={(e) => setAdvertisesText(e.target.value)}
                    placeholder={t("studio.campaignNew.material.advertisesPlaceholder")}
                    className="mt-2 w-full border border-border bg-white p-2 text-sm" />
                  <p className="mt-1 text-xs text-muted-foreground">{t("studio.campaignNew.material.advertisesHint")}</p>
                </div>
              )}

              {recentShots.length > 0 && (
                <>
                  <p className="mt-6 text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.material.recentShots")}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {recentShots.map((s, i) => (
                      <button key={i} type="button" onClick={() => reuseRecentShot(s.url)} className="group relative h-16 w-16 border border-border hover:border-foreground">
                        <img src={s.url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[0.55rem] uppercase tracking-widest text-transparent group-hover:bg-black/60 group-hover:text-white">{t("studio.campaignNew.material.useShot")}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Inszenierung (Teil 16a) — der neue Bild-Weg: Art erkennen, passende Varianten anbieten. */}
            {outputType === "bild" && stagingSourceUrl && (
              <div className="border-b border-border py-8">
                <p className="editorial-eyebrow">{t("studio.campaignNew.staging.eyebrow")}</p>

                {stagingDetectBusy && <p className="mt-3 text-sm text-muted-foreground">{t("studio.campaignNew.staging.detecting")}</p>}

                {stagingFotoHinweis && (
                  <p className="mt-3 border-l-2 border-foreground pl-3 text-sm text-muted-foreground">{stagingFotoHinweis}</p>
                )}

                {!stagingDetectBusy && (
                  <div className="mt-3">
                    <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("studio.campaignNew.staging.artLabel")}{stagingAmbiguous ? t("studio.campaignNew.staging.artConfirm") : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ART_ORDER.map((a) => (
                        <button key={a} type="button" onClick={() => setStagingArt(a)}
                          className={`min-h-[32px] border px-3 py-1 text-[0.62rem] tracking-wide ${stagingArt === a ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                          {t(ART_LABEL[a])}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {stagingArt && stagingTemplatesForArt.length > 0 && (
                  <>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {/* "tpl" statt "t" — sonst würde der Schleifenparameter unsere Übersetzungsfunktion t() verdecken. */}
                      {stagingTemplatesForArt.map((tpl) => (
                        <label key={tpl.id} className={`flex cursor-pointer gap-3 border p-3 ${stagingSelectedIds.includes(tpl.id) ? "border-foreground" : "border-border"}`}>
                          <input type="checkbox" className="mt-1" checked={stagingSelectedIds.includes(tpl.id)} onChange={() => toggleStagingTemplate(tpl.id)} />
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              {tpl.preview_url ? (
                                <img src={tpl.preview_url} alt="" className="h-12 w-12 shrink-0 border border-border object-cover" />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-border text-[0.5rem] text-muted-foreground">{t("studio.campaignNew.staging.exampleSoon")}</div>
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
                        {stagingSelectedIds.length === 0
                          ? t("studio.campaignNew.staging.selectAtLeastOne")
                          : t("studio.campaignNew.staging.durationHint", { n: stagingSelectedIds.length })}
                      </p>
                      <button type="button" onClick={() => void runStaging()}
                        disabled={stagingBusy || stagingSelectedIds.length === 0 || !quota.canDo("shots")}
                        className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                        {stagingBusy ? t("studio.campaignNew.staging.busy") : t("studio.campaignNew.staging.start")}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("studio.campaignNew.staging.disclaimer")}
                    </p>
                  </>
                )}

                {stagingResults && (
                  <div className="mt-6 border-t border-border pt-6">
                    <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.staging.result")}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {stagingResults.map((r) => (
                        <div key={r.template_id} className="border border-border">
                          {r.result_url ? (
                            <>
                              <img src={r.result_url} alt={r.label} className="aspect-square w-full object-cover" />
                              <div className="p-2">
                                <p className="truncate text-xs">{r.label}</p>
                                {products.length > 0 ? (
                                  <select defaultValue="" onChange={(e) => { const v = e.target.value; if (v) void adoptStagingResult(r, v); e.target.value = ""; }}
                                    className="mt-1 w-full border border-border bg-white px-1 py-1 text-[0.6rem]">
                                    <option value="">{t("studio.campaignNew.staging.selectAsProduct")}</option>
                                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                ) : (
                                  <p className="mt-1 text-[0.58rem] text-muted-foreground">{t("studio.campaignNew.staging.landsInLibrary")}</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex aspect-square items-center justify-center p-2 text-center text-[0.62rem] text-muted-foreground">{r.error ?? t("studio.campaignNew.staging.failed")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model */}
            <div className="border-b border-border py-8">
              <p className="editorial-eyebrow">{t("studio.campaignNew.model.eyebrow")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {((poolHasAny ? ["pawn_pool", "beschreiben", "gespeichert", "keins"] : ["beschreiben", "gespeichert", "keins"]) as ModelMode[]).map((m) => (
                  <div key={m} className="flex flex-col items-start gap-1">
                    {m === recommendedMode && <span className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.model.recommended")}</span>}
                    <button onClick={() => setModelModeUser(m)}
                      className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${activeModelMode === m ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {t(MODE_LABEL[m])}
                    </button>
                  </div>
                ))}
              </div>

              {activeModelMode === "pawn_pool" && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {(["weiblich", "männlich", "divers"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setTryonStyle(s)}
                        className={`min-h-[36px] border px-3 py-1 text-[0.68rem] ${tryonStyle === s ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {t(TRYON_STYLE_LABEL[s])}
                      </button>
                    ))}
                  </div>
                  {modelPool[tryonStyle].length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">{t("studio.campaignNew.model.poolEmpty", { style: t(TRYON_STYLE_LABEL[tryonStyle]), describeMode: t(MODE_LABEL.beschreiben) })}</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {modelPool[tryonStyle].map((url, i) => (
                        <button key={i} type="button" onClick={() => setChosenPoolImageUrl(url)}
                          className={`aspect-[3/4] border ${chosenPoolImageUrl === url ? "border-foreground" : "border-border hover:border-foreground"}`}>
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModelMode === "beschreiben" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.ausstrahlung")}</span>
                    <input value={modelAusstrahlung} onChange={(e) => setModelAusstrahlung(e.target.value)} placeholder={t("studio.campaignNew.model.field.ausstrahlungPlaceholder")} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.altersgruppe")}</span>
                    <input value={modelAltersgruppe} onChange={(e) => setModelAltersgruppe(e.target.value)} placeholder={t("studio.campaignNew.model.field.altersgruppePlaceholder")} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.haar")}</span>
                    <input value={modelHaar} onChange={(e) => setModelHaar(e.target.value)} placeholder={t("studio.campaignNew.model.field.haarPlaceholder")} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.hautton")}</span>
                    <input value={modelHautton} onChange={(e) => setModelHautton(e.target.value)} placeholder={t("studio.campaignNew.model.field.hauttonPlaceholder")} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.statur")}</span>
                    <input value={modelStatur} onChange={(e) => setModelStatur(e.target.value)} placeholder={t("studio.campaignNew.model.field.staturPlaceholder")} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <label className="block sm:col-span-2"><span className="editorial-eyebrow">{t("studio.campaignNew.model.field.freitext")}</span>
                    <textarea value={modelFreitext} onChange={(e) => setModelFreitext(e.target.value)} rows={2} className="mt-1 w-full border border-border bg-background p-2 text-sm" /></label>
                  <p className="text-xs text-muted-foreground sm:col-span-2 border-l-2 border-foreground pl-3">
                    {t("studio.campaignNew.model.fictionalOnly")}
                  </p>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={saveAsHouseModel} onChange={(e) => setSaveAsHouseModel(e.target.checked)} />
                      {t("studio.campaignNew.model.saveAsHouseModel")}
                    </label>
                    {saveAsHouseModel && (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input value={newHouseModelName} onChange={(e) => setNewHouseModelName(e.target.value)} placeholder={t("studio.campaignNew.model.houseModelNamePlaceholder")} className="flex-1 border border-border bg-background p-2 text-sm" />
                        <button type="button" onClick={createHouseModel} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background">{t("common.save")}</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeModelMode === "gespeichert" && (
                houseModels.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">{t("studio.campaignNew.model.noHouseModels")}</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {houseModels.map((hm) => (
                      <button key={hm.id} onClick={() => setChosenHouseModelId(hm.id)}
                        className={`min-h-[40px] border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenHouseModelId === hm.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {hm.name}
                      </button>
                    ))}
                  </div>
                )
              )}

              {activeModelMode !== "keins" && (
                <div className="mt-6 border-t border-border pt-6">
                  <p className="text-sm text-muted-foreground">
                    {t("studio.campaignNew.model.appearsOnModel")}
                  </p>
                  <p className="mt-1 text-[0.62rem] italic text-muted-foreground">{tryonDisclosure}</p>
                  {!rawMaterialImage && <p className="mt-2 text-sm text-muted-foreground">{t("studio.campaignNew.model.chooseMaterialFirst")}</p>}
                  <button type="button" onClick={requestModelShot}
                    disabled={modelShotBusy || !rawMaterialImage || (activeModelMode === "pawn_pool" && !chosenPoolImageUrl) || !quota.canDo("shots")}
                    className="mt-3 min-h-[40px] border border-foreground bg-foreground px-4 py-1.5 text-[0.68rem] uppercase tracking-widest text-background disabled:opacity-60">
                    {modelShotBusy ? t("studio.campaignNew.model.working") : modelShotUrl ? t("studio.campaignNew.model.regenerate") : t("studio.campaignNew.model.createShot")}
                  </button>
                  {modelShotUrl && (
                    <div className="mt-4 flex items-center gap-4">
                      <img src={modelShotUrl} alt={t("studio.campaignNew.modal.modelShotTitle")} className="h-24 w-24 border border-foreground object-cover" />
                      <div className="flex-1 text-xs">
                        <span className="inline-block border border-foreground bg-white px-2 py-0.5 text-[0.55rem] uppercase tracking-widest">{t("studio.campaignNew.model.confirmed")}</span>
                        <p className="mt-2 text-muted-foreground">{t("studio.campaignNew.model.usedAsMaterial")}</p>
                        <button type="button" onClick={() => setModelShotUrl(null)} className="mt-2 text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground">{t("studio.campaignNew.discard")}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bewegung & Qualität (Video) / Text (Bild) */}
            <div className="border-b border-border py-8">
              <p className="editorial-eyebrow">{outputType === "video" ? t("studio.campaignNew.section.motionQuality") : t("studio.campaignNew.section.text")}</p>

              {outputType === "video" && dnaSuggestion && !suggestionDismissed && (
                <div className="mt-4 border border-foreground bg-white p-4">
                  <p className="editorial-eyebrow text-muted-foreground">{t("studio.campaignNew.dna.eyebrow")}</p>
                  <p className="mt-1 text-sm">{t("studio.campaignNew.dna.summaryLine", { reason: dnaSuggestion.reason, summary: dnaSuggestion.summary })}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={applyDnaSuggestion}
                      className="min-h-[32px] border border-foreground bg-foreground px-3 py-1 text-[0.62rem] uppercase tracking-wide text-background hover:bg-background hover:text-foreground">
                      {t("studio.campaignNew.apply")}
                    </button>
                    <button type="button" onClick={() => setSuggestionDismissed(true)}
                      className="min-h-[32px] border border-border bg-white px-3 py-1 text-[0.62rem] uppercase tracking-wide text-muted-foreground hover:border-foreground hover:text-foreground">
                      {t("studio.campaignNew.discard")}
                    </button>
                  </div>
                </div>
              )}

              {outputType === "video" && (
                <>
                  <input value={ortFreitext} onChange={(e) => setOrtFreitext(e.target.value)} placeholder={t("studio.campaignNew.motion.ortPlaceholder")}
                    className="mt-4 w-full border border-border bg-white p-2 text-sm" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ORT_PRESETS.map((o) => (
                      <button key={o} onClick={() => setOrtPreset(o === ortPreset ? null : o)}
                        className={`min-h-[32px] border px-3 py-1 text-[0.62rem] tracking-wide ${ortPreset === o ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                        {t(o)}
                      </button>
                    ))}
                  </div>

                  {houseSettings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {houseSettings.map((s) => (
                        <button key={s.id} type="button" onClick={() => applyHouseSetting(s)}
                          className="min-h-[32px] border border-dashed border-border bg-white px-3 py-1 text-[0.62rem] tracking-wide hover:border-foreground"
                          title={t("studio.campaignNew.motion.applySettingTitle")}>
                          ★ {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input value={newSettingName} onChange={(e) => setNewSettingName(e.target.value)} placeholder={t("studio.campaignNew.motion.settingNamePlaceholder")}
                      className="min-h-[32px] w-56 border border-border bg-white px-2 py-1 text-[0.68rem]" />
                    <button type="button" onClick={() => void saveHouseSetting()} disabled={savingSetting || !newSettingName.trim()}
                      className="min-h-[32px] border border-border px-3 py-1 text-[0.62rem] uppercase tracking-wide hover:border-foreground disabled:opacity-40">
                      {savingSetting ? "…" : t("studio.campaignNew.motion.saveSetting")}
                    </button>
                  </div>
                </>
              )}

              <textarea
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder={outputType === "bild" ? t("studio.campaignNew.motion.promptPlaceholderBild") : t("studio.campaignNew.motion.promptPlaceholderVideo")}
                className="mt-4 min-h-28 w-full border border-border bg-white p-4 text-base"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {outputType === "bild"
                  ? t("studio.campaignNew.motion.promptHintBild")
                  : t("studio.campaignNew.motion.promptHintVideo")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {outputType === "bild"
                  ? ["studio.campaignNew.chip.klarReduziert", "studio.campaignNew.chip.warmPersoenlich", "studio.campaignNew.chip.editorialDirekt"].map((chip) => (
                    <button key={chip} onClick={() => setPrompt(t(chip))}
                      className="min-h-[32px] border border-border bg-white px-3 py-1 text-[0.62rem] tracking-wide hover:bg-foreground hover:text-background">
                      {t(chip)}
                    </button>
                  ))
                  : MOVEMENT_CHIPS.map((m) => (
                    <button key={m.id} onClick={() => toggleMovementChip(m.id)}
                      className={`min-h-[32px] border px-3 py-1 text-[0.62rem] tracking-wide ${selectedMovementIds.includes(m.id) ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {t(m.label)}
                    </button>
                  ))}
              </div>

              {composedCastingText && (
                <button type="button" onClick={() => setPrompt((prev) => [prev, composedCastingText].filter(Boolean).join(". "))}
                  className="mt-3 text-[0.62rem] uppercase tracking-wide text-muted-foreground underline hover:text-foreground">
                  {t("studio.campaignNew.motion.applyCasting", { text: composedCastingText })}
                </button>
              )}

              {outputType === "video" && (
                <>
                  <p className="editorial-eyebrow mt-8">{t("studio.campaignNew.motion.movementEyebrow")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {videoModels.map((m) => {
                      const affordable = quota.canDo("videos") && quota.canDo("cinematic");
                      return (
                        <div key={m.id} className="flex flex-col items-start gap-1">
                          <button disabled={!affordable} onClick={() => setMotionChoice(m.id)}
                            className={`min-h-[44px] border px-4 py-2 text-left text-[0.7rem] uppercase tracking-[0.18em] disabled:opacity-40 ${motionChoice === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                            {m.label}
                          </button>
                          {m.dauer_hinweis && <span className="text-[0.58rem] text-muted-foreground">{m.dauer_hinweis}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {modelCatalogLoaded && videoModels.length === 0 && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t("studio.campaignNew.motion.noVideoModel")}
                    </p>
                  )}

                  {chosenModelEntry && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.motion.length")}</span>
                      {([5, 10] as DurationS[]).map((d) => (
                        <button key={d} onClick={() => setDurationS(d)}
                          className={`min-h-[36px] border px-3 py-1.5 text-[0.68rem] ${durationS === d ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                          {d}s
                        </button>
                      ))}
                    </div>
                  )}
                  {chosenModelEntry && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.motion.strength")}</span>
                      {Object.keys(cfgScaleOptions).map((k) => (
                        <button key={k} onClick={() => setMovementStrength(k)}
                          className={`min-h-[36px] border px-3 py-1.5 text-[0.68rem] ${movementStrength === k ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                          {MOVEMENT_STRENGTH_LABEL[k] ? t(MOVEMENT_STRENGTH_LABEL[k]) : k}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Feinschliff — geschlossen per Default */}
            <div className="py-8">
              <button type="button" onClick={() => setFeinschliffOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
                <p className="editorial-eyebrow">{t("studio.campaignNew.finish.eyebrow")}</p>
                {feinschliffOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {!feinschliffOpen && <p className="mt-1 text-xs text-muted-foreground">{outputType === "video" ? t("studio.campaignNew.finish.summaryVideo") : t("studio.campaignNew.finish.summary")}</p>}

              {feinschliffOpen && (
                <div className="mt-6 space-y-8">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="editorial-eyebrow">{t("studio.campaignNew.finish.aiHeading")}</p>
                      <button onClick={askAI} disabled={aiBusy || !prompt.trim()} className="flex min-h-[32px] items-center gap-2 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground disabled:opacity-40">
                        <Sparkles className="h-3 w-3" /> {aiBusy ? "…" : t("studio.campaignNew.finish.suggestion")}
                      </button>
                    </div>
                    {outputType === "video" && (
                      <label className="mt-3 block"><span className="editorial-eyebrow">{t("studio.campaignNew.finish.hookLabel")}</span>
                        <input value={hook} onChange={(e) => setHook(e.target.value)} maxLength={60} className="mt-2 w-full border border-border bg-background p-2 text-sm" /></label>
                    )}
                    <label className="mt-3 block"><span className="editorial-eyebrow">{t("studio.campaignNew.finish.captionLabel")}</span>
                      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-2 min-h-24 w-full border border-border bg-background p-2 text-sm" /></label>
                    <label className="mt-3 block"><span className="editorial-eyebrow">{t("studio.campaignNew.finish.hashtagsLabel")}</span>
                      <input value={hashtags.join(" ")} onChange={(e) => setHashtags(e.target.value.split(/\s+/).filter(Boolean))} className="mt-2 w-full border border-border bg-background p-2 text-sm" /></label>
                  </div>

                  {outputType === "video" && (
                    <>
                      <div>
                        <p className="editorial-eyebrow">{t("studio.campaignNew.finish.tempoHeading")}</p>
                        <div className="mt-3 flex gap-2">
                          {/* "tp" statt "t" — sonst würde der Schleifenparameter unsere Übersetzungsfunktion t() verdecken. */}
                          {(["ruhig", "spannungsvoll"] as Tempo[]).map((tp) => (
                            <button key={tp} onClick={() => setTempo(tp)}
                              className={`min-h-[40px] border px-4 py-2 text-[0.68rem] uppercase tracking-[0.2em] ${tempo === tp ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                              {t(TEMPO_LABEL[tp])}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="editorial-eyebrow">{t("studio.campaignNew.finish.signatureHeading")}</p>
                        {signaturesLoading ? (
                          <p className="mt-2 text-sm text-muted-foreground">{t("studio.campaignNew.finish.directorThinking")}</p>
                        ) : (
                          <>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button onClick={() => setChosenSignatureId(null)}
                                className={`min-h-[36px] border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.16em] ${chosenSignatureId === null ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                                {t("studio.campaignNew.finish.standard")}
                              </button>
                              {signatures.map((s) => (
                                <button key={s.id} onClick={() => setChosenSignatureId(s.id)}
                                  className={`min-h-[36px] border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.16em] ${chosenSignatureId === s.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                                  {s.name}{s.recipe?.wunsch ? " ✦" : ""}
                                </button>
                              ))}
                            </div>
                            {chosenSignatureId && (
                              <button type="button" onClick={applySignatureSuggestion} className="mt-2 text-[0.62rem] uppercase tracking-wide text-muted-foreground underline hover:text-foreground">
                                {t("studio.campaignNew.finish.applySignatureSuggestion")}
                              </button>
                            )}
                            {plan === "maison" && (
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <input value={wishName} onChange={(e) => setWishName(e.target.value)} placeholder={t("studio.campaignNew.finish.wishNamePlaceholder")} className="border border-border bg-background p-2 text-sm sm:w-40" />
                                <input value={wishPrompt} onChange={(e) => setWishPrompt(e.target.value)} placeholder={t("studio.campaignNew.finish.wishPromptPlaceholder")} className="flex-1 border border-border bg-background p-2 text-sm" />
                                <button onClick={requestWishSignature} disabled={wishBusy}
                                  className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background disabled:opacity-50">
                                  {wishBusy ? "…" : t("studio.campaignNew.finish.request")}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <p className="editorial-eyebrow">{t("studio.campaignNew.finish.cutHeading")}</p>
                        <div className="mt-3 flex gap-2">
                          {(["9:16", "1:1"] as Format[]).map((f) => (
                            <button key={f} onClick={() => setFormat(f)} className={`min-h-[40px] border px-4 py-2 text-[0.68rem] uppercase tracking-[0.2em] ${format === f ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                              {f === "9:16" ? t("studio.campaignNew.finish.formatReel") : t("studio.campaignNew.finish.formatFeed")}
                            </button>
                          ))}
                        </div>
                        {rawClips.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {clipOrder.map((idx, pos) => (
                              <div key={idx} className="flex items-center gap-3 border border-border p-2">
                                <div className="h-10 w-10 shrink-0 border border-border bg-black">
                                  {rawClips[idx] ? <video src={rawClips[idx]!} muted className="h-full w-full object-cover" /> : <img src={chosenImages[idx]} alt="" className="h-full w-full object-cover" />}
                                </div>
                                <span className="flex-1 text-sm text-muted-foreground">{t("studio.campaignNew.finish.shotNumber", { n: pos + 1 })}</span>
                                <button onClick={() => moveClip(pos, -1)} disabled={pos === 0} className="p-1 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                                <button onClick={() => moveClip(pos, 1)} disabled={pos === clipOrder.length - 1} className="p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-4 text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.campaignNew.finish.sceneLength", { s: sceneSeconds.toFixed(1) })}</p>
                        <input type="range" min={1} max={4} step={0.5} value={sceneSeconds} onChange={(e) => setSceneSeconds(Number(e.target.value))} className="mt-2 w-full" />
                        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeIntro} onChange={(e) => setIncludeIntro(e.target.checked)} /> {t("studio.campaignNew.finish.introCheckbox")}</label>
                        {includeIntro && <input value={introText} onChange={(e) => setIntroText(e.target.value)} placeholder={t("studio.campaignNew.finish.introPlaceholder")} className="mt-1 w-full border border-border bg-white p-2 text-sm" />}
                        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeOutro} onChange={(e) => setIncludeOutro(e.target.checked)} /> {t("studio.campaignNew.finish.outroCheckbox")}</label>
                        {includeOutro && <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> {t("studio.campaignNew.finish.showLogoCheckbox")}</label>}
                        {videoBlob && (
                          <button onClick={() => { setSeed(randomSeed()); void composeVideo(); }} className="mt-3 flex min-h-[36px] items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
                            <Shuffle className="h-3 w-3" /> {t("studio.campaignNew.finish.recut")}
                          </button>
                        )}
                        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                          <Music className="mt-0.5 h-3 w-3 shrink-0" /> {t("studio.campaignNew.finish.noSoundNote")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Erzeugen / Speichern — der eine Handlungsknopf */}
            <div className="border-t-[1.5px] border-foreground pt-6">
              {outputType === "bild" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t("studio.campaignNew.final.imageIntro", { variant: modelShotUrl ? t("studio.campaignNew.final.variantModelShot") : productShotResult ? t("studio.campaignNew.final.variantStudioBg") : t("studio.campaignNew.final.variantAsUploaded") })}
                  </p>
                  <button onClick={saveImageForApproval} disabled={!canSaveImage}
                    className="mt-4 flex min-h-[44px] items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                    {savingImage ? t("common.saving") : t("studio.campaignNew.final.saveForApproval")}
                  </button>
                  {materialReady && !needsModelShot && !hasTarget && (
                    <p className="mt-2 text-xs text-muted-foreground">{t("studio.campaignNew.final.needsTargetHint")}</p>
                  )}
                </>
              ) : videoBlob ? (
                <>
                  <p className="text-sm">{t("studio.campaignNew.final.videoDone")}</p>
                  <button onClick={saveForApproval} disabled={!hasTarget} className="mt-4 min-h-[44px] border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                    {t("studio.campaignNew.final.saveForApproval")}
                  </button>
                  {!hasTarget && (
                    <p className="mt-2 text-xs text-muted-foreground">{t("studio.campaignNew.final.needsTargetHint")}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {chosenImages.length} {chosenImages.length === 1 ? t("studio.campaignNew.final.photo") : t("studio.campaignNew.final.photos")} {t("studio.campaignNew.final.videoIntro", { model: chosenModelEntry?.label ?? t("studio.campaignNew.stage.pollingModelFallback"), duration: durationS })}
                  </p>
                  {needsModelShot && <p className="mt-2 text-sm text-foreground">{t("studio.campaignNew.final.confirmModelShotFirst")}</p>}
                  {!motionDecided && <p className="mt-2 text-sm text-foreground">{t("studio.campaignNew.final.chooseMotionFirst", { section: t("studio.campaignNew.motion.movementEyebrow") })}</p>}
                  <button onClick={generateVideo} disabled={!canGenerateVideo}
                    className="mt-4 flex min-h-[44px] items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                    {renderBusy ? t("studio.campaignNew.final.cutting", { pct: renderPct }) : cinematicStage === "submitting" || cinematicStage === "polling" ? t("studio.campaignNew.final.recording") : t("studio.campaignNew.final.generate")}
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
              <h3 className="font-serif text-xl">{t("studio.campaignNew.modal.beforeAfter")}</h3>
              <button onClick={() => setFreistellerPreview(null)} aria-label={t("studio.campaignNew.modal.close")} className="rounded p-1 hover:bg-muted">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={freistellerPreview.source} alt={t("studio.campaignNew.modal.original")} className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">{t("studio.campaignNew.modal.original")}</figcaption>
              </figure>
              <figure>
                <img src={freistellerPreview.result} alt={t("studio.campaignNew.material.freisteller")} className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">{t("studio.campaignNew.modal.neutralBackground")}</figcaption>
              </figure>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setFreistellerPreview(null)} className="min-h-[40px] border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("studio.campaignNew.discard")}</button>
              <button onClick={acceptFreisteller} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">{t("studio.campaignNew.apply")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Model-Shot: Vorher/Nachher */}
      {modelShotPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setModelShotPreview(null)}>
          <div className="w-full max-w-3xl border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-xl">{t("studio.campaignNew.modal.modelShotTitle")}</h3>
              <button onClick={() => setModelShotPreview(null)} aria-label={t("studio.campaignNew.modal.close")} className="rounded p-1 hover:bg-muted">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure>
                <img src={modelShotPreview.source} alt={t("studio.campaignNew.modal.sourcePhoto")} className="w-full border border-border bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-muted-foreground">{t("studio.campaignNew.modal.sourcePhoto")}</figcaption>
              </figure>
              <figure>
                <img src={modelShotPreview.result} alt={t("studio.campaignNew.modal.modelShotTitle")} className="w-full border border-foreground bg-muted object-contain" style={{ aspectRatio: "1 / 1" }} />
                <figcaption className="mt-2 text-[0.68rem] uppercase tracking-widest text-foreground">{t("studio.campaignNew.modal.modelShotTitle")}</figcaption>
              </figure>
            </div>
            <p className="mt-4 text-xs italic text-muted-foreground">{tryonDisclosure}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button onClick={() => setModelShotPreview(null)} className="min-h-[40px] border border-border bg-white px-4 py-2 text-[0.68rem] tracking-wide hover:bg-muted">{t("studio.campaignNew.discard")}</button>
              <button onClick={acceptModelShot} className="min-h-[40px] border border-foreground bg-foreground px-4 py-2 text-[0.68rem] tracking-wide text-background hover:bg-black">{t("studio.campaignNew.apply")}</button>
            </div>
          </div>
        </div>
      )}
    </StudioShell>
  );
}
