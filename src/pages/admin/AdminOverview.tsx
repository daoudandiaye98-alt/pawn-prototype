import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/pawn/AdminShell";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { cn } from "@/lib/utils";
import { RoleGate, PrototypeAccessBanner } from "@/features/access/RoleGate";
import {
  ArrowRight, ArrowUpRight, Check, HeartPulse, Loader2, Rss, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminRecentOrders, useAdminTopDesigners, useAdminSystemStats,
  useAdminPlatformKpis, useAcquisitionPulse, useDomainEventsTicker, useSystemHeartbeat,
} from "@/features/admin/useAdminData";
import { useAdminNextMove } from "@/features/admin/useAdminNextMove";
import { useJarvisCockpit, type JarvisRunRow, type JarvisQueueItem } from "@/features/admin/useJarvisCockpit";
import { useDisplayName } from "@/lib/displayName";

/* ─────────────────────── Cockpit primitives ─────────────────────── */

function Panel({
  title, action, children, className, eyebrow, live,
}: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
  className?: string; eyebrow?: string; live?: boolean;
}) {
  return (
    <section className={cn("flex flex-col border border-white/[0.07] bg-[hsl(18_10%_7%)]/70 backdrop-blur-[1px]", className)}>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-[15px] leading-none text-[hsl(36_25%_92%)]">{title}</h3>
          {eyebrow && <span className="text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(36_15%_55%)]">{eyebrow}</span>}
          {live && <LiveDot />}
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em] text-emerald-300/90">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}

function Btn({
  children, onClick, variant = "ghost", disabled,
}: { children: React.ReactNode; onClick?: () => void; variant?: "ghost" | "solid" | "danger"; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      "border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] transition-colors disabled:opacity-40",
      variant === "ghost" && "border-white/15 text-[hsl(36_25%_82%)] hover:border-white/40 hover:bg-white/[0.04]",
      variant === "solid" && "border-[hsl(350_55%_35%)] bg-[hsl(350_55%_22%)] text-[hsl(36_28%_94%)] hover:bg-[hsl(350_55%_28%)]",
      variant === "danger" && "border-red-500/40 text-red-200 hover:bg-red-500/10",
    )}>{children}</button>
  );
}

function Sparkline({ series, stroke = "hsl(350 55% 50%)", height = 28 }: { series: number[]; stroke?: string; height?: number }) {
  const width = 120;
  const max = Math.max(...series, 1); const min = Math.min(...series); const span = max - min || 1;
  const stepX = width / Math.max(series.length - 1, 1);
  const path = series.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${height - ((v - min) / span) * height * 0.85 - 2}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none"><path d={path} fill="none" stroke={stroke} strokeWidth={1.25} /></svg>;
}

