/**
 * "Dein nächster Zug" — EINE empfohlene Aktion mit Klartext-Begründung.
 * Priorität: unversendete bezahlte Bestellung > wartende Kampagnen-Freigabe >
 * offene Kundenanfrage > Checklisten-Lücke (Porträt/Manifest/Produkt) >
 * Trend-Vorschlag.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DesignerLevel } from "./useDesignerLevel";

export interface NextMove {
  key: string;
  headline: string;    // Klartext, ein Satz
  reason: string;      // warum jetzt
  cta: string;         // Button-Text
  to: string;          // Zielroute
  urgency?: "hoch" | "mittel" | "sanft";
}

interface Input {
  designerId?: string;
  level?: DesignerLevel;
  hasStory?: boolean;
  hasPortrait?: boolean;
  publishedCount?: number;
}

export function useNextMove({ designerId, level, hasStory, hasPortrait, publishedCount }: Input) {
  const [openOrder, setOpenOrder] = useState<{ id: string; created_at: string } | null>(null);
  const [pendingCampaign, setPendingCampaign] = useState<{ id: string; title: string } | null>(null);
  const [openThread, setOpenThread] = useState<{ id: string; subject: string } | null>(null);
  const [trendTerm, setTrendTerm] = useState<string | null>(null);
  const [dnaGap, setDnaGap] = useState<{ id: string; name: string; total: number } | null>(null);

  useEffect(() => {
    if (!designerId) return;
    let alive = true;
    (async () => {
      const [ords, camps, msgs, prods] = await Promise.all([
        supabase.from("orders").select("id, created_at").eq("status", "paid").in("fulfillment_status", ["new", "in_progress"]).order("created_at", { ascending: true }).limit(5),
        supabase.from("campaigns").select("id, title").eq("designer_id", designerId).eq("status", "proposed").order("created_at", { ascending: true }).limit(1),
        supabase.from("message_threads").select("id, subject").eq("designer_id", designerId).eq("status", "open").order("last_message_at", { ascending: false }).limit(1),
        supabase.from("products").select("id, name, product_dna, status").eq("designer_id", designerId).eq("status", "published"),
      ]);
      if (!alive) return;
      const order = (ords.data ?? [])[0] ?? null;
      setOpenOrder(order ? { id: order.id, created_at: order.created_at as string } : null);
      const c = (camps.data ?? [])[0] ?? null;
      setPendingCampaign(c ? { id: c.id as string, title: c.title as string } : null);
      const t = (msgs.data ?? [])[0] ?? null;
      setOpenThread(t ? { id: t.id as string, subject: t.subject as string } : null);

      const products = (prods.data ?? []) as { id: string; name: string; product_dna: Record<string, unknown> | null }[];
      const isEmpty = (p: typeof products[number]) => {
        const dna = p.product_dna ?? {};
        const arr = (k: string) => Array.isArray((dna as Record<string, unknown>)[k]) ? ((dna as Record<string, unknown>)[k] as unknown[]).length : 0;
        return arr("materials") + arr("silhouette") + arr("colors") + arr("mood") === 0;
      };
      const missing = products.filter(isEmpty);
      setDnaGap(missing.length > 0 ? { id: missing[0].id, name: missing[0].name, total: missing.length } : null);

      // Trend-Vorschlag: erster steigender Term in "Mode"
      try {
        const { data: mo } = await supabase.rpc("trend_momentum" as never, { _world: "Mode" } as never);
        const arr = (mo as unknown as { term: string; momentum: string }[] | null) ?? [];
        const rising = arr.find((r) => r.momentum === "steigend");
        setTrendTerm(rising?.term ?? null);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [designerId]);

  return useMemo<NextMove>(() => {
    if (openOrder) {
      const hoursOld = (Date.now() - new Date(openOrder.created_at).getTime()) / 3_600_000;
      const late = hoursOld > 24;
      return {
        key: "fulfill_order",
        headline: late ? "Ein Paket wartet seit gestern auf dich." : "Eine bezahlte Bestellung will raus.",
        reason: "Ich führe dich Schritt für Schritt: Karton, Etikett, Tracking. Zwei Minuten.",
        cta: "Bestellung versenden",
        to: "/studio/bestellungen",
        urgency: late ? "hoch" : "mittel",
      };
    }
    if (pendingCampaign) {
      return {
        key: "approve_campaign",
        headline: `Deine Kampagne „${pendingCampaign.title}" wartet auf Freigabe.`,
        reason: "Ein Klick, dann geht sie in die Warteschlange und wird gepostet.",
        cta: "Kampagne ansehen",
        to: "/studio/kampagnen",
        urgency: "mittel",
      };
    }
    if (openThread) {
      return {
        key: "reply_message",
        headline: `Jemand hat dir geschrieben: „${openThread.subject}".`,
        reason: "Antworten hält den Faden warm — meistens reichen zwei Sätze.",
        cta: "Nachricht öffnen",
        to: "/studio/nachrichten",
        urgency: "mittel",
      };
    }
    if (!hasPortrait) {
      return {
        key: "add_portrait",
        headline: "Lade ein Foto von dir hoch.",
        reason: "Menschen kaufen von Menschen. Ein Porträt macht deinen Auftritt echt.",
        cta: "Porträt hinzufügen",
        to: "/studio/brand",
        urgency: "sanft",
      };
    }
    if (!hasStory) {
      return {
        key: "write_story",
        headline: "Erzähl in drei Sätzen, wer du bist.",
        reason: "Dein Manifest steht auf jeder deiner Seiten oben — die erste Berührung mit Käufer:innen.",
        cta: "Manifest schreiben",
        to: "/studio/brand",
        urgency: "sanft",
      };
    }
    if ((publishedCount ?? 0) === 0) {
      return {
        key: "publish_product",
        headline: "Zeit für dein erstes Stück.",
        reason: "Ein einziges Foto, Titel, Preis — mehr braucht es zum Start nicht. Ich helfe beim Text.",
        cta: "Neues Stück anlegen",
        to: "/studio/produkte",
        urgency: "mittel",
      };
    }
    if (dnaGap) {
      return {
        key: "complete_dna",
        headline: dnaGap.total > 1
          ? `Vervollständige die DNA von „${dnaGap.name}" (${dnaGap.total} Stücke offen).`
          : `Vervollständige die DNA von „${dnaGap.name}".`,
        reason: "Vier kurze Antworten (Material, Silhouette, Farbe, Stimmung) — dann findet PAWN die richtigen Menschen für dein Stück.",
        cta: "DNA vervollständigen",
        to: `/studio/produkte?dna=${dnaGap.id}`,
        urgency: "sanft",
      };
    }
    if (trendTerm && level?.level !== "dame") {
      return {
        key: "trend_upload",
        headline: `„${trendTerm}" steigt gerade — hast du etwas in dieser Richtung?`,
        reason: "Wenn ja, lade es hoch, solange die Welle da ist.",
        cta: "Stück hinzufügen",
        to: "/studio/produkte",
        urgency: "sanft",
      };
    }
    return {
      key: "steady",
      headline: "Deine Bühne läuft ruhig. Perfekter Moment für eine Kampagne.",
      reason: "Zwölf Sekunden Video, in wenigen Minuten fertig — das lenkt den Blick auf ein Stück.",
      cta: "Kampagne starten",
      to: "/studio/kampagnen/neu",
      urgency: "sanft",
    };
  }, [openOrder, pendingCampaign, openThread, hasPortrait, hasStory, publishedCount, trendTerm, dnaGap, level?.level]);
}
