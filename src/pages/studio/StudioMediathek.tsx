/**
 * Mediathek (Teil 12b): zentrale Ablage für alles, was ein Haus erzeugt oder hochlädt —
 * eigene Uploads gleichwertig neben KI-Material. Wege hinaus: Produktseite, Banner
 * vormerken, PAWN-Archiv zur Prüfung, Download, Feedback im Content-Begleiter (Teil 16b,
 * nur für eigene Uploads — PAWN gibt kein Feedback zu KI-erzeugtem Material).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";
import { useCredits } from "@/features/campaign/quota";
import { supabase } from "@/integrations/supabase/client";
import { Download, Upload, Sparkles, Image as ImageIcon, Trash2, Send, Check, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Kind = "bild" | "video";
type Origin = "upload" | "erzeugt" | "edition";
type ReviewStatus = "privat" | "eingereicht" | "angenommen" | "abgelehnt";

interface MediaRow {
  id: string;
  kind: Kind;
  origin: Origin;
  url: string;
  title: string | null;
  note: string | null;
  usages: Array<{ type: string; product_id?: string }>;
  rights_granted: boolean;
  review_status: ReviewStatus;
  created_at: string;
}

interface ProductLite { id: string; name: string; }

const KIND_LABEL: Record<Kind, string> = { bild: "Bild", video: "Video" };
const ORIGIN_LABEL: Record<Origin, string> = { upload: "Eigener Upload", erzeugt: "KI erzeugt", edition: "Edition" };
const REVIEW_LABEL: Record<ReviewStatus, string> = { privat: "Privat", eingereicht: "Eingereicht", angenommen: "Angenommen", abgelehnt: "Abgelehnt" };

const MAX_IMAGE_MB = 20;
const MAX_VIDEO_MB = 300;

function kindOf(file: File): Kind | null {
  if (file.type.startsWith("image/")) return "bild";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export default function StudioMediathek() {
  const { designer, loading } = useMyDesigner();
  const { user } = useAuth();
  const plan = (designer as unknown as { plan?: "haus" | "atelier" | "maison" })?.plan ?? "haus";
  const credits = useCredits(designer?.id, plan);

  const [rows, setRows] = useState<MediaRow[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [filter, setFilter] = useState<"alle" | Kind>("alle");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    if (!designer) return;
    const { data } = await supabase.from("media_assets" as never)
      .select("id, kind, origin, url, title, note, usages, rights_granted, review_status, created_at")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as MediaRow[]);
  };

  useEffect(() => { void refresh(); }, [designer]);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("products").select("id, name").eq("designer_id", designer.id).order("name")
      .then(({ data }) => setProducts((data ?? []) as ProductLite[]));
  }, [designer]);

  const filtered = useMemo(() => filter === "alle" ? rows : rows.filter((r) => r.kind === filter), [rows, filter]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !designer || !user) return;
    const list = Array.from(files).slice(0, 10);
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const file of list) {
      const kind = kindOf(file);
      if (!kind) {
        toast.error(`${file.name}: nur Bilder oder Videos.`);
        setUploadProgress((p) => p ? { ...p, done: p.done + 1 } : p);
        continue;
      }
      const maxMb = kind === "bild" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
      if (file.size > maxMb * 1024 * 1024) {
        toast.error(`${file.name}: zu groß (max. ${maxMb} MB).`);
        setUploadProgress((p) => p ? { ...p, done: p.done + 1 } : p);
        continue;
      }
      try {
        const ext = file.name.split(".").pop() || (kind === "bild" ? "jpg" : "mp4");
        const path = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("mediathek").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage.from("mediathek").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signErr || !signed) throw signErr ?? new Error("sign_failed");
        const { error: insErr } = await supabase.from("media_assets" as never).insert({
          designer_id: designer.id, kind, origin: "upload", url: signed.signedUrl, title: file.name.replace(/\.[^.]+$/, ""),
        } as never);
        if (insErr) throw insErr;
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message || "Upload fehlgeschlagen"}`);
      } finally {
        setUploadProgress((p) => p ? { ...p, done: p.done + 1 } : p);
      }
    }
    setUploading(false);
    setUploadProgress(null);
    if (ok > 0) { toast.success(`${ok} Datei${ok === 1 ? "" : "en"} hochgeladen.`); void refresh(); }
  };

  const applyFreisteller = async (row: MediaRow) => {
    if (!designer) return;
    if (!credits.canAfford(credits.costs.product_shot ?? 1)) {
      toast.error(`Nicht genug Credits — Freisteller kostet ${credits.costs.product_shot ?? 1}, du hast ${credits.balance}.`);
      return;
    }
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-shot", {
        body: { designer_id: designer.id, source_url: row.url },
      });
      if (error) throw error;
      const r = data as { result_url?: string; error?: string; message?: string } | null;
      if (!r?.result_url) throw new Error(r?.message ?? r?.error ?? "Freisteller fehlgeschlagen.");
      await supabase.from("media_assets" as never).insert({
        designer_id: designer.id, kind: "bild", origin: "erzeugt", url: r.result_url,
        title: row.title ? `${row.title} · Freisteller` : "Freisteller", note: `Aus: ${row.id}`,
      } as never);
      toast.success("Freisteller fertig — als neue Datei in der Mediathek.");
      void refresh();
      void credits.refresh();
    } catch (e) {
      toast.error((e as Error).message || "Freisteller fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  };

  const useOnProduct = async (row: MediaRow, productId: string) => {
    if (!productId) return;
    setBusyId(row.id);
    try {
      const { error } = await supabase.from("products").update({ image_url: row.url }).eq("id", productId);
      if (error) throw error;
      await supabase.from("media_assets" as never).update({
        usages: [...row.usages, { type: "produkt", product_id: productId }],
      } as never).eq("id", row.id);
      toast.success("Als Produktbild gesetzt.");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message || "Fehler");
    } finally {
      setBusyId(null);
    }
  };

  const markForBanner = async (row: MediaRow) => {
    setBusyId(row.id);
    await supabase.from("media_assets" as never).update({
      usages: [...row.usages, { type: "banner_vormerkung" }],
    } as never).eq("id", row.id);
    toast.success("Für Banner vorgemerkt — sichtbar wird das mit den Hausseiten-Bausteinen.");
    setBusyId(null);
    void refresh();
  };

  const submitToArchive = async (row: MediaRow) => {
    setBusyId(row.id);
    await supabase.from("media_assets" as never).update({ review_status: "eingereicht" } as never).eq("id", row.id);
    toast.success("Ins PAWN-Archiv eingereicht — die Entscheidung liegt beim Admin.");
    setBusyId(null);
    void refresh();
  };

  const remove = async (row: MediaRow) => {
    if (!confirm("Diese Datei wirklich löschen?")) return;
    setBusyId(row.id);
    await supabase.from("media_assets" as never).delete().eq("id", row.id);
    setBusyId(null);
    void refresh();
  };

  const saveTitle = async (row: MediaRow, title: string) => {
    if (title === (row.title ?? "")) return;
    await supabase.from("media_assets" as never).update({ title } as never).eq("id", row.id);
  };

  if (loading) return <StudioShell title="Mediathek"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Mediathek"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Mediathek" eyebrow="Material">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Alles, was dein Haus erzeugt oder hochlädt, landet hier — eigene Fotos und Videos gleichberechtigt neben KI-Material aus dem Kampagnen-Studio.
      </p>

      <div className="mt-6 border-2 border-dashed border-border bg-white p-8 text-center">
        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-3 text-sm">Zieh Fotos oder Videos hierher, oder wähle sie aus. Mehrfachauswahl möglich.</p>
        <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center border border-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
          Dateien auswählen
          <input type="file" accept="image/*,video/*" multiple className="hidden" disabled={uploading}
            onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }} />
        </label>
        {uploadProgress && (
          <p className="mt-3 text-xs text-muted-foreground">Lade hoch … {uploadProgress.done} / {uploadProgress.total}</p>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {(["alle", "bild", "video"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`min-h-[36px] border px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] ${filter === f ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
            {f === "alle" ? "Alle" : f === "bild" ? "Bilder" : "Videos"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Noch nichts hier. Lade eine Datei hoch, oder erzeuge Material im <a href="/studio/kampagnen/neu" className="underline">Kampagnen-Studio</a>.</p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((row) => (
            <div key={row.id} className="border border-border bg-white">
              <div className="border-b border-border bg-muted">
                {row.kind === "video" ? (
                  <video src={row.url} muted playsInline loop autoPlay className="aspect-square w-full object-cover" />
                ) : (
                  <img src={row.url} alt={row.title ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="p-3">
                <input defaultValue={row.title ?? ""} placeholder="Titel"
                  onBlur={(e) => void saveTitle(row, e.target.value)}
                  className="w-full border-0 border-b border-transparent bg-transparent text-sm font-medium focus:border-border focus:outline-none" />
                <p className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {KIND_LABEL[row.kind]} · {ORIGIN_LABEL[row.origin]} · {REVIEW_LABEL[row.review_status]}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.kind === "bild" && (
                    <button onClick={() => void applyFreisteller(row)} disabled={busyId === row.id}
                      className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide hover:border-foreground disabled:opacity-50">
                      <Sparkles className="h-3 w-3" /> Freisteller · {credits.costs.product_shot ?? 1} Cr.
                    </button>
                  )}
                  <a href={row.url} download className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide hover:border-foreground">
                    <Download className="h-3 w-3" /> Download
                  </a>
                  {row.origin === "upload" && (
                    <Link to={`/studio/content-begleiter?media=${row.id}`}
                      className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide hover:border-foreground">
                      <MessageSquare className="h-3 w-3" /> Feedback
                    </Link>
                  )}
                  {row.review_status === "privat" && (
                    <button onClick={() => void submitToArchive(row)} disabled={busyId === row.id}
                      className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide hover:border-foreground disabled:opacity-50">
                      <Send className="h-3 w-3" /> Ins Archiv
                    </button>
                  )}
                  <button onClick={() => void markForBanner(row)} disabled={busyId === row.id}
                    className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide hover:border-foreground disabled:opacity-50">
                    <ImageIcon className="h-3 w-3" /> Für Banner vormerken
                  </button>
                  <button onClick={() => void remove(row)} disabled={busyId === row.id}
                    className="flex min-h-[32px] items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-wide text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50">
                    <Trash2 className="h-3 w-3" /> Löschen
                  </button>
                </div>

                {row.kind === "bild" && products.length > 0 && (
                  <label className="mt-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                    <select defaultValue="" onChange={(e) => { const v = e.target.value; if (v) void useOnProduct(row, v); e.target.value = ""; }}
                      className="min-h-[32px] flex-1 border border-border bg-white px-2 py-1 text-[0.68rem] normal-case tracking-normal text-foreground">
                      <option value="">Auf Produktseite verwenden…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                )}

                {row.usages.some((u) => u.type === "produkt") && (
                  <p className="mt-2 flex items-center gap-1 text-[0.58rem] text-muted-foreground"><Check className="h-3 w-3" /> Auf Produktseite verwendet</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </StudioShell>
  );
}
