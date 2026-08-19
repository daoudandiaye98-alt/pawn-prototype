/**
 * Teil X8 — die Häuser als Kapitel.
 *
 * Sektion 08 verspricht es seit X5: „Jedes Haus ein eigenes Kapitel." Hier wird
 * das Versprechen eingelöst — als Design, nicht als neue Logik. Jedes aktive
 * Haus bekommt hinter den Werken sein Kapitel: eine Auftakt-Doppelseite, und
 * dahinter seine Bausteine (die Hausseite aus Teil 12c) als Heftseiten.
 *
 * **Was vom Haus-Thema ins Heft darf — und was nicht.** Die Hausseite im Netz
 * trägt das volle Thema (Teil 15a): Farben, Rundung, Bewegung, Textur. Ein Heft
 * ist strenger. Aus `house_themes` kommen genau vier Dinge:
 *
 *   Papier   die Grundfläche des Kapitels     (farbwelt.bg)
 *   Tinte    die Schrift darauf               (farbwelt.fg)
 *   Schrift  die Stimme der Schlagzeilen      (typografie)
 *   Übergang die Behandlung der Bilder        (uebergangsart, s. u.)
 *
 * Kein Akzent, keine Rundung, keine Textur: das Kapitel bleibt ein Blatt in
 * PAWNs Heft, das die Handschrift des Hauses trägt — nicht die Hausseite,
 * zwischen zwei andere Seiten geklemmt. Das ist die bewusste Ausnahme vom
 * Schwarz-Weiß-Gesetz, in derselben Art wie die Welt-Kopfbilder: eingezäunt
 * auf die Kapitel-Seiten (`data-haus` in `heft.css`).
 *
 * **Warum die Übergangsart keine Animation ist.** `fade`, `iris`, `schnitt`,
 * `wisch` beschreiben auf der Hausseite den Seitenübergang. Im Heft gehört der
 * Übergang dem Wendel — ein zweiter, konkurrierender Bewegungsmechanismus je
 * Haus wäre genau die Doppelung, die das Heft überall sonst verbietet. Die
 * Übergangsart wird deshalb zur **Bildbehandlung** des Kapitels: sie prägt,
 * wie die Platten des Hauses auf dem Papier stehen. Gedruckt wäre es genauso.
 *
 * **Keine Datenbank-Arbeit.** Alles hier liest nur: designers, house_themes,
 * designer_page_blocks, media_assets, products — Tabellen und Spalten, die es
 * seit den Teilen 12c/15a gibt.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bildSatz, bildVariante } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile } from "./satzspiegel";
import { werkPfad } from "./verzeichnis";

/** Die Adresse eines Kapitels. Eine Stelle, wie bei `werkPfad`. */
export const hausPfad = (slug: string) => `/haus/${slug}`;

/* ————————————————— Der Stil eines Kapitels ————————————————— */

/**
 * Die Stimme der Schlagzeilen, aus `typografie` übersetzt.
 *
 * Nur Schriften, die das Bündel wirklich trägt (`main.tsx`): Playfair und
 * Cormorant Garamond sind geladen, alles andere fiele auf Systemschriften.
 * `archiv` ist bewusst die Systemmono — eine geladene Monoschrift nur für
 * Häuser, die sie wählen, wäre Gewicht für alle (Kontrolle 4.7).
 */
const SCHRIFT: Record<string, string> = {
  editorial: '"Playfair Display", Georgia, serif',
  zart: '"Cormorant Garamond", Georgia, serif',
  warm: '"Cormorant Garamond", Georgia, serif',
  archiv: 'ui-monospace, "SF Mono", Menlo, monospace',
};

export interface HausStil {
  papier: string;
  tinte: string;
  schrift: string;
  /** fade · iris · schnitt · wisch — die Bildbehandlung, s. Kopfkommentar. */
  uebergang: string;
}

/** Ohne Thema schreibt das Haus auf PAWNs eigenem Papier. Kein geratener Wert. */
const PAWN_STIL: HausStil = {
  papier: "#FFFFFF", tinte: "#000000", schrift: SCHRIFT.editorial, uebergang: "fade",
};

/* ————————————————— Die Daten ————————————————— */

export interface HausBaustein {
  id: string;
  kind: string;
  content: Record<string, unknown>;
}

export interface HausKapitel {
  id: string;
  slug: string;
  name: string;
  /** Die Hausnummer — „eine Handschrift mit einer Nummer" (Sektion 08). */
  nummer: number | null;
  story: string | null;
  zitat: string | null;
  bild: string | null;
  stil: HausStil;
  /** Nur bei veröffentlichter Hausseite — sonst bleibt es beim Auftakt. */
  bausteine: HausBaustein[];
}

