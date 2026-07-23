/**
 * Maschinenraum — Jarvis' technische Seite. Die Briefing-Ansicht (Jarvis'
 * Wort, Dein nächster Zug, Wartet auf dich, Organe) lebt auf /admin; hier
 * liegt, was selten aber gründlich gebraucht wird: Lauf-Historie, Diagnose,
 * Gedächtnis, Wissenslauf-Details und Denklogik.
 */
import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GenomeCard, type GenomeStrand } from "@/components/palace/GenomeCard";
import { Loader2, Sparkles, Mic, X } from "lucide-react";

interface JarvisRun {
  id: string;
  mode: string | null;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
  tokens_used: number;
  cost_estimate: number | null;
  error: string | null;
}

interface JarvisReport {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface JarvisNotice {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  dismissed_at: string | null;
}

interface JarvisMemoryRow {
  id: string;
  content: string;
  created_at: string;
  last_used_at: string | null;
}

interface JarvisExperiment {
  id: string;
  hypothesis: string;
  changed_key: string;
  metric: string;
  baseline: number | null;
  result: number | null;
  status: string;
  started_at: string;
  evaluated_at: string | null;
}

const KIND_LABELS: Record<string, string> = {
  morgen: "Morgenbericht", woche: "Wochenbericht", recherche: "Recherche", antwort: "Antwort",
  diagnose: "Diagnose", wissen: "Wissenslauf", regie: "Kampagnen-Regie", dossier: "Haus-Dossier",
};

const EXPERIMENT_STATUS_LABELS: Record<string, string> = {
  laufend: "Läuft", behalten: "Behalten", verworfen: "Verworfen",
};

const SpeechRecognitionCtor: (new () => any) | null =
  typeof window !== "undefined" ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null) : null;

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

function StatusChip({ status }: { status: string }) {
  const positive = status === "done";
  const negative = status === "failed";
  return (
    <span className={cn(
      "inline-block border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]",
      positive && "border-black bg-black text-white",
      negative && "border-black text-foreground",
      !positive && !negative && "border-border text-muted-foreground",
    )}>
      {status === "done" ? "Fertig" : status === "failed" ? "Fehler" : "Läuft"}
    </span>
  );
}