function KpiCell({
  label, value, delta, trend, why, series, accent,
}: {
  label: string; value: string; delta?: string; trend?: "up" | "down" | "neutral";
  why?: string[]; series?: number[]; accent?: "wine" | "emerald" | "amber";
}) {
  const stroke = accent === "emerald" ? "hsl(160 55% 55%)" : accent === "amber" ? "hsl(38 90% 60%)" : "hsl(350 55% 55%)";
  return (
    <div className="group relative flex flex-col justify-between border border-white/[0.07] bg-[hsl(18_10%_6%)] p-5 transition-colors hover:bg-[hsl(18_10%_8%)]">
      <div className="flex items-start justify-between">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(36_15%_58%)]">{label}</p>
        {trend && (
          <span className={cn("text-[0.6rem]",
            trend === "up" && "text-emerald-300/90",
            trend === "down" && "text-red-300/90",
            trend === "neutral" && "text-[hsl(36_15%_55%)]",
          )}>{delta}</span>
        )}
      </div>
      <p className="mt-4 font-serif text-[28px] leading-none tabular-nums text-[hsl(36_28%_94%)]">{value}</p>
      {series && <div className="pointer-events-none mt-2 -mx-1 opacity-70"><Sparkline series={series} stroke={stroke} /></div>}
      {why && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[hsl(18_10%_5%)] via-[hsl(18_10%_5%)]/95 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="text-[0.55rem] uppercase tracking-[0.28em] text-[hsl(36_15%_55%)]">Warum</p>
          <ul className="mt-2 space-y-1 text-[11px] leading-snug text-[hsl(36_25%_86%)]">
            {why.map((w) => (
              <li key={w} className="flex gap-2"><span className="mt-1.5 h-px w-2 shrink-0 bg-[hsl(350_55%_50%)]" /><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Live-Puls: schmale Statusleiste ─────────────────────── */

function LivePulseBar({ lastUpdated }: { lastUpdated: Date }) {
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setNowTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secondsAgo = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
  const label = secondsAgo < 60 ? `vor ${secondsAgo}s` : `vor ${Math.floor(secondsAgo / 60)}m`;
  return (
    <div className="mt-3 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.24em] text-[hsl(36_15%_55%)]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Letzte Aktualisierung: {label}
    </div>
  );
}

/* ─────────────────────── Ereignis-Ticker: echte domain_events ─────────────────────── */

const EVENT_SENTENCES: Record<string, string> = {
  "order.placed": "Eine Bestellung wurde aufgegeben",
  "order.received": "Eine Bestellung ist eingegangen",
  "order.paid": "Eine Bestellung wurde bezahlt",
  "plan.updated": "Ein Plan wurde geändert",
  "designer.application_submitted": "Neue Bewerbung eingegangen",
  "designer.onboarding_completed": "Ein Designer hat das Onboarding abgeschlossen",
  "designer.consent_accepted": "Zustimmung erteilt",
  "consent.revoked": "Zustimmung widerrufen",
  "designer.level_up": "Ein Designer ist aufgestiegen",
  "designer.followed": "Ein Designer wurde gefolgt",
  "designer.registered": "Ein Designer wurde registriert",
  "product.viewed": "Ein Produkt wurde angesehen",
  "product.saved": "Ein Produkt wurde gemerkt",
  "product.registered": "Ein Produkt wurde angelegt",
  "cart.item_added": "Etwas wurde in den Warenkorb gelegt",
  "cart.item_removed": "Etwas wurde aus dem Warenkorb entfernt",
  "cart.cleared": "Ein Warenkorb wurde geleert",
  "mutation.proposed": "Eine DNA-Änderung wurde vorgeschlagen",
  "mutation.ratified": "Eine DNA-Änderung wurde bestätigt",
  "mutation.rejected": "Eine DNA-Änderung wurde abgelehnt",
  "dna.updated": "DNA wurde aktualisiert",
  "ai.prompt_updated": "Ein Prompt wurde aktualisiert",
  "ai.taste_signal": "Ein Geschmackssignal wurde erfasst",
  "ai.signal_corrected": "Ein Geschmackssignal wurde korrigiert",
  "ai.memory_deleted": "Eine Erinnerung wurde gelöscht",
  "ai.response_logged": "Eine KI-Antwort wurde protokolliert",
  "ai.tool_enabled": "Ein KI-Werkzeug wurde aktiviert",
  "ai.tool_disabled": "Ein KI-Werkzeug wurde deaktiviert",
  "plugin.enabled": "Ein Plugin wurde aktiviert",
  "plugin.disabled": "Ein Plugin wurde deaktiviert",
  "plugin.registered": "Ein Plugin wurde registriert",
  "content.updated": "Ein Inhalt wurde geändert",
  "campaign.broll_ready": "B-Roll für eine Kampagne ist fertig",
  "integration.dispatched": "Eine Integration wurde ausgelöst",
  "integration.failed": "Eine Integration ist fehlgeschlagen",
  "admin.action_requested": "Eine Admin-Aktion wurde angefordert",
  "identity.created": "Eine neue Identität wurde angelegt",
  "policy.updated": "Eine Policy wurde aktualisiert",
  "brand.registered": "Eine Marke wurde registriert",
};

function eventSentence(type: string): string {
  return EVENT_SENTENCES[type] ?? `Ereignis: ${type}`;
}

function EventTicker({ rows, loading }: { rows: { id: string; type: string; at: string }[]; loading: boolean }) {
  if (loading) return <EmptyRow text="Lade …" />;
  if (rows.length === 0) return <EmptyRow text="Noch ist es still. Der erste Zug kommt." />;
  return (
    <ul className="max-h-[360px] divide-y divide-white/[0.06] overflow-y-auto">
      {rows.map((e) => (
        <li key={e.id} className="px-5 py-3 text-[12px] animate-in fade-in slide-in-from-top-1 duration-500">
          <p className="text-[hsl(36_25%_86%)]">{eventSentence(e.type)}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[hsl(36_15%_45%)]">
            {timeAgo(new Date(e.at).getTime())} · {e.type}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── System-Herzschlag: Ampel ohne Farben ─────────────────────── */

function HeartbeatDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn(
      "inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
      ok ? "border-[hsl(36_28%_94%)] bg-[hsl(36_28%_94%)]" : "border-white/25 bg-transparent",
    )} />
  );
}

function SystemHeartbeatPanel({ hb }: { hb: ReturnType<typeof useSystemHeartbeat> }) {
  const rows: { label: string; ok: boolean; sub: string }[] = [];
  if (hb.secretsAvailable) {
    rows.push({ label: "Zahlungen", ok: hb.payments, sub: "Stripe-Key" });
    rows.push({ label: "KI", ok: hb.ai, sub: "OpenAI / Anthropic" });
    rows.push({ label: "Bildgenerierung", ok: hb.imageGen, sub: "FAL" });
    rows.push({ label: "Social-Anbindung", ok: hb.social, sub: "Meta / TikTok" });
  }
  rows.push({
    label: "Trend-Berechnung",
    ok: hb.trendsFresh,
    sub: hb.trendAgeDays === null ? "noch kein Snapshot" : `letzter Snapshot vor ${hb.trendAgeDays} T`,
  });
  return (
    <ul className="divide-y divide-white/[0.05]">
      {hb.loading ? (
        <EmptyRow text="Lade …" />
      ) : rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 px-5 py-3">
          <HeartbeatDot ok={r.ok} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[hsl(36_28%_92%)]">{r.label}</p>
            <p className="text-[10.5px] text-[hsl(36_15%_55%)]">{r.sub}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Akquise-Puls ─────────────────────── */

const PULSE_STAGES = ["neu", "angewaermt", "kontaktiert", "antwort", "registriert", "aktiviert"] as const;
const PULSE_STAGE_LABELS: Record<(typeof PULSE_STAGES)[number], string> = {
  neu: "Neu", angewaermt: "Angewärmt", kontaktiert: "Kontaktiert",
  antwort: "Antwort", registriert: "Registriert", aktiviert: "Aktiviert",
};
const ACQUISITION_GOALS = { Mode: 500, Kunst: 250, Interior: 250 } as const;

function AcquisitionPulsePanel({ pulse, navigate }: { pulse: ReturnType<typeof useAcquisitionPulse>; navigate: (to: string) => void }) {
  const total = PULSE_STAGES.reduce((sum, s) => sum + pulse.stageCounts[s], 0);
  const tasks = [
    { label: "anzuwärmen", count: pulse.toWarmUp, status: "neu" },
    { label: "zu kontaktieren", count: pulse.toContact, status: "angewaermt" },
    { label: "Follow-up fällig", count: pulse.followupDue, status: "kontaktiert" },
  ];
  return (
    <div className="grid gap-0 sm:grid-cols-[1.5fr_1fr]">
      <div className="border-b border-white/[0.06] p-5 sm:border-b-0 sm:border-r">
        {pulse.loading ? (
          <EmptyRow text="Lade …" />
        ) : total === 0 ? (
          <EmptyRow text="Die Pipeline ist noch leer. Die ersten Kandidaten ziehen ein." />
        ) : (
          <div className="flex h-6 w-full overflow-hidden border border-white/10">
            {PULSE_STAGES.map((s) => {
              const count = pulse.stageCounts[s];
              if (count === 0) return null;
              return (
                <div
                  key={s}
                  title={`${PULSE_STAGE_LABELS[s]}: ${count}`}
                  className="flex items-center justify-center border-r border-white/10 bg-white/[0.04] text-[9px] uppercase tracking-[0.1em] text-[hsl(36_20%_78%)] last:border-r-0"
                  style={{ width: `${(count / total) * 100}%` }}
                >
                  {count}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] uppercase tracking-[0.14em] text-[hsl(36_15%_50%)]">
          {PULSE_STAGES.map((s) => (
            <span key={s}>{PULSE_STAGE_LABELS[s]} · {pulse.loading ? "…" : pulse.stageCounts[s]}</span>
          ))}
        </div>

        <ul className="mt-4 divide-y divide-white/[0.05]">
          {tasks.map((t) => (
            <li key={t.label} className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="text-[hsl(36_25%_86%)]">
                <span className="font-serif text-[16px] tabular-nums text-[hsl(36_28%_94%)]">{pulse.loading ? "…" : t.count}</span>{" "}
                {t.label}
              </span>
              <button
                onClick={() => navigate(`/admin/akquise?status=${t.status}`)}
                className="text-[0.6rem] uppercase tracking-[0.2em] text-[hsl(36_20%_74%)] hover:text-[hsl(36_28%_94%)]"
              >
                Öffnen →
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-5">
        <p className="text-[0.55rem] uppercase tracking-[0.24em] text-[hsl(36_15%_50%)]">Fortschritt gegen Ziel</p>
        <div className="mt-3 space-y-3">
          {(Object.keys(ACQUISITION_GOALS) as (keyof typeof ACQUISITION_GOALS)[]).map((w) => {
            const goal = ACQUISITION_GOALS[w];
            const count = pulse.worldCounts[w];
            const pct = Math.min(100, Math.round((count / goal) * 100));
            return (
              <div key={w}>
                <div className="flex items-center justify-between text-[10.5px] text-[hsl(36_15%_55%)]">
                  <span className="uppercase tracking-[0.18em]">{w}</span>
                  <span className="tabular-nums">{count} / {goal}</span>
                </div>
                <div className="mt-1 h-1 w-full bg-white/[0.06]">
                  <div className="h-full bg-white/40" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Jarvis' Wort — der jüngste Morgenbericht ─────────────────────── */

function JarvisWordPanel({ report, onRequest, busy }: { report: ReturnType<typeof useJarvisCockpit>["latestMorgen"]; onRequest: () => void; busy: boolean }) {
  if (!report) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p className="text-[12.5px] leading-relaxed text-[hsl(36_18%_66%)]">
          Jarvis hat heute noch nichts geschrieben. Der nächste Morgenbericht kommt automatisch — oder jetzt anfordern.
        </p>
        <Btn variant="solid" onClick={onRequest} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> : null}
          Morgenbericht jetzt
        </Btn>
      </div>
    );
  }
  return (
    <div className="p-6">
      <p className="text-[0.6rem] uppercase tracking-[0.24em] text-[hsl(36_15%_55%)]">{timeAgo(new Date(report.created_at).getTime())}</p>
      <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-[hsl(36_25%_88%)]">{report.body}</p>
    </div>
  );
}

/* ─────────────────────── Wartet auf dich — echte Entscheidungs-Queue ─────────────────────── */

function QueuePanel({ items, onChanged }: { items: JarvisQueueItem[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function resolvePending(id: string, actionMode: "confirm_action" | "reject_action") {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: actionMode, pending_action_id: id } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Konnte nicht verarbeitet werden."); return; }
      toast.success(actionMode === "confirm_action" ? "Aktion ausgeführt." : "Aktion abgelehnt.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function dismissNotice(id: string) {
    setBusy(id);
    const { error } = await supabase.from("jarvis_notices").update({ dismissed_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  async function applySuggestion(item: JarvisQueueItem) {
    if (!item.suggested_action) return;
    setBusy(item.id);
    try {
      const { action, params } = item.suggested_action;
      const { data, error } = await supabase.functions.invoke("pawn-actions", {
        body: { mode: "execute", action, params, source: "admin_chat" },
      });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Konnte nicht umgesetzt werden."); return; }
      toast.success("Umgesetzt.");
      await dismissNotice(item.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <EmptyRow text="Nichts wartet gerade — Jarvis handelt still oder hat noch nichts vorzuschlagen." />;
  }

  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug text-[hsl(36_28%_92%)]">{item.title}</p>
            {item.body && <p className="mt-0.5 text-[11.5px] text-[hsl(36_15%_58%)]">{item.body}</p>}
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[hsl(36_15%_45%)]">
              {item.kind === "pending" ? "Wartet auf Bestätigung" : "Vorschlag"} · {timeAgo(new Date(item.created_at).getTime())}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {item.kind === "pending" ? (
              <>
                <Btn variant="solid" disabled={busy === item.id} onClick={() => resolvePending(item.id, "confirm_action")}>
                  {busy === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Btn>
                <Btn disabled={busy === item.id} onClick={() => resolvePending(item.id, "reject_action")}>
                  <X className="h-3 w-3" />
                </Btn>
              </>
            ) : (
              <>
                {item.suggested_action && item.suggested_action.zone !== "rot" && (
                  <Btn variant="solid" disabled={busy === item.id} onClick={() => applySuggestion(item)}>
                    {busy === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Umsetzen"}
                  </Btn>
                )}
                <Btn disabled={busy === item.id} onClick={() => dismissNotice(item.id)}>Verwerfen</Btn>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Organe statt Engines — was Jarvis wirklich tut ─────────────────────── */

const ORGANS: { mode: string; label: string; desc: string; keywords: string[] }[] = [
  { mode: "heartbeat", label: "Herzschlag", desc: "Prüft Fehler und Gesundheit, meldet was auffällt.", keywords: ["heartbeat"] },
  { mode: "wissen", label: "Wissenslauf", desc: "Erweitert, was Jarvis über PAWN und den Markt weiß.", keywords: ["wissen"] },
  { mode: "akquise_kuratieren", label: "Kurator-Auge", desc: "Bewertet neue Akquise-Kandidaten per Bildanalyse.", keywords: ["kuratieren"] },
  { mode: "akquise_verfassen", label: "Verfassen", desc: "Schreibt persönliche Ansprachen für wartende Leads.", keywords: ["verfassen"] },
  { mode: "akquise_senden", label: "Versand", desc: "Verschickt vorbereitete Nachrichten an Leads.", keywords: ["senden"] },
  { mode: "bewerbung_pruefen", label: "Postfach-Auge", desc: "Prüft eingegangene Designer-Bewerbungen.", keywords: ["bewerbung", "pruefen"] },
  { mode: "kampagnen_regie", label: "Regisseur", desc: "Wertet Première-Performance aus, passt Vorlieben an.", keywords: ["regie"] },
  { mode: "evolution", label: "Evolution", desc: "Testet und verwirft Parameter-Experimente.", keywords: ["evolution"] },
];

function humanizeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return `Zeitplan: ${expr}`;
  const [min, hour, dom, , dow] = parts;
  if (/^\d+$/.test(min) && /^\d+$/.test(hour)) {
    const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")} UTC`;
    if (dom === "*" && dow === "*") return `täglich · ${time}`;
    if (dom === "*" && /^\d+$/.test(dow)) {
      const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      return `wöchentlich · ${days[Number(dow)] ?? dow} ${time}`;
    }
  }
  return `Zeitplan: ${expr}`;
}

function OrganCard({ organ, runs, cronJobs }: { organ: typeof ORGANS[number]; runs: JarvisRunRow[]; cronJobs: ReturnType<typeof useJarvisCockpit>["cronJobs"] }) {
  const last = runs.find((r) => r.mode === organ.mode) ?? null;
  const job = cronJobs.find((j) => organ.keywords.some((k) => j.jobname.toLowerCase().includes(k))) ?? null;
  const failed = last?.status === "failed";
  return (
    <div className="flex items-start gap-3 border border-white/[0.06] p-4">
      <span className={cn(
        "mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
        !last ? "border-white/20 bg-transparent" : failed ? "border-red-400 bg-red-400" : "border-[hsl(36_28%_94%)] bg-[hsl(36_28%_94%)]",
      )} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-[hsl(36_28%_92%)]">{organ.label}</p>
        <p className="mt-0.5 text-[10.5px] leading-snug text-[hsl(36_15%_55%)]">{organ.desc}</p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(36_15%_50%)]">
          {last ? `letzter Lauf ${timeAgo(new Date(last.finished_at ?? last.started_at).getTime())}` : "noch kein Lauf"}
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[hsl(36_15%_50%)]">
          {job ? (job.active ? humanizeCron(job.schedule) : `pausiert · ${humanizeCron(job.schedule)}`) : "kein Zeitplan hinterlegt"}
        </p>
        {failed && last?.error && (
          <p className="mt-1.5 text-[11px] leading-snug text-red-300/90">{last.error}</p>
        )}
      </div>
    </div>
  );
}

function OrgansPanel({ runs, cronJobs, trendAgeDays, trendsFresh }: {
  runs: JarvisRunRow[]; cronJobs: ReturnType<typeof useJarvisCockpit>["cronJobs"]; trendAgeDays: number | null; trendsFresh: boolean;
}) {
  const failuresLast24h = runs.filter((r) => {
    const at = new Date(r.finished_at ?? r.started_at).getTime();
    return r.status === "failed" && Date.now() - at < 24 * 3600 * 1000;
  });
  return (
    <div className="p-5">
      {failuresLast24h.length > 0 && (
        <div className="mb-4 border border-red-500/30 bg-red-500/[0.06] p-3 text-[11.5px] text-red-200">
          {failuresLast24h.length} Fehler in den letzten 24 Stunden — sichtbar statt still (siehe rote Organe unten).
        </div>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {ORGANS.map((o) => <OrganCard key={o.mode} organ={o} runs={runs} cronJobs={cronJobs} />)}
        <div className="flex items-start gap-3 border border-white/[0.06] p-4">
          <span className={cn(
            "mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full border",
            trendsFresh ? "border-[hsl(36_28%_94%)] bg-[hsl(36_28%_94%)]" : "border-white/20 bg-transparent",
          )} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-[hsl(36_28%_92%)]">Trends</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-[hsl(36_15%_55%)]">Berechnet, was gerade zieht — täglich, unabhängig von Jarvis.</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(36_15%_50%)]">
              {trendAgeDays === null ? "noch kein Snapshot" : `letzter Snapshot vor ${trendAgeDays} T`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Command Deck (OS body) ─────────────────────── */

function CommandDeck() {
  const navigate = useNavigate();

  // Live-Puls: die ganze Seite lädt ihre Daten alle 30 Sekunden neu.
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setTick((v) => v + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { setLastUpdated(new Date()); }, [tick]);

  const { rows: recentOrders, loading: ordersLoading } = useAdminRecentOrders(6, tick);
  const { rows: topDesigners, loading: topLoading } = useAdminTopDesigners(5, tick);
  const sysStats = useAdminSystemStats(tick);
  const kpis = useAdminPlatformKpis(tick);
  const acquisitionPulse = useAcquisitionPulse(tick);
  const { rows: eventRows, loading: eventsLoading } = useDomainEventsTicker(15, tick);
  const heartbeat = useSystemHeartbeat(tick);
  const { firstName } = useDisplayName();
  const { move: adminMove } = useAdminNextMove();
  const [jarvisTick, setJarvisTick] = useState(0);
  const jarvis = useJarvisCockpit(`${tick}-${jarvisTick}`);
  const [morgenBusy, setMorgenBusy] = useState(false);

  async function requestMorgenbericht() {
    setMorgenBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "morgenbericht" } });
      if (error) { toast.error(error.message); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { toast.error(result.error ?? "Jarvis konnte nicht antworten."); return; }
      toast.success("Morgenbericht fertig.");
      setJarvisTick((v) => v + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMorgenBusy(false);
    }
  }

  return (
    <div className="-mx-6 -my-6 min-h-[calc(100vh-4rem)] bg-[hsl(18_10%_4%)] p-6 text-[hsl(36_25%_90%)] md:-mx-10 md:-my-10 md:p-10">
      {/* Header strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[hsl(36_15%_55%)]">
            Cockpit · Identity · Intelligence · Marketplace
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight text-[hsl(36_28%_94%)]">
            Guten Tag, {firstName}.
            {jarvis.paused && <span className="ml-3 text-[hsl(36_15%_55%)]">Jarvis ist pausiert.</span>}
          </h2>
        </div>
      </div>
      <LivePulseBar lastUpdated={lastUpdated} />

      {/* JARVIS' WORT — der jüngste Morgenbericht */}
      <Panel title="Jarvis' Wort" eyebrow="Morgenbericht" className="mt-6">
        <JarvisWordPanel report={jarvis.latestMorgen} onRequest={() => void requestMorgenbericht()} busy={morgenBusy} />
      </Panel>

      {/* DEIN NÄCHSTER ZUG — ganz oben, ein klarer Impuls */}
      <section className="mt-4 border-[1.5px] border-[hsl(350_55%_45%)] bg-[hsl(18_10%_6%)] p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(36_15%_58%)]">
              <ArrowRight className="h-3 w-3" /> Dein nächster Zug
              {adminMove.urgency === "hoch" && (
                <span className="border border-red-500/40 px-1.5 text-red-200">jetzt</span>
              )}
            </p>
            <h2 className="mt-3 font-serif text-2xl leading-tight text-[hsl(36_28%_94%)] md:text-[26px]">
              {adminMove.headline}
            </h2>
            <p className="mt-3 text-[13px] text-[hsl(36_20%_74%)]">{adminMove.reason}</p>
          </div>
          <button
            onClick={() => navigate(adminMove.to)}
            className="inline-flex items-center gap-2 border border-[hsl(350_55%_45%)] bg-[hsl(350_55%_28%)] px-5 py-3 text-[0.68rem] uppercase tracking-[0.28em] text-[hsl(36_28%_94%)] hover:bg-[hsl(350_55%_34%)]"
          >
            {adminMove.cta} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* WARTET AUF DICH — die echte Entscheidungs-Queue */}
      <Panel title="Wartet auf dich" eyebrow="Jarvis-Queue" className="mt-4" action={
        jarvis.queue.length > 0
          ? <span className="border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em] text-red-200">{jarvis.queue.length}</span>
          : undefined
      }>
        <QueuePanel items={jarvis.queue} onChanged={() => setJarvisTick((v) => v + 1)} />
      </Panel>

      {/* AKQUISE-PULS */}
      <Panel title="Akquise-Puls" eyebrow="Designer gewinnen · täglich" className="mt-4" live>
        <AcquisitionPulsePanel pulse={acquisitionPulse} navigate={navigate} />
      </Panel>

      {/* KPI row — echte 30-Tage-Daten */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCell
          label="Umsatz · 30 T"
          value={kpis.loading ? "…" : `€${kpis.revenue30d.toLocaleString("de-DE")}`}
          delta={`${kpis.revenue30dDelta >= 0 ? "+" : ""}${kpis.revenue30dDelta} %`}
          trend={kpis.revenue30dDelta >= 0 ? "up" : "down"} series={kpis.revenueSeries}
          why={[
            `Bezahlte Bestellungen: ${kpis.orders30d}`,
            `Ø Bestellwert: €${kpis.aov30d.toLocaleString("de-DE")}`,
            kpis.revenue30d === 0 ? "Noch keine Verkäufe — der erste kommt." : "Live aus orders (paid, 30 T).",
          ]}
        />
        <KpiCell label="Bestellungen · 30 T"
          value={kpis.loading ? "…" : String(kpis.orders30d)}
          delta={kpis.ordersDelta >= 0 ? `+${kpis.ordersDelta}` : String(kpis.ordersDelta)}
          trend={kpis.ordersDelta >= 0 ? "up" : "down"}
          series={kpis.orderSeries} accent="emerald"
          why={kpis.orders30d === 0 ? ["Keine bezahlten Bestellungen in den letzten 30 Tagen."] : [`${kpis.orders30d} bezahlt`, "Tages-Buckets aus orders"]} />
        <KpiCell label="Ø Bestellwert"
          value={kpis.loading ? "…" : (kpis.aov30d > 0 ? `€${kpis.aov30d.toLocaleString("de-DE")}` : "—")}
          delta={kpis.aov30d > 0 ? `${kpis.aovDelta >= 0 ? "+" : ""}${kpis.aovDelta} %` : "keine Basis"}
          trend={kpis.aovDelta >= 0 ? "up" : "down"}
          series={kpis.revenueSeries.map((v, i) => (kpis.orderSeries[i] > 0 ? Math.round(v / kpis.orderSeries[i]) : 0))}
          accent="amber"
          why={kpis.aov30d === 0 ? ["Noch kein bezahlter Warenkorb."] : ["Umsatz / bezahlte Bestellungen (30 T)"]} />
        <KpiCell label="Neue Nutzer · 30 T"
          value={kpis.loading ? "…" : String(kpis.newUsers30d)}
          delta={`${kpis.newUsersDelta >= 0 ? "+" : ""}${kpis.newUsersDelta} %`}
          trend={kpis.newUsersDelta >= 0 ? "up" : "down"}
          series={kpis.orderSeries.map(() => Math.max(0, Math.round(kpis.newUsers30d / 30)))}
          accent="emerald"
          why={kpis.newUsers30d === 0 ? ["Noch keine neuen Konten in den letzten 30 Tagen."] : ["profiles.created_at, letzte 30 T"]} />
        <KpiCell label="DNA Coverage"
          value={kpis.loading ? "…" : `${kpis.dnaCoverage} %`}
          delta={kpis.activeDesigners > 0 ? `${kpis.activeDesigners} aktiv` : "keine Designer"}
          trend="up" series={kpis.orderSeries}
          why={kpis.activeDesigners === 0 ? ["Noch keine aktiven Designer."] : [`Designer mit brand_dna: ${Math.round((kpis.dnaCoverage / 100) * kpis.activeDesigners)} / ${kpis.activeDesigners}`]} />
        <KpiCell label="Aktive Designer"
          value={String(kpis.activeDesigners)}
          delta={kpis.pendingApplications ? `${kpis.pendingApplications} in Prüfung` : "Inbox leer"}
          trend="up" series={kpis.orderSeries.map(() => kpis.activeDesigners)} accent="emerald"
          why={[`${kpis.pendingApplications} warten auf Review`, "Live aus designers (status=active)"]} />
      </div>

      {/* ORGANE STATT ENGINES */}
      <Panel title="Organe" eyebrow="was Jarvis wirklich tut" className="mt-4" live>
        <OrgansPanel runs={jarvis.runs} cronJobs={jarvis.cronJobs} trendAgeDays={heartbeat.trendAgeDays} trendsFresh={heartbeat.trendsFresh} />
      </Panel>

      {/* Row: Ereignis-Ticker (echte domain_events) + System-Herzschlag */}
      <div className="mt-4 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Ereignis-Ticker" eyebrow="letzte 15 · domain_events" live
          action={<span className="inline-flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-[hsl(36_20%_74%)]"><Rss className="h-3 w-3" /> real</span>}>
          <EventTicker rows={eventRows} loading={eventsLoading} />
        </Panel>

        <Panel title="System-Herzschlag" eyebrow="vorhanden / fehlt"
          action={<HeartPulse className="h-3.5 w-3.5 text-[hsl(36_20%_74%)]" />}>
          <SystemHeartbeatPanel hb={heartbeat} />
        </Panel>
      </div>

      {/* Umsatzentwicklung (real 30d buckets) */}
      <div className="mt-4">
        <Panel title="Umsatzentwicklung" eyebrow="30 Tage · echte Buckets"
          action={<span className="text-[0.6rem] uppercase tracking-[0.22em] text-[hsl(36_15%_55%)]">EUR / Tag</span>}>
          <div className="relative px-4 pb-4 pt-2">
            {kpis.loading ? (
              <div className="flex h-[240px] items-center justify-center text-[11px] text-[hsl(36_15%_55%)]">Lade …</div>
            ) : kpis.revenueSeries.every((v) => v === 0) ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center text-[12px] text-[hsl(36_18%_66%)]">
                <p className="font-serif text-[16px] text-[hsl(36_28%_92%)]">Noch keine Verkäufe — der erste kommt.</p>
                <p className="text-[11px] text-[hsl(36_15%_55%)]">Chart erscheint, sobald bezahlte Bestellungen eingehen.</p>
              </div>
            ) : (
              <>
                <ChartPlaceholder series={kpis.revenueSeries} labels={kpis.dayLabels.filter((_, i) => i % 5 === 0)} tone="dark" variant="area" height={240} />
                <div className="mt-3 flex items-center justify-between text-[11px] text-[hsl(36_20%_74%)]">
                  <span>Summe 30 T: <span className="text-[hsl(36_28%_94%)] tabular-nums">€{kpis.revenue30d.toLocaleString("de-DE")}</span></span>
                  <span>Bestellungen: <span className="text-[hsl(36_28%_94%)] tabular-nums">{kpis.orders30d}</span></span>
                  <span>Ø: <span className="text-[hsl(36_28%_94%)] tabular-nums">€{kpis.aov30d.toLocaleString("de-DE")}</span></span>
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Row: Orders + Top Designers + System perf (real DB data) */}
      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
        <Panel title="Letzte Bestellungen" eyebrow="live" action={<Btn onClick={() => navigate("/admin/zahlungen")}>Alle</Btn>}>
          {ordersLoading ? (
            <EmptyRow text="Lade …" />
          ) : recentOrders.length === 0 ? (
            <EmptyRow text="Noch keine Bestellungen." />
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[12px]">
              <thead>
                <tr className="text-left text-[0.55rem] uppercase tracking-[0.24em] text-[hsl(36_15%_50%)]">
                  <th className="px-5 py-2.5 font-normal">Bestellung</th>
                  <th className="px-5 py-2.5 font-normal">Kunde</th>
                  <th className="px-5 py-2.5 font-normal">Status</th>
                  <th className="px-5 py-2.5 text-right font-normal">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5 font-mono text-[11px] text-[hsl(36_20%_78%)]">{o.short}</td>
                    <td className="px-5 py-2.5 text-[hsl(36_25%_88%)]">{o.customer}</td>
                    <td className="px-5 py-2.5">
                      <span className="border border-white/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-[hsl(36_20%_78%)]">{o.status}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-[hsl(36_28%_92%)]">€{o.total.toLocaleString("de-DE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Panel>

        <Panel title="Top Designer" eyebrow="Umsatz · 30T" action={<Btn onClick={() => navigate("/admin/designers")}>Alle</Btn>}>
          {topLoading ? (
            <EmptyRow text="Lade …" />
          ) : topDesigners.length === 0 ? (
            <EmptyRow text="Noch keine bezahlten Bestellungen in den letzten 30 Tagen." />
          ) : (
            <ul>
              {topDesigners.map((d, i) => (
                <li key={d.id} className="flex items-center justify-between border-t border-white/[0.05] px-5 py-2.5 text-[12px] first:border-t-0">
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-[10px] tabular-nums text-[hsl(36_15%_50%)]">{i + 1}</span>
                    <span className="flex h-6 w-6 items-center justify-center border border-white/10 font-serif text-[10px] text-[hsl(36_28%_92%)]">{d.name.slice(0, 2).toUpperCase()}</span>
                    <span className="text-[hsl(36_25%_88%)]">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-[hsl(36_28%_92%)]">€{d.revenue.toLocaleString("de-DE")}</span>
                    <span className="text-[11px] text-[hsl(36_15%_55%)]">{d.orders} Pos.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Systemzahlen" eyebrow="letzte 24 h · echt">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3">
            {[
              { l: "Events", v: sysStats.eventsLast24h.toLocaleString("de-DE") },
              { l: "AI-Anfragen", v: sysStats.aiRequestsLast24h.toLocaleString("de-DE") },
              { l: "Bestellungen", v: sysStats.ordersLast24h.toLocaleString("de-DE") },
              { l: "Davon bezahlt", v: sysStats.paidOrdersLast24h.toLocaleString("de-DE") },
              { l: "Aktive Designer", v: sysStats.designerCount.toLocaleString("de-DE") },
            ].map((m) => (
              <div key={m.l}>
                <p className="text-[0.55rem] uppercase tracking-[0.24em] text-[hsl(36_15%_50%)]">{m.l}</p>
                <p className="mt-1 font-serif text-[18px] text-[hsl(36_28%_94%)] tabular-nums">
                  {sysStats.loading ? "…" : m.v}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={() => navigate("/admin/jarvis")} className="editorial-eyebrow text-[hsl(36_20%_74%)] underline decoration-1 underline-offset-4 hover:text-[hsl(36_28%_94%)]">
          Zum Maschinenraum <ArrowUpRight className="ml-1 inline h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `vor ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center px-5 py-8 text-center text-[11px] leading-relaxed text-[hsl(36_15%_55%)]">
      {text}
    </div>
  );
}

/* ─────────────────────── Page ─────────────────────── */

const AdminOverview = () => {
  return (
    <RoleGate role="admin">
      <AdminShell eyebrow="Cockpit" title="Kontrollhub">
        <PrototypeAccessBanner role="Owner OS" />
        <CommandDeck />
      </AdminShell>
    </RoleGate>
  );
};

export default AdminOverview;