export interface HaeuserStand {
  haeuser: HausKapitel[];
  /** Bild-Adressen je media_asset-Id, für die Baustein-Seiten. */
  medien: Record<string, { url: string; kind: string }>;
  /** Stücke je Produkt-Id, für die Produktreihen. */
  stuecke: Record<string, { name: string; slug: string; price: number; image_url: string | null }>;
  laedt: boolean;
  fehler: string | null;
}

export const LEERE_HAEUSER: HaeuserStand = {
  haeuser: [], medien: {}, stuecke: {}, laedt: true, fehler: null,
};

type ThemeZeile = {
  designer_id: string;
  farbwelt: { bg?: string; fg?: string } | null;
  typografie: string | null;
  uebergangsart: string | null;
};

/**
 * Lädt die Kapitel. Dieselbe Rollenverteilung wie beim Verzeichnis (X6): die
 * Route lädt, die Seitenliste bleibt rein und bekommt den Stand gereicht.
 */
export function useHausKapitel(): HaeuserStand {
  const [stand, setStand] = useState<HaeuserStand>(LEERE_HAEUSER);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, brand_name, story, quote, hero_image_url, house_number, page_published_at")
        .eq("status", "active")
        .order("house_number", { ascending: true });
      if (abgebrochen) return;
      if (error) {
        setStand({ ...LEERE_HAEUSER, laedt: false, fehler: "Die Häuser lassen sich gerade nicht laden." });
        return;
      }
      const zeilen = (data ?? []) as {
        id: string; slug: string; brand_name: string; story: string | null; quote: string | null;
        hero_image_url: string | null; house_number: number | null; page_published_at: string | null;
      }[];
      const ids = zeilen.map((z) => z.id);
      const veroeffentlicht = zeilen.filter((z) => z.page_published_at).map((z) => z.id);

      const [themen, bloecke] = await Promise.all([
        ids.length
          ? supabase.from("house_themes" as never)
            .select("designer_id, farbwelt, typografie, uebergangsart")
            .eq("is_current", true).in("designer_id", ids)
          : Promise.resolve({ data: [] }),
        veroeffentlicht.length
          ? supabase.from("designer_page_blocks" as never)
            .select("id, designer_id, kind, position, content")
            .in("designer_id", veroeffentlicht).order("position")
          : Promise.resolve({ data: [] }),
      ]);
      if (abgebrochen) return;

      const stilVon = new Map<string, HausStil>();
      for (const t of ((themen.data ?? []) as unknown as ThemeZeile[])) {
        stilVon.set(t.designer_id, {
          papier: t.farbwelt?.bg ?? PAWN_STIL.papier,
          tinte: t.farbwelt?.fg ?? PAWN_STIL.tinte,
          schrift: SCHRIFT[t.typografie ?? ""] ?? PAWN_STIL.schrift,
          uebergang: t.uebergangsart ?? PAWN_STIL.uebergang,
        });
      }

      const bausteineVon = new Map<string, HausBaustein[]>();
      const medienIds = new Set<string>();
      const produktIds = new Set<string>();
      for (const b of ((bloecke.data ?? []) as unknown as {
        id: string; designer_id: string; kind: string; position: number; content: Record<string, unknown> | null;
      }[])) {
        const c = b.content ?? {};
        const liste = bausteineVon.get(b.designer_id) ?? [];
        liste.push({ id: b.id, kind: b.kind, content: c });
        bausteineVon.set(b.designer_id, liste);
        if (typeof c.media_asset_id === "string") medienIds.add(c.media_asset_id);
        for (const id of Array.isArray(c.media_asset_ids) ? c.media_asset_ids : []) {
          if (typeof id === "string") medienIds.add(id);
        }
        for (const id of Array.isArray(c.product_ids) ? c.product_ids : []) {
          if (typeof id === "string") produktIds.add(id);
        }
      }

      const [medienRes, stueckeRes] = await Promise.all([
        medienIds.size
          ? supabase.from("media_assets" as never).select("id, url, kind").in("id", [...medienIds])
          : Promise.resolve({ data: [] }),
        produktIds.size
          ? supabase.from("products").select("id, name, slug, price, image_url")
            .in("id", [...produktIds]).eq("status", "published")
          : Promise.resolve({ data: [] }),
      ]);
      if (abgebrochen) return;

      const medien: HaeuserStand["medien"] = {};
      for (const m of ((medienRes.data ?? []) as unknown as { id: string; url: string; kind: string }[])) {
        medien[m.id] = { url: m.url, kind: m.kind };
      }
      const stuecke: HaeuserStand["stuecke"] = {};
      for (const p of ((stueckeRes.data ?? []) as unknown as {
        id: string; name: string; slug: string; price: number; image_url: string | null;
      }[])) {
        stuecke[p.id] = { name: p.name, slug: p.slug, price: Number(p.price), image_url: p.image_url };
      }

      setStand({
        haeuser: zeilen.map((z) => ({
          id: z.id,
          slug: z.slug,
          name: z.brand_name,
          nummer: z.house_number,
          story: z.story,
          zitat: z.quote,
          bild: z.hero_image_url,
          stil: stilVon.get(z.id) ?? PAWN_STIL,
          bausteine: bausteineVon.get(z.id) ?? [],
        })),
        medien, stuecke, laedt: false, fehler: null,
      });
    })();
    return () => { abgebrochen = true; };
  }, []);

  return stand;
}

