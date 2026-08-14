/**
 * Admin-Video-Archiv: alle Videos aller Häuser an einem Ort.
 * Stern = Startseiten-Video (Landing-Feed), Pfeil = in die Posting-Queue schicken.
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Star, Send } from "lucide-react";

type Source = "designer" | "edition" | "jarvis";
type MediaKind = "bild" | "video";
type MediaOrigin = "upload" | "erzeugt" | "edition";

/** Die drei Stufen, für die ein Werk als Plan-Beispiel freigegeben werden kann. */
type Stufe = "haus" | "atelier" | "maison";
const STUFEN: Stufe[] = ["haus", "atelier", "maison"];
const STUFE_LABEL: Record<Stufe, string> = { haus: "Haus", atelier: "Atelier", maison: "Maison" };

interface SubmittedRow {
  id: string;
  kind: MediaKind;
  origin: MediaOrigin;
  url: string;
  title: string | null;
  created_at: string;
  designers?: { brand_name: string; house_number: number | null } | null;
}

/** Ein Bild aus einer Mediathek, das angenommen wurde — Kandidat für ein Plan-Beispiel. */
interface BildRow {
  id: string;
  url: string;
  title: string | null;
  rights_granted: boolean;
  plan_beispiel: Stufe | null;
  designers?: { brand_name: string; intern: boolean } | null;
}

const MEDIA_ORIGIN_LABEL: Record<MediaOrigin, string> = { upload: "Eigener Upload", erzeugt: "KI erzeugt", edition: "Gemeinsame Kampagne" };

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

const SOURCE_LABEL: Record<Source, string> = { designer: "Designer", edition: "Gemeinsame Kampagne", jarvis: "PAWN" };

