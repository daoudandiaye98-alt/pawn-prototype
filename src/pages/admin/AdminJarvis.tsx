/**
 * PAWN Jarvis — die interne KI-Instanz. Ruft die pawn-jarvis Edge Function auf.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Mic, Check, X } from "lucide-react";

interface JarvisRun {
  id: string;
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

interface JarvisPendingAction {
  id: string;
  action: string;
  params: Record<string, unknown>;
  reason: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

const KIND_LABELS: Record<string, string> = {
  morgen: "Morgenbericht", woche: "Wochenbericht", recherche: "Recherche", antwort: "Antwort",
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
  const [pending, setPending] = useState<JarvisPendingAction[]>([]);
  const [rawConfig, setRawConfig] = useState<Record<string, unknown> | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [monthlyLimit, setMonthlyLimit] = useState(20);
  const [fetching, setFetching] = useState(true);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState<null | "befehl" | "morgenbericht" | "wochenbericht" | "recherche">(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const recognitionRef = useRef<any>(null);

  const load = async () => {
    setFetching(true);
    try {
      const [runsRes, reportsRes, noticesRes, pendingRes, configRes] = await Promise.allSettled([
        supabase.from("jarvis_runs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("jarvis_reports").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("jarvis_notices").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("jarvis_pending_actions").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("ai_config").select("value").eq("key", "jarvis_config").maybeSingle(),
      ]);
      if (runsRes.status === "fulfilled") setRuns((runsRes.value.data as JarvisRun[]) ?? []);
      if (reportsRes.status === "fulfilled") setReports((reportsRes.value.data as JarvisReport[]) ?? []);
      if (noticesRes.status === "fulfilled") setNotices((noticesRes.value.data as JarvisNotice[]) ?? []);
      if (pendingRes.status === "fulfilled") setPending((pendingRes.value.data as JarvisPendingAction[]) ?? []);
      if (configRes.status === "fulfilled") {
        const cfgValue = (configRes.value.data?.value as Record<string, unknown>) ?? null;
        setRawConfig(cfgValue);
        setEnabled((cfgValue?.enabled as boolean | undefined) ?? true);
        setMonthlyLimit((cfgValue?.monthly_limit_usd as number | undefined) ?? 20);
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

  async function resolveAction(id: string, actionMode: "confirm_action" | "reject_action") {
    setResolving(id);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: actionMode, pending_action_id: id } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Konnte nicht verarbeitet werden."); return; }
      toast.success(actionMode === "confirm_action" ? "Aktion ausgeführt." : "Aktion abgelehnt.");
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResolving(null);
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

  return (
    <AdminShell title="Jarvis" eyebrow="Die interne KI-Instanz von PAWN">
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

      {pending.length > 0 && (
        <section className="mb-8 border-[1.5px] border-black">
          <header className="border-b-[1.5px] border-black px-5 py-3">
            <p className="editorial-eyebrow">Wartet auf dich</p>
          </header>
          <ul className="divide-y divide-border">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-serif text-base">{p.action}</p>
                  {p.reason && <p className="text-sm text-muted-foreground">{p.reason}</p>}
                  <p className="text-xs text-muted-foreground">Vorgeschlagen {timeAgo(p.created_at)} · läuft ab {timeAgo(p.expires_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={resolving === p.id}
                    onClick={() => resolveAction(p.id, "confirm_action")}
                    className="rounded-none bg-black text-white hover:bg-white hover:text-black"
                  >
                    {resolving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolving === p.id}
                    onClick={() => resolveAction(p.id, "reject_action")}
                    className="rounded-none border-black hover:bg-black hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
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

      <section className="mb-8 border-[1.5px] border-black">
        <header className="border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Berichte</p>
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

      <section className="border-[1.5px] border-black">
        <header className="border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Lauf-Protokoll · letzte 20</p>
        </header>
        {runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Noch keine Läufe.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Zeit</th>
                <th className="px-4 py-2.5">Auslöser</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.started_at).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2 uppercase tracking-[0.18em] text-[0.7rem]">{r.trigger}</td>
                  <td className="px-4 py-2"><StatusChip status={r.status} /></td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.cost_estimate != null ? `$${r.cost_estimate.toFixed(3)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
