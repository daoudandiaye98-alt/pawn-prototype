/**
 * "Dein nächster Zug" für den Admin.
 * Priorität: was Jarvis vorlegt (wartende Bestätigungen, ungesehene Vorschläge)
 * kommt zuerst — das ist der Sinn des Cockpits: Jarvis bereitet vor, du
 * entscheidest. Danach die bestehende Heuristik: wartende Bewerbungen >
 * Akquise-Follow-ups > Posting-Queue > fehlende Secrets > Kampagnen in
 * Review > leere Inhalte > Ruhezustand.
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
  pendingActions: number;
  oldestPendingAction: string | null;
  unseenSuggestions: number;
  oldestSuggestion: string | null;
  pendingApplications: number;
  queuedPosts: number;
  campaignsInReview: number;
  emptyContent: number;
  missingSecrets: string[];
  followupDue: number;
  warmedWaiting: number;
}

const KNOWN_SECRETS = ["STRIPE_SECRET_KEY", "OPENAI_API_KEY", "FAL_KEY"];

export function useAdminNextMove(): { move: AdminNextMove; signals: Signals } {
  const [signals, setSignals] = useState<Signals>({
    pendingActions: 0, oldestPendingAction: null, unseenSuggestions: 0, oldestSuggestion: null,
    pendingApplications: 0, queuedPosts: 0, campaignsInReview: 0, emptyContent: 0,
    missingSecrets: [], followupDue: 0, warmedWaiting: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();
      const [pendingActions, suggestions, apps, queue, camps, content, secretsRes, followups, warmed] = await Promise.all([
        supabase.from("jarvis_pending_actions").select("action, created_at").eq("status", "pending").order("created_at", { ascending: true }),
        supabase.from("jarvis_notices").select("title, created_at").eq("kind", "vorschlag").is("dismissed_at", null).order("created_at", { ascending: true }),
        supabase.from("designer_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review"]),
        supabase.from("posting_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "proposed"),
        supabase.from("site_content").select("value").limit(50),
        supabase.functions.invoke("check-secrets", { body: {} }).catch(() => ({ data: null })),
        supabase.from("acquisition_leads").select("id", { count: "exact", head: true })
          .eq("status", "kontaktiert").is("followup_at", null).lte("contacted_at", fiveDaysAgo),
        supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).eq("status", "angewaermt"),
      ]);
      if (!alive) return;
      const empties = ((content.data ?? []) as Array<{ value: unknown }>).filter((r) => {
        const v = r.value as { text?: string; body?: string } | null;
        return !v || !(v.text?.trim() || v.body?.trim());
      }).length;
      const missingFromApi = ((secretsRes as { data?: { missing?: string[] } })?.data?.missing ?? [])
        .filter((s) => KNOWN_SECRETS.includes(s));
      const pendingRows = (pendingActions.data ?? []) as { action: string; created_at: string }[];
      const suggestionRows = (suggestions.data ?? []) as { title: string; created_at: string }[];
      setSignals({
        pendingActions: pendingRows.length,
        oldestPendingAction: pendingRows[0]?.action ?? null,
        unseenSuggestions: suggestionRows.length,
        oldestSuggestion: suggestionRows[0]?.title ?? null,
        pendingApplications: apps.count ?? 0,
        queuedPosts: queue.count ?? 0,
        campaignsInReview: camps.count ?? 0,
        emptyContent: empties,
        missingSecrets: missingFromApi,
        followupDue: followups.count ?? 0,
        warmedWaiting: warmed.count ?? 0,
      });
    })();
    return () => { alive = false; };
  }, []);

  const move = useMemo<AdminNextMove>(() => {
    if (signals.pendingActions > 0) {
      return {
        key: "jarvis_pending",
        headline: signals.pendingActions === 1
          ? `Jarvis wartet auf eine Bestätigung: ${signals.oldestPendingAction}.`
          : `Jarvis wartet auf ${signals.pendingActions} Bestätigungen — am längsten: ${signals.oldestPendingAction}.`,
        reason: "Zone Rot: Geld, Veröffentlichung oder Löschung — das entscheidest du, nicht Jarvis.",
        cta: "Zug machen",
        to: "/admin",
        urgency: "hoch",
      };
    }
    if (signals.unseenSuggestions > 0) {
      return {
        key: "jarvis_suggestion",
        headline: signals.unseenSuggestions === 1
          ? `Jarvis schlägt vor: ${signals.oldestSuggestion}.`
          : `Jarvis hat ${signals.unseenSuggestions} Vorschläge gemacht — zuerst: ${signals.oldestSuggestion}.`,
        reason: "Umsetzen oder verwerfen — ein Klick.",
        cta: "Vorschlag ansehen",
        to: "/admin",
        urgency: "mittel",
      };
    }
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
    if (signals.followupDue > 0 || signals.warmedWaiting > 10) {
      return {
        key: "acquisition",
        headline: signals.followupDue > 0
          ? `${signals.followupDue} Follow-up${signals.followupDue === 1 ? "" : "s"} in der Akquise fällig.`
          : `${signals.warmedWaiting} Leads warten seit Tagen auf den nächsten Kontakt.`,
        reason: "Kurzes Zeitfenster, bevor der Kontakt kalt wird — jetzt nachfassen oder anschreiben.",
        cta: "Akquise-Cockpit öffnen",
        to: "/admin/akquise",
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
        cta: "System-Herzschlag ansehen",
        to: "/admin",
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
        cta: "Texte & Bilder öffnen",
        to: "/admin/texte-bilder",
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
