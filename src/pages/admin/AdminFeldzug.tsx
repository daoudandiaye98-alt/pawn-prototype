/**
 * WP3 "Die ersten Fünfzig" — der Feldzug: die mobile Sende-Rampe. Wichtigstes Werkzeug dieses
 * Auftrags. Ziel: Daouda schafft 50 DMs in unter 40 Minuten vom iPhone. Entwurfs-Prinzip gilt
 * hart: Instagram-DMs sendet ausschließlich der Mensch, das Organ bereitet nur vor.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Copy, Loader2, ExternalLink, Check, SkipForward } from "lucide-react";

interface FeldzugLead {
  id: string;
  handle: string;
  world: string | null;
  followers: number | null;
  personal_line: string | null;
  message_draft: string | null;
  status: string;
  channel: string | null;
  admin_decision: string | null;
  qc_passed: boolean | null;
  contacted_at: string | null;
  kurator_score: number | null;
  blocked_reason: string | null;
  replied_at: string | null;
  reply_sentiment: string | null;
  notes: string | null;
  scrape_images: unknown;
  bounce_type: string | null;
  lead_type: string;
  followup_at: string | null;
  dm_followup_draft: string | null;
  dm_followup_sent_at: string | null;
}

type ChannelTab = "dm" | "nachfassen" | "email" | "blockiert";
type MainTab = "heute" | "gespraech";

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openInstagramDeeplink(handle: string) {
  const igMe = `https://ig.me/m/${encodeURIComponent(handle)}`;
  if (isMobileDevice()) {
    window.location.href = igMe;
    window.setTimeout(() => { window.location.href = `https://instagram.com/${encodeURIComponent(handle)}`; }, 900);
  } else {
    window.open(`https://instagram.com/${encodeURIComponent(handle)}`, "_blank", "noopener,noreferrer");
  }
}

function scrapeImages(lead: FeldzugLead): string[] {
  return Array.isArray(lead.scrape_images) ? (lead.scrape_images as string[]).slice(0, 3) : [];
}

/* ─────────────────────── DM-Karte: eine pro Lead, Vollbild mobil ─────────────────────── */

