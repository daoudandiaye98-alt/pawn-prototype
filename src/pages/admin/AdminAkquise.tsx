/**
 * Akquise-Cockpit: das Werkzeug, mit dem Daouda täglich Designer für PAWN gewinnt.
 * Reines Frontend gegen die bereits bestehende Tabelle `acquisition_leads`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  X, Copy, Loader2, Search, ArrowUpDown, Upload, Info,
} from "lucide-react";

type World = "Mode" | "Kunst" | "Interior";
type Status =
  | "neu" | "angewaermt" | "kontaktiert" | "antwort"
  | "registriert" | "aktiviert" | "spaeter" | "nein" | "ghost";

interface Lead {
  id: string;
  handle: string;
  world: string;
  source: string | null;
  followers: number | null;
  bio: string | null;
  personal_line: string | null;
  status: string;
  warmed_at: string | null;
  contacted_at: string | null;
  followup_at: string | null;
  clips: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const WORLDS: World[] = ["Mode", "Kunst", "Interior"];
const GOALS: Record<World, number> = { Mode: 500, Kunst: 250, Interior: 250 };

const STATUSES: Status[] = [
  "neu", "angewaermt", "kontaktiert", "antwort",
  "registriert", "aktiviert", "spaeter", "nein", "ghost",
];

const STATUS_LABELS: Record<Status, string> = {
  neu: "Neu",
  angewaermt: "Angewärmt",
  kontaktiert: "Kontaktiert",
  antwort: "Antwort",
  registriert: "Registriert",
  aktiviert: "Aktiviert",
  spaeter: "Später",
  nein: "Nein",
  ghost: "Ghost",
};

// Aktions-Knöpfe im Detail-Panel — "Neu" ist der Startzustand, kein Klick-Ziel.
const ACTION_STATUSES: Status[] = [
  "angewaermt", "kontaktiert", "antwort", "registriert", "aktiviert", "spaeter", "nein", "ghost",
];

function buildMessage(personalLine: string) {
  return `Hey, ich bin Daouda aus Köln. ${personalLine}

Ich baue gerade PAWN — eine kuratierte Ausstellung für unabhängige Designer aus Mode, Interior und Kunst. Kein Katalog, kein Marktplatz-Grau: ein ruhiger Raum, in dem jedes Haus seine eigene Geschichte erzählt und gesehen wird.

Für dich entstehen keine Kosten. Keine Grundgebühr, keine Mindestlaufzeit. Du lädst deine Stücke einmal hoch — die Fotos hast du ja längst — und wir kümmern uns darum, dass man dich sieht. Wenn etwas verkauft wird, bleiben 93% bei dir.

Ausgabe 08 öffnet gerade, die ersten Häuser ziehen ein: pawn.vision

Wenn's nichts für dich ist — auch gut, mach weiter so.`;
}

const FOLLOWUP_MESSAGE = `Kein Stress — wollte nur sichergehen, dass meine Nachricht nicht im Anfragen-Ordner versackt ist. Falls du reinschauen magst: pawn.vision. Kostet nichts, und Ausgabe 08 hat noch Platz. Wenn nicht, ist das auch völlig okay.`;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function clipsOf(lead: Lead): string[] {
  return Array.isArray(lead.clips) ? (lead.clips as string[]) : [];
}

/* ─────────────────────── Kopfzeile: Tageslage ─────────────────────── */

function DayCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-[1.5px] border-black p-5">
      <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-3 font-serif text-3xl leading-none tabular-nums">{value}</p>
    </div>
  );
}

function WorldProgress({ world, count }: { world: World; count: number }) {
  const goal = GOALS[world];
  const pct = Math.min(100, Math.round((count / goal) * 100));
  return (
    <div className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
      <span className="w-20 shrink-0 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{world}</span>
      <div className="h-2 flex-1 border border-black">
        <div className="h-full bg-black" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {count} / {goal}
      </span>
    </div>
  );
}

/* ─────────────────────── Status-Chip ─────────────────────── */

function StatusChip({ status }: { status: string }) {
  const positive = status === "registriert" || status === "aktiviert";
  const closed = status === "nein" || status === "ghost" || status === "spaeter";
  return (
    <span
      className={cn(
        "inline-block border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]",
        positive && "border-black bg-black text-white",
        !positive && !closed && "border-black text-foreground",
        closed && "border-border text-muted-foreground",
      )}
    >
      {STATUS_LABELS[status as Status] ?? status}
    </span>
  );
}

