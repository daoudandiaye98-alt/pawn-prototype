/**
 * Content-Begleiter (Teil 16b): PAWN erzeugt keine Beiträge für die Kanäle der Designer —
 * dieser Bereich hilft, eigenes, selbst aufgenommenes Material stärker zu machen. Ein Foto
 * oder kurzes Video hochladen (oder aus der Mediathek übernehmen), konkretes Feedback erhalten
 * (Bildaufbau, Licht, Hintergrund, Verdeckung, Ausschnitt), einen Geschichte-Vorschlag und bei
 * Bedarf einen Hinweis für eine Wiederholung. Dazu ein knapper Leitfaden für die eigene Welt.
 *
 * Video-Feedback: Deno kann kein Video dekodieren, darum werden im Browser per <canvas> 1-3
 * Einzelbilder aus dem eigenen Video gezogen und als Bild-Frames an Claude geschickt.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useContentValue } from "@/components/palace/Editable";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { World } from "@/core/types/entities";
import { useI18n } from "@/lib/i18n";

type Kind = "bild" | "video";

function kindOf(file: File): Kind | null {
  if (file.type.startsWith("image/")) return "bild";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

interface FeedbackResult { punkte: string[]; geschichte: string | null; wiederholung_tipp: string | null }

const WORLD_GUIDE_FALLBACK: Record<World, string> = {
  Mode: "Zeig die Hand, die näht, und den Übergang am Stück — Naht, Verschluss, wie der Stoff im Licht wirkt.",
  Interior: "Material und Verbindung zeigen sich am besten im seitlichen Tageslicht, auf Augenhöhe fotografiert.",
  Kunst: "Der Farbauftrag selbst ist oft das Interessante — eine Nahaufnahme zeigt, was die Totale verschluckt.",
};

/** Zieht bis zu 3 Einzelbilder aus einem Video als JPEG-Data-URLs, für die Analyse. */
async function extractFrames(url: string): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.src = url;
    const frames: string[] = [];
    const canvas = document.createElement("canvas");
    const timestamps = [0.2, 0.5, 0.8];
    let i = 0;

    const grab = () => {
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          frames.push(canvas.toDataURL("image/jpeg", 0.85));
        }
      } catch { /* tainted canvas oder anderer Fehler — Frame wird ausgelassen */ }
      i++;
      if (i < timestamps.length) {
        video.currentTime = timestamps[i] * video.duration;
      } else {
        resolve(frames);
      }
    };

    video.onloadedmetadata = () => { video.currentTime = timestamps[0] * video.duration; };
    video.onseeked = grab;
    video.onerror = () => resolve(frames);
    setTimeout(() => resolve(frames), 15000);
  });
}

