/**
 * Studio-Videothek: eigene Videos, Download + fertige Caption/Hashtags aus der Brand-DNA.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface VideoRow {
  id: string;
  url: string;
  source: "designer" | "edition" | "jarvis";
  premiere: boolean;
  performance: { premiere_views?: number; shop_clicks?: number } | null;
  created_at: string;
  campaigns: { title: string; content: { caption?: string; hashtags?: string[] } | null } | null;
}

export default function StudioVideothek() {
  const { designer, loading } = useMyDesigner();
  const { t } = useI18n();
  const [rows, setRows] = useState<VideoRow[]>([]);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("video_assets" as never)
      .select("id, url, source, premiere, performance, created_at, campaigns:campaign_id(title, content)")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as VideoRow[]));
  }, [designer]);

  const brandTags = useMemo(() => {
    const signals = (designer?.brand_dna as { signals?: string[] } | null)?.signals ?? [];
    return signals.slice(0, 6).map((s) => `#${s.replace(/\s+/g, "").toLowerCase()}`);
  }, [designer]);

  if (loading) return <StudioShell title={t("studio.videothek.title")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.videothek.title")}><p className="text-muted-foreground">{t("studio.videothek.noAccess")}</p></StudioShell>;

  const captionFor = (r: VideoRow) => r.campaigns?.content?.caption?.trim()
    || t("studio.videothek.captionFallback", { brand: designer.brand_name });
  const hashtagsFor = (r: VideoRow) => {
    const own = r.campaigns?.content?.hashtags ?? [];
    return (own.length > 0 ? own : brandTags.length > 0 ? brandTags : t("studio.videothek.defaultHashtags").split(" "))
      .map((h) => h.startsWith("#") ? h : `#${h}`);
  };

  const copyCaption = (r: VideoRow) => {
    const text = `${captionFor(r)}\n\n${hashtagsFor(r).join(" ")}`;
    void navigator.clipboard.writeText(text);
    toast.success(t("studio.videothek.copiedToast"));
  };

  return (
    <StudioShell title={t("studio.videothek.title")} eyebrow={t("studio.videothek.eyebrow")}>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {t("studio.videothek.description")}
      </p>
      {rows.length === 0 ? (
        <PawnEmptyState
          className="mt-10"
          title={t("studio.videothek.empty")}
          action={
            <Link to="/studio/kampagnen/neu" className="inline-flex items-center border border-foreground px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
              {t("studio.videothek.emptyCta")}
            </Link>
          }
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="border border-border bg-white">
              <div className="border-b border-border bg-black">
                <video src={r.url} muted playsInline controls className="aspect-[9/16] w-full bg-black object-contain" />
              </div>
              <div className="p-4">
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("de-DE")}{r.premiere ? ` · ${t("studio.videothek.premiere")}` : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-sm">{captionFor(r)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{hashtagsFor(r).join(" ")}</p>
                <div className="mt-4 flex gap-2">
                  <a href={r.url} download target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 border border-foreground px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background">
                    <Download className="h-3.5 w-3.5" /> {t("common.download")}
                  </a>
                  <button onClick={() => copyCaption(r)}
                    className="flex items-center justify-center gap-2 border border-border px-3 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
                    <Copy className="h-3.5 w-3.5" /> {t("studio.videothek.captionButton")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </StudioShell>
  );
}
