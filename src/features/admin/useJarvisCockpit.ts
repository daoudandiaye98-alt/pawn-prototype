/**
 * Alles, was das Cockpit (/admin) von Jarvis braucht, an einem Ort: der
 * jüngste Morgenbericht, die echte Entscheidungs-Queue (Vorschläge +
 * Bestätigungen), die letzten Läufe je Organ (für Status/Fehler) und der
 * Cron-Zeitplan. Read-safe — jede Abfrage degradiert einzeln, ein Fehler in
 * einer Quelle blockiert die anderen nicht.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface JarvisReportRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  created_at: string;
}

export interface JarvisQueueItem {
  id: string;
  kind: "suggestion" | "pending";
  title: string;
  body: string | null;
  created_at: string;
  suggested_action?: { action: string; params: Record<string, unknown>; zone: string } | null;
  action?: string;
  reason?: string | null;
  expires_at?: string;
}

export interface JarvisRunRow {
  id: string;
  mode: string | null;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
  error: string | null;
}

export interface CronJobRow {
  jobname: string;
  schedule: string;
  active: boolean;
}

export function useJarvisCockpit(refreshKey: number | string = 0) {
  const [latestMorgen, setLatestMorgen] = useState<JarvisReportRow | null>(null);
  const [queue, setQueue] = useState<JarvisQueueItem[]>([]);
  const [runs, setRuns] = useState<JarvisRunRow[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJobRow[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [morgenRes, noticesRes, pendingRes, runsRes, configRes, cronRes] = await Promise.allSettled([
        supabase.from("jarvis_reports").select("id, kind, title, body, created_at").eq("kind", "morgen").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("jarvis_notices").select("id, kind, title, body, created_at, suggested_action").eq("kind", "vorschlag").is("dismissed_at", null).order("created_at", { ascending: false }),
        supabase.from("jarvis_pending_actions").select("id, action, params, reason, created_at, expires_at").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("jarvis_runs").select("id, mode, trigger, started_at, finished_at, status, summary, error").order("started_at", { ascending: false }).limit(80),
        supabase.from("ai_config").select("value").eq("key", "jarvis_config").maybeSingle(),
        supabase.functions.invoke("pawn-jarvis", { body: { mode: "cron_status" } }).catch(() => ({ data: null })),
      ]);
      if (!alive) return;

      if (morgenRes.status === "fulfilled") setLatestMorgen((morgenRes.value.data as JarvisReportRow) ?? null);

      const suggestions: JarvisQueueItem[] = noticesRes.status === "fulfilled"
        ? ((noticesRes.value.data ?? []) as Array<{ id: string; kind: string; title: string; body: string; created_at: string; suggested_action: JarvisQueueItem["suggested_action"] }>)
          .map((n) => ({ id: n.id, kind: "suggestion" as const, title: n.title, body: n.body, created_at: n.created_at, suggested_action: n.suggested_action }))
        : [];
      const pendingItems: JarvisQueueItem[] = pendingRes.status === "fulfilled"
        ? ((pendingRes.value.data ?? []) as Array<{ id: string; action: string; reason: string | null; created_at: string; expires_at: string }>)
          .map((p) => ({ id: p.id, kind: "pending" as const, title: p.action, body: p.reason, created_at: p.created_at, action: p.action, reason: p.reason, expires_at: p.expires_at }))
        : [];
      setQueue([...pendingItems, ...suggestions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

      if (runsRes.status === "fulfilled") setRuns((runsRes.value.data as JarvisRunRow[]) ?? []);

      if (configRes.status === "fulfilled") {
        const cfg = (configRes.value.data?.value as { enabled?: boolean } | undefined) ?? {};
        setPaused(cfg.enabled === false);
      }

      if (cronRes.status === "fulfilled") {
        const jobs = (cronRes.value as { data?: { jobs?: CronJobRow[] } } | null)?.data?.jobs ?? [];
        setCronJobs(jobs);
      }

      setLoading(false);
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  return { latestMorgen, queue, runs, cronJobs, paused, loading };
}
