/**
 * Teil 17c: der durchgehende Weg vom Konto bis zum ersten Verkauf — acht Schritte, jeder
 * Zustand aus echten Daten abgeleitet, nie in einer eigenen Tabelle gespeichert. Jeder Schritt
 * trägt eine Begründung (warum er zählt) und einen direkten Weg dorthin.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StudioDesigner } from "./useMyDesigner";

export interface JourneyStep {
  key: string;
  label: string;
  reason: string;
  done: boolean;
  to: string;
}

interface JourneyInputs {
  designer: StudioDesigner | null;
  productsCount: number;
  hasPaidOrder: boolean;
}

const SHARE_EVENT_TYPES = ["share.kit_downloaded", "share.package_downloaded", "share.link_copied"];

export function useDesignerJourney({ designer, productsCount, hasPaidOrder }: JourneyInputs) {
  const [staged, setStaged] = useState(false);
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designer) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const [stagingRes, shareRes] = await Promise.all([
        supabase.from("staging_requests" as never).select("id").eq("designer_id", designer.id).eq("status", "done").limit(1),
        supabase.from("domain_events").select("id").in("type", SHARE_EVENT_TYPES).eq("payload->>designer_id", designer.id).limit(1),
      ]);
      if (!alive) return;
      setStaged(((stagingRes.data as unknown as unknown[]) ?? []).length > 0);
      setShared(((shareRes.data as unknown as unknown[]) ?? []).length > 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [designer?.id]);

  const steps: JourneyStep[] = designer ? [
    { key: "konto", label: "Konto", reason: "Dein Zugang zu PAWN.", done: true, to: "/studio/einstellungen" },
    { key: "haus_benannt", label: "Haus benannt", reason: "Kund·innen erkennen dich an deinem Namen.", done: !!designer.brand_name, to: "/studio/brand" },
    { key: "erstes_stueck", label: "Erstes Stück", reason: "Ohne ein Stück gibt es nichts zu verkaufen.", done: productsCount > 0, to: "/studio/produkte/neu" },
    { key: "bild_inszeniert", label: "Bild inszeniert", reason: "Ein inszeniertes Bild verkauft nachweislich besser als ein Rohfoto.", done: staged, to: "/studio/produkte" },
    { key: "auszahlungskonto", label: "Auszahlungskonto", reason: "Ohne Konto kann PAWN dein Geld nicht auszahlen — die Einrichtung dauert etwa 5 Minuten.", done: designer.stripe_charges_enabled === true, to: "/studio/auszahlung" },
    { key: "seite_veroeffentlicht", label: "Seite veröffentlicht", reason: "Deine Seite ist deine Visitenkarte — ohne sie findet dich niemand.", done: !!designer.page_published_at, to: "/studio/hausseite" },
    { key: "erstmals_geteilt", label: "Erstmals geteilt", reason: "Reichweite entsteht nicht von allein — das erste Teilen ist der erste Schritt.", done: shared, to: "/studio/produkte" },
    { key: "erster_verkauf", label: "Erster Verkauf", reason: "Der Moment, für den alles andere da ist.", done: hasPaidOrder, to: "/studio/bestellungen" },
  ] : [];

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return { steps, doneCount, nextStep, loading: loading && !!designer };
}