export default function AdminArchiv() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [submitted, setSubmitted] = useState<SubmittedRow[]>([]);
  const [bilder, setBilder] = useState<BildRow[]>([]);
  // Freigaben je Video (Werk-ID -> Stufe). Getrennt geladen, damit das Archiv auch
  // dann vollständig steht, wenn das Freigabe-Feld noch nicht in der Datenbank ist.
  const [videoFreigaben, setVideoFreigaben] = useState<Record<string, Stufe>>({});
  const [freigabeBereit, setFreigabeBereit] = useState(false);
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

  const refreshSubmitted = async () => {
    const { data } = await supabase.from("media_assets" as never)
      .select("id, kind, origin, url, title, created_at, designers:designer_id(brand_name, house_number)")
      .eq("review_status", "eingereicht")
      .order("created_at", { ascending: false });
    setSubmitted((data ?? []) as unknown as SubmittedRow[]);
  };

  /** Angenommene Bilder + die aktuellen Plan-Freigaben. Bewusst eine eigene Abfrage:
   *  solange das Feld `plan_beispiel` noch nicht in der Datenbank steht, schlägt nur
   *  dieser Teil fehl — das Archiv selbst bleibt vollständig bedienbar. */
  const refreshFreigaben = async () => {
    const bild = await supabase.from("media_assets" as never)
      .select("id, url, title, rights_granted, plan_beispiel, designers:designer_id(brand_name, intern)")
      .eq("kind", "bild")
      .eq("review_status", "angenommen")
      .order("created_at", { ascending: false })
      .limit(60);
    const video = await supabase.from("video_assets" as never)
      .select("id, plan_beispiel")
      .not("plan_beispiel", "is", null);

    if (bild.error || video.error) { setFreigabeBereit(false); return; }
    setFreigabeBereit(true);
    setBilder((bild.data ?? []) as unknown as BildRow[]);
    const map: Record<string, Stufe> = {};
    for (const v of (video.data ?? []) as unknown as Array<{ id: string; plan_beispiel: Stufe }>) map[v.id] = v.plan_beispiel;
    setVideoFreigaben(map);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refresh();
    void refreshSubmitted();
    void refreshFreigaben();
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
    toast.success(!row.premiere ? "Startseiten-Video gesetzt." : "Aus Startseiten-Video entfernt.");
    void refresh();
  };

  const decideSubmission = async (row: SubmittedRow, approve: boolean) => {
    setBusy(row.id);
    const { error } = await supabase.from("media_assets" as never)
      .update({ review_status: approve ? "angenommen" : "abgelehnt" } as never).eq("id", row.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Angenommen." : "Abgelehnt.");
    void refreshSubmitted();
  };

  /** Gibt ein Werk als Plan-Beispiel einer Stufe frei — oder nimmt die Freigabe zurück.
   *  Je Stufe steht höchstens ein Werk: eine neue Freigabe löst die alte ab. */
  const setzePlanBeispiel = async (tabelle: "media_assets" | "video_assets", id: string, stufe: Stufe | null) => {
    setBusy(id);
    if (stufe) {
      // Erst die bisherige Freigabe dieser Stufe lösen — in beiden Ablagen.
      await supabase.from("media_assets" as never).update({ plan_beispiel: null } as never).eq("plan_beispiel", stufe);
      await supabase.from("video_assets" as never).update({ plan_beispiel: null } as never).eq("plan_beispiel", stufe);
    }
    const { error } = await supabase.from(tabelle as never).update({ plan_beispiel: stufe } as never).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(stufe ? `Als Plan-Beispiel für ${STUFE_LABEL[stufe]} freigegeben.` : "Freigabe zurückgenommen.");
    void refreshFreigaben();
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
        Jedes erzeugte Video aller Häuser — Stern setzt eine Startseiten-Video auf der Startseite, der Pfeil schickt die Kampagne in die Posting-Warteschlange.
      </p>

      {submitted.length > 0 && (
        <section className="mt-8 border border-foreground bg-white">
          <header className="border-b border-border px-5 py-3">
            <p className="editorial-eyebrow">Aus der Mediathek eingereicht · {submitted.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Häuser haben diese Dateien zur Prüfung eingereicht — die Entscheidung liegt bei dir.</p>
          </header>
          <div className="grid gap-4 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {submitted.map((s) => (
              <div key={s.id} className="border border-border bg-white">
                <div className="border-b border-border bg-muted">
                  {s.kind === "video" ? (
                    <video src={s.url} muted playsInline className="aspect-square w-full object-cover" />
                  ) : (
                    <img src={s.url} alt={s.title ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm">{s.title ?? "Ohne Titel"}</p>
                  <p className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {s.designers?.brand_name ?? "—"} · {MEDIA_ORIGIN_LABEL[s.origin]}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => void decideSubmission(s, true)} disabled={busy === s.id}
                      className="flex-1 border border-foreground bg-foreground px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:opacity-40">
                      Annehmen
                    </button>
                    <button onClick={() => void decideSubmission(s, false)} disabled={busy === s.id}
                      className="flex-1 border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-40">
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plan-Beispiele: nur was hier ausdrücklich freigegeben ist, erscheint auf der
          Plan-Seite. Ohne Freigabe steht dort das hinterlegte Plan-Bild — nie ein
          Werk, das sich das System selbst aus dem Bestand gesucht hat. */}
      <section className="mt-8 border border-foreground bg-white">
        <header className="border-b border-border px-5 py-3">
          <p className="editorial-eyebrow">Plan-Beispiele</p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Je Stufe steht höchstens ein Werk auf der Plan-Seite — und nur, wenn du es hier freigibst.
            Ohne Freigabe zeigt die Stufe ihr hinterlegtes Bild. Interne Häuser (Test, Demo, PAWN-eigen)
            sind grundsätzlich ausgenommen.
          </p>
        </header>

        {!freigabeBereit ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Die Freigabe steht bereit, sobald die zugehörige Datenbank-Änderung eingespielt ist.
            Bis dahin zeigen alle drei Stufen ihr hinterlegtes Bild.
          </p>
        ) : (
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {STUFEN.map((stufe) => {
                const bild = bilder.find((b) => b.plan_beispiel === stufe);
                const videoId = Object.keys(videoFreigaben).find((id) => videoFreigaben[id] === stufe);
                const video = videoId ? rows.find((r) => r.id === videoId) : undefined;
                const belegt = bild ?? video;
                return (
                  <div key={stufe} className="border border-border p-4">
                    <p className="editorial-eyebrow">{STUFE_LABEL[stufe]}</p>
                    {belegt ? (
                      <>
                        <p className="mt-2 truncate text-sm">
                          {bild ? (bild.title ?? "Bild ohne Titel") : "Video"} · {(bild?.designers?.brand_name ?? video?.designers?.brand_name) ?? "—"}
                        </p>
                        <button
                          onClick={() => void setzePlanBeispiel(bild ? "media_assets" : "video_assets", bild ? bild.id : (videoId as string), null)}
                          disabled={busy === (bild ? bild.id : videoId)}
                          className="mt-3 border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-40"
                        >
                          Freigabe zurücknehmen
                        </button>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Keine Freigabe — es steht das hinterlegte Bild.</p>
                    )}
                  </div>
                );
              })}
            </div>

            {bilder.length > 0 && (
              <>
                <p className="mt-6 editorial-eyebrow">Angenommene Bilder · zur Freigabe</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {bilder.map((b) => {
                    const gesperrt = !!b.designers?.intern || !b.rights_granted;
                    return (
                      <div key={b.id} className="border border-border">
                        <img src={b.url} alt={b.title ?? ""} loading="lazy" className="aspect-square w-full border-b border-border object-cover" />
                        <div className="p-3">
                          <p className="truncate text-sm">{b.title ?? "Ohne Titel"}</p>
                          <p className="mt-1 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{b.designers?.brand_name ?? "—"}</p>
                          {gesperrt ? (
                            <p className="mt-2 text-[0.62rem] text-muted-foreground">
                              {b.designers?.intern ? "Internes Haus — kann kein Plan-Beispiel stellen." : "Rechte-Haken fehlt."}
                            </p>
                          ) : (
                            <select
                              value={b.plan_beispiel ?? ""}
                              onChange={(e) => void setzePlanBeispiel("media_assets", b.id, (e.target.value || null) as Stufe | null)}
                              disabled={busy === b.id}
                              aria-label="Als Plan-Beispiel freigeben"
                              className="mt-2 w-full border border-border bg-white px-2 py-2 text-sm"
                            >
                              <option value="">Kein Plan-Beispiel</option>
                              {STUFEN.map((s) => <option key={s} value={s}>Beispiel für {STUFE_LABEL[s]}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </section>

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
          <option value="">Alle Bildsprachen</option>
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
                title={r.premiere ? "Startseiten-Video entfernen" : "Als Startseiten-Video setzen"}
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
                <p className="mt-2 text-[0.62rem] text-muted-foreground">Rechte-Haken fehlt — nicht für Startseiten-Video geeignet.</p>
              )}
              {freigabeBereit && r.rights_granted && (
                <select
                  value={videoFreigaben[r.id] ?? ""}
                  onChange={(e) => void setzePlanBeispiel("video_assets", r.id, (e.target.value || null) as Stufe | null)}
                  disabled={busy === r.id}
                  aria-label="Als Plan-Beispiel freigeben"
                  className="mt-3 w-full border border-border bg-white px-2 py-2 text-sm"
                >
                  <option value="">Kein Plan-Beispiel</option>
                  {STUFEN.map((s) => <option key={s} value={s}>Beispiel für {STUFE_LABEL[s]}</option>)}
                </select>
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