/* ————————————————— Die Seiten eines Kapitels ————————————————— */

/** Der Kolumnentitel: der Name des Hauses — wie beim Werk das Haus. */
export const hausKolumne = (h: HausKapitel) => h.name;

/** Die Platte des Kapitels: das Bild in der Behandlung der Übergangsart. */
function KapitelPlatte({ haus }: { haus: HausKapitel }) {
  if (!haus.bild) {
    /* Ohne Bild trägt die linke Seite den Namen als Bild — Tinte auf Papier,
       in der Schrift des Hauses. Kein grauer Platzhalter. */
    return (
      <div className="hx-haus-namensplatte" aria-hidden>
        <span>{haus.name}</span>
      </div>
    );
  }
  return (
    <div className="hx-haus-platte" data-uebergang={haus.stil.uebergang}>
      {/* Z4 — Anzeigegrößen: eine Seite ist die halbe Doppelseite, auf dem
          Telefon die ganze. Dieselben sizes wie die gebündelten Platten. */}
      <img
        src={bildVariante(haus.bild, { breite: 960, guete: 80 })}
        srcSet={bildSatz(haus.bild, [640, 960, 1280])}
        sizes="(max-width: 820px) 100vw, 50vw"
        alt={`${haus.name} — Bild des Hauses.`}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function HausSeiteLinks({ haus, folio }: { haus: HausKapitel; folio: number | null }) {
  return (
    <Heftseite lage="links" kolumne={hausKolumne(haus)} folio={folio} hausStil={haus.stil}>
      <KapitelPlatte haus={haus} />
    </Heftseite>
  );
}

export function HausSeiteRechts({ haus, folio }: { haus: HausKapitel; folio: number | null }) {
  /* Story vor Zitat: die Story ist die längere, eigene Erzählung. Beides leer →
     der ehrliche Satz über das, was ein Kapitel hier ist. */
  const text = haus.story ?? haus.zitat
    ?? "Dieses Haus lässt seine Arbeit sprechen. Die Stücke stehen im Verzeichnis.";
  return (
    <Heftseite
      lage="rechts" kolumne={hausKolumne(haus)} folio={folio} hausStil={haus.stil}
      weg={{ text: "Die Stücke des Hauses", zu: `/verzeichnis/1?haus=${haus.slug}` }}
    >
      <div className="hx-satz-block">
        <Kicker>{haus.nummer != null ? `Kapitel · Haus Nr. ${haus.nummer}` : "Kapitel"}</Kicker>
        <Schlagzeile>{haus.name}</Schlagzeile>
        <Fliesstext>{text}</Fliesstext>
        {haus.zitat && haus.story ? <Bildunterschrift>„{haus.zitat}"</Bildunterschrift> : null}
      </div>
    </Heftseite>
  );
}

/* ————————————————— Bausteine werden Seiten ————————————————— */

/**
 * Ein Baustein der Hausseite als Heftseite — oder `null`, wenn er auf Papier
 * nichts zu zeigen hat (leere Felder bleiben unsichtbar, Q4b-Regel).
 *
 * Die Zuordnung ist bewusst eine Übersetzung, kein Nachbau: die Hausseite ist
 * eine rollende Fläche, das Heft ein Satzspiegel. Ein Baustein wird zu der
 * Seitenform, die seinem Inhalt entspricht — Bild, Satz, Zitat oder Reihe.
 */
export function bausteinInhalt(
  haus: HausKapitel,
  b: HausBaustein,
  stand: Pick<HaeuserStand, "medien" | "stuecke">,
  aufWerk?: (slug: string) => boolean,
): ReactNode | null {
  const c = b.content;
  const erstesBild = (): string | null => {
    if (typeof c.media_asset_id === "string") return stand.medien[c.media_asset_id]?.url ?? null;
    const ids = Array.isArray(c.media_asset_ids) ? c.media_asset_ids : [];
    for (const id of ids) {
      if (typeof id === "string" && stand.medien[id]?.kind === "bild") return stand.medien[id].url;
    }
    return null;
  };
  const text = (feld: string): string | null =>
    typeof c[feld] === "string" && (c[feld] as string).trim() ? (c[feld] as string).trim() : null;

  switch (b.kind) {
    case "editorial_text": {
      const kopf = text("heading");
      const lauf = text("text");
      if (!kopf && !lauf) return null;
      return (
        <div className="hx-satz-block">
          {kopf ? <Schlagzeile>{kopf}</Schlagzeile> : null}
          {lauf ? <Fliesstext>{lauf}</Fliesstext> : null}
        </div>
      );
    }
    case "zitat": {
      const zitat = text("quote");
      if (!zitat) return null;
      return (
        <div className="hx-satz-block">
          <blockquote className="hx-haus-zitat">„{zitat}"</blockquote>
          {text("author") ? <Bildunterschrift>{text("author")}</Bildunterschrift> : null}
        </div>
      );
    }
    case "produktreihe": {
      const ids = (Array.isArray(c.product_ids) ? c.product_ids : []).filter(
        (id): id is string => typeof id === "string" && !!stand.stuecke[id],
      );
      if (ids.length === 0) return null;
      return <HausReihe ids={ids} stuecke={stand.stuecke} aufWerk={aufWerk} />;
    }
    default: {
      /* auftakt, lookbook_streifen, banner_seitlich, banner_vollbreite,
         ueberlappend — alles, dessen Kern ein Bild ist, wird eine Bildseite.
         Text, der am Baustein hängt, steht als Unterschrift dabei. */
      const bild = erstesBild();
      if (!bild) return null;
      const unterschrift = text("heading") ?? text("text");
      return (
        <>
          <div className="hx-haus-platte" data-uebergang={haus.stil.uebergang}>
            <img
              src={bildVariante(bild, { breite: 960, guete: 80 })}
              srcSet={bildSatz(bild, [640, 960, 1280])}
              sizes="(max-width: 820px) 100vw, 50vw"
              alt="" loading="lazy" decoding="async"
            />
          </div>
          {unterschrift ? <Bildunterschrift>{unterschrift}</Bildunterschrift> : null}
        </>
      );
    }
  }
}

/** Die Produktreihe als Verzeichnis-Zeilen des Hauses. */
function HausReihe({ ids, stuecke, aufWerk }: {
  ids: string[];
  stuecke: HaeuserStand["stuecke"];
  aufWerk?: (slug: string) => boolean;
}) {
  const { locale } = useI18n();
  return (
    <ol className="hx-inhalt-liste">
      {ids.map((id) => {
        const p = stuecke[id];
        return (
          <li key={id}>
            <Link
              className="hx-inhalt-zeile"
              to={werkPfad(p.slug)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                if (!aufWerk?.(p.slug)) return;
                e.preventDefault();
              }}
            >
              <span className="hx-inhalt-wort">{p.name}</span>
              <span className="hx-inhalt-punkte" aria-hidden />
              <span className="hx-inhalt-folio">{formatPrice(p.price, locale)}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/* ————————————————— Die Zeilen für Sektion 08 ————————————————— */

/**
 * Die Häuser als Liste auf der Sektionsseite — derselbe Bau wie die Weltzeilen.
 * `aufHaus` blättert; ohne Eintrag bleibt es ein gewöhnlicher Link (derselbe
 * Handel wie bei `aufWerk` in X7).
 */
export function HausZeilen({ haeuser, aufHaus }: {
  haeuser: HausKapitel[];
  aufHaus?: (slug: string) => boolean;
}) {
  if (haeuser.length === 0) return null;
  return (
    <ul className="hx-welten">
      {haeuser.map((h) => (
        <li key={h.id}>
          <Link
            className="hx-welt-zeile"
            to={hausPfad(h.slug)}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              if (!aufHaus?.(h.slug)) return;
              e.preventDefault();
            }}
          >
            <span className="hx-welt-name">{h.name}</span>
            <span className="hx-welt-satz">
              {h.nummer != null ? `Haus Nr. ${h.nummer}` : "Ein eigenes Kapitel"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
