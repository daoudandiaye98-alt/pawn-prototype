/**
 * "Deine Marke aufbauen" — fünf Etappen, jeder Schritt aus echten Daten abgeleitet.
 * Kein eigener Status in der Datenbank: was erledigt ist, ergibt sich aus dem,
 * was das Haus tatsächlich getan hat.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StudioDesigner } from "./useMyDesigner";

export interface BrandStep {
  key: string;
  label: string;
  why: string;
  how: string;
  tool: string;
  to: string;
  done: boolean;
}

export interface BrandStage {
  key: string;
  title: string;
  intro: string;
  steps: BrandStep[];
  done: boolean;
}

interface Facts {
  products: number;
  published: number;
  withImage: number;
  withDetails: number;
  videos: number;
  shared: boolean;
  paidOrder: boolean;
}

const EMPTY: Facts = { products: 0, published: 0, withImage: 0, withDetails: 0, videos: 0, shared: false, paidOrder: false };

const SHARE_EVENT_TYPES = ["share.kit_downloaded", "share.package_downloaded", "share.link_copied"];

interface ProductRow {
  id: string;
  status: string | null;
  images: unknown;
  materials: string | null;
  care: string | null;
  measurements: unknown;
  description: string | null;
}

function hasImage(p: ProductRow): boolean {
  const imgs = p.images;
  return Array.isArray(imgs) ? imgs.length > 0 : false;
}

function hasDetails(p: ProductRow): boolean {
  const measured = p.measurements && typeof p.measurements === "object" && Object.keys(p.measurements as object).length > 0;
  return Boolean((p.materials || p.care) && (measured || (p.description ?? "").length > 40));
}

export function useBrandJourney(designer: StudioDesigner | null) {
  const [facts, setFacts] = useState<Facts>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designer) { setFacts(EMPTY); setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const [prodRes, vidRes, shareRes, orderRes] = await Promise.all([
        supabase.from("products").select("id, status, images, materials, care, measurements, description").eq("designer_id", designer.id),
        supabase.from("video_assets" as never).select("id").eq("designer_id", designer.id).limit(1),
        supabase.from("domain_events").select("id").in("type", SHARE_EVENT_TYPES).eq("payload->>designer_id", designer.id).limit(1),
        supabase.from("orders").select("id").eq("status", "paid").limit(1),
      ]);
      if (!alive) return;
      const products = ((prodRes.data ?? []) as unknown as ProductRow[]);
      setFacts({
        products: products.length,
        published: products.filter((p) => p.status === "published").length,
        withImage: products.filter(hasImage).length,
        withDetails: products.filter(hasDetails).length,
        videos: ((vidRes.data as unknown as unknown[]) ?? []).length,
        shared: ((shareRes.data as unknown as unknown[]) ?? []).length > 0,
        paidOrder: ((orderRes.data as unknown as unknown[]) ?? []).length > 0,
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [designer?.id]);

  const d = designer;
  const stages: BrandStage[] = d ? withDone([
    {
      key: "ankommen",
      title: "Ankommen",
      intro: "Der Anfang ist klein: ein Name, eine Welt, ein Konto. Mehr braucht es jetzt noch nicht.",
      steps: [
        {
          key: "konto", label: "Konto angelegt", why: "Dein Zugang zu allem, was hier folgt.",
          how: "Ist erledigt, sobald du hier bist.", tool: "Einstellungen", to: "/studio/einstellungen", done: true,
        },
        {
          key: "haus_benannt", label: "Haus benannt", why: "Kund·innen merken sich einen Namen, keine Nummer.",
          how: "Trag den Namen deiner Marke ein — er steht später über allem, was du zeigst.",
          tool: "Markenseite", to: "/studio/brand", done: !!d.brand_name,
        },
        {
          key: "welt", label: "Welt gewählt", why: "Mode, Interior oder Kunst — daran hängt, wem PAWN dich zeigt.",
          how: "Wähle die Welt, in der deine Arbeit zu Hause ist.",
          tool: "Markenprofil", to: "/studio/dna", done: !!d.brand_dna || !!d.aussenauge,
        },
      ],
    },
    {
      key: "zeigen",
      title: "Zeigen",
      intro: "Ein einziges Stück reicht für den Start. Wichtig ist, dass man es gut sieht und versteht.",
      steps: [
        {
          key: "erstes_stueck", label: "Erstes Stück angelegt", why: "Ohne ein Stück gibt es nichts zu kaufen.",
          how: "Foto hochladen, Name, Preis — der Rest kann warten.",
          tool: "Kollektion", to: "/studio/produkte/neu", done: facts.products > 0,
        },
        {
          key: "gutes_bild", label: "Ein gutes Bild", why: "Das Bild entscheidet in einer Sekunde, ob jemand bleibt.",
          how: "Tageslicht, ruhiger Hintergrund. PAWN kann dein Foto freistellen und inszenieren.",
          tool: "Bilder", to: "/studio/mediathek", done: facts.withImage > 0,
        },
        {
          key: "details", label: "Details vollständig", why: "Maße, Material und Pflege beantworten die Fragen, die sonst zum Abbruch führen.",
          how: "Öffne dein Stück und fülle Material, Pflege und Maße aus.",
          tool: "Kollektion", to: "/studio/produkte", done: facts.withDetails > 0,
        },
        {
          key: "veroeffentlicht", label: "Stück veröffentlicht", why: "Erst veröffentlicht ist es im Shop sichtbar.",
          how: "Stelle den Schalter im Stück auf veröffentlicht.",
          tool: "Kollektion", to: "/studio/produkte", done: facts.published > 0,
        },
      ],
    },
    {
      key: "seite",
      title: "Deine Seite",
      intro: "Deine Seite auf PAWN ist deine Visitenkarte — sie erzählt, wer hinter der Arbeit steht.",
      steps: [
        {
          key: "portrait", label: "Porträt und Geschichte", why: "Menschen kaufen von Menschen. Ein Gesicht und ein Satz reichen.",
          how: "Lade ein Porträt hoch und schreibe drei Sätze darüber, warum du das machst.",
          tool: "Markenseite", to: "/studio/brand", done: !!d.avatar_url && !!d.story,
        },
        {
          key: "seite_veroeffentlicht", label: "Markenseite veröffentlicht", why: "Ohne veröffentlichte Seite findet dich niemand.",
          how: "Bausteine wählen, Bilder setzen, veröffentlichen.",
          tool: "Deine Markenseite", to: "/studio/hausseite", done: !!d.page_published_at,
        },
      ],
    },
    {
      key: "sichtbar",
      title: "Sichtbar werden",
      intro: "Reichweite entsteht durch Wiederholung. Ein Video pro Woche ist mehr wert als zehn an einem Tag.",
      steps: [
        {
          key: "erstes_video", label: "Erstes Video", why: "Bewegte Bilder werden deutlich öfter gesehen als Fotos.",
          how: "Aus deinen Fotos macht PAWN in wenigen Minuten einen Clip.",
          tool: "Videos erstellen", to: "/studio/kampagnen/neu", done: facts.videos > 0,
        },
        {
          key: "geteilt", label: "Erstmals geteilt", why: "Der erste Beitrag ist der schwerste — danach wird es Routine.",
          how: "Lade dein Video herunter, poste es und verlinke deine PAWN-Seite.",
          tool: "Fertige Videos", to: "/studio/videothek", done: facts.shared,
        },
        {
          key: "rhythmus", label: "Posting-Rhythmus gewählt", why: "Ein fester Rhythmus schlägt jede einzelne gute Idee.",
          how: "Nimm den Wochenplan unten und such dir zwei feste Tage.",
          tool: "Ideen-Begleiter", to: "/studio/content-begleiter", done: false,
        },
      ],
    },
    {
      key: "verkaufen",
      title: "Verkaufen",
      intro: "Zum Schluss die Grundlage: Geld, Versand, Preise. Danach kann jeder Klick eine Bestellung werden.",
      steps: [
        {
          key: "auszahlung", label: "Auszahlungskonto verbunden", why: "Ohne Konto kann dein Geld nicht bei dir ankommen.",
          how: "Etwa fünf Minuten — Name, Adresse, Bankverbindung.",
          tool: "Auszahlung", to: "/studio/auszahlung", done: d.stripe_charges_enabled === true,
        },
        {
          key: "versand", label: "Preise und Versand gesetzt", why: "Klare Versandkosten senken die Zahl der Abbrüche im Warenkorb.",
          how: "Trag deine Versandpreise und deinen Steuersatz ein.",
          tool: "Versand", to: "/studio/versand", done: !!d.shipping_rates && Object.keys(d.shipping_rates).length > 0,
        },
        {
          key: "erster_verkauf", label: "Erster Verkauf", why: "Der Moment, für den alles andere da ist.",
          how: "Kommt von allein, wenn die Schritte davor stehen.",
          tool: "Bestellungen", to: "/studio/bestellungen", done: facts.paidOrder,
        },
      ],
    },
  ]) : [];

  const allSteps = stages.flatMap((s) => s.steps);
  const doneCount = allSteps.filter((s) => s.done).length;
  const totalCount = allSteps.length;
  const currentStage = stages.find((s) => !s.done) ?? stages[stages.length - 1] ?? null;
  const nextStep = allSteps.find((s) => !s.done) ?? null;

  return { stages, allSteps, doneCount, totalCount, currentStage, nextStep, loading: loading && !!designer };
}

function withDone(stages: Omit<BrandStage, "done">[]): BrandStage[] {
  return stages.map((s) => ({ ...s, done: s.steps.every((x) => x.done) }));
}