function DmCard({
  lead, onSent, onSkip, busy, textOverride, skipHidden,
}: {
  lead: FeldzugLead;
  onSent: () => void;
  onSkip: (reason: string) => void;
  busy: boolean;
  /** WP5 "Die Rampe auf Hochtouren": für Nachfass-Karten zeigt/kopiert die Karte
   * dm_followup_draft statt der ursprünglichen Erstnachricht. */
  textOverride?: string | null;
  skipHidden?: boolean;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = frisch, 1 = kopiert, 2 = Instagram geöffnet
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const images = scrapeImages(lead);
  const text = textOverride ?? lead.message_draft;

  useEffect(() => { setStep(0); setSkipOpen(false); setSkipReason(""); }, [lead.id]);

  async function copyText() {
    await navigator.clipboard.writeText(text ?? "");
    toast.success("Nachricht kopiert.");
    setStep((s) => (s < 1 ? 1 : s));
  }

  function openInstagram() {
    openInstagramDeeplink(lead.handle);
    setStep(2);
  }

  function confirmSkip() {
    if (!skipReason.trim()) { toast.error("Bitte kurz einen Grund angeben."); return; }
    onSkip(skipReason.trim());
  }

  return (
    <div className="border-[1.5px] border-black bg-white">
      <header className="border-b-[1.5px] border-black px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="editorial-eyebrow">{lead.world ?? "—"}</p>
            <h2 className="font-serif text-2xl">@{lead.handle}</h2>
          </div>
          {lead.followers != null && (
            <span className="shrink-0 text-xs text-muted-foreground">{lead.followers.toLocaleString("de-DE")} Follower</span>
          )}
        </div>
        {images.length > 0 && (
          <div className="mt-3 flex gap-2">
            {images.map((src) => (
              <img key={src} src={src} alt={`Arbeit von @${lead.handle}`} loading="lazy" className="h-16 w-16 border border-black object-cover" />
            ))}
          </div>
        )}
      </header>

      <div className="px-5 py-5">
        <p className="editorial-eyebrow mb-2">Nachricht</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{text || "Kein Entwurf vorhanden."}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 border-t-[1.5px] border-black p-5 sm:grid-cols-3">
        <Button
          onClick={copyText}
          variant={step === 0 ? "default" : "outline"}
          className={cn("rounded-none justify-center", step === 0 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
        >
          <Copy className="mr-2 h-4 w-4" /> Kopieren
        </Button>
        <Button
          onClick={openInstagram}
          variant={step === 1 ? "default" : "outline"}
          className={cn("rounded-none justify-center", step === 1 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Instagram öffnen
        </Button>
        <Button
          onClick={onSent}
          disabled={busy}
          variant={step === 2 ? "default" : "outline"}
          className={cn("rounded-none justify-center", step === 2 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Gesendet ✓
        </Button>
      </div>

      {!skipHidden && (
        <div className="border-t border-border px-5 py-3">
          {!skipOpen ? (
            <button
              type="button"
              onClick={() => setSkipOpen(true)}
              className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" /> Überspringen
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={2}
                placeholder="Warum überspringen? (Pflichtfeld)"
                className="rounded-none border-black text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmSkip} disabled={busy} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                  Überspringen bestätigen
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setSkipOpen(false); setSkipReason(""); }} className="rounded-none border-black">
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── E-Mail-Status (automatischer Kanal, nur Anzeige) ─────────────────────── */

function emailQueueStatus(lead: FeldzugLead): string {
  if (lead.bounce_type) return "gebounced";
  if (lead.contacted_at) return "gesendet";
  return "wartet";
}

function kurzDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/** WP5 "Die Rampe auf Hochtouren": statt nur eines Status-Worts die ganze E-Mail-Spur eines Leads
 * im selben Tab — Erstkontakt, Nachfassen, Antwort — jeweils mit Datum, wenn vorhanden. */
function EmailStatusList({ leads }: { leads: FeldzugLead[] }) {
  if (leads.length === 0) return <p className="p-6 text-sm text-muted-foreground">Keine E-Mail-Leads in der Warteschlange.</p>;
  return (
    <ul className="divide-y divide-border">
      {leads.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="font-serif text-base">@{l.handle}</p>
            <p className="text-xs text-muted-foreground">{l.world ?? "—"}</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              {l.contacted_at ? `Erstkontakt ${kurzDatum(l.contacted_at)}` : "Noch kein Erstkontakt"}
              {l.followup_at && ` · Nachgefasst ${kurzDatum(l.followup_at)}`}
              {l.replied_at && ` · Antwort ${kurzDatum(l.replied_at)}`}
            </p>
          </div>
          <span className="shrink-0 border border-black px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]">
            {emailQueueStatus(l)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Blockiert-Ansicht ─────────────────────── */

function BlockedList({ leads }: { leads: FeldzugLead[] }) {
  if (leads.length === 0) return <p className="p-6 text-sm text-muted-foreground">Nichts blockiert.</p>;
  return (
    <ul className="divide-y divide-border">
      {leads.map((l) => (
        <li key={l.id} className="px-5 py-3">
          <p className="font-serif text-base">@{l.handle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{l.blocked_reason}</p>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Im Gespräch ─────────────────────── */

const SENTIMENTS: { key: "positiv" | "neutral" | "negativ"; label: string }[] = [
  { key: "positiv", label: "Positiv" },
  { key: "neutral", label: "Neutral" },
  { key: "negativ", label: "Negativ" },
];

function GespraechCard({
  lead, onReplied, onRuhe, busy,
}: {
  lead: FeldzugLead;
  onReplied: (sentiment: "positiv" | "neutral" | "negativ") => void;
  onRuhe: (reason: string) => void;
  busy: boolean;
}) {
  const [ruheOpen, setRuheOpen] = useState(false);
  const [ruheReason, setRuheReason] = useState("");

  return (
    <li className="border-b border-border px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-serif text-base">@{lead.handle}</p>
        <span className="text-xs text-muted-foreground">{lead.world ?? "—"}</span>
      </div>
      {lead.dm_followup_sent_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nachfassen bereits gesendet am {new Date(lead.dm_followup_sent_at).toLocaleDateString("de-DE")} — ein zweites Nachfassen ist nicht vorgesehen, eher Richtung Ruhe.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Hat geantwortet:</p>
        {SENTIMENTS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onReplied(s.key)}
            className="rounded-none border-black text-[0.65rem] hover:bg-black hover:text-white"
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="mt-2">
        {!ruheOpen ? (
          <button
            type="button"
            onClick={() => setRuheOpen(true)}
            className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            Ruhe (kein Interesse)
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <Textarea
              value={ruheReason}
              onChange={(e) => setRuheReason(e.target.value)}
              rows={2}
              placeholder="Kurzer Grund…"
              className="rounded-none border-black text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !ruheReason.trim()} onClick={() => onRuhe(ruheReason.trim())} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                Bestätigen
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setRuheOpen(false); setRuheReason(""); }} className="rounded-none border-black">
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/* ─────────────────────── Hauptseite ─────────────────────── */

interface TodayFunnel {
  neu: number;
  kontaktiert: number;
  geantwortet: number;
  beworben: number;
}

export default function AdminFeldzug() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<FeldzugLead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("heute");
  const [channelTab, setChannelTab] = useState<ChannelTab>("dm");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [todayFunnel, setTodayFunnel] = useState<TodayFunnel | null>(null);
  // WP5 "Die Rampe auf Hochtouren": Tagesziel aus ai_config.akquise_config.daily_goal, Standard 50.
  const [dailyGoal, setDailyGoal] = useState(50);
  // WP6/WP7 "Das Attributions-Netz": wie viele Bewerbungen lassen sich auf einen Akquise-Kontakt
  // zurückführen — "X von Y", nie mehr behauptet als real gezählt.
  const [attribution, setAttribution] = useState<{ attributed: number; total: number } | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const load = async () => {
    setFetching(true);
    const heuteStart = new Date(); heuteStart.setHours(0, 0, 0, 0);
    const heuteIso = heuteStart.toISOString();
    const [leadsRes, neuRes, kontaktiertRes, geantwortetRes, beworbenRes, configRes, attributionRes] = await Promise.all([
      supabase
        .from("acquisition_leads")
        .select("id, handle, world, followers, personal_line, message_draft, status, channel, admin_decision, qc_passed, contacted_at, kurator_score, blocked_reason, replied_at, reply_sentiment, notes, scrape_images, bounce_type, lead_type, followup_at, dm_followup_draft, dm_followup_sent_at")
        .eq("lead_type", "designer")
        .in("status", ["qualifiziert", "kontaktiert"])
        .order("kurator_score", { ascending: false, nullsFirst: false }),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("created_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("contacted_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("replied_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("applied_at", heuteIso),
      supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      supabase.rpc("get_attribution_stats"),
    ]);
    if (leadsRes.error) toast.error(leadsRes.error.message);
    setRows((leadsRes.data as FeldzugLead[] | null) ?? []);
    setTodayFunnel({
      neu: neuRes.count ?? 0,
      kontaktiert: kontaktiertRes.count ?? 0,
      geantwortet: geantwortetRes.count ?? 0,
      beworben: beworbenRes.count ?? 0,
    });
    const goal = (configRes.data?.value as { daily_goal?: number } | null)?.daily_goal;
    if (typeof goal === "number" && goal > 0) setDailyGoal(goal);
    const attrRow = (attributionRes.data as { attributed: number; total: number }[] | null)?.[0] ?? null;
    if (attrRow) setAttribution(attrRow);
    setFetching(false);
  };

  async function runBackfill() {
    setBackfillBusy(true);
    const { data, error } = await supabase.rpc("backfill_lead_attribution");
    setBackfillBusy(false);
    if (error) { toast.error(error.message); return; }
    const result = (data as { matched_count: number; examined_count: number }[] | null)?.[0];
    if (!result || result.examined_count === 0) {
      toast("Keine unzugeordneten Bewerbungen mit Instagram-Handle gefunden.");
    } else if (result.matched_count === 0) {
      toast(`${result.examined_count} geprüft, aber kein eindeutiger Instagram-Handle-Treffer gefunden.`);
    } else {
      toast.success(`${result.matched_count} von ${result.examined_count} geprüften Bewerbungen zugeordnet.`);
    }
    void load();
  }

  useEffect(() => { if (user && roles.includes("admin")) void load(); }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  function patch(id: string, p: Partial<FeldzugLead>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  // "Heutige Züge": freigegeben, geprüft, noch nicht kontaktiert.
  const readyToday = rows.filter((r) => r.admin_decision === "ja" && r.qc_passed === true && !r.contacted_at);
  const dmQueue = readyToday.filter((r) => r.channel !== "email" && !r.blocked_reason);
  // WP5: die E-Mail-Ansicht zeigt jetzt die ganze Spur (auch schon Kontaktierte), nicht nur die
  // Warteschlange — sonst ist von "Erstkontakt/Nachgefasst/Antwort" nie etwas zu sehen.
  const emailQueue = rows.filter((r) => r.channel === "email");
  const blockedQueue = readyToday.filter((r) => !!r.blocked_reason);
  // WP5: vorbereitete Nachfass-Entwürfe, noch nicht gesendet — eigener Zug neben der Erstnachricht.
  const nachfassenQueue = rows.filter((r) => r.dm_followup_draft && !r.dm_followup_sent_at);

  // "Im Gespräch": kontaktiert (manueller Kanal), noch keine Antwort erfasst.
  const gespraech = rows.filter((r) => r.status === "kontaktiert" && r.channel !== "email" && !r.replied_at);

  const currentDm = dmQueue[0] ?? null;
  const currentNachfassen = nachfassenQueue[0] ?? null;

  async function markSent(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "kontaktiert", contacted_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "kontaktiert", contacted_at: now });
    toast.success(`@${lead.handle} als gesendet markiert.`);
  }

  async function markNachfassenSent(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ dm_followup_sent_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { dm_followup_sent_at: now });
    toast.success(`@${lead.handle}: Nachfassen als gesendet markiert.`);
  }

  async function skipLead(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const { error } = await supabase.from("acquisition_leads")
      .update({ blocked_reason: reason, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { blocked_reason: reason });
    toast.success(`@${lead.handle} übersprungen.`);
  }

  async function markReplied(lead: FeldzugLead, sentiment: "positiv" | "neutral" | "negativ") {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "geantwortet", replied_at: now, reply_channel: lead.channel, reply_sentiment: sentiment, updated_at: now })
      .eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "geantwortet", replied_at: now, reply_sentiment: sentiment });
    toast.success(`@${lead.handle}: Antwort erfasst.`);
  }

  async function markRuhe(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const notes = [lead.notes, `Ruhe: ${reason}`].filter(Boolean).join("\n");
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "ruhe", notes, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "ruhe", notes });
    toast.success(`@${lead.handle}: Ruhe.`);
  }

  return (
    <AdminShell title="Feldzug" eyebrow="Die mobile Sende-Rampe">
      {/* WP7 "Wirkungs-Cockpit": ehrliches Heute-Band statt reiner Warteschlangen-Zahlen —
          nur Felder mit echtem Zeitstempel (created_at/contacted_at/replied_at/applied_at). */}
      {todayFunnel && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-px border-[1.5px] border-black bg-black sm:grid-cols-4">
            {[
              { label: "Neu heute", value: todayFunnel.neu },
              { label: "Heute gesendet", value: `${todayFunnel.kontaktiert} / ${dailyGoal}` },
              { label: "Geantwortet heute", value: todayFunnel.geantwortet },
              { label: "Beworben heute", value: todayFunnel.beworben },
            ].map((s) => (
              <div key={s.label} className="bg-white px-4 py-3">
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-serif text-2xl tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          {/* WP5 "Die Rampe auf Hochtouren": freundlicher Hinweis am Tagesziel, kein Stopp — der
              Feldzug bleibt bedienbar, egal wie hoch der Zähler steht. */}
          {todayFunnel.kontaktiert >= dailyGoal && (
            <p className="mb-6 border-[1.5px] border-black bg-white px-4 py-3 text-sm">
              Tagesziel von {dailyGoal} erreicht — großartig. Du kannst gerne weitermachen, musst aber nicht.
            </p>
          )}
        </>
      )}

      {/* WP7 "Das Attributions-Netz": ehrliche Zuordnungsrate + manueller Nachzieh-Lauf. */}
      {attribution && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-black bg-white px-4 py-3">
          <p className="text-sm">
            <span className="font-serif text-lg tabular-nums">{attribution.attributed} von {attribution.total}</span>{" "}
            <span className="text-muted-foreground">Bewerbungen einem Akquise-Kontakt zugeordnet.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={backfillBusy}
            onClick={() => void runBackfill()}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {backfillBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ursprünge nachziehen
          </Button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {(["heute", "gespraech"] as MainTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={cn(
              "border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em]",
              mainTab === t ? "bg-black text-white" : "hover:bg-black hover:text-white",
            )}
          >
            {t === "heute" ? `Heutige Züge (${dmQueue.length})` : `Im Gespräch (${gespraech.length})`}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center p-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Feldzug…
        </div>
      ) : mainTab === "heute" ? (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              { key: "dm" as ChannelTab, label: `DM (${dmQueue.length})` },
              { key: "nachfassen" as ChannelTab, label: `Nachfassen (${nachfassenQueue.length})` },
              { key: "email" as ChannelTab, label: `E-Mail (${emailQueue.length})` },
              { key: "blockiert" as ChannelTab, label: `Blockiert (${blockedQueue.length})` },
            ]).map((c) => (
              <button
                key={c.key}
                onClick={() => setChannelTab(c.key)}
                className={cn(
                  "border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]",
                  channelTab === c.key ? "border-black bg-black text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {channelTab === "dm" && (
            currentDm ? (
              <DmCard
                lead={currentDm}
                busy={busyId === currentDm.id}
                onSent={() => void markSent(currentDm)}
                onSkip={(reason) => void skipLead(currentDm, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Für heute erledigt — alle freigegebenen DMs sind raus.
              </div>
            )
          )}
          {channelTab === "nachfassen" && (
            currentNachfassen ? (
              <DmCard
                lead={currentNachfassen}
                busy={busyId === currentNachfassen.id}
                textOverride={currentNachfassen.dm_followup_draft}
                onSent={() => void markNachfassenSent(currentNachfassen)}
                onSkip={(reason) => void skipLead(currentNachfassen, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Kein Nachfassen fällig — PAWN bereitet Nachfass-Entwürfe automatisch vor, sobald
                kontaktierte Leads seit mindestens drei Tagen ohne Antwort sind.
              </div>
            )
          )}
          {channelTab === "email" && (
            <div className="border-[1.5px] border-black">
              <EmailStatusList leads={emailQueue} />
            </div>
          )}
          {channelTab === "blockiert" && (
            <div className="border-[1.5px] border-black">
              <BlockedList leads={blockedQueue} />
            </div>
          )}
        </div>
      ) : (
        <div className="border-[1.5px] border-black">
          {gespraech.length === 0 ? (
            <p className="p-16 text-center text-muted-foreground">Keine offenen Gespräche.</p>
          ) : (
            <ul>
              {gespraech.map((l) => (
                <GespraechCard
                  key={l.id}
                  lead={l}
                  busy={busyId === l.id}
                  onReplied={(s) => void markReplied(l, s)}
                  onRuhe={(r) => void markRuhe(l, r)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminShell>
  );
}
