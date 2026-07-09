/**
 * "Dein nächster Zug" für den Admin.
 * Priorität: wartende Bewerbungen > Posting-Queue > fehlende Secrets > Kampagnen in Review > leere Inhalte.
 * Secrets werden lokal geprüft (Client-seitige Erinnerung — Werte sind nie sichtbar).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminNextMove {
  key: string;
  headline: string;
  reason: string;
  cta: string;
  to: string;
  urgency: "hoch" | "mittel" | "sanft";
}

interface Signals {
  pendingApplications: number;
  queuedPosts: number;
  campaignsInReview: number;
  emptyContent: number;
  missingSecrets: string[];
}

const KNOWN_SECRETS = ["STRIPE_SECRET_KEY", "OPENAI_API_KEY", "FAL_KEY"];

export function useAdminNextMove(): { move: AdminNextMove; signals: Signals } {
  const [signals, setSignals] = useState<Signals>({
    pendingApplications: 0, queuedPosts: 0, campaignsInReview: 0, emptyContent: 0,
    missingSecrets: [],
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [apps, queue, camps, content, cfg] = await Promise.all([
        supabase.from("designer_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review"]),
        supabase.from("posting_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "proposed"),
        supabase.from("site_content").select("value").limit(50),
        supabase.from("ai_config").select("key, value").eq("key", "missing_secrets").maybeSingle(),
      ]);
      if (!alive) return;
      // Empty content check: any site_content whose value is missing text
      const empties = ((content.data ?? []) as Array<{ value: unknown }>).filter((r) => {
        const v = r.value as { text?: string; body?: string } | null;
        return !v || !(v.text?.trim() || v.body?.trim());
      }).length;
      const cfgVal = (cfg.data?.value as { missing?: string[] } | undefined)?.missing ?? [];
      setSignals({
        pendingApplications: apps.count ?? 0,
        queuedPosts: queue.count ?? 0,
        campaignsInReview: camps.count ?? 0,
        emptyContent: empties,
        missingSecrets: cfgVal.filter((s) => KNOWN_SECRETS.includes(s)),
      });
    })();
    return () => { alive = false; };
  }, []);

  const move = useMemo<AdminNextMove>(() => {
    if (signals.pendingApplications > 0) {
      return {
        key: "review_applications",
        headline: `${signals.pendingApplications} Bewerbung${signals.pendingApplications === 1 ? "" : "en"} warten auf dich.`,
        reason: "Prüfe kurz — genehmigen, ablehnen oder Notizen hinterlassen. Zwei Minuten pro Bewerbung.",
        cta: "Bewerbungen öffnen",
        to: "/admin/designers",
        urgency: "hoch",
      };
    }
    if (signals.queuedPosts > 0) {
      return {
        key: "posting_queue",
        headline: `${signals.queuedPosts} Post${signals.queuedPosts === 1 ? "" : "s"} in der Warteschlange.`,
        reason: "Ein Klick pro Post: prüfen und veröffentlichen, oder verschieben.",
        cta: "Queue öffnen",
        to: "/admin/posting",
        urgency: "mittel",
      };
    }
    if (signals.missingSecrets.length > 0) {
      const first = signals.missingSecrets[0];
      const help: Record<string, string> = {
        STRIPE_SECRET_KEY: "Für Zahlungen. In Projekt-Einstellungen → Secrets hinterlegen (aus dem Stripe-Dashboard: Entwickler → API-Keys).",
        OPENAI_API_KEY: "Für Textvorschläge im Copilot. Optional — ohne Key nutzt der Copilot den kostenlosen Lovable-Gateway.",
        FAL_KEY: "Für den kinematischen Kampagnen-Modus (Video-Generierung). In Projekt-Einstellungen → Secrets hinterlegen.",
      };
      return {
        key: "secret_" + first,
        headline: `Secret fehlt: ${first}.`,
        reason: help[first] ?? "Bitte in Projekt-Einstellungen → Secrets ergänzen.",
        cta: "Einstellungen öffnen",
        to: "/admin/settings",
        urgency: "hoch",
      };
    }
    if (signals.campaignsInReview > 0) {
      return {
        key: "campaigns",
        headline: `${signals.campaignsInReview} Kampagne${signals.campaignsInReview === 1 ? "" : "n"} warten auf Sichtung.`,
        reason: "Freigeben oder Änderungen erbitten.",
        cta: "Kampagnen öffnen",
        to: "/admin/kampagnen",
        urgency: "mittel",
      };
    }
    if (signals.emptyContent > 0) {
      return {
        key: "content",
        headline: `${signals.emptyContent} Inhaltsfeld${signals.emptyContent === 1 ? "" : "er"} noch leer.`,
        reason: "Füll die editorialen Räume — Über, Manifest, Hero-Texte.",
        cta: "Inhalte öffnen",
        to: "/admin/inhalte",
        urgency: "sanft",
      };
    }
    return {
      key: "steady",
      headline: "Alles ruhig. Perfekter Moment für einen Broadcast an deine Designer.",
      reason: "Ein kurzer Impuls hält die Beziehung warm.",
      cta: "Nachrichten öffnen",
      to: "/admin/nachrichten",
      urgency: "sanft",
    };
  }, [signals]);

  return { move, signals };
}
