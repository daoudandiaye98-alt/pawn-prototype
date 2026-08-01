/**
 * Genom — die Basis-DNA der Plattform (ai_config.matching_weights, editierbar)
 * plus je Haus eine Genom-Karte mit dem, was aus seiner eigenen Performance
 * gelernt wurde (designers.video_taste_weights), verknüpften Bildsprachen und
 * einem kurzen Verlauf aus den wöchentlichen Kampagnen-Regie-Berichten.
 *
 * Teil 19c: aus der Einzelkarte wird ein Kartenwerk — eine Vergleichstabelle über
 * alle Häuser, eine Drift-Sektion (welche Häuser sich verändern, welche Strömung
 * gerade am breitesten verankert ist, wo die Ontologie neu andockt), laufende
 * Experimente neben der Basis-DNA statt auf einer separaten Seite, und von jeder
 * Auffälligkeit ein direkter Link zur passenden Handlung.
 */
import { Link } from "react-router-dom";
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
  brand_dna: { worlds?: Record<string, number>; signals?: string[] } | null;
  aussenauge: { urteil?: string; fruehzustand?: { erreicht?: boolean } } | null;
}
interface SegmentRow {
  segment: string;
  kunden: number;
  anteil: number;
  merkmal: string;
  avg_bestellungen: number;
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
  data: { top_houses?: { designer_id: string; weights?: Record<string, number>; near_current?: string | null }[] } | null;
}
interface CulturalCurrentLite {
  name: string;
  nahe_haeuser: string[] | null;
  worlds: string[] | null;
}
interface HouseThemeLite {
  designer_id: string;
  version: number;
  is_current: boolean;
  name: string | null;
  created_at: string;
  farbwelt: { bg: string; fg: string; accent: string };
  typografie: string;
  bewegungscharakter: string;
}
interface ExperimentRow {
  id: string;
  hypothesis: string;
  changed_key: string;
  metric: string;
  status: "laufend" | "behalten" | "verworfen";
  started_at: string;
}
interface OntologyLearnedRow {
  term: string;
  world: string[];
  created_at: string;
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
  const [culturalCurrents, setCulturalCurrents] = useState<CulturalCurrentLite[]>([]);
  const [houseThemes, setHouseThemes] = useState<HouseThemeLite[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRow[]>([]);
  const [learnedTerms, setLearnedTerms] = useState<OntologyLearnedRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [distillBusyId, setDistillBusyId] = useState<string | null>(null);

  const nearCurrentFor = (d: DesignerRow): string | null => {
    const worlds = Object.keys(d.brand_dna?.worlds ?? {});
    return culturalCurrents.find((c) => (c.nahe_haeuser ?? []).includes(d.id))?.name
      ?? culturalCurrents.find((c) => (c.worlds ?? []).some((w) => worlds.includes(w)))?.name
      ?? null;
  };

  const distillDna = async (designerId: string) => {
    setDistillBusyId(designerId);
    try {
      const { data, error } = await supabase.functions.invoke("distill-brand-dna", { body: { designer_id: designerId } });
      if (error) { toast.error(error.message); return; }
      const r = data as { ok?: boolean; error?: string; message?: string; brand_dna?: { worlds?: Record<string, number>; signals?: string[] } };
      if (!r.ok) { toast.error(r.message ?? r.error ?? "DNA konnte nicht destilliert werden."); return; }
      toast.success("DNA destilliert.");
      setDesigners((prev) => prev.map((d) => (d.id === designerId ? { ...d, brand_dna: r.brand_dna ?? d.brand_dna } : d)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDistillBusyId(null);
    }
  };

  useEffect(() => {
    (async () => {
      const [mw, des, sigs, reports, currents, themes, exps, terms, segs] = await Promise.all([
        supabase.from("ai_config").select("value").eq("key", "matching_weights").maybeSingle(),
        supabase
          .from("designers")
          .select("id, brand_name, house_number, video_taste_weights, brand_dna, aussenauge")
          .eq("status", "active")
          .order("house_number"),
        supabase.from("house_signatures").select("id, designer_id, name, recipe"),
        supabase
          .from("jarvis_reports")
          .select("id, kind, created_at, body, data")
          .in("kind", ["regie", "wissen"])
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("cultural_currents" as never).select("name, nahe_haeuser, worlds"),
        supabase.from("house_themes" as never)
          .select("designer_id, version, is_current, name, created_at, farbwelt, typografie, bewegungscharakter")
          .order("version", { ascending: false }),
        supabase.from("jarvis_experiments").select("id, hypothesis, changed_key, metric, status, started_at")
          .eq("status", "laufend").order("started_at", { ascending: false }),
        supabase.from("fashion_ontology").select("term, world, created_at")
          .eq("learned", true).order("created_at", { ascending: false }).limit(6),
        supabase.rpc("customer_behavior_segments" as never),
      ]);
      const mwVal = (mw.data?.value ?? {}) as unknown as Partial<MatchingWeights>;
      setWeights({ ...DEFAULT_MATCHING_WEIGHTS, ...mwVal });
      setDesigners((des.data ?? []) as unknown as DesignerRow[]);
      setSignatures((sigs.data ?? []) as unknown as SignatureRow[]);
      const allReports = (reports.data ?? []) as unknown as ReportRow[];
      setRegieReports(allReports.filter((r) => r.kind === "regie"));
      setWissenReport(allReports.find((r) => r.kind === "wissen") ?? null);
      setCulturalCurrents((currents.data ?? []) as unknown as CulturalCurrentLite[]);
      setHouseThemes((themes.data ?? []) as unknown as HouseThemeLite[]);
      setExperiments((exps.data ?? []) as unknown as ExperimentRow[]);
      setLearnedTerms((terms.data ?? []) as unknown as OntologyLearnedRow[]);
      setSegments((segs.data ?? []) as unknown as SegmentRow[]);
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

  // Teil 19c: aus der Einzelkarte wird ein Kartenwerk — Ableitungen je Haus für die
  // Vergleichstabelle und die Drift-Erkennung (verändert sich das Haus gerade?).
  const houseDerived = designers.map((d) => {
    const dnaWorlds = d.brand_dna?.worlds ?? {};
    const topWorldEntry = Object.entries(dnaWorlds).sort((a, b) => b[1] - a[1])[0];
    const dnaSignals = d.brand_dna?.signals ?? [];
    const themesForD = houseThemes.filter((t) => t.designer_id === d.id);
    const currentTheme = themesForD.find((t) => t.is_current) ?? null;
    const houseWeights = d.video_taste_weights ?? {};
    const topLearned = Object.entries(houseWeights).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const history = regieReports.filter((r) => (r.data?.top_houses ?? []).some((h) => h.designer_id === d.id));
    const priorEntry = history[1]?.data?.top_houses?.find((h) => h.designer_id === d.id);
    const priorTop = priorEntry?.weights ? Object.entries(priorEntry.weights).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
    const tasteShifted = !!(topLearned && priorTop && topLearned !== priorTop);
    const themeEvolved = themesForD.length > 1;
    return {
      designer: d,
      topWorld: topWorldEntry ? { world: topWorldEntry[0], pct: Math.round(topWorldEntry[1] * 100) } : null,
      topSignal: dnaSignals[0] ?? null,
      aussenaugeUrteil: d.aussenauge?.fruehzustand?.erreicht ? (d.aussenauge?.urteil ?? null) : null,
      currentTheme,
      nearCurrent: nearCurrentFor(d),
      inMotion: themeEvolved || tasteShifted,
      motionReason: themeEvolved && tasteShifted
        ? "Thema verfeinert & Geschmack verschoben"
        : themeEvolved
          ? "Thema verfeinert"
          : tasteShifted
            ? `Geschmack verschoben (${priorTop} → ${topLearned})`
            : null,
    };
  });

  const worldCounts: Record<string, number> = {};
  for (const hd of houseDerived) if (hd.topWorld) worldCounts[hd.topWorld.world] = (worldCounts[hd.topWorld.world] ?? 0) + 1;
  const worldEntries = (["Mode", "Interior", "Kunst"] as const).map((w) => ({ world: w, count: worldCounts[w] ?? 0 }));
  const maxWorldCount = Math.max(0, ...worldEntries.map((w) => w.count));
  const underrepresented = maxWorldCount > 0 ? worldEntries.filter((w) => w.count < maxWorldCount).sort((a, b) => a.count - b.count)[0] : null;

  const currentsByReach = [...culturalCurrents]
    .sort((a, b) => (b.nahe_haeuser?.length ?? 0) - (a.nahe_haeuser?.length ?? 0))
    .slice(0, 4);

  const housesInMotion = houseDerived.filter((hd) => hd.inMotion);

  return (
    <AdminShell eyebrow="Intelligence" title="Genom">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Die DNA von PAWN — als lebendes Dokument. Oben die globale Basis, darunter, was jedes Haus aus seiner eigenen
          Performance gelernt hat, und wie Kundinnen und Kunden sich tatsächlich verhalten.
        </p>
        <span className="shrink-0 border border-black bg-black px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-white">Nur für Admins</span>
      </div>
      <p className="mt-3 max-w-2xl text-[0.8rem] text-muted-foreground/80">
        Diese Profile beeinflussen ausschließlich Reihenfolge und Empfehlung — niemals Preis, Verfügbarkeit, Versand oder Angebot.
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-4">
            <p className="text-sm text-black/70">
              {experiments.length === 0
                ? "Kein laufendes Experiment gerade — Jarvis testet nichts an dieser Basis."
                : `${experiments.length} laufende${experiments.length === 1 ? "s" : ""} Experiment${experiments.length === 1 ? "" : "e"}: ${experiments.slice(0, 2).map((e) => e.changed_key).join(", ")}${experiments.length > 2 ? "…" : ""}`}
            </p>
            <Link to="/admin/jarvis" className="editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
              Zum Maschinenraum →
            </Link>
          </div>
        </GenomeCard>
      </div>

      <div className="mt-10">
        <p className="editorial-eyebrow text-black/50">Verhaltensprofile · alle Kunden</p>
        {segments.length === 0 ? (
          <div className="mt-4 border border-dashed border-black/30 p-6 text-center text-sm text-muted-foreground">
            Noch keine Aufrufe oder Bestellungen — die Segmente erscheinen, sobald Kund:innen da waren.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto border-[1.5px] border-black bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-black text-[0.62rem] uppercase tracking-[0.18em] text-black/50">
                  <th className="px-4 py-3">Segment</th>
                  <th className="px-4 py-3">Kunden</th>
                  <th className="px-4 py-3">Anteil</th>
                  <th className="px-4 py-3">Merkmal</th>
                  <th className="px-4 py-3">Ø Bestellungen</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.segment} className="border-b border-black/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-black">{s.segment}</td>
                    <td className="px-4 py-3 tabular-nums text-black/70">{s.kunden}</td>
                    <td className="px-4 py-3 tabular-nums text-black/70">{s.anteil}%</td>
                    <td className="px-4 py-3 text-black/70">{s.merkmal}</td>
                    <td className="px-4 py-3 tabular-nums text-black/70">{s.avg_bestellungen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[0.7rem] text-black/40">
          Ableitung: Beobachter = keine Bestellung. Gezielt = genau eine. Sammler = mehrfach bei höchstens zwei Häusern. Streuner = mehrfach über drei oder mehr Häuser.
        </p>
      </div>

      {designers.length > 0 && (
        <div className="mt-10">
          <p className="editorial-eyebrow text-black/50">Kartenwerk · alle Häuser im Vergleich</p>
          <div className="mt-4 overflow-x-auto border-[1.5px] border-black bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-black text-[0.62rem] uppercase tracking-[0.18em] text-black/50">
                  <th className="px-4 py-3">Haus</th>
                  <th className="px-4 py-3">Welt</th>
                  <th className="px-4 py-3">Palette</th>
                  <th className="px-4 py-3">Haltung</th>
                  <th className="px-4 py-3">Selbstbild vs. Markenprofil</th>
                  <th className="px-4 py-3">Strömung</th>
                  <th className="px-4 py-3">Verändert sich</th>
                </tr>
              </thead>
              <tbody>
                {houseDerived.map((hd) => (
                  <tr key={hd.designer.id} className="border-b border-black/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-black">{hd.designer.brand_name}</td>
                    <td className="px-4 py-3 text-black/70">{hd.topWorld ? `${hd.topWorld.world} · ${hd.topWorld.pct}%` : "—"}</td>
                    <td className="px-4 py-3">
                      {hd.currentTheme ? (
                        <div className="flex gap-1">
                          {[hd.currentTheme.farbwelt.bg, hd.currentTheme.farbwelt.fg, hd.currentTheme.farbwelt.accent].map((hex, i) => (
                            <span key={i} className="h-4 w-4 border border-black/20" style={{ background: hex }} title={hex} />
                          ))}
                        </div>
                      ) : <span className="text-black/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-black/70">{hd.topSignal ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[240px] text-xs text-black/60">
                      {hd.aussenaugeUrteil ? hd.aussenaugeUrteil : <span className="text-black/30">noch keine Einschätzung</span>}
                    </td>
                    <td className="px-4 py-3 text-black/70">{hd.nearCurrent ?? "—"}</td>
                    <td className="px-4 py-3">
                      {hd.inMotion ? (
                        <span className="border border-black bg-black px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-white">In Bewegung</span>
                      ) : <span className="text-black/30">ruhig</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="border-[1.5px] border-black bg-white p-6">
          <p className="editorial-eyebrow text-black/50">Häuser in Bewegung</p>
          {housesInMotion.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">Gerade kein Haus mit sichtbarer Veränderung.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {housesInMotion.map((hd) => (
                <li key={hd.designer.id} className="border-t border-black/10 pt-3 first:border-0 first:pt-0">
                  <p className="text-sm font-medium text-black">{hd.designer.brand_name}</p>
                  <p className="mt-0.5 text-xs text-black/60">{hd.motionReason}</p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/archiv" className="mt-4 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
            Für Startseiten-Video vormerken →
          </Link>
        </div>

        <div className="border-[1.5px] border-black bg-white p-6">
          <p className="editorial-eyebrow text-black/50">Strömungen · am breitesten verankert</p>
          {currentsByReach.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">Noch keine Kulturströmungen erfasst.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {currentsByReach.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-sm text-black">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-black/50">{c.nahe_haeuser?.length ?? 0} Haus{(c.nahe_haeuser?.length ?? 0) === 1 ? "" : "er"}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/editionen" className="mt-4 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
            Gemeinsame Kampagne vorschlagen →
          </Link>
        </div>

        <div className="border-[1.5px] border-black bg-white p-6">
          <p className="editorial-eyebrow text-black/50">Neu angedockte Begriffe</p>
          {learnedTerms.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">Die Ontologie hat gerade nichts Neues gelernt.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {learnedTerms.map((t) => (
                <li key={t.term} className="flex items-center justify-between text-sm text-black">
                  <span>{t.term}</span>
                  <span className="text-black/50">{t.world.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          {underrepresented && (
            <p className="mt-4 text-xs text-black/60">
              {underrepresented.world} steht mit {underrepresented.count} Haus{underrepresented.count === 1 ? "" : "ern"} am schwächsten da.
            </p>
          )}
          <Link to="/admin/akquise" className="mt-2 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
            Akquise lenken →
          </Link>
        </div>
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
              const dnaWorlds = d.brand_dna?.worlds ?? {};
              const dnaStrands: GenomeStrand[] = Object.entries(dnaWorlds).map(([label, value]) => ({ label, value: Math.round(value * 100) }));
              const dnaSignals = d.brand_dna?.signals ?? [];
              const houseSigs = signatures.filter((s) => s.designer_id === d.id);
              const nearCurrent = nearCurrentFor(d);
              const history = regieReports
                .filter((r) => (r.data?.top_houses ?? []).some((h) => h.designer_id === d.id))
                .slice(0, 3);
              const themesForD = houseThemes.filter((t) => t.designer_id === d.id);
              const currentTheme = themesForD.find((t) => t.is_current) ?? null;
              return (
                <GenomeCard
                  key={d.id}
                  eyebrow={d.house_number ? `Haus № ${d.house_number}` : "Haus"}
                  title={d.brand_name}
                  strands={dnaStrands}
                  strandsLabel="DNA · Welten"
                  learned={learned}
                  learnedLabel="Gelernt aus Performance"
                  signatures={houseSigs.map((s) => ({ id: s.id, name: s.name, wunsch: s.recipe?.wunsch }))}
                  signaturesHref="/admin/jarvis"
                  signaturesLinkLabel="Zum Regisseur"
                  campaignsHref="/admin/kampagnen"
                  campaignsLinkLabel="Zu Kampagnen"
                  emptyText={`Noch keine gelernte Performance für ${d.brand_name} — erscheint nach der ersten Kampagnen-Regie.`}
                >
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {dnaSignals.length === 0 ? (
                        <span className="text-sm text-black/50">Noch keine Stil-Signale.</span>
                      ) : (
                        dnaSignals.map((s) => (
                          <span key={s} className="border border-black/20 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-black/70">{s}</span>
                        ))
                      )}
                      {nearCurrent && (
                        <span className="border border-black bg-black px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-white">
                          Strömung: {nearCurrent}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => void distillDna(d.id)} disabled={distillBusyId === d.id}
                      className="shrink-0 border-[1.5px] border-black px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-black hover:text-white disabled:opacity-50">
                      {distillBusyId === d.id ? "Destilliert…" : "DNA destillieren"}
                    </button>
                  </div>
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
                              {entry?.near_current ? ` — nah an „${entry.near_current}"` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {/* Teil 15c: das Haus-Thema als Ausdruck der DNA, mit Verlauf über die Zeit. */}
                  {currentTheme && (
                    <div className="mt-6 border-t border-black/15 pt-4">
                      <p className="editorial-eyebrow text-black/50">Haus-Thema · Ausdruck der DNA</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="flex gap-1">
                          {[currentTheme.farbwelt.bg, currentTheme.farbwelt.fg, currentTheme.farbwelt.accent].map((hex, i) => (
                            <span key={i} className="h-5 w-5 border border-black/20" style={{ background: hex }} title={hex} />
                          ))}
                        </div>
                        <p className="text-sm text-black/70">
                          {currentTheme.name || "Ohne Namen"} · {currentTheme.typografie} · {currentTheme.bewegungscharakter} · v{currentTheme.version}
                        </p>
                      </div>
                      {themesForD.length > 1 && (
                        <ul className="mt-2 space-y-1 text-xs text-black/50">
                          {themesForD.filter((t) => !t.is_current).slice(0, 3).map((t) => (
                            <li key={t.version}>v{t.version} — {t.name || "Ohne Namen"} ({timeAgo(t.created_at)})</li>
                          ))}
                        </ul>
                      )}
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
