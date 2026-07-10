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
  const [cinematicClips, setCinematicClips] = useState<string[]>([]);
  const previewMountRef = useRef<HTMLDivElement | null>(null);

  // Quota
  const plan: Plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = useCampaignQuota(designer?.id, plan, isAdmin);
  const cinematicAllowed = isAdmin || plan === "atelier" || plan === "maison";


  // Load consent + products.
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [{ data: d }, { data: prods }] = await Promise.all([
        supabase.from("designers").select("image_usage_consent").eq("id", designer.id).maybeSingle(),
        supabase.from("products").select("id, name, slug, world, image_url").eq("designer_id", designer.id).order("created_at", { ascending: false }),
      ]);
      setConsentOk(((d as unknown as { image_usage_consent?: boolean } | null)?.image_usage_consent) === true);
      setProducts((prods ?? []) as ProductLite[]);
    })();
  }, [designer]);

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
    if (chosenProduct?.image_url) return [chosenProduct.image_url];
    return uploaded.map((u) => u.url);
  }, [chosenProduct, uploaded]);

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

  // Cinematic mode: submit fal.ai jobs and poll until clips ready or timeout.
  const runCinematic = async (): Promise<string[] | null> => {
    if (!designer) return null;
    // Create a temp campaign row? No — we just want clip URLs. We reuse an
    // ephemeral campaigns row by inserting a draft first.
    const { data: campRow, error: campErr } = await supabase.from("campaigns").insert({
      designer_id: designer.id,
      title: `${designer.brand_name} · Draft`,
      kind: "video",
      status: "draft",
      content: { image_urls: chosenImages, cinematic: true } as unknown as Record<string, unknown>,
      created_by: user?.id ?? null,
    } as never).select("id").single();
    if (campErr || !campRow) { toast.error(campErr?.message ?? "Draft konnte nicht angelegt werden."); return null; }
    const campaign_id = (campRow as { id: string }).id;

    setCinematicStage("submitting");
    const { data: submitData, error: submitErr } = await supabase.functions.invoke("generate-broll", {
      body: { campaign_id, image_urls: chosenImages.slice(0, 3), motion_prompt: prompt },
    });
    if (submitErr) {
      const msg = submitErr.message ?? String(submitErr);
      toast.error(msg.includes("provider_not_configured") ? "Kinematischer Modus ist nicht eingerichtet." : `Fehler: ${msg}`);
      setCinematicStage("failed");
      return null;
    }
    type Sub = { id: string; request_id?: string } | { image_url: string; error: string; status?: number };
    const allSubs = ((submitData as { submissions?: Sub[] })?.submissions ?? []);
    const submissions = allSubs.filter((s): s is { id: string; request_id?: string } => "id" in s);
    if (submissions.length === 0) {
      const firstErr = allSubs.find((s): s is { image_url: string; error: string; status?: number } => "error" in s);
      const isCredit = firstErr && (firstErr.status === 402 || /guthaben|credit|402|insufficient/i.test(firstErr.error));
      toast.error(isCredit
        ? "fal.ai-Guthaben fehlt — bitte im fal.ai-Konto Credits aufladen und erneut versuchen."
        : `Provider hat keine Aufträge angenommen. ${firstErr?.error ?? ""}`);
      setCinematicStage("failed");
      return null;
    }


    setCinematicStage("polling");
    const requestIds = submissions.map((s) => s.id);
    const deadline = Date.now() + 6 * 60 * 1000;
    let clips: string[] = [];
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      const { data: pollData } = await supabase.functions.invoke("poll-broll", { body: { request_ids: requestIds } });
      const results = (pollData as { results?: Array<{ id: string; status: string; result_url?: string }> })?.results ?? [];
      if (results.every((r) => r.status === "done" || r.status === "failed")) {
        clips = results.filter((r) => r.status === "done" && r.result_url).map((r) => r.result_url!);
        break;
      }
    }
    if (clips.length === 0) {
      setCinematicStage("failed");
      return null;
    }
    setCinematicClips(clips);
    setCinematicStage("ready");
    return clips;
  };

  // Render video
  const doRender = async () => {
    if (!designer) return;
    if (chosenImages.length < 1) { toast.error("Mindestens 1 Bild."); return; }
    setRenderBusy(true); setRenderPct(0); setVideoBlob(null); setVideoUrl(null);

    let clipUrls: string[] | undefined;
    if (cinematic) {
      const clips = await runCinematic();
      if (!clips || clips.length === 0) {
        toast.message("Die Kamera hatte einen schlechten Tag — hier ist die Editorial-Fassung.");
        clipUrls = undefined;
      } else {
        clipUrls = clips;
      }
    }

    try {
      const houseNo = (designer as unknown as { house_number?: number | null })?.house_number ?? null;
      const result = await renderCampaign({
        brandName: designer.brand_name,
        houseNumber: houseNo,
        hookLine: hook || null,
        imageUrls: clipUrls ? undefined : chosenImages.slice(0, 4),
        clipUrls,
        tempo,
        productLabel: chosenProduct ? `${chosenProduct.world} · ${designer.brand_name}` : designer.brand_name,
        productName: chosenProduct?.name ?? designer.brand_name,
        format,
        seed,
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
      toast.success("Video steht.");
    } catch (e) {
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
      const content: DraftContent = {
        asset_url: signedUrl,
        asset_path: path,
        mime: videoMime,
        caption, hashtags, hook, prompt, tempo,
        product_id: chosenProduct?.id ?? null,
        image_urls: chosenImages,
      };
      const title = chosenProduct
        ? `${chosenProduct.name} · Kampagne`
        : `${designer.brand_name} · Reel`;
      const { error } = await supabase.from("campaigns").insert({
        designer_id: designer.id,
        product_id: chosenProduct?.id ?? null,
        title,
        kind: "video",
        status: "proposed",
        content: content as unknown as Record<string, unknown>,
        created_by: user.id,
      } as never);
      if (error) throw error;
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
          </aside>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={consentOk !== true || quota.atLimit}
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

            <p className="editorial-eyebrow mt-8">✦ Kinematischer Modus</p>
            <div className={`mt-3 border ${cinematic ? "border-foreground" : "border-border"} bg-white p-4`}>
              <label className={`flex items-start gap-3 ${cinematicAllowed ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                <input
                  type="checkbox"
                  checked={cinematic}
                  disabled={!cinematicAllowed}
                  onChange={(e) => setCinematic(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-foreground"
                />
                <div>
                  <p className="font-serif text-base">Echte KI-Bewegung statt Standbildern.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    PAWN erzeugt für jedes Foto einen kurzen Clip (fal.ai · Kling), schneidet sie in deiner Regie.
                    {cinematicAllowed
                      ? ` Verbraucht ${quota.accentCostUnits} deiner ${Number.isFinite(quota.limit) ? quota.limit : "∞"} Kampagnen.`
                      : " Verfügbar ab Atelier."}
                  </p>
                  {!cinematicAllowed && (
                    <Link to="/studio/plan" className="mt-2 inline-block text-xs underline">Plan ansehen</Link>
                  )}
                </div>
              </label>
            </div>

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
                        {cinematicStage === "submitting" && "Übergabe an die Kamera…"}
                        {cinematicStage === "polling" && "Die Kamera arbeitet — das kann 1–3 Minuten dauern."}
                        {cinematicStage === "failed" && "Die Kamera hatte einen schlechten Tag — es wird die Editorial-Fassung."}
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