/* ─────────────────────── Detail-Drawer ─────────────────────── */

function LeadDrawer({
  lead, onClose, onChange,
}: { lead: Lead; onClose: () => void; onChange: (patch: Partial<Lead>) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => { setNotes(lead.notes ?? ""); firstRender.current = true; }, [lead.id]);

  // Notizfeld: debounced Autosave
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = window.setTimeout(async () => {
      const { error } = await supabase
        .from("acquisition_leads")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      if (error) toast.error(error.message);
      else onChange({ notes });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  async function setStatus(next: Status) {
    setBusy(next);
    const now = new Date().toISOString();
    const patch: { status: string; updated_at: string; warmed_at?: string; contacted_at?: string } = { status: next, updated_at: now };
    if (next === "angewaermt") patch.warmed_at = now;
    if (next === "kontaktiert") patch.contacted_at = now;
    const { error } = await supabase.from("acquisition_leads").update(patch).eq("id", lead.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status: ${STATUS_LABELS[next]}`);
    onChange(patch);
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(buildMessage(lead.personal_line ?? ""));
    toast.success("Nachricht kopiert.");
  }

  async function copyFollowup() {
    await navigator.clipboard.writeText(FOLLOWUP_MESSAGE);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("acquisition_leads")
      .update({ followup_at: now, updated_at: now })
      .eq("id", lead.id);
    if (error) toast.error(error.message);
    else onChange({ followup_at: now });
    toast.success("Follow-up kopiert.");
  }

  const clips = clipsOf(lead);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full overflow-y-auto border-l-[1.5px] border-black bg-background sm:max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b-[1.5px] border-black bg-background px-6 py-4">
          <div>
            <p className="editorial-eyebrow">{lead.world}</p>
            <h2 className="font-serif text-2xl">@{lead.handle}</h2>
          </div>
          <button onClick={onClose} className="border-[1.5px] border-black p-1.5 hover:bg-black hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-8 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={lead.status} />
            <a
              href={`https://instagram.com/${lead.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.7rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline"
            >
              Instagram öffnen ↗
            </a>
            {lead.followers != null && (
              <span className="text-xs text-muted-foreground">{lead.followers.toLocaleString("de-DE")} Follower</span>
            )}
          </div>

          {lead.bio && (
            <section>
              <p className="editorial-eyebrow mb-2">Bio</p>
              <p className="whitespace-pre-line text-sm text-foreground/80">{lead.bio}</p>
            </section>
          )}

          {lead.personal_line && (
            <section>
              <p className="editorial-eyebrow mb-2">Persönlicher Satz</p>
              <p className="whitespace-pre-line text-sm text-foreground/80">{lead.personal_line}</p>
            </section>
          )}

          <section>
            <p className="editorial-eyebrow mb-3">Clips</p>
            {clips.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Clips hinterlegt.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {clips.map((url, i) => (
                  <video key={i} src={url} controls playsInline className="aspect-[9/16] w-full border border-border bg-black object-contain" />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 border-t-[1.5px] border-black pt-6">
            <p className="editorial-eyebrow">Nachricht</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={copyMessage} className="flex-1 rounded-none bg-black text-white hover:bg-white hover:text-black">
                <Copy className="mr-2 h-4 w-4" /> Nachricht kopieren
              </Button>
              <Button onClick={copyFollowup} variant="outline" className="flex-1 rounded-none border-black hover:bg-black hover:text-white">
                <Copy className="mr-2 h-4 w-4" /> Follow-up kopieren
              </Button>
            </div>
          </section>

          <section className="space-y-3 border-t-[1.5px] border-black pt-6">
            <p className="editorial-eyebrow">Status setzen</p>
            <div className="flex flex-wrap gap-2">
              {ACTION_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  disabled={busy !== null}
                  className={cn(
                    "border-[1.5px] border-black px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] disabled:opacity-40",
                    lead.status === s ? "bg-black text-white" : "hover:bg-black hover:text-white",
                  )}
                >
                  {busy === s ? <Loader2 className="h-3 w-3 animate-spin" /> : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </section>

          <section className="border-t-[1.5px] border-black pt-6">
            <p className="editorial-eyebrow mb-2">Notizen</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notizen (speichert automatisch)…"
              className="rounded-none border-black"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Import ─────────────────────── */

interface ParsedRow {
  handle: string; world: string; source: string | null;
  followers: number | null; bio: string | null; personal_line: string | null;
  error: string | null;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeWorld(raw: string): string | null {
  const w = raw.trim().toLowerCase();
  if (w === "mode") return "Mode";
  if (w === "kunst") return "Kunst";
  if (w === "interior") return "Interior";
  return null;
}

function parseLeadsInput(text: string): ParsedRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as Record<string, unknown>[];
      return arr.map((r) => toParsedRow({
        handle: String(r.handle ?? ""),
        world: String(r.world ?? ""),
        source: r.source != null ? String(r.source) : "",
        followers: r.followers != null ? String(r.followers) : "",
        bio: r.bio != null ? String(r.bio) : "",
        personal_line: r.personal_line != null ? String(r.personal_line) : "",
      }));
    } catch {
      return [{ handle: "", world: "", source: null, followers: null, bio: null, personal_line: null, error: "JSON ungültig." }];
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const hasHeader = idx("handle") !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitCsvLine(line);
    const get = (name: string, fallback: number) => {
      const i = hasHeader ? idx(name) : fallback;
      return i >= 0 && i < cells.length ? cells[i] : "";
    };
    return toParsedRow({
      handle: get("handle", 0),
      world: get("world", 1),
      source: get("source", 2),
      followers: get("followers", 3),
      bio: get("bio", 4),
      personal_line: get("personal_line", 5),
    });
  });
}

function toParsedRow(r: { handle: string; world: string; source: string; followers: string; bio: string; personal_line: string }): ParsedRow {
  const handle = r.handle.replace(/^@/, "").trim();
  const world = normalizeWorld(r.world);
  const followersNum = r.followers.trim() ? Number(r.followers.replace(/[^\d]/g, "")) : null;
  let error: string | null = null;
  if (!handle) error = "Handle fehlt.";
  else if (!world) error = "Welt muss Mode/Kunst/Interior sein.";
  return {
    handle,
    world: world ?? r.world.trim(),
    source: r.source.trim() || null,
    followers: followersNum != null && !Number.isNaN(followersNum) ? followersNum : null,
    bio: r.bio.trim() || null,
    personal_line: r.personal_line.trim() || null,
    error,
  };
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(() => (rows ?? []).filter((r) => !r.error), [rows]);

  async function doImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    const payload = validRows.map((r) => ({
      handle: r.handle,
      world: r.world,
      source: r.source,
      followers: r.followers,
      bio: r.bio,
      personal_line: r.personal_line,
    }));
    const { data, error } = await supabase
      .from("acquisition_leads")
      .upsert(payload, { onConflict: "handle", ignoreDuplicates: true })
      .select("id");
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    const imported = data?.length ?? 0;
    const skipped = validRows.length - imported;
    toast.success(`${imported} importiert · ${skipped} übersprungen (Duplikate)`);
    setText("");
    setRows(null);
    onImported();
  }

  return (
    <section className="border-[1.5px] border-black p-5">
      <p className="editorial-eyebrow mb-3">Leads importieren</p>
      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setRows(null); }}
        rows={5}
        placeholder="CSV (handle,world,source,followers,bio,personal_line) oder JSON-Array einfügen…"
        className="rounded-none border-black font-mono text-xs"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setRows(parseLeadsInput(text))}
          variant="outline"
          disabled={!text.trim()}
          className="rounded-none border-black hover:bg-black hover:text-white"
        >
          Vorschau
        </Button>
        {rows && (
          <Button
            onClick={doImport}
            disabled={importing || validRows.length === 0}
            className="rounded-none bg-black text-white hover:bg-white hover:text-black"
          >
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {validRows.length} importieren
          </Button>
        )}
      </div>

      {rows && (
        <div className="mt-4 max-h-64 overflow-y-auto border border-border">
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Handle</th>
                <th className="px-3 py-2">Welt</th>
                <th className="px-3 py-2">Follower</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5">{r.handle || "—"}</td>
                  <td className="px-3 py-1.5">{r.world || "—"}</td>
                  <td className="px-3 py-1.5">{r.followers ?? "—"}</td>
                  <td className={cn("px-3 py-1.5", r.error ? "text-red-600" : "text-muted-foreground")}>
                    {r.error ?? "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────── Hauptseite ─────────────────────── */

type SortField = "created_at" | "followers";

export default function AdminAkquise() {
  const { user, roles, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [rows, setRows] = useState<Lead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | "all">(
    initialStatus && STATUSES.includes(initialStatus as Status) ? (initialStatus as Status) : "all",
  );
  const [worldFilter, setWorldFilter] = useState<World | "all">("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("acquisition_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast.error(error.message);
    setRows((data as Lead[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (user && roles.includes("admin")) void load(); }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const kpis = {
    toWarmUp: rows.filter((r) => r.status === "neu").length,
    toContact: rows.filter((r) => r.status === "angewaermt" && (daysSince(r.warmed_at) ?? 0) >= 2).length,
    followupDue: rows.filter((r) => r.status === "kontaktiert" && !r.followup_at && (daysSince(r.contacted_at) ?? 0) >= 5).length,
    registeredTotal: rows.filter((r) => r.status === "registriert" || r.status === "aktiviert").length,
  };

  const countsByWorld: Record<World, number> = {
    Mode: rows.filter((r) => r.world === "Mode").length,
    Kunst: rows.filter((r) => r.world === "Kunst").length,
    Interior: rows.filter((r) => r.world === "Interior").length,
  };

  const filtered = rows
    .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
    .filter((r) => (worldFilter === "all" ? true : r.world === worldFilter))
    .filter((r) => (search.trim() ? r.handle.toLowerCase().includes(search.trim().toLowerCase()) : true));

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "followers") return ((a.followers ?? 0) - (b.followers ?? 0)) * dir;
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function patchRow(id: string, patch: Partial<Lead>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <AdminShell title="Akquise" eyebrow="Designer gewinnen · täglich">
      <div className="mb-6 flex items-start gap-3 border-[1.5px] border-black bg-white p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">So funktioniert's:</strong> anwärmen → 2 Tage warten → DM mit Clips → nach 5 Tagen einmal nachfassen → dann Ruhe.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DayCell label="Heute anzuwärmen" value={kpis.toWarmUp} />
        <DayCell label="Heute zu kontaktieren" value={kpis.toContact} />
        <DayCell label="Follow-up fällig" value={kpis.followupDue} />
        <DayCell label="Registriert gesamt" value={kpis.registeredTotal} />
      </div>

      <div className="mb-8 border-[1.5px] border-black p-5">
        <p className="editorial-eyebrow mb-3">Fortschritt gegen Ziel</p>
        {WORLDS.map((w) => (
          <WorldProgress key={w} world={w} count={countsByWorld[w]} />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "border-[1.5px] border-black px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em]",
            statusFilter === "all" ? "bg-black text-white" : "hover:bg-black hover:text-white",
          )}
        >
          Alle Status
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "border-[1.5px] border-black px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em]",
              statusFilter === s ? "bg-black text-white" : "hover:bg-black hover:text-white",
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setWorldFilter("all")}
          className={cn(
            "border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]",
            worldFilter === "all" ? "border-black bg-black text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Alle Welten
        </button>
        {WORLDS.map((w) => (
          <button
            key={w}
            onClick={() => setWorldFilter(w)}
            className={cn(
              "border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]",
              worldFilter === w ? "border-black bg-black text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {w}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Handle suchen…"
            className="rounded-none border-black pl-8"
          />
        </div>
      </div>

      <div className="border-[1.5px] border-black bg-card">
        {fetching ? (
          <div className="flex items-center justify-center p-16 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Pipeline…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            Die ersten Kandidaten ziehen ein.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b-[1.5px] border-black text-left text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Handle</th>
                <th className="px-4 py-3 hidden sm:table-cell">Welt</th>
                <th className="px-4 py-3">
                  <button onClick={() => toggleSort("followers")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Follower <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">
                  <button onClick={() => toggleSort("created_at")} className="inline-flex items-center gap-1 hover:text-foreground">
                    Erfasst <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={`https://instagram.com/${r.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="underline-offset-4 hover:underline"
                    >
                      @{r.handle}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{r.world}</td>
                  <td className="px-4 py-3 tabular-nums">{r.followers != null ? r.followers.toLocaleString("de-DE") : "—"}</td>
                  <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8">
        <ImportPanel onImported={load} />
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          onClose={() => setSelectedId(null)}
          onChange={(patch) => patchRow(selected.id, patch)}
        />
      )}
    </AdminShell>
  );
}
