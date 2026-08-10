/**
 * Die Jagd: Jarvis sucht selbst nach neuen Häusern. Dieses Panel zeigt die laufenden und
 * letzten Suchläufe, die aktuellen Suchbegriffe und erlaubt es, eine Jagd sofort zu starten
 * oder die Ergebnisse abzuholen. Reines Frontend gegen `acquisition_hunts` und `ai_config`.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Radar, Download, Brain, UserSearch, Mail } from "lucide-react";

export interface HuntQuery {
  query: string;
  type: "hashtag" | "nachbarschaft";
  world: string;
  weight: number;
}

interface Hunt {
  id: string;
  query: string;
  query_type: string;
  world: string;
  status: string;
  items_found: number;
  leads_created: number;
  qualified_count: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  gestartet: "läuft",
  fertig: "fertig",
  fehlgeschlagen: "fehlgeschlagen",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function parseQueries(value: unknown): HuntQuery[] {
  const raw = (value as { hunt_queries?: unknown } | null)?.hunt_queries;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => r as Partial<HuntQuery>)
    .filter((r): r is HuntQuery => typeof r.query === "string" && r.query.length > 0)
    .map((r) => ({
      query: r.query,
      type: r.type === "nachbarschaft" ? "nachbarschaft" : "hashtag",
      world: r.world ?? "Mode",
      weight: typeof r.weight === "number" ? r.weight : 1,
    }));
}

interface KontaktStats {
  qualifiziert: number;
  mitEmail: number;
  formular: number;
  nurDm: number;
  heuteGesendet: number;
}

type JagdMode = "akquise_jagd" | "akquise_import" | "akquise_jagd_lernen" | "akquise_profile" | "akquise_kontakt";

export function JagdPanel() {
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [queries, setQueries] = useState<HuntQuery[]>([]);
  const [queryText, setQueryText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState<KontaktStats | null>(null);
  const [dailyRuns, setDailyRuns] = useState(16);
  const [dailyRunsSaving, setDailyRunsSaving] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(50);
  const [dailyGoalSaving, setDailyGoalSaving] = useState(false);

  const load = useCallback(async () => {
    const seit = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const [huntsRes, configRes, leadsRes, sentRes] = await Promise.all([
      supabase.from("acquisition_hunts").select("*").order("created_at", { ascending: false }).limit(25),
      supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      supabase.from("acquisition_leads").select("status, email, contact_url").in("status", ["neu", "qualifiziert", "angewaermt"]),
      supabase.from("acquisition_leads").select("id").gte("contacted_at", seit),
    ]);
    setHunts((huntsRes.data as Hunt[] | null) ?? []);
    const parsed = parseQueries(configRes.data?.value);
    setQueries(parsed);
    setQueryText(parsed.map((q) => `${q.query} · ${q.world}`).join("\n"));
    const storedDailyRuns = (configRes.data?.value as { hunt_daily_runs?: number } | null)?.hunt_daily_runs;
    if (typeof storedDailyRuns === "number") setDailyRuns(storedDailyRuns);
    const storedDailyGoal = (configRes.data?.value as { daily_goal?: number } | null)?.daily_goal;
    if (typeof storedDailyGoal === "number") setDailyGoal(storedDailyGoal);

    const leads = (leadsRes.data as { status: string; email: string | null; contact_url: string | null }[] | null) ?? [];
    setStats({
      qualifiziert: leads.filter((l) => l.status === "qualifiziert").length,
      mitEmail: leads.filter((l) => !!l.email).length,
      formular: leads.filter((l) => !l.email && !!l.contact_url).length,
      nurDm: leads.filter((l) => !l.email && !l.contact_url).length,
      heuteGesendet: (sentRes.data as { id: string }[] | null)?.length ?? 0,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(mode: JagdMode, label: string) {
    setBusy(mode);
    const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode } });
    setBusy(null);
    if (error) { toast.error(`${label}: ${error.message}`); return; }
    const result = data as {
      ok?: boolean; error?: string; message?: string; started?: number; imported?: number;
      ausgewertet?: number; gestartet?: number; gefunden?: number; geprueft?: number; angereichert?: number;
    } | null;
    if (result?.ok === false) { toast.error(result.error ?? `${label} fehlgeschlagen.`); return; }
    const detail = mode === "akquise_jagd"
      ? `${result?.started ?? 0} Suchlauf/Suchläufe gestartet`
      : mode === "akquise_import"
        ? `${result?.imported ?? 0} neue Konten, ${result?.angereichert ?? 0} angereichert`
        : mode === "akquise_profile"
          ? `${result?.gestartet ?? 0} Anreicherungslauf/-läufe gestartet`
          : mode === "akquise_kontakt"
            ? `${result?.gefunden ?? 0} Adressen bei ${result?.geprueft ?? 0} Konten`
            : `${result?.ausgewertet ?? 0} Begriffe ausgewertet`;
    toast.success(`${label}: ${detail}${result?.message ? ` · ${result.message}` : ""}`);
    void load();
  }


  async function saveQueries() {
    const parsed: HuntQuery[] = queryText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [q, world] = line.split("·").map((s) => s.trim());
        const existing = queries.find((e) => e.query.toLowerCase() === q.replace(/^#/, "").toLowerCase());
        return {
          query: q.replace(/^#/, ""),
          type: "hashtag" as const,
          world: ["Mode", "Interior", "Kunst"].includes(world ?? "") ? world! : "Mode",
          weight: existing?.weight ?? 1,
        };
      });

    const { data: current } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
    const base = (current?.value as Record<string, unknown> | null) ?? {};
    const { error } = await supabase.from("ai_config")
      .upsert({ key: "akquise_config", value: { ...base, hunt_queries: parsed } as unknown as never }, { onConflict: "key" });
    if (error) { toast.error(error.message); return; }
    setQueries(parsed);
    setEditing(false);
    toast.success("Suchbegriffe gespeichert.");
  }

  async function saveDailyRuns(value: number) {
    setDailyRunsSaving(true);
    const { data: current } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
    const base = (current?.value as Record<string, unknown> | null) ?? {};
    const { error } = await supabase.from("ai_config")
      .upsert({ key: "akquise_config", value: { ...base, hunt_daily_runs: value } as unknown as never }, { onConflict: "key" });
    setDailyRunsSaving(false);
    if (error) { toast.error(error.message); return; }
    setDailyRuns(value);
    toast.success(`Tempo gespeichert: ${value} Suchläufe pro Jagd.`);
  }

  async function saveDailyGoal(value: number) {
    setDailyGoalSaving(true);
    const { data: current } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
    const base = (current?.value as Record<string, unknown> | null) ?? {};
    const { error } = await supabase.from("ai_config")
      .upsert({ key: "akquise_config", value: { ...base, daily_goal: value } as unknown as never }, { onConflict: "key" });
    setDailyGoalSaving(false);
    if (error) { toast.error(error.message); return; }
    setDailyGoal(value);
    toast.success(`Tagesziel gespeichert: ${value} Erstkontakte pro Tag.`);
  }

  const running = hunts.filter((h) => h.status === "gestartet").length;

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">
          Jagd · PAWN sucht selbst {running > 0 ? `· ${running} läuft` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" disabled={busy !== null} onClick={() => run("akquise_jagd", "Jagd")}
            className="rounded-none bg-black text-white hover:bg-white hover:text-black"
          >
            {busy === "akquise_jagd" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
            Jetzt jagen
          </Button>
          <Button
            size="sm" variant="outline" disabled={busy !== null} onClick={() => run("akquise_import", "Abholen")}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "akquise_import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Ergebnisse holen
          </Button>
          <Button
            size="sm" variant="outline" disabled={busy !== null} onClick={() => run("akquise_jagd_lernen", "Auswertung")}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "akquise_jagd_lernen" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
            Auswerten
          </Button>
          <Button
            size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("akquise_profile", "Profile laden")}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "akquise_profile" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserSearch className="mr-2 h-4 w-4" />}
            Profile laden
          </Button>
          <Button
            size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("akquise_kontakt", "Kontakt suchen")}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {busy === "akquise_kontakt" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Kontakt suchen
          </Button>
        </div>
      </header>

      {stats && (
        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-5 sm:divide-y-0">
          {[
            { label: "Qualifiziert", value: stats.qualifiziert },
            { label: "Mit E-Mail", value: stats.mitEmail },
            { label: "Formular", value: stats.formular },
            { label: "Nur DM", value: stats.nurDm },
            { label: "Heute gesendet", value: stats.heuteGesendet },
          ].map((s) => (
            <div key={s.label} className="px-5 py-3">
              <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* WP7 Tagesziel-Wächter: nur eine sichtbare Warnung, kein Auto-Versand. */}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Tagesziel: <span className="tabular-nums text-foreground">{stats.heuteGesendet} / {dailyGoal}</span>
            {new Date().getHours() >= 18 && stats.heuteGesendet < dailyGoal && (
              <span className="ml-2 text-[0.65rem] uppercase tracking-[0.18em] text-destructive">
                {dailyGoal - stats.heuteGesendet} fehlen noch heute
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={500} value={dailyGoal}
              onChange={(e) => setDailyGoal(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              className="h-8 w-16 border-[1.5px] border-black px-2 text-center text-sm tabular-nums"
            />
            <Button
              size="sm" variant="outline" disabled={dailyGoalSaving} onClick={() => void saveDailyGoal(dailyGoal)}
              className="rounded-none border-black hover:bg-black hover:text-white"
            >
              {dailyGoalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ziel speichern"}
            </Button>
          </div>
        </div>
      )}



      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Tempo</p>
          <p className="mt-1 text-xs text-muted-foreground">Suchläufe, die „Jetzt jagen" pro Klick startet.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={200} value={dailyRuns}
            onChange={(e) => setDailyRuns(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
            className="h-9 w-20 border-[1.5px] border-black px-2 text-center font-serif text-lg tabular-nums"
          />
          <Button
            size="sm" disabled={dailyRunsSaving} onClick={() => void saveDailyRuns(dailyRuns)}
            className="rounded-none bg-black text-white hover:bg-white hover:text-black"
          >
            {dailyRunsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Speichern"}
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Suchbegriffe · {queries.length}
          </p>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="text-[0.65rem] uppercase tracking-[0.22em] underline underline-offset-4"
          >
            {editing ? "Abbrechen" : "Bearbeiten"}
          </button>
        </div>

        {editing ? (
          <div className="mt-3 space-y-3">
            <Textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={10}
              className="rounded-none border-black font-mono text-xs"
              placeholder={"handmadeleatherbag · Mode\nceramicstudio · Interior"}
            />
            <p className="text-xs text-muted-foreground">
              Ein Begriff pro Zeile, dahinter mit „·" die Welt (Mode, Interior, Kunst). Leer lassen, damit PAWN beim
              nächsten Lauf selbst Begriffe aus der DNA der bestehenden Häuser destilliert.
            </p>
            <Button
              size="sm" onClick={() => void saveQueries()}
              className="rounded-none bg-black text-white hover:bg-white hover:text-black"
            >
              Speichern
            </Button>
          </div>
        ) : queries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Noch keine Begriffe. Beim nächsten Jagd-Lauf destilliert PAWN sie aus der DNA der bestehenden Häuser.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {queries.map((q) => (
              <li key={q.query} className="border border-black px-2 py-1 text-xs">
                #{q.query}
                <span className="ml-2 text-muted-foreground">{q.world} · ×{q.weight}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hunts.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Noch keine Jagd gestartet. „Jetzt jagen" schickt die ersten Suchläufe los.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {hunts.map((h) => {
            const quote = h.leads_created > 0 ? Math.round((h.qualified_count / h.leads_created) * 100) : null;
            return (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-serif text-base">
                    {h.query_type === "nachbarschaft" ? `@${h.query}` : `#${h.query}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {h.world} · {h.query_type === "nachbarschaft" ? "Nachbarschaft" : "Hashtag"} · {formatDate(h.created_at)}
                    {h.error ? ` · ${h.error}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums">
                  <span className="text-muted-foreground">{h.items_found} gefunden</span>
                  <span>{h.leads_created} neu</span>
                  {quote !== null && <span className="text-muted-foreground">{quote}% Treffer</span>}
                  <span className="border border-black px-2 py-0.5 uppercase tracking-[0.18em]">
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
