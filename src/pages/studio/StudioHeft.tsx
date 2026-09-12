/**
 * Teil O/K3 — `/studio/heft`: das Haus bearbeitet seine Seite im echten Heft.
 *
 * Der Bruch, den diese Seite behebt: das Studio hatte einen eigenen Renderer für dieselben
 * Daten, die das Heft als Doppelseite zeichnet. Hier läuft nur noch das Heft selbst, mit
 * `bearbeiten: true` und der Studio-Quelle. Was der Designer ändert, kommt über
 * `auf.gestellt(entwurf)` zurück und wird — entprellt — in dieselben Tabellen geschrieben,
 * aus denen die öffentliche Ausgabe liest. Kein zweites Vorschau-Modell.
 *
 * `studioQuelle` und die Option `bearbeiten` liegen in `src/heft03/` (zweiter Agent). Fehlt
 * eines von beidem, bleibt diese Seite mit einer klaren Meldung stehen, statt halb zu laufen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

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

      if (entwurf.buehne) {
        const b = entwurf.buehne;
        const zeile = {
          designer_id: designer.id, welt: b.welt ?? null, blatt: b.blatt ?? null, layout: b.layout ?? null,
          kicker: b.kicker ?? null, titel: b.titel ?? null, text: b.text ?? null,
          boden: b.boden ?? null, ruecken: b.ruecken ?? null, licht: b.licht ?? null,
          stuecke: b.stuecke ?? null, deko: b.deko ?? null, eigenhaendig: true,
        };
        const id = b.id ?? buehneId.current;
        if (id) {
          // `veroeffentlicht` bleibt unberührt — das entscheidet allein der Knopf.
          await supabase.from("heft_buehnen" as never).update(zeile as never).eq("id", id);
        } else {
          const { data } = await supabase.from("heft_buehnen" as never)
            .insert(zeile as never).select("id").maybeSingle();
          buehneId.current = (data as { id?: string } | null)?.id ?? null;
        }
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
  }, [designer]);

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
        supabase.from("heft_buehnen" as never).select("id, veroeffentlicht").eq("designer_id", designer.id).limit(1).maybeSingle(),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
      ]);
      const row = b as { id?: string; veroeffentlicht?: boolean } | null;
      buehneId.current = row?.id ?? null;
      setVeroeffentlicht(!!row?.veroeffentlicht);
      setWerkeZahl(count ?? 0);
    })();
  }, [designer]);

  /* ——— Das echte Heft starten ——— */
  useEffect(() => {
    if (!designer || !halter.current) return;
    let abgeraeumt = false;
    void (async () => {
      const quelleModul = await import("@/heft03/quelle.mjs") as unknown as Record<string, unknown>;
      const appModul = await import("@/heft03/app.js") as unknown as Record<string, unknown>;
      const studioQuelle = quelleModul.studioQuelle as ((o: Record<string, unknown>) => unknown) | undefined;
      const startHeft = appModul.startHeft as StartHeft | undefined;
      if (typeof studioQuelle !== "function" || typeof startHeft !== "function") {
        setFehlt(typeof studioQuelle !== "function" ? "studioQuelle" : "startHeft");
        return;
      }
      try {
        const g = await startHeft({
          quelle: studioQuelle({ client: supabase, haus: designer.slug }),
          adresse: "keine",
          bearbeiten: true,
          auf: { gestellt },
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
    };
  }, [designer, gestellt]);

  const veroeffentlichen = async () => {
    if (!designer) return;
    setBusy(true);
    try {
      if (buehneId.current) {
        const { error } = await supabase.from("heft_buehnen" as never)
          .update({ veroeffentlicht: true } as never).eq("id", buehneId.current);
        if (error) {
          if (error.message.includes("buehne_braucht_drei_werke")) {
            toast.error(t("studio.heft.nochWerke", { n: Math.max(0, 3 - werkeZahl) }));
            return;
          }
          throw error;
        }
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
        <div ref={halter} style={{ width: breite, maxWidth: "100%", aspectRatio: hoch ? "3 / 4" : "16 / 10" }} />
      </div>
    </StudioShell>
  );
}
