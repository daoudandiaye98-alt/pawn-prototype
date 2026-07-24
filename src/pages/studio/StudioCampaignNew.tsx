/**
 * Kampagnen-Funnel: Erklärung → Material → Prompt → Produktion → Freigabe.
 *
 * Rendert das Video CLIENT-SEITE (renderCampaign), lädt Blob nach
 * campaign-assets (privat) hoch und legt einen campaigns-Row mit
 * status='proposed' an. Freigabe passiert danach auf /studio/kampagnen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderCampaign, blobPreviewUrl, type Tempo, type Format } from "@/features/campaign/renderer";
import { randomSeed } from "@/features/campaign/prng";
import { useCampaignQuota, planLabel, type Plan } from "@/features/campaign/quota";
import { Check, Upload, Sparkles, Music, ArrowRight, Wand2, Shuffle } from "lucide-react";


interface ProductLite {
  id: string; name: string; slug: string; world: string;
  image_url: string | null;
}

interface HouseSignature {
  id: string; name: string;
  recipe: { licht?: string; palette?: string; kamerafahrt?: string; schnittrhythmus?: string; typo?: string; musik_tempo?: string; wunsch?: boolean };
}

type Step = 0 | 1 | 2 | 3 | 4;

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

export default function StudioCampaignNew() {
  const { user, profile, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { designer, loading } = useMyDesigner();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(0);

  // Step 0
  const [consentOk, setConsentOk] = useState<boolean | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [mediaRightsGranted, setMediaRightsGranted] = useState<boolean | null>(null);
  const [mediaRightsBusy, setMediaRightsBusy] = useState(false);

  // Step 1
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [chosenProduct, setChosenProduct] = useState<ProductLite | null>(null);
  const [uploaded, setUploaded] = useState<{ url: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // Step 2
  const [prompt, setPrompt] = useState("");
  const [tempo, setTempo] = useState<Tempo>("ruhig");
  const [hook, setHook] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);

  // Step 3
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderPct, setRenderPct] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>("video/webm");
  const [format, setFormat] = useState<Format>("9:16");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [cinematic, setCinematic] = useState(false);
  const [cinematicStage, setCinematicStage] = useState<null | "submitting" | "polling" | "ready" | "failed">(null);
  const [cinematicProgress, setCinematicProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [cinematicClips, setCinematicClips] = useState<string[]>([]);
  const [cinematicError, setCinematicError] = useState<string | null>(null);
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const [instagramHandle, setInstagramHandle] = useState<string>("hausofpawn");

  // Try-On
  const [tryonBusy, setTryonBusy] = useState(false);
  const [tryonReplacement, setTryonReplacement] = useState<string | null>(null);
  const [tryonDisclosure, setTryonDisclosure] = useState<string>("Visualisierung mit KI-Model");
  const [tryonStyle, setTryonStyle] = useState<"weiblich"|"männlich"|"divers">("weiblich");

  // Signaturen (der Regisseur)
  const [signatures, setSignatures] = useState<HouseSignature[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [chosenSignatureId, setChosenSignatureId] = useState<string | null>(null);
  const [wishName, setWishName] = useState("");
  const [wishPrompt, setWishPrompt] = useState("");
  const [wishBusy, setWishBusy] = useState(false);
  const [cinematicModel, setCinematicModel] = useState<string | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number>(0);

  // Quota
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = useCampaignQuota(designer?.id, plan, isAdmin);
  const cinematicAllowed = true;


  // Load consent + products.
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [{ data: d }, { data: prods }] = await Promise.all([
        supabase.from("designers").select("image_usage_consent, media_rights_granted_at").eq("id", designer.id).maybeSingle(),
        supabase.from("products").select("id, name, slug, world, image_url").eq("designer_id", designer.id).order("created_at", { ascending: false }),
      ]);
      const dd = d as unknown as { image_usage_consent?: boolean; media_rights_granted_at?: string | null } | null;
      setConsentOk(dd?.image_usage_consent === true);
      setMediaRightsGranted(!!dd?.media_rights_granted_at);
      setProducts((prods ?? []) as ProductLite[]);
    })();
  }, [designer]);

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

  // Instagram-Handle aus ai_config.business_profile lesen (Fallback bleibt 'hausofpawn').
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle();
      const v = (data as { value?: { instagram?: string } } | null)?.value;
      const raw = v?.instagram?.trim();
      if (raw) setInstagramHandle(raw.replace(/^@/, ""));
    })();
  }, []);

  // Try-On Disclosure aus Config.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "tryon_provider").maybeSingle();
      const d = (data as { value?: { shot_disclosure?: string } } | null)?.value?.shot_disclosure;
      if (d) setTryonDisclosure(d);
    })();
  }, []);

  const requestTryonForChosen = async () => {
    if (!chosenProduct?.id || !chosenProduct.image_url) return;
    setTryonBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tryon", {
        body: { product_id: chosenProduct.id, source_image_url: chosenProduct.image_url, mode: "shot", model_style: tryonStyle },
      });
      if (error) { console.error("[generate-tryon] invoke error:", error); throw error; }
      const r = data as { result_url?: string; error?: string; message?: string; stage?: string; status?: number } | null;
      if (!r?.result_url) {
        console.error("[generate-tryon] no result_url:", r);
        throw new Error(r?.message ?? r?.error ?? "KI-Model-Shot fehlgeschlagen.");
      }
      setTryonReplacement(r.result_url);
      toast.success("KI-Model-Shot bereit — wird als Material genutzt.");
    } catch (e) {
      const msg = (e as Error).message ?? "";
      console.error("[generate-tryon] failed:", e);
      toast.error(/guthaben|402|credit/i.test(msg)
        ? "fal.ai-Guthaben fehlt. Bitte im fal.ai-Konto Credits aufladen."
        : msg || "Fehler");
    } finally {
      setTryonBusy(false);
    }
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

  // Upload handlers
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!user) return;
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
  }, [user, uploaded.length]);

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files); };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) void handleFiles(e.target.files); };

  // Selected images
  const chosenImages = useMemo(() => {
    if (chosenProduct?.image_url) return [tryonReplacement ?? chosenProduct.image_url];
    return uploaded.map((u) => u.url);
  }, [chosenProduct, uploaded, tryonReplacement]);


  const canProceedFromStep1 =
    (chosenProduct && !!chosenProduct.image_url) || uploaded.length >= 2;

  // Ask AI for hook/caption/hashtags
  const askAI = async () => {
    if (!designer) return;
    setAiBusy(true);
    try {
      // Falls product gewählt: klassischer campaign_draft; sonst generischer Prompt.
      if (chosenProduct) {
        const { data } = await supabase.functions.invoke("studio-ai", {
          body: { mode: "campaign_draft", product_id: chosenProduct.id },
        });
        const r = data as { caption?: string; hashtags?: string[] } | null;
        if (r?.caption) setCaption(r.caption);
        if (r?.hashtags) setHashtags(r.hashtags);
        if (!hook) setHook(prompt.split(/[.!?]/)[0]?.trim().slice(0, 60) || "");
        // Delete the auto-created draft campaign row; we'll create our own with the video.
      } else {
        // Ohne Produkt: nur einen Chat-Aufruf für Vorschläge basierend auf Prompt+DNA.
        const { data } = await supabase.functions.invoke("studio-ai", {
          body: {
            mode: "chat",
            question: `Entwirf für eine Reel-Kampagne eine kurze Hook-Zeile (max 6 Wörter), eine Caption (max 2 Sätze) und 4-6 englische Hashtags. Ausgangs-Prompt: "${prompt}". Nur JSON zurückgeben: {"hook":"…","caption":"…","hashtags":["#..","#.."]}`,
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

  // Cinematic mode: submit fal.ai jobs, poll live, return one entry per input image
  // (clip URL when done, null when failed). Throws with real reason on hard failure.
  const runCinematic = async (inputImages: string[]): Promise<Array<string | null>> => {
    if (!designer) throw new Error("no_designer");
    const { data: campRow, error: campErr } = await supabase.from("campaigns").insert({
      designer_id: designer.id,
      title: `${designer.brand_name} · Draft`,
      kind: "video",
      status: "draft",
      content: { image_urls: inputImages, cinematic: true } as unknown as Record<string, unknown>,
      created_by: user?.id ?? null,
    } as never).select("id").single();
    if (campErr || !campRow) {
      console.error("[runCinematic] draft campaign insert failed:", campErr);
      throw new Error(campErr?.message ?? "Kampagnen-Draft konnte nicht angelegt werden.");
    }
    const campaign_id = (campRow as { id: string }).id;

    setCinematicStage("submitting");
    setCinematicProgress({ done: 0, total: inputImages.length });
    const { data: submitData, error: submitErr } = await supabase.functions.invoke("generate-broll", {
      body: { campaign_id, image_urls: inputImages, motion_prompt: prompt, signature_id: chosenSignatureId ?? undefined },
    });
    if (submitErr) {
      const msg = submitErr.message ?? String(submitErr);
      console.error("[generate-broll] invoke error:", submitErr);
      setCinematicStage("failed");
      throw new Error(msg.includes("provider_not_configured")
        ? "Kinematischer Modus ist nicht eingerichtet (FAL_KEY fehlt)."
        : "Kinematischer Modus konnte nicht gestartet werden. Bitte versuch es gleich noch einmal.");
    }
    setCinematicModel((submitData as { model?: string } | null)?.model ?? null);
    type SubOK = { id: string; request_id?: string; image_url?: string };
    type SubErr = { image_url: string; error: string; status?: number };
    type Sub = SubOK | SubErr;
    const allSubs = ((submitData as { submissions?: Sub[] })?.submissions ?? []);
    const submissions = allSubs.filter((s): s is SubOK => "id" in s);
    const failedSubs = allSubs.filter((s): s is SubErr => "error" in s);
    if (failedSubs.length > 0) console.error("[generate-broll] partial submit failures:", failedSubs);
    if (submissions.length === 0) {
      setCinematicStage("failed");
      const firstErr = failedSubs[0];
      const isCredit = firstErr && (firstErr.status === 402 || /guthaben|credit|402|insufficient/i.test(firstErr.error));
      throw new Error(isCredit
        ? "fal.ai-Guthaben fehlt — bitte im fal.ai-Konto Credits aufladen und erneut versuchen."
        : `Provider hat keine Aufträge angenommen: ${firstErr?.error ?? "unbekannter Fehler"}`);
    }

    setCinematicStage("polling");
    // Map image_url → clip result (null while pending/failed).
    const perImageClip = new Map<string, string | null>();
    const idToImage = new Map<string, string>();
    for (const s of submissions) if (s.image_url) idToImage.set(s.id, s.image_url);

    const requestIds = submissions.map((s) => s.id);
    const perClipTimeoutMs = 120_000;
    const deadline = Date.now() + Math.max(180_000, perClipTimeoutMs + 60_000);
    let doneCount = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const { data: pollData, error: pollErr } = await supabase.functions.invoke("poll-broll", {
        body: { request_ids: requestIds },
      });
      if (pollErr) { console.error("[poll-broll] invoke error:", pollErr); continue; }
      const results = (pollData as { results?: Array<{ id: string; status: string; result_url?: string; error?: string }> })?.results ?? [];
      doneCount = results.filter((r) => r.status === "done" || r.status === "failed").length;
      setCinematicProgress({ done: doneCount, total: requestIds.length });
      for (const r of results) {
        const img = idToImage.get(r.id);
        if (!img) continue;
        if (r.status === "done" && r.result_url) perImageClip.set(img, r.result_url);
        else if (r.status === "failed") {
          console.error("[poll-broll] clip failed:", r);
          perImageClip.set(img, null);
        }
      }
      if (results.every((r) => r.status === "done" || r.status === "failed")) break;
    }

    // Align result with input order.
    const aligned = inputImages.map((img) => perImageClip.get(img) ?? null);
    const successful = aligned.filter((c) => !!c).length;
    if (successful === 0) {
      setCinematicStage("failed");
      throw new Error("Keine der Aufnahmen ist gelungen. Prüfe später erneut oder wechsle in die Editorial-Fassung.");
    }
    setCinematicClips(aligned.filter((c): c is string => !!c));
    setCinematicStage("ready");
    return aligned;
  };

  // Render video
  const doRender = async () => {
    if (!designer) return;
    if (chosenImages.length < 1) { toast.error("Mindestens 1 Bild."); return; }
    setRenderBusy(true); setRenderPct(0); setVideoBlob(null); setVideoUrl(null); setCinematicError(null);

    const baseImages = chosenImages.slice(0, 4);
    let sources: Array<{ image?: string; clip?: string }> | undefined;
    const useCinematic = cinematic && quota.kinematicAllowed && !quota.kinematicAtLimit;

    if (useCinematic) {
      try {
        const aligned = await runCinematic(baseImages.slice(0, 3));
        const succeeded = aligned.filter((c) => !!c).length;
        const attempted = aligned.length;
        sources = baseImages.map((img, i) => {
          const clip = i < aligned.length ? aligned[i] : null;
          return clip ? { clip, image: img } : { image: img };
        });
        if (succeeded < attempted) {
          toast.message(`${succeeded} von ${attempted} Aufnahmen gelungen — Rest als Editorial-Szene.`);
        } else {
          toast.success(`${succeeded} kinematische Aufnahmen bereit.`);
        }
      } catch (e) {
        console.error("[doRender] cinematic failed:", e);
        const msg = (e as Error).message || "Kinematischer Modus ist fehlgeschlagen.";
        setCinematicError(msg);
        toast.error(msg);
        setRenderBusy(false);
        return;
      }
    }

    try {
      const houseNo = (designer as unknown as { house_number?: number | null })?.house_number ?? null;
      const result = await renderCampaign({
        brandName: designer.brand_name,
        houseNumber: houseNo,
        hookLine: hook || null,
        imageUrls: sources ? undefined : baseImages,
        sources,
        tempo,
        productLabel: chosenProduct ? `${chosenProduct.world} · ${designer.brand_name}` : designer.brand_name,
        productName: chosenProduct?.name ?? designer.brand_name,
        format,
        seed,
        instagramHandle,
        showEmblem: plan === "haus",
        signatureRecipe: signatures.find((s) => s.id === chosenSignatureId)?.recipe ?? null,
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
      console.error("[renderCampaign] failed:", e);
      toast.error((e as Error).message);
    } finally {
      setRenderBusy(false);
    }

  };

  const saveForApproval = async () => {
    if (!designer || !user || !videoBlob) return;
    try {
      const ext = videoMime.includes("mp4") ? "mp4" : "webm";
      const { path, signedUrl } = await uploadFile(user.id, videoBlob, ext);
      const hasTryon = !!tryonReplacement;
      const finalCaption = hasTryon && !caption.includes(tryonDisclosure)
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
        content: { ...content, tryon: hasTryon } as unknown as Record<string, unknown>,
        created_by: user.id,
      } as never).select("id").single();
      if (error) throw error;

      const rightsGranted = mediaRightsGranted === true;
      const chosenSignature = signatures.find((s) => s.id === chosenSignatureId) ?? null;
      const hookTyp = hook.trim() ? "custom" : chosenProduct ? "product" : "brand";
      await supabase.from("video_assets").insert({
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
          modelltyp: cinematic && cinematicModel ? cinematicModel : "editorial-client",
          tempo, seed, format, cinematic,
        } as unknown as Record<string, unknown>,
        rights_granted: rightsGranted,
      } as never);

      toast.success("Zur Freigabe gespeichert.");
      nav("/studio/kampagnen");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (loading) return <StudioShell title="Neue Kampagne"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Neue Kampagne"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  // === Render ===
  return (
    <StudioShell title="Neue Kampagne" eyebrow="Kampagnen-Studio">
      <StepHeader step={step} />

      {/* SCHRITT 0 — Erklärung */}
      {step === 0 && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <section>
            <p className="editorial-eyebrow">So entsteht deine Kampagne</p>
            <h2 className="mt-2 font-serif text-3xl">Vier ruhige Züge.</h2>
            <ol className="mt-8 space-y-6">
              {[
                { n: 1, t: "Fotos wählen", d: "Ein Stück aus deiner Kollektion — oder 2 bis 4 eigene Bilder hochladen." },
                { n: 2, t: "Sag PAWN, wie es sich anfühlen soll", d: "In deinen Worten. Zwei Sätze genügen, PAWN liefert einen Vorschlag." },
                { n: 3, t: "PAWN produziert", d: "Ein Reel im PAWN-Stil, direkt in deinem Browser — ohne Umweg." },
                { n: 4, t: "Du gibst frei, PAWN veröffentlicht", d: "Nichts geht ohne deine Freigabe raus. Danach reiht es sich in die Warteschlange." },
              ].map((a) => (
                <li key={a.n} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-foreground font-serif">{a.n}</span>
                  <div><p className="font-serif text-lg">{a.t}</p><p className="mt-1 text-sm text-muted-foreground">{a.d}</p></div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="space-y-4">
            <div className="border border-border bg-white p-5">
              <p className="editorial-eyebrow">Dein Plan</p>
              <p className="mt-2 font-serif text-xl">{planLabel(plan)}</p>
              <p className="mt-3 text-sm">
                Kampagnen diesen Monat: <span className="tabular-nums font-medium">{quota.used}</span> von <span className="tabular-nums">{quota.limit}</span>.
              </p>
              {quota.atLimit && (
                <div className="mt-4 border border-foreground p-3 text-sm">
                  Dein Kontingent für diesen Monat ist ausgeschöpft. <Link to="/studio/plan" className="underline">Plan ansehen</Link>.
                </div>
              )}
            </div>
            <div className="border border-border bg-white p-5">
              <p className="editorial-eyebrow">Bildrechte</p>
              {consentOk === null ? <p className="mt-2 text-sm text-muted-foreground">wird geprüft…</p> :
                consentOk ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" /> Einwilligung liegt vor.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Für Kampagnen brauchen wir deine Einwilligung, dass PAWN deine Produktbilder in Reels und Posts verwenden darf.
                    </p>
                    <button onClick={grantConsent} disabled={consentBusy}
                      className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                      {consentBusy ? "Speichere…" : "Ich stimme zu"}
                    </button>
                  </div>
                )}
            </div>
            <div className="border border-border bg-white p-5">
              <p className="editorial-eyebrow">Medien-Rechte</p>
              {mediaRightsGranted === null ? <p className="mt-2 text-sm text-muted-foreground">wird geprüft…</p> :
                mediaRightsGranted ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" /> Rechte-Haken gesetzt.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      PAWN darf ausgewählte Videos mit Credit und Verlinkung auf der Plattform und den PAWN-Kanälen zeigen.
                    </p>
                    <button onClick={grantMediaRights} disabled={mediaRightsBusy}
                      className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background disabled:opacity-50">
                      {mediaRightsBusy ? "Speichere…" : "Ich stimme zu"}
                    </button>
                  </div>
                )}
            </div>
          </aside>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={consentOk !== true || mediaRightsGranted !== true || quota.atLimit}
              className="flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40"
            >
              Weiter zu Material <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SCHRITT 1 — Material */}
      {step === 1 && (
        <div className="mt-8 space-y-8">
          <section>
            <p className="editorial-eyebrow">Aus deiner Kollektion</p>
            {products.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Noch keine Produkte hinterlegt. Oder lade unten 2–4 Fotos hoch.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {products.map((p) => (
                  <button key={p.id} onClick={() => { setChosenProduct(p); setUploaded([]); }}
                    className={`group border p-2 text-left transition-all ${chosenProduct?.id === p.id ? "border-foreground shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]" : "border-border hover:border-foreground"}`}>
                    <div className="aspect-[4/5] bg-muted">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition" loading="lazy" />}
                    </div>
                    <p className="mt-2 truncate font-serif text-sm">{p.name}</p>
                    <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{p.world}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="editorial-eyebrow">Oder eigene Fotos</p>
            <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
              className="mt-4 border-2 border-dashed border-border bg-white p-8 text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm">Zieh 2–4 Fotos hierher, oder wähle sie aus.</p>
              <label className="mt-4 inline-block cursor-pointer border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                Fotos auswählen
                <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
              </label>
              {uploading && <p className="mt-3 text-xs text-muted-foreground">Lade hoch…</p>}
              {uploaded.length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {uploaded.map((u, i) => (
                    <div key={i} className="border border-border bg-white p-1">
                      <img src={u.url} alt="" className="aspect-square w-full object-cover grayscale" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {chosenProduct && (
            <div className="border border-border bg-white p-4">
              <p className="editorial-eyebrow">✦ KI-Model-Shot</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Aus deinem Foto wird ein Model-Shot — mit KI-Model, das dein Stück trägt. Das Ergebnis ersetzt das gewählte Foto im Material.
                  </p>
                  <p className="mt-1 text-[0.62rem] italic text-muted-foreground">{tryonDisclosure}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["weiblich","männlich","divers"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setTryonStyle(s)} disabled={tryonBusy}
                      className={`border px-3 py-1 text-[0.68rem] ${tryonStyle === s ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                  <button type="button" onClick={requestTryonForChosen} disabled={tryonBusy}
                    className="border border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] uppercase tracking-widest text-background disabled:opacity-60">
                    {tryonBusy ? "KI arbeitet…" : (tryonReplacement ? "Neu erzeugen" : "Shot erzeugen")}
                  </button>
                </div>
              </div>
              {tryonReplacement && (
                <div className="mt-4 flex items-center gap-4">
                  <img src={tryonReplacement} alt="KI-Model-Shot" className="h-32 w-32 border border-foreground object-cover" />
                  <div className="flex-1 text-xs">
                    <span className="inline-block border border-foreground bg-white px-2 py-0.5 text-[0.55rem] uppercase tracking-widest">KI-Model</span>
                    <p className="mt-2 text-muted-foreground">Wird als Material für diese Kampagne verwendet. Die Disclosure wird automatisch an die Caption angehängt.</p>
                    <button type="button" onClick={() => setTryonReplacement(null)} className="mt-2 text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground">Verwerfen · Originalfoto nutzen</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {chosenImages.length === 1 && !tryonReplacement && (
            <p className="text-xs italic text-muted-foreground">
              Ein Foto ergibt einen kurzen Teaser — mit 3–4 Fotos führt PAWN echte Regie. Tipp: erst ✨ Studio-Foto veredeln oder ✦ KI-Model-Shot machen.
            </p>
          )}



          <div className="flex items-center justify-between">
            <button onClick={() => setStep(0)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">← Zurück</button>
            <button onClick={() => setStep(2)} disabled={!canProceedFromStep1}
              className="flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
              Weiter <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SCHRITT 2 — Prompt */}
      {step === 2 && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <section>
            <p className="editorial-eyebrow">Wie soll sich die Kampagne anfühlen?</p>
            <textarea
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="ruhig und skulptural, wie ein Museumsbesuch"
              className="mt-3 min-h-32 w-full border border-border bg-white p-4 text-base"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {["Ruhig · skulptural", "Streng · minimal", "Editorial · schnell"].map((chip) => (
                <button key={chip} onClick={() => setPrompt(chip)}
                  className="border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">
                  {chip}
                </button>
              ))}
            </div>

            <p className="editorial-eyebrow mt-8">Tempo</p>
            <div className="mt-3 flex gap-3">
              {(["ruhig", "spannungsvoll"] as Tempo[]).map((t) => (
                <button key={t} onClick={() => setTempo(t)}
                  className={`border px-5 py-2.5 text-[0.7rem] uppercase tracking-[0.22em] ${tempo === t ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>

            <p className="editorial-eyebrow mt-8">Signatur</p>
            {signaturesLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Der Regisseur denkt nach…</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setChosenSignatureId(null)}
                    className={`border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenSignatureId === null ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                    Standard
                  </button>
                  {signatures.map((s) => (
                    <button key={s.id} onClick={() => setChosenSignatureId(s.id)}
                      className={`border px-4 py-2 text-[0.7rem] uppercase tracking-[0.18em] ${chosenSignatureId === s.id ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {s.name}{s.recipe?.wunsch ? " ✦" : ""}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dein Stil-Rezept aus Licht, Kamerafahrt und Schnittrhythmus — vom Regisseur aus deiner Brand-DNA destilliert.
                </p>
                {plan === "maison" && (
                  <div className="mt-4 border border-border bg-white p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">Wunsch-Signatur</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input value={wishName} onChange={(e) => setWishName(e.target.value)} placeholder="Name"
                        className="border border-border bg-background p-2 text-sm sm:w-40" />
                      <input value={wishPrompt} onChange={(e) => setWishPrompt(e.target.value)} placeholder="Beschreibung (Stimmung, Licht, Tempo …)"
                        className="flex-1 border border-border bg-background p-2 text-sm" />
                      <button onClick={requestWishSignature} disabled={wishBusy}
                        className="border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background disabled:opacity-50">
                        {wishBusy ? "…" : "Anfragen"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="editorial-eyebrow mt-8">✦ Kinematischer Modus</p>
            {!quota.kinematicAllowed ? (
              <div className="mt-3 border border-foreground bg-white p-4">
                <p className="font-serif text-base">Ab Atelier: echte KI-Bewegung statt Standbildern.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Der Haus-Plan produziert in der ruhigen Editorial-Regie. Kinematische Clips (fal.ai) sind ab Atelier dabei.
                </p>
                <Link to="/studio/plan" className="mt-3 inline-block border border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.22em] text-background">
                  Plan ansehen
                </Link>
              </div>
            ) : quota.kinematicAtLimit ? (
              <div className="mt-3 border border-foreground bg-white p-4">
                <p className="font-serif text-base">Kinematisches Kontingent diesen Monat aufgebraucht.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {quota.kinematicUsed} von {quota.kinematicLimit} kinematischen Clips verbraucht. Restliche Videos entstehen in der Editorial-Regie.
                </p>
              </div>
            ) : (
              <div className={`mt-3 border ${cinematic ? "border-foreground" : "border-border"} bg-white p-4`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={cinematic}
                    onChange={(e) => setCinematic(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-foreground"
                  />
                  <div>
                    <p className="font-serif text-base">Echte KI-Bewegung statt Standbildern.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      PAWN erzeugt für jedes Foto einen kurzen Clip (fal.ai · Kling), schneidet sie in deiner Regie.
                      {quota.kinematicLimit !== Infinity && ` Noch ${quota.kinematicLimit - quota.kinematicUsed} von ${quota.kinematicLimit} kinematische Clips diesen Monat.`}
                    </p>
                  </div>
                </label>
              </div>
            )}

          </section>

          <aside className="border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="editorial-eyebrow">PAWN schreibt mit</p>
              <button onClick={askAI} disabled={aiBusy || !prompt.trim()}
                className="flex items-center gap-2 border border-foreground bg-foreground px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-background disabled:opacity-40">
                <Sparkles className="h-3 w-3" /> {aiBusy ? "…" : "Vorschlag"}
              </button>
            </div>
            <label className="mt-4 block">
              <span className="editorial-eyebrow">Hook (Intro-Zeile, optional)</span>
              <input value={hook} onChange={(e) => setHook(e.target.value)} maxLength={60}
                className="mt-2 w-full border border-border bg-background p-2 text-sm" />
            </label>
            <label className="mt-4 block">
              <span className="editorial-eyebrow">Caption</span>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                className="mt-2 min-h-24 w-full border border-border bg-background p-2 text-sm" />
            </label>
            <label className="mt-4 block">
              <span className="editorial-eyebrow">Hashtags</span>
              <input value={hashtags.join(" ")} onChange={(e) => setHashtags(e.target.value.split(/\s+/).filter(Boolean))}
                className="mt-2 w-full border border-border bg-background p-2 text-sm" />
            </label>
          </aside>

          <div className="lg:col-span-2 flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">← Zurück</button>
            <button onClick={() => setStep(3)} disabled={!prompt.trim()}
              className="flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
              Weiter zur Produktion <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SCHRITT 3 — Produktion */}
      {step === 3 && (
        <div className="mt-8 space-y-6">
          {quota.atLimit ? (
            <div className="border border-foreground bg-white p-8 text-center">
              <p className="editorial-eyebrow">Kontingent erreicht</p>
              <h3 className="mt-3 font-serif text-2xl">Dein Plan {planLabel(plan)} ist für diesen Monat voll.</h3>
              <p className="mt-3 text-sm text-muted-foreground">Wechsle in einen größeren Plan oder warte auf den nächsten Monat.</p>
              <Link to="/studio/plan" className="mt-6 inline-block border border-foreground bg-foreground px-6 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background">Plan ansehen</Link>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_.6fr]">
              <div className="border border-border bg-black p-4">
                <div ref={previewMountRef} className={`mx-auto ${format === "1:1" ? "aspect-square" : "aspect-[9/16]"} w-full max-w-sm bg-black`} />
                {videoUrl && (
                  <video src={videoUrl} controls playsInline className={`mx-auto mt-4 ${format === "1:1" ? "aspect-square" : "aspect-[9/16]"} w-full max-w-sm bg-black`} />
                )}
              </div>
              <div className="space-y-4">
                <p className="editorial-eyebrow">Format</p>
                <div className="flex gap-2">
                  {(["9:16", "1:1"] as Format[]).map((f) => (
                    <button key={f} onClick={() => setFormat(f)}
                      className={`border px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] ${format === f ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
                      {f === "9:16" ? "Reel · 9:16" : "Feed · 1:1"}
                    </button>
                  ))}
                </div>

                <p className="editorial-eyebrow pt-2">Produktion</p>
                {cinematic && cinematicStage && cinematicStage !== "ready" && (
                  <div className="border border-foreground bg-white p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      <span>
                        {cinematicStage === "submitting" && "✦ Übergabe an die Kamera…"}
                        {cinematicStage === "polling" && (
                          <>
                            ✦ Aufnahmen entstehen — ca. 1–2 Minuten
                            {cinematicProgress.total > 0 && (
                              <span className="ml-2 tabular-nums text-muted-foreground">
                                ({cinematicProgress.done}/{cinematicProgress.total} fertig)
                              </span>
                            )}
                          </>
                        )}
                        {cinematicStage === "failed" && (cinematicError ?? "Kinematischer Modus ist fehlgeschlagen. Versuch es gleich noch einmal oder wechsle in die Editorial-Fassung.")}
                      </span>
                    </div>
                  </div>
                )}
                {!videoBlob ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Der Renderer läuft direkt in deinem Browser. Etwa 15 Sekunden. Kein Ton — Musik fügst du beim Posten hinzu.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={doRender} disabled={renderBusy}
                        className="flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background disabled:opacity-40">
                        {renderBusy ? `PAWN produziert… ${renderPct}%` : "PAWN produziert"}
                      </button>
                      <button onClick={() => setSeed(randomSeed())} disabled={renderBusy}
                        className="flex items-center gap-2 border border-border bg-white px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:border-foreground disabled:opacity-40">
                        <Shuffle className="h-3 w-3" /> Neu würfeln
                      </button>
                    </div>
                    {renderBusy && (
                      <div className="h-1 w-full border border-border bg-white">
                        <div className="h-full bg-foreground transition-all" style={{ width: `${renderPct}%` }} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm">Fertig. Sieh dir das Ergebnis an.</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setSeed(randomSeed()); void doRender(); }}
                        className="flex items-center gap-2 border border-border bg-white px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-muted">
                        <Shuffle className="h-3 w-3" /> Neu produzieren
                      </button>
                      <button onClick={saveForApproval}
                        className="border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background">
                        Zur Freigabe speichern
                      </button>
                    </div>
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Music className="mt-0.5 h-3 w-3 shrink-0" />
                      Bewusst ohne Ton: Musik wählst du direkt in Reels oder TikTok — dort ist sie lizenzsicher.
                    </p>
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Seed · {seed}</p>
                  </>
                )}
              </div>
            </div>

          )}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(2)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">← Zurück</button>
          </div>
        </div>
      )}
    </StudioShell>
  );
}

function StepHeader({ step }: { step: Step }) {
  const labels = ["Erklärung", "Material", "Prompt", "Produktion"];
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-border pb-6">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center border text-[0.62rem] ${i <= step ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>{i + 1}</span>
          <span className={`text-[0.68rem] uppercase tracking-[0.24em] ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
          {i < labels.length - 1 && <span className="ml-2 hidden h-px w-8 bg-border sm:inline-block" />}
        </div>
      ))}
    </div>
  );
}