export default function StudioContentBegleiter() {
  const { designer, loading } = useMyDesigner();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [world, setWorld] = useState<World>("Mode");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<Kind | null>(null);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const guideMode = useContentValue("content_guide.mode.text", WORLD_GUIDE_FALLBACK.Mode);
  const guideInterior = useContentValue("content_guide.interior.text", WORLD_GUIDE_FALLBACK.Interior);
  const guideKunst = useContentValue("content_guide.kunst.text", WORLD_GUIDE_FALLBACK.Kunst);
  const guides: Record<World, string> = { Mode: guideMode, Interior: guideInterior, Kunst: guideKunst };

  useEffect(() => {
    if (!designer) return;
    void supabase.from("products").select("world").eq("designer_id", designer.id)
      .then(({ data }) => {
        const rows = (data ?? []) as { world: World }[];
        if (!rows.length) return;
        const counts: Partial<Record<World, number>> = {};
        for (const r of rows) counts[r.world] = (counts[r.world] ?? 0) + 1;
        const top = (Object.entries(counts) as [World, number][]).sort((a, b) => b[1] - a[1])[0];
        if (top) setWorld(top[0]);
      });
  }, [designer]);

  const runFeedback = async (url: string, kind: Kind) => {
    if (!designer) return;
    setBusy(true);
    setResult(null);
    setStatus(kind === "video" ? t("studio.contentBegleiter.statusExtractingFrames") : t("studio.contentBegleiter.statusLookingAtImage"));
    try {
      let body: Record<string, unknown>;
      if (kind === "video") {
        const frames = await extractFrames(url);
        if (frames.length === 0) {
          toast.error(t("studio.contentBegleiter.errorNoFrames"));
          setBusy(false); setStatus(null);
          return;
        }
        body = { designer_id: designer.id, kind: "video", frames, locale };
      } else {
        body = { designer_id: designer.id, kind: "bild", source_url: url, locale };
      }
      setStatus(t("studio.contentBegleiter.statusGivingFeedback"));
      const { data, error } = await supabase.functions.invoke("generate-content-feedback", { body });
      if (error) throw error;
      const r = data as { ok?: boolean; punkte?: string[]; geschichte?: string | null; wiederholung_tipp?: string | null; message?: string; error?: string } | null;
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? t("studio.contentBegleiter.errorFeedbackFailed"));
      setResult({ punkte: r.punkte ?? [], geschichte: r.geschichte ?? null, wiederholung_tipp: r.wiederholung_tipp ?? null });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const onUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !designer || !user) return;
    const kind = kindOf(file);
    if (!kind) { toast.error(t("studio.contentBegleiter.errorInvalidFile")); return; }
    setBusy(true);
    setStatus(t("studio.contentBegleiter.statusUploading"));
    try {
      const ext = file.name.split(".").pop() || (kind === "bild" ? "jpg" : "mp4");
      const path = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("mediathek").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from("mediathek").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr ?? new Error("sign_failed");
      await supabase.from("media_assets" as never).insert({
        designer_id: designer.id, kind, origin: "upload", url: signed.signedUrl, title: file.name.replace(/\.[^.]+$/, ""),
      } as never);
      setPreviewUrl(signed.signedUrl);
      setPreviewKind(kind);
      setBusy(false);
      setStatus(null);
      void runFeedback(signed.signedUrl, kind);
    } catch (e) {
      toast.error((e as Error).message || t("studio.contentBegleiter.errorUploadFailed"));
      setBusy(false);
      setStatus(null);
    }
  };

  // Einstieg aus der Mediathek: ?media=<id> lädt die Datei und startet die Analyse direkt.
  useEffect(() => {
    const mediaId = params.get("media");
    if (!mediaId || !designer) return;
    void supabase.from("media_assets" as never).select("url, kind").eq("id", mediaId).maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as { url: string; kind: Kind } | null;
        if (!row) return;
        setPreviewUrl(row.url);
        setPreviewKind(row.kind);
        void runFeedback(row.url, row.kind);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer]);

  if (loading) return <StudioShell title={t("studio.contentBegleiter.title")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.contentBegleiter.title")}><p className="text-muted-foreground">{t("studio.contentBegleiter.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studio.contentBegleiter.title")} eyebrow={t("studio.contentBegleiter.eyebrow")}>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t("studio.contentBegleiter.intro")}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          {!previewUrl ? (
            <div className="border-2 border-dashed border-border bg-white p-8 text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm">{t("studio.contentBegleiter.dropHint")}</p>
              <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                {t("studio.contentBegleiter.chooseFile")}
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" disabled={busy}
                  onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          ) : (
            <div className="border border-border bg-black">
              {previewKind === "video" ? (
                <video src={previewUrl} controls playsInline className="aspect-square w-full object-contain" />
              ) : (
                <img src={previewUrl} alt="" className="aspect-square w-full object-contain" />
              )}
            </div>
          )}
          {previewUrl && (
            <button type="button" onClick={() => { setPreviewUrl(null); setPreviewKind(null); setResult(null); }}
              className="mt-3 text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              {t("studio.contentBegleiter.chooseOther")}
            </button>
          )}

          {busy && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}

          {result && (
            <div className="mt-6 border border-border bg-white p-5">
              <p className="editorial-eyebrow">{t("studio.contentBegleiter.feedbackHeading")}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {result.punkte.map((p, i) => <li key={i}>· {p}</li>)}
              </ul>
              {result.geschichte && (
                <>
                  <p className="editorial-eyebrow mt-5">{t("studio.contentBegleiter.storyHeading")}</p>
                  <p className="mt-1 text-sm">{result.geschichte}</p>
                </>
              )}
              {result.wiederholung_tipp && (
                <>
                  <p className="editorial-eyebrow mt-5">{t("studio.contentBegleiter.repeatTipHeading")}</p>
                  <p className="mt-1 text-sm">{result.wiederholung_tipp}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="editorial-eyebrow">
            {t("studio.contentBegleiter.guideHeading", {
              world: world === "Mode" ? t("nav.mode") : world === "Interior" ? t("nav.interior") : t("nav.kunst"),
            })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{guides[world]}</p>
        </div>
      </div>
    </StudioShell>
  );
}