export default function AdminJarvis() {
  const { user, roles, loading } = useAuth();
  const [runs, setRuns] = useState<JarvisRun[]>([]);
  const [reports, setReports] = useState<JarvisReport[]>([]);
  const [notices, setNotices] = useState<JarvisNotice[]>([]);
  const [memories, setMemories] = useState<JarvisMemoryRow[]>([]);
  const [experiments, setExperiments] = useState<JarvisExperiment[]>([]);
  const [rawConfig, setRawConfig] = useState<Record<string, unknown> | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [monthlyLimit, setMonthlyLimit] = useState(20);
  const [houseStyleLaw, setHouseStyleLaw] = useState<string>("");
  const [directives, setDirectives] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState<null | "befehl" | "morgenbericht" | "wochenbericht" | "recherche">(null);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [evolutionBusy, setEvolutionBusy] = useState(false);
  const [regieBusy, setRegieBusy] = useState(false);
  const [signaturesBulkBusy, setSignaturesBulkBusy] = useState(false);
  const [wissenBusy, setWissenBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const recognitionRef = useRef<any>(null);

  const load = async () => {
    setFetching(true);
    try {
      const [runsRes, reportsRes, noticesRes, memoryRes, experimentsRes, configRes, styleLawRes, directivesRes] = await Promise.allSettled([
        supabase.from("jarvis_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("jarvis_reports").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("jarvis_notices").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("jarvis_memory").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("jarvis_experiments").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("ai_config").select("value").eq("key", "jarvis_config").maybeSingle(),
        supabase.from("ai_config").select("value").eq("key", "house_style_law").maybeSingle(),
        supabase.from("ai_config").select("value").eq("key", "directives").maybeSingle(),
      ]);
      if (runsRes.status === "fulfilled") setRuns((runsRes.value.data as JarvisRun[]) ?? []);
      if (reportsRes.status === "fulfilled") setReports((reportsRes.value.data as JarvisReport[]) ?? []);
      if (noticesRes.status === "fulfilled") setNotices((noticesRes.value.data as JarvisNotice[]) ?? []);
      if (memoryRes.status === "fulfilled") setMemories((memoryRes.value.data as JarvisMemoryRow[]) ?? []);
      if (experimentsRes.status === "fulfilled") setExperiments((experimentsRes.value.data as JarvisExperiment[]) ?? []);
      if (configRes.status === "fulfilled") {
        const cfgValue = (configRes.value.data?.value as Record<string, unknown>) ?? null;
        setRawConfig(cfgValue);
        setEnabled((cfgValue?.enabled as boolean | undefined) ?? true);
        setMonthlyLimit((cfgValue?.monthly_limit_usd as number | undefined) ?? 20);
      }
      if (styleLawRes.status === "fulfilled") {
        setHouseStyleLaw(((styleLawRes.value.data?.value as { text?: string } | undefined)?.text) ?? "");
      }
      if (directivesRes.status === "fulfilled") {
        setDirectives(((directivesRes.value.data?.value as { items?: string[] } | undefined)?.items) ?? []);
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { if (user && roles.includes("admin")) void load(); }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const lastRun = runs[0] ?? null;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const costThisMonth = runs
    .filter((r) => new Date(r.started_at) >= monthStart)
    .reduce((sum, r) => sum + (r.cost_estimate ?? 0), 0);

  async function trigger(mode: "befehl" | "morgenbericht" | "wochenbericht" | "recherche", prompt?: string) {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode, prompt } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Jarvis konnte nicht antworten."); return; }
      toast.success("Jarvis hat geantwortet.");
      setCommand("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function startListening() {
    if (!SpeechRecognitionCtor || busy) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) {
        setCommand(transcript);
        void trigger("befehl", transcript);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); setListening(true); } catch { setListening(false); }
  }
  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function runDiagnoseNow() {
    setDiagnoseBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "diagnose" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Diagnose konnte nicht laufen."); return; }
      toast.success("Diagnose fertig.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDiagnoseBusy(false);
    }
  }

  async function runKampagnenRegieNow() {
    setRegieBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "kampagnen_regie" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Regie konnte nicht laufen."); return; }
      toast.success("Regie-Auswertung fertig.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegieBusy(false);
    }
  }

  async function runSignaturesBulkNow() {
    setSignaturesBulkBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signatures", { body: { mode: "bulk" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string; message?: string; processed?: number; created?: number };
      if (!result.ok) { toast.error(result.message ?? result.error ?? "Massenlauf fehlgeschlagen."); return; }
      toast.success(`${result.processed ?? 0} Häuser geprüft, ${result.created ?? 0} Signaturen erzeugt.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSignaturesBulkBusy(false);
    }
  }

  async function runEvolutionNow() {
    setEvolutionBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "evolution" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string; summary?: string };
      if (!result.ok) { toast.error(result.error ?? "Auswertung konnte nicht laufen."); return; }
      toast.success(result.summary ?? "Auswertung fertig.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEvolutionBusy(false);
    }
  }

  async function runWissenNow() {
    setWissenBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "wissen" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Wissenslauf konnte nicht laufen."); return; }
      toast.success("Wissenslauf fertig.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWissenBusy(false);
    }
  }

  async function dismissNotice(id: string) {
    const now = new Date().toISOString();
    setNotices((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed_at: now } : n)));
    const { error } = await supabase.from("jarvis_notices").update({ dismissed_at: now }).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function togglePause() {
    if (!user) return;
    setPauseBusy(true);
    const next = !enabled;
    const nextValue = { ...(rawConfig ?? {}), enabled: next };
    const { error } = await supabase.from("ai_config").upsert({ key: "jarvis_config", value: nextValue, updated_by: user.id });
    setPauseBusy(false);
    if (error) { toast.error(error.message); return; }
    setEnabled(next);
    setRawConfig(nextValue);
    toast.success(next ? "Jarvis ist wieder aktiv." : "Jarvis ist pausiert.");
  }

  const unseenNotices = notices.filter((n) => !n.dismissed_at);
  const latestDiagnose = reports.find((r) => r.kind === "diagnose") ?? null;
  const wissenReports = reports.filter((r) => r.kind === "wissen");
  const regieReports = reports.filter((r) => r.kind === "regie");
  const issueNotices = notices.filter((n) => n.kind === "github_issue");
  const runningExperiment = experiments.find((e) => e.status === "laufend") ?? null;

  const learningStrands: GenomeStrand[] = [
    { label: "Wissenslauf", value: Math.min(100, wissenReports.length * 20), hint: `${wissenReports.length}` },
    { label: "Gedächtnis", value: Math.min(100, memories.length * 10), hint: `${memories.length}` },
    { label: "Regie-Gewichte", value: Math.min(100, regieReports.length * 20), hint: `${regieReports.length}` },
    { label: "Experimente", value: Math.min(100, experiments.length * 20), hint: `${experiments.length}` },
  ];
  const learningTimeline = [
    ...wissenReports.map((r) => ({ id: r.id, at: r.created_at, text: `Wissenslauf: ${r.body.slice(0, 100)}${r.body.length > 100 ? "…" : ""}` })),
    ...regieReports.map((r) => ({ id: r.id, at: r.created_at, text: `Regie: ${r.body.slice(0, 100)}${r.body.length > 100 ? "…" : ""}` })),
    ...experiments.filter((e) => e.evaluated_at).map((e) => ({ id: e.id, at: e.evaluated_at as string, text: `Experiment ${EXPERIMENT_STATUS_LABELS[e.status] ?? e.status}: ${e.hypothesis}` })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);
  const latestLearning = learningTimeline[0] ?? null;

  return (
    <AdminShell title="Maschinenraum" eyebrow="Jarvis · die interne KI-Instanz von PAWN">
      <div className="mb-4 flex items-center justify-between border-[1.5px] border-black px-5 py-3">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Jarvis-Status</p>
          <p className="mt-1 font-serif text-lg leading-none">{enabled ? "Aktiv" : "Pausiert"}</p>
        </div>
        <Button
          onClick={togglePause}
          disabled={pauseBusy}
          variant="outline"
          className="rounded-none border-black hover:bg-black hover:text-white"
        >
          {pauseBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {enabled ? "Jarvis pausieren" : "Jarvis fortsetzen"}
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-[1.5px] border-black p-5">
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Zuletzt aktiv</p>
          <p className="mt-3 font-serif text-2xl leading-none">{timeAgo(lastRun?.finished_at ?? lastRun?.started_at ?? null)}</p>
        </div>
        <div className="border-[1.5px] border-black p-5">
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Letzter Lauf</p>
          <p className="mt-3 truncate font-serif text-lg leading-tight" title={lastRun?.summary ?? undefined}>
            {lastRun?.summary ?? "—"}
          </p>
          {lastRun && <div className="mt-2"><StatusChip status={lastRun.status} /></div>}
        </div>
        <div className="border-[1.5px] border-black p-5">
          <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Geschätzte Kosten · diesen Monat</p>
          <p className="mt-3 font-serif text-2xl leading-none tabular-nums">
            ${costThisMonth.toFixed(2)} <span className="text-sm text-muted-foreground">/ ${monthlyLimit.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <section className="mb-8 border-[1.5px] border-black p-5">
        <p className="editorial-eyebrow mb-3">Was soll ich tun?</p>
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          rows={4}
          placeholder="Frag Jarvis etwas oder gib einen Auftrag…"
          className="rounded-none border-black"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => trigger("befehl", command)}
            disabled={busy !== null || !command.trim()}
            className="rounded-none bg-black text-white hover:bg-white hover:text-black"
          >
            {busy === "befehl" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {busy === "befehl" ? "Jarvis denkt nach…" : "Senden"}
          </Button>
          {SpeechRecognitionCtor && (
            <Button
              type="button"
              disabled={busy !== null}
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onMouseLeave={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              variant="outline"
              title="Gedrückt halten und sprechen"
              className={cn(
                "rounded-none border-black hover:bg-black hover:text-white",
                listening && "bg-black text-white",
              )}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
          <span className="mx-1 text-muted-foreground">·</span>
          <Button
            onClick={() => trigger("morgenbericht")}
            disabled={busy !== null}
            variant="outline"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "morgenbericht" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Morgenbericht jetzt
          </Button>
          <Button
            onClick={() => trigger("wochenbericht")}
            disabled={busy !== null}
            variant="outline"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "wochenbericht" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Wochenbericht jetzt
          </Button>
          <Button
            onClick={() => trigger("recherche", command)}
            disabled={busy !== null}
            variant="outline"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "recherche" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Recherche starten
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          "Recherche starten" nutzt den Text oben als Thema. Ohne Text wählt Jarvis ein naheliegendes Thema.
          {SpeechRecognitionCtor && " Mikrofon gedrückt halten, sprechen, loslassen — wird wie ein Befehl gesendet."}
        </p>
      </section>

      <section className="mb-8 border-[1.5px] border-black">
        <header className="border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Lauf-Historie · letzte 20</p>
        </header>
        {runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Noch keine Läufe.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border text-left text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Zeit</th>
                <th className="px-4 py-2.5">Organ</th>
                <th className="px-4 py-2.5">Auslöser</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.started_at).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2 uppercase tracking-[0.18em] text-[0.7rem]">{r.mode ?? "—"}</td>
                  <td className="px-4 py-2 uppercase tracking-[0.18em] text-[0.7rem]">{r.trigger}</td>
                  <td className="px-4 py-2"><StatusChip status={r.status} /></td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.cost_estimate != null ? `$${r.cost_estimate.toFixed(3)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>

      <section className="mb-8 border-[1.5px] border-black p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="editorial-eyebrow">Diagnose-Berichte</p>
          <Button
            onClick={runDiagnoseNow}
            disabled={diagnoseBusy}
            variant="outline"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {diagnoseBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {diagnoseBusy ? "Jarvis prüft PAWN…" : "Jetzt prüfen"}
          </Button>
        </div>
        {latestDiagnose ? (
          <div className="mt-3 whitespace-pre-line text-sm text-foreground/80">
            <p className="mb-1 text-xs text-muted-foreground">Letzter Heilungsbericht · {timeAgo(latestDiagnose.created_at)}</p>
            {latestDiagnose.body}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Noch keine Diagnose gelaufen.</p>
        )}
      </section>

      <section className="mb-8 border-[1.5px] border-black p-5">
        <p className="editorial-eyebrow mb-3">Gedächtnis</p>
        {memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Jarvis hat sich noch nichts gemerkt.</p>
        ) : (
          <ul className="divide-y divide-border">
            {memories.map((m) => (
              <li key={m.id} className="py-2.5 text-sm">
                <p className="text-foreground/80">{m.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gemerkt {timeAgo(m.created_at)}{m.last_used_at ? ` · zuletzt genutzt ${timeAgo(m.last_used_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 border-[1.5px] border-black">
        <header className="flex items-center justify-between border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Wissenslauf-Details</p>
          <Button
            onClick={runWissenNow}
            disabled={wissenBusy}
            variant="outline"
            size="sm"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {wissenBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {wissenBusy ? "Jarvis lernt…" : "Wissen erweitern"}
          </Button>
        </header>
        {wissenReports.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Noch kein Wissenslauf gelaufen.</div>
        ) : (
          <ul className="divide-y divide-border">
            {wissenReports.slice(0, 10).map((r) => (
              <li key={r.id} className="px-5 py-3">
                <p className="whitespace-pre-line text-sm text-foreground/80">{r.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-8">
        <GenomeCard
          eyebrow="Denklogik"
          title="Was Jarvis gelernt hat"
          subtitle="Erkenntnisse aus Wissenslauf, Gedächtnis, Regie-Gewichten und Experimenten — als Verlauf über die Wochen."
          strands={learningStrands}
          strandsLabel="Woraus Jarvis lernt"
          pulse={latestLearning ? { text: latestLearning.text, when: timeAgo(latestLearning.at) } : null}
          emptyText="Noch keine Lernschleife gelaufen — der erste Wissenslauf oder das erste Experiment füllt diese Karte."
          className="border-black"
        >
          {learningTimeline.length > 0 && (
            <div className="mt-6 border-t border-black/15 pt-4">
              <p className="editorial-eyebrow text-black/50">Verlauf</p>
              <ul className="mt-2 space-y-1.5 text-sm text-black/70">
                {learningTimeline.map((item) => (
                  <li key={item.id}>{timeAgo(item.at)} — {item.text}</li>
                ))}
              </ul>
            </div>
          )}
        </GenomeCard>
      </div>

      <section className="mb-8 border-[1.5px] border-black p-5">
        <p className="editorial-eyebrow mb-3">Denklogik</p>
        {houseStyleLaw ? (
          <p className="text-sm text-foreground/80">{houseStyleLaw}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Haus-Stilgesetz hinterlegt.</p>
        )}
        {directives.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground/80">
            {directives.map((d) => <li key={d}>{d}</li>)}
          </ul>
        )}
        <Link to="/admin/ki" className="mt-4 inline-block text-[0.68rem] uppercase tracking-[0.22em] underline decoration-1 underline-offset-4 hover:no-underline">
          Bearbeiten im KI Cockpit →
        </Link>
      </section>

      <section className="mb-8 border-[1.5px] border-black">
        <header className="flex items-center justify-between border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Experimente</p>
          <Button
            onClick={runEvolutionNow}
            disabled={evolutionBusy}
            variant="outline"
            size="sm"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {evolutionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Jetzt auswerten
          </Button>
        </header>
        {experiments.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Noch kein Experiment. {runningExperiment ? "" : "Der Herzschlag startet automatisch eines pro Woche."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {experiments.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn(
                    "inline-block border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]",
                    e.status === "behalten" && "border-black bg-black text-white",
                    e.status === "verworfen" && "border-black text-foreground",
                    e.status === "laufend" && "border-border text-muted-foreground",
                  )}>
                    {EXPERIMENT_STATUS_LABELS[e.status] ?? e.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.result != null ? `${e.result} vs. ${e.baseline ?? 0}` : `Ausgangswert ${e.baseline ?? 0}`}
                  </span>
                </div>
                <p className="mt-1 text-sm">{e.hypothesis}</p>
                <p className="text-xs text-muted-foreground">Gestartet {timeAgo(e.started_at)}{e.evaluated_at ? ` · ausgewertet ${timeAgo(e.evaluated_at)}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8 border-[1.5px] border-black">
        <header className="flex items-center justify-between border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Kampagnen-Regie &amp; Signaturen</p>
        </header>
        <div className="flex flex-wrap gap-3 p-5">
          <Button
            onClick={runKampagnenRegieNow}
            disabled={regieBusy}
            variant="outline"
            size="sm"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {regieBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Regie jetzt auswerten
          </Button>
          <Button
            onClick={runSignaturesBulkNow}
            disabled={signaturesBulkBusy}
            variant="outline"
            size="sm"
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {signaturesBulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Signaturen für alle Häuser erzeugen
          </Button>
        </div>
        <p className="px-5 pb-5 text-xs text-muted-foreground">
          Regie liest wöchentlich Première-Views/Shop-Klicks je Haus und destilliert Vorlieben; läuft normalerweise automatisch per Cron. Signaturen-Massenlauf erzeugt Stil-Rezepte für alle Häuser ohne bestehende Signatur.
        </p>
      </section>

      {issueNotices.length > 0 && (
        <section className="mb-8 border-[1.5px] border-black">
          <header className="border-b-[1.5px] border-black px-5 py-3">
            <p className="editorial-eyebrow">Issues an Claude Code</p>
          </header>
          <ul className="divide-y divide-border">
            {issueNotices.map((n) => (
              <li key={n.id} className="px-5 py-3">
                <p className="font-serif text-base">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notices.length > 0 && (
        <section className="mb-8 border-[1.5px] border-black">
          <header className="border-b-[1.5px] border-black px-5 py-3">
            <p className="editorial-eyebrow">Meldungen{unseenNotices.length > 0 ? ` · ${unseenNotices.length} neu` : ""}</p>
          </header>
          <ul className="divide-y divide-border">
            {notices.map((n) => (
              <li key={n.id} className={cn("flex items-start justify-between gap-3 px-5 py-3", !n.dismissed_at && "bg-secondary/30")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.dismissed_at && <span className="h-2 w-2 shrink-0 rounded-full bg-black" title="Ungesehen" />}
                    <p className="font-serif text-base">{n.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
                {!n.dismissed_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissNotice(n.id)}
                    className="shrink-0 rounded-none border-black hover:bg-black hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8 border-[1.5px] border-black p-5">
        <p className="editorial-eyebrow mb-3">Zonen-Übersicht</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="border border-border p-4">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Grün · läuft frei</p>
            <p className="mt-2 text-sm">Ontologie anlegen/zusammenführen, Trends berechnen, Benachrichtigungen an Admins, Merksätze.</p>
          </div>
          <div className="border border-border p-4">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Gelb · läuft, meldet sich</p>
            <p className="mt-2 text-sm">Texte korrigieren, Direktiven/Personas nachschärfen, Lead-Einstiegssätze schreiben.</p>
          </div>
          <div className="border border-border p-4">
            <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Rot · fragt zuerst</p>
            <p className="mt-2 text-sm">Alles mit Geld, Plänen, Veröffentlichung, Löschung oder Außenwirkung — siehe "Wartet auf dich" im Cockpit.</p>
          </div>
        </div>
      </section>

      <section className="border-[1.5px] border-black">
        <header className="border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Berichte · alle</p>
        </header>
        {fetching ? (
          <div className="flex items-center justify-center p-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Berichte…
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">Noch keine Berichte. Jarvis hat noch nichts geschrieben.</div>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((r) => {
              const unread = !r.read_at;
              const open = expanded === r.id;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setExpanded(open ? null : r.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-secondary/30"
                  >
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-black" title="Ungelesen" />}
                    <span className="w-28 shrink-0 text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
                      {KIND_LABELS[r.kind] ?? r.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-serif text-base">{r.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </button>
                  {open && (
                    <div className="whitespace-pre-line border-t border-border px-5 py-4 text-sm text-foreground/80">
                      {r.body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
