/**
 * Teil O/K3 — `/studio/heft`: das Haus bearbeitet seine Seite im echten Heft.
 *
 * Der Bruch, den diese Seite behebt: das Studio hatte einen eigenen Renderer für dieselben
 * Daten, die das Heft als Doppelseite zeichnet. Hier läuft nur noch das Heft selbst, mit
 * `bearbeiten: true` und der Studio-Quelle. Was der Designer ändert, kommt über
 * `auf.gestellt(entwurf)` zurück und wird — entprellt — in dieselben Tabellen geschrieben,
 * aus denen die öffentliche Ausgabe liest. Kein zweites Vorschau-Modell.
 *
 * DREI GRUENDE, WARUM HIER LANGE NICHTS STAND, alle behoben:
 *  1. `studioQuelle` gab es nicht — die Seite brach mit `fehlt = "studioQuelle"` ab, bevor
 *     das Heft startete. Jetzt in `src/heft03/quelle.mjs`.
 *  2. Hier stand ein LEERES `<div>`. `app.js` sucht feste Knoten (`#mobile-reader`,
 *     `#drawer-content`, `#hotspots` …) per `getElementById` und fand keinen. Jetzt wird
 *     dasselbe Geruest eingesetzt, das HeftRoute03 benutzt — `src/heft03/geruest.ts`.
 *  3. Das Heft-CSS fehlte ganz. Jetzt haengen `style.css` und `schriften.css` als `<link>`
 *     am Kopf, genau wie in der oeffentlichen Huelle, und werden beim Verlassen abgeraeumt.
 *
 * Und die eine Eigenschaft, die alles zusammenhaelt: `KASTEN_STIL` (`contain:paint`) sperrt
 * die 15 `position:fixed`-Regeln des Hefts in diesen Kasten ein. Ohne sie spannte sich die
 * Buehne ueber das ganze Fenster statt ueber die Vorschau. Gemessen, nicht vermutet —
 * die Zahlen stehen im Kopf von `geruest.ts`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { FlaechenTabs } from "@/components/pawn/FlaechenTabs";
import { GERUEST, KASTEN_STIL, stylesheet } from "@/heft03/geruest";
import heftCss from "@/heft03/style.css?url";
import schriftenCss from "@/heft03/schriften.css?url";

/* ——— Der Vertrag, gegen den diese Hülle geschrieben ist ——— */

interface HeftHaus {
  collection_title?: string | null;
  story?: string | null;
  hero_image_url?: string | null;
  atelier_image_url?: string | null;
  atelier_caption?: string | null;
}
interface HeftBlock { id?: string; kind: string; position: number; content: Record<string, unknown> }
interface HeftBuehne {
  id?: string; welt?: string | null; blatt?: number | null; layout?: string | null;
  kicker?: string | null; titel?: string | null; text?: string | null;
  boden?: unknown; ruecken?: unknown; licht?: unknown; stuecke?: unknown; deko?: unknown;
}
interface HeftWerk { id: string; hoehe?: number | null; notiz?: string | null }
interface HeftEntwurf {
  haus?: HeftHaus;
  blocks?: HeftBlock[];
  theme?: Record<string, unknown>;
  buehne?: HeftBuehne;
  werke?: HeftWerk[];
}
type Griff = { stop(): void };
type StartHeft = (o: Record<string, unknown>) => Promise<Griff>;

/** Was diese Huelle von `studioQuelle` braucht — mehr nicht. */
type BuehneAntwort = {
  ok?: boolean; fehler?: string; ueberholt?: boolean;
  gruende?: string[]; mindestens?: number; version?: number | null;
  buehne?: { id?: string; version?: number; veroeffentlicht?: boolean };
};
type StudioQuelle = {
  buehneSchreiben(entwurf: Record<string, unknown>): Promise<BuehneAntwort>;
  buehneVeroeffentlichen(buehne: Record<string, unknown>): Promise<BuehneAntwort>;
};

const ANSICHTEN = [
  { key: "doppelseite", labelKey: "studio.heft.ansicht.doppelseite", hoch: true },
  { key: "schaufenster", labelKey: "studio.heft.ansicht.schaufenster", hoch: false },
] as const;
const BREITEN = [1280, 834, 390] as const;

