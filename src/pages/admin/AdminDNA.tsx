/**
 * Genom — die Basis-DNA der Plattform (ai_config.matching_weights, editierbar)
 * plus je Haus eine Genom-Karte mit dem, was aus seiner eigenen Performance
 * gelernt wurde (designers.video_taste_weights), verknüpften Signaturen und
 * einem kurzen Verlauf aus den wöchentlichen Kampagnen-Regie-Berichten.
 */
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { GenomeCard, type GenomeStrand } from "@/components/palace/GenomeCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { DEFAULT_MATCHING_WEIGHTS, type MatchingWeights } from "@/features/personalization";

const STRAND_LABELS: Record<keyof MatchingWeights, string> = {
  mood: "Stimmung",
  silhouette: "Silhouette",
  material: "Material",
  colors: "Farbwelt",
};
const STRAND_KEYS = Object.keys(STRAND_LABELS) as (keyof MatchingWeights)[];
const STRAND_MAX = 3; // Startwerte laufen 1–2 — als Obergrenze für die 0–100-Balken.

interface DesignerRow {
  id: string;
  brand_name: string;
  house_number: number | null;
  video_taste_weights: Record<string, number> | null;
}
interface SignatureRow {
  id: string;
  designer_id: string;
  name: string;
  recipe: { wunsch?: boolean } | null;
}
interface ReportRow {
  id: string;
  kind: string;
  created_at: string;
  body: string | null;
  data: { top_houses?: { designer_id: string; weights?: Record<string, number> }[] } | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `vor ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

export default function AdminDNA() {
  const { user } = useAuth();
  const [weights, setWeights] = useState<MatchingWeights>(DEFAULT_MATCHING_WEIGHTS);
  const [savingWeights, setSavingWeights] = useState(false);
  const [designers, setDesigners] = useState<DesignerRow[]>([]);
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [regieReports, setRegieReports] = useState<ReportRow[]>([]);
  const [wissenReport, setWissenReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [mw, des, sigs, reports] = await Promise.all([
        supabase.from("ai_config").select("value").eq("key", "matching_weights").maybeSingle(),
        supabase
          .from("designers")
          .select("id, brand_name, house_number, video_taste_weights")
          .eq("status", "active")
          .order("house_number"),
        supabase.from("house_signatures").select("id, designer_id, name, recipe"),
        supabase
          .from("jarvis_reports")
          .select("id, kind, created_at, body, data")
          .in("kind", ["regie", "wissen"])
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const mwVal = (mw.data?.value ?? {}) as unknown as Partial<MatchingWeights>;
      setWeights({ ...DEFAULT_MATCHING_WEIGHTS, ...mwVal });
      setDesigners((des.data ?? []) as unknown as DesignerRow[]);
      setSignatures((sigs.data ?? []) as unknown as SignatureRow[]);
      const allReports = (reports.data ?? []) as unknown as ReportRow[];
      setRegieReports(allReports.filter((r) => r.kind === "regie"));
      setWissenReport(allReports.find((r) => r.kind === "wissen") ?? null);
      setLoading(false);
    })();
  }, []);

  const saveWeights = async () => {
    if (!user) return;
    setSavingWeights(true);
    const { error } = await supabase
      .from("ai_config")
      .upsert({ key: "matching_weights", value: weights as unknown as Record<string, number>, updated_by: user.id });
    setSavingWeights(false);
    if (error) return toast.error(error.message);
    toast.success("Basis-DNA gespeichert.");
  };

  const globalStrands: GenomeStrand[] = STRAND_KEYS.map((k) => ({
    label: STRAND_LABELS[k],
    value: Math.round((weights[k] / STRAND_MAX) * 100),
    hint: `×${weights[k].toFixed(1)}`,
  }));

  const latestPulse = wissenReport
    ? { text: (wissenReport.body ?? "Neues aus dem Wissenslauf.").slice(0, 140), when: timeAgo(wissenReport.created_at) }
    : regieReports[0]
      ? { text: (regieReports[0].body ?? "Performance-Gewichte aktualisiert.").slice(0, 140), when: timeAgo(regieReports[0].created_at) }
      : null;

  return (
    <AdminShell eyebrow="Intelligence" title="Genom">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Die DNA von PAWN — als lebendes Dokument. Oben die globale Basis, darunter, was jedes Haus aus seiner eigenen
        Performance gelernt hat.
      </p>

      <div className="mt-8">
        <GenomeCard
          eyebrow="Global · Basis-DNA"
          title="Wonach PAWN gerade gewichtet"
          subtitle="Fließt in jede Empfehlung ein — Jarvis testet diese Werte im Evolutions-Kreislauf."
          strands={globalStrands}
          strandsLabel="Gewichte"
          pulse={latestPulse}
        >
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/15 pt-4 sm:grid-cols-4">
            {STRAND_KEYS.map((k) => (
              <label key={k} className="block">
                <span className="editorial-eyebrow text-black/50">{STRAND_LABELS[k]}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={STRAND_MAX}
                  value={weights[k]}
                  onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                  className="mt-1 w-full border-[1.5px] border-black bg-white px-2 py-1.5 text-sm focus:outline-none"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void saveWeights()}
            disabled={savingWeights}
            className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white disabled:opacity-50"
          >
            {savingWeights ? "…" : "Basis-DNA speichern"}
          </button>
        </GenomeCard>
      </div>

      <div className="mt-10">
        <p className="editorial-eyebrow text-black/50">Je Haus</p>
        {loading ? (
          <div className="mt-4 h-40 animate-pulse bg-muted" />
        ) : designers.length === 0 ? (
          <div className="mt-4 border border-dashed border-black/30 p-8 text-center text-sm text-muted-foreground">
            Die ersten Häuser ziehen ein — ihre Genom-Karten erscheinen hier, sobald sie veröffentlicht sind.
          </div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {designers.map((d) => {
              const houseWeights = d.video_taste_weights ?? {};
              const maxW = Math.max(1, ...Object.values(houseWeights));
              const learned: GenomeStrand[] = Object.entries(houseWeights)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([label, value]) => ({ label, value: (value / maxW) * 100, hint: `×${value.toFixed(2)}` }));
              const houseSigs = signatures.filter((s) => s.designer_id === d.id);
              const history = regieReports
                .filter((r) => (r.data?.top_houses ?? []).some((h) => h.designer_id === d.id))
                .slice(0, 3);
              return (
                <GenomeCard
                  key={d.id}
                  eyebrow={d.house_number ? `Haus № ${d.house_number}` : "Haus"}
                  title={d.brand_name}
                  learned={learned}
                  learnedLabel="Gelernt aus Performance"
                  signatures={houseSigs.map((s) => ({ id: s.id, name: s.name, wunsch: s.recipe?.wunsch }))}
                  signaturesHref="/admin/jarvis"
                  signaturesLinkLabel="Zum Regisseur"
                  campaignsHref="/admin/kampagnen"
                  campaignsLinkLabel="Zu Kampagnen"
                  emptyText={`Noch keine gelernte Performance für ${d.brand_name} — erscheint nach der ersten Kampagnen-Regie.`}
                >
                  {history.length > 0 && (
                    <div className="mt-6 border-t border-black/15 pt-4">
                      <p className="editorial-eyebrow text-black/50">Verlauf</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-black/70">
                        {history.map((r) => {
                          const entry = r.data?.top_houses?.find((h) => h.designer_id === d.id);
                          const topKey = entry?.weights
                            ? Object.entries(entry.weights).sort((a, b) => b[1] - a[1])[0]?.[0]
                            : null;
                          return (
                            <li key={r.id}>
                              {timeAgo(r.created_at)} — {topKey ? `Top: ${topKey}` : "Gewichte aktualisiert"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </GenomeCard>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
