/**
 * Admin-Video-Archiv: alle Videos aller Häuser an einem Ort.
 * Stern = Première (Landing-Feed), Pfeil = in die Posting-Queue schicken.
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Star, Send } from "lucide-react";

type Source = "designer" | "edition" | "jarvis";

interface AssetRow {
  id: string;
  designer_id: string;
  campaign_id: string | null;
  url: string;
  thumb: string | null;
  source: Source;
  video_dna: { signature?: string; tempo?: string } | null;
  rights_granted: boolean;
  premiere: boolean;
  performance: { premiere_views?: number; shop_clicks?: number } | null;
  created_at: string;
  designers?: { brand_name: string; house_number: number | null } | null;
  campaigns?: { title: string; products?: { world: string } | null } | null;
}

const SOURCE_LABEL: Record<Source, string> = { designer: "Designer", edition: "Edition", jarvis: "Jarvis" };

export default function AdminArchiv() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [filterHouse, setFilterHouse] = useState("");
  const [filterWorld, setFilterWorld] = useState("");
  const [filterSignature, setFilterSignature] = useState("");
  const [sortMode, setSortMode] = useState<"neu" | "performance">("neu");

  const refresh = async () => {
    const { data } = await supabase.from("video_assets" as never)
      .select("id, designer_id, campaign_id, url, thumb, source, video_dna, rights_granted, premiere, performance, created_at, designers:designer_id(brand_name, house_number), campaigns:campaign_id(title, products:product_id(world))")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as unknown as AssetRow[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refresh();
  }, [user, roles]);

  const houses = useMemo(() => Array.from(new Set(rows.map((r) => r.designers?.brand_name).filter(Boolean))) as string[], [rows]);
  const worlds = useMemo(() => Array.from(new Set(rows.map((r) => r.campaigns?.products?.world).filter(Boolean))) as string[], [rows]);
  const signatures = useMemo(() => Array.from(new Set(rows.map((r) => r.video_dna?.signature).filter(Boolean))) as string[], [rows]);

  const visible = useMemo(() => {
    let list = rows.filter((r) =>
      (!filterHouse || r.designers?.brand_name === filterHouse) &&
      (!filterWorld || r.campaigns?.products?.world === filterWorld) &&
      (!filterSignature || r.video_dna?.signature === filterSignature)
    );
    if (sortMode === "performance") {
      list = [...list].sort((a, b) => {
        const score = (x: AssetRow) => (x.performance?.premiere_views ?? 0) + (x.performance?.shop_clicks ?? 0) * 3;
        return score(b) - score(a);
      });
    }
    return list;
  }, [rows, filterHouse, filterWorld, filterSignature, sortMode]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const togglePremiere = async (row: AssetRow) => {
    setBusy(row.id);
    const { error } = await supabase.from("video_assets" as never)
      .update({ premiere: !row.premiere } as never).eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(!row.premiere ? "Première gesetzt." : "Aus Première entfernt.");
    void refresh();
  };

  const sendToQueue = async (row: AssetRow) => {
    if (!row.campaign_id) return toast.error("Dieses Video hängt an keiner Kampagne — kann nicht gepostet werden.");
    setBusy(row.id);
    const { error } = await supabase.from("posting_queue" as never).insert({
      campaign_id: row.campaign_id,
      channel: "pawn_instagram",
      scheduled_at: new Date().toISOString(),
    } as never);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("In die Posting-Warteschlange gelegt.");
  };

  return (
    <AdminShell title="Archiv" eyebrow="Videos">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Jedes erzeugte Video aller Häuser — Stern setzt eine Première auf der Startseite, der Pfeil schickt die Kampagne in die Posting-Warteschlange.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select value={filterHouse} onChange={(e) => setFilterHouse(e.target.value)} className="border border-border bg-white px-3 py-2 text-sm">
          <option value="">Alle Häuser</option>
          {houses.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={filterWorld} onChange={(e) => setFilterWorld(e.target.value)} className="border border-border bg-white px-3 py-2 text-sm">
          <option value="">Alle Welten</option>
          {worlds.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterSignature} onChange={(e) => setFilterSignature(e.target.value)} className="border border-border bg-white px-3 py-2 text-sm">
          <option value="">Alle Signaturen</option>
          {signatures.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "neu" | "performance")} className="border border-border bg-white px-3 py-2 text-sm">
          <option value="neu">Neueste zuerst</option>
          <option value="performance">Beste Performance zuerst</option>
        </select>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {visible.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Keine Videos gefunden.</p>}
        {visible.map((r) => (
          <div key={r.id} className="border border-border bg-white">
            <div className="relative border-b border-border bg-black">
              <video src={r.url} muted playsInline className="aspect-[9/16] w-full bg-black object-contain" />
              <button
                onClick={() => togglePremiere(r)}
                disabled={busy === r.id}
                title={r.premiere ? "Première entfernen" : "Als Première setzen"}
                className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center border ${r.premiere ? "border-white bg-white text-black" : "border-white/60 bg-black/40 text-white"}`}
              >
                <Star className="h-4 w-4" fill={r.premiere ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="p-3">
              <p className="truncate font-serif text-sm">{r.designers?.brand_name ?? "—"} {r.designers?.house_number != null ? `· №${r.designers.house_number}` : ""}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                {SOURCE_LABEL[r.source]} · {r.campaigns?.products?.world ?? "—"}{r.video_dna?.signature ? ` · ${r.video_dna.signature}` : ""}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {r.performance?.premiere_views ?? 0} Aufrufe · {r.performance?.shop_clicks ?? 0} Shop-Klicks
              </p>
              {!r.rights_granted && (
                <p className="mt-2 text-[0.62rem] text-amber-700">Rechte-Haken fehlt — nicht für Première geeignet.</p>
              )}
              <button
                onClick={() => sendToQueue(r)}
                disabled={busy === r.id || !r.campaign_id}
                className="mt-3 flex w-full items-center justify-center gap-2 border border-foreground px-3 py-2 text-[0.62rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> An Posting-Queue
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