export default function StudioHeft() {
  const { t } = useI18n();
  const { designer, loading } = useMyDesigner();
  const halter = useRef<HTMLDivElement>(null);
  const griff = useRef<Griff | null>(null);
  const timer = useRef<number | null>(null);
  const letzterEntwurf = useRef<HeftEntwurf | null>(null);
  const buehneId = useRef<string | null>(null);
  /* Die Version, die beim letzten Lesen galt. Sie ist der Riegel: wer zwei Fenster offen
     hat, soll nicht stillschweigend das aeltere gewinnen lassen. Jede Antwort der Quelle
     schreibt sie fort — sonst schlaegt der naechste Schreibversuch zu Recht fehl. */
  const version = useRef<number>(0);
  const quelle = useRef<StudioQuelle | null>(null);

  const [ansicht, setAnsicht] = useState<(typeof ANSICHTEN)[number]["key"]>("doppelseite");
  const [breite, setBreite] = useState<number>(1280);
  const [fehlt, setFehlt] = useState<string | null>(null);
  const [stand, setStand] = useState<"ruhig" | "speichert" | "gespeichert">("ruhig");
  const [veroeffentlicht, setVeroeffentlicht] = useState(false);
  const [werkeZahl, setWerkeZahl] = useState(0);
  const [busy, setBusy] = useState(false);

  /* ——— Speichern: ein Entwurf, fünf Ziele ——— */
  const speichern = useCallback(async (entwurf: HeftEntwurf) => {
    if (!designer) return;
    setStand("speichert");
    try {
      if (entwurf.haus) {
        const h = entwurf.haus;
        await supabase.from("designers").update({
          collection_title: h.collection_title ?? null,
          story: h.story ?? null,
          hero_image_url: h.hero_image_url ?? null,
          atelier_image_url: h.atelier_image_url ?? null,
          atelier_caption: h.atelier_caption ?? null,
        }).eq("id", designer.id);
      }

      if (entwurf.blocks) {
        const { data: vorhanden } = await supabase.from("designer_page_blocks" as never)
          .select("id").eq("designer_id", designer.id);
        const alteIds = new Set(((vorhanden ?? []) as { id: string }[]).map((r) => r.id));
        for (const [i, b] of entwurf.blocks.entries()) {
          if (b.id && alteIds.has(b.id)) {
            alteIds.delete(b.id);
            await supabase.from("designer_page_blocks" as never)
              .update({ kind: b.kind, position: i, content: b.content } as never).eq("id", b.id);
          } else {
            await supabase.from("designer_page_blocks" as never)
              .insert({ designer_id: designer.id, kind: b.kind, position: i, content: b.content } as never);
          }
        }
        // Entfernte Bausteine verschwinden auch in der Datenbank — sonst blieben Leichen stehen.
        for (const id of alteIds) {
          await supabase.from("designer_page_blocks" as never).delete().eq("id", id);
        }
      }

      if (entwurf.theme) {
        // Guardrails und Versionierung bleiben beim Erzeuger — hier nur die Handfassung.
        await supabase.functions.invoke("generate-house-theme", {
          body: { action: "manual", manual: entwurf.theme },
        });
      }

      if (entwurf.buehne && quelle.current) {
        /* Nicht mehr ein nacktes `update`: `studioQuelle.buehneSchreiben` geht über
           `buehne.mjs › schreibEntwurf()`. Das klemmt jedes Stück in die erlaubte Spanne
           (der Trigger `heft_buehne_pruefen` würde es sonst ablehnen) UND schreibt nur,
           wenn die Version noch die ist, die beim Lesen galt. `veroeffentlicht` bleibt
           unberührt — das entscheidet allein der Knopf. */
        const antwort = await quelle.current.buehneSchreiben({
          ...entwurf.buehne,
          id: entwurf.buehne.id ?? buehneId.current ?? undefined,
          version: version.current,
        });
        if (antwort.ueberholt) {
          setStand("ruhig");
          toast.error(t("studio.heft.ueberholt"));
          return;
        }
        if (antwort.fehler) throw new Error(antwort.fehler);
        if (antwort.buehne?.id) buehneId.current = antwort.buehne.id;
        if (typeof antwort.buehne?.version === "number") version.current = antwort.buehne.version;
      }

      if (entwurf.werke?.length) {
        for (const w of entwurf.werke) {
          const { data: p } = await supabase.from("products").select("product_dna").eq("id", w.id).maybeSingle();
          const dna = ((p as { product_dna?: Record<string, unknown> } | null)?.product_dna ?? {}) as Record<string, unknown>;
          const heft = { ...((dna.heft ?? {}) as Record<string, unknown>) };
          if (w.hoehe != null) heft.hoehe = w.hoehe;
          if (w.notiz != null) heft.notiz = w.notiz;
          await supabase.from("products").update({ product_dna: { ...dna, heft } as never }).eq("id", w.id);
        }
      }

      setStand("gespeichert");
      window.setTimeout(() => setStand("ruhig"), 1600);
    } catch (e) {
      setStand("ruhig");
      toast.error((e as Error).message);
    }
  }, [designer, t]);

  const gestellt = useCallback((entwurf: HeftEntwurf) => {
    letzterEntwurf.current = entwurf;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (letzterEntwurf.current) void speichern(letzterEntwurf.current);
    }, 800);
  }, [speichern]);

  /* ——— Zustand des Hauses: Entwurf oder veröffentlicht ——— */
  useEffect(() => {
    if (!designer) return;
    void (async () => {
      const [{ data: b }, { count }] = await Promise.all([
        supabase.from("heft_buehnen").select("id, veroeffentlicht, version").eq("designer_id", designer.id).limit(1).maybeSingle(),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
      ]);
      const row = b as { id?: string; veroeffentlicht?: boolean; version?: number } | null;
      buehneId.current = row?.id ?? null;
      version.current = row?.version ?? 0;
      setVeroeffentlicht(!!row?.veroeffentlicht);
      setWerkeZahl(count ?? 0);
    })();
  }, [designer]);

  /* ——— Das echte Heft starten ——— */
  useEffect(() => {
    const kasten = halter.current;
    if (!designer || !kasten) return;
    let abgeraeumt = false;

    /* Das Geruest MUSS vor startHeft im DOM stehen: app.js sucht seine Knoten per
       getElementById und gibt auf, wenn es sie nicht findet. Darum hier und nicht in JSX —
       React soll diesen Teilbaum danach nicht mehr anfassen. */
    kasten.innerHTML = GERUEST;
    const blaetter = [stylesheet(schriftenCss), stylesheet(heftCss)];

    void (async () => {
      const quelleModul = await import("@/heft03/quelle.mjs") as unknown as Record<string, unknown>;
      const appModul = await import("@/heft03/app.js") as unknown as Record<string, unknown>;
      const studioQuelle = quelleModul.studioQuelle as ((o: Record<string, unknown>) => StudioQuelle) | undefined;
      const startHeft = appModul.startHeft as StartHeft | undefined;
      if (typeof studioQuelle !== "function" || typeof startHeft !== "function") {
        setFehlt(typeof studioQuelle !== "function" ? "studioQuelle" : "startHeft");
        return;
      }
      try {
        const q = studioQuelle({ client: supabase, haus: designer.slug, bild: (u: string) => u });
        quelle.current = q;
        const g = await startHeft({
          quelle: q,
          adresse: "keine",
          assets: "/heft/assets/",
          bearbeiten: true,
          auf: { gestellt, fehler: (e: Error) => setFehlt(e?.message ?? String(e)) },
        });
        if (abgeraeumt) g.stop(); else griff.current = g;
      } catch (e) {
        setFehlt((e as Error).message);
      }
    })();
    return () => {
      abgeraeumt = true;
      if (timer.current) window.clearTimeout(timer.current);
      griff.current?.stop();
      griff.current = null;
      quelle.current = null;
      for (const l of blaetter) l.remove();
      kasten.innerHTML = "";
    };
  }, [designer, gestellt]);

  const veroeffentlichen = async () => {
    if (!designer) return;
    setBusy(true);
    try {
      if (buehneId.current && quelle.current) {
        /* Die Gründe stehen VOR dem Schreiben fest (`buehne.mjs › fehltZumVeroeffentlichen`),
           nicht erst als Datenbankfehler. Der Trigger bleibt die letzte Wache, aber der
           Mensch erfährt vorher, was fehlt — und in Klartext, nicht als `buehne_braucht_drei_werke`. */
        const antwort = await quelle.current.buehneVeroeffentlichen({
          id: buehneId.current,
          version: version.current,
          stuecke: letzterEntwurf.current?.buehne?.stuecke ?? [],
        });
        if (antwort.ueberholt) { toast.error(t("studio.heft.ueberholt")); return; }
        if (antwort.fehler === "unfertig") {
          toast.error(antwort.gruende?.length
            ? antwort.gruende.join(" · ")
            : t("studio.heft.nochWerke", { n: Math.max(0, (antwort.mindestens ?? 3) - werkeZahl) }));
          return;
        }
        if (antwort.fehler) throw new Error(antwort.fehler);
        if (typeof antwort.buehne?.version === "number") version.current = antwort.buehne.version;
      }
      await supabase.from("designers").update({ page_published_at: new Date().toISOString() }).eq("id", designer.id);
      setVeroeffentlicht(true);
      toast.success(t("studio.heft.veroeffentlicht"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <StudioShell title={t("studioShell.nav.doppelseite")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.doppelseite")}><p className="text-muted-foreground">{t("studio.hausseite.noAccess")}</p></StudioShell>;

  const hoch = ANSICHTEN.find((a) => a.key === ansicht)?.hoch ?? true;

  return (
    <StudioShell title={t("studioShell.nav.doppelseite")} eyebrow={t("studio.heft.eyebrow")}>
      {/* Ohne die Tabs war dieser Raum eine Sackgasse: von „Seite" führte kein Weg zu „Stil". */}
      <FlaechenTabs tabs={[
        { to: "/studio/doppelseite", label: t("studio.tabs.seite") },
        { to: "/studio/doppelseite/stil", label: t("studio.tabs.stil") },
      ]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex border border-border">
          {ANSICHTEN.map((a) => (
            <button key={a.key} onClick={() => setAnsicht(a.key)}
              className={`min-h-[36px] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] ${ansicht === a.key ? "bg-foreground text-background" : "hover:border-foreground"}`}>
              {t(a.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex border border-border">
          {BREITEN.map((b) => (
            <button key={b} onClick={() => setBreite(b)}
              className={`min-h-[36px] px-3 py-1.5 text-[0.62rem] tracking-[0.2em] ${breite === b ? "bg-foreground text-background" : "hover:border-foreground"}`}>
              {b}
            </button>
          ))}
        </div>
        {/* Die Breiten zeigen die BÜHNE schmaler, nicht das Telefon. `@media`-Regeln und
            `vw` beziehen sich auf das Fenster, nicht auf diesen Kasten (siehe geruest.ts) —
            die Kopfzeile läuft bei 390 px rechts hinaus. Wer die echte Handy-Ansicht
            braucht, nimmt den Prüfstand. Lieber ein ehrlicher Satz als ein falsches Bild. */}
        <span className="text-[0.62rem] tracking-[0.14em] text-muted-foreground">{t("studio.heft.breiteHinweis")}</span>
        <span className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
          {stand === "speichert" ? t("studio.heft.speichert") : stand === "gespeichert" ? t("studio.heft.gespeichert") : veroeffentlicht ? t("studio.heft.zustand.veroeffentlicht") : t("studio.heft.zustand.entwurf")}
        </span>
        <button onClick={() => void veroeffentlichen()} disabled={busy || veroeffentlicht}
          className="ml-auto min-h-[36px] border border-foreground bg-foreground px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:opacity-50">
          {veroeffentlicht ? t("studio.heft.zustand.veroeffentlicht") : t("studio.hausseite.publishButton")}
        </button>
      </div>

      {fehlt && (
        <p className="mb-4 border border-border bg-white p-4 text-sm">
          {t("studio.heft.nochNicht", { teil: fehlt })}
        </p>
      )}

      <div className="relative overflow-auto border border-border bg-white">
        {/* Entwurf: diagonaler Bauplanen-Streifen über der Seite, nie über den Werkzeugen. */}
        {!veroeffentlicht && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(0,0,0,.05) 0 18px, rgba(0,0,0,0) 18px 36px)" }} />
        )}
        {/* KASTEN_STIL ist `contain:paint` und der Grund, warum hier überhaupt etwas zu sehen
            ist: es macht diesen Kasten zum Bezugsrahmen für die `position:fixed`-Regeln des
            Hefts. Kein `transform` — das zerstörte die Perspektive des CSS3D-Renderers.
            Den Inhalt setzt der Effekt (das Gerüst), React fasst ihn danach nicht mehr an. */}
        <div ref={halter} data-heft03-studio
          style={{ width: breite, maxWidth: "100%", aspectRatio: hoch ? "3 / 4" : "16 / 10", ...KASTEN_STIL }} />
      </div>
    </StudioShell>
  );
}
