/**
 * Teil 19a — Das Werkbuch: die Marken-DNA als lebendiges Dokument statt Formular.
 * Drei Ebenen: Der Kern (lesbares Porträt, korrigierbar in eigenen Worten),
 * Die Wirkung (was aus der DNA tatsächlich entstanden ist — Signaturen, Thema,
 * Kampagnen, Performance), Die Entwicklung (Verlauf mit Datum und Anlass).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { GenomeRung } from "@/components/palace/GenomeCard";

interface BrandDna {
  worlds?: Record<string, number>;
  signals?: string[];
  distilled_at?: string;
  history?: { at: string; worlds: Record<string, number>; signals: string[]; reason: string }[];
}
interface SignatureRow { id: string; name: string; created_at: string; }
interface ThemeRow { id: string; version: number; name: string | null; quelle: string; is_current: boolean; created_at: string; }
interface VideoRow { video_dna: { signatur?: string } | null; performance: { premiere_views?: number; shop_clicks?: number } | null; }
interface SuggestionEvent { created_at: string; payload: { reason?: string; summary?: string; current_name?: string | null } | null; }

const QUELLE_LABEL: Record<string, string> = {
  dna_destilliert: "aus deiner DNA",
  designer_beschrieben: "von dir beschrieben",
  manuell_verfeinert: "von Hand verfeinert",
};

export default function StudioDNA() {
  const { designer, loading, refresh } = useMyDesigner();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [correction, setCorrection] = useState("");
  const [signatures, setSignatures] = useState<SignatureRow[]>([]);
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionEvent[]>([]);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("house_signatures").select("id, name, created_at")
      .eq("designer_id", designer.id).order("created_at", { ascending: false })
      .then(({ data }) => setSignatures((data ?? []) as SignatureRow[]));
    void supabase.from("house_themes" as never).select("id, version, name, quelle, is_current, created_at")
      .eq("designer_id", designer.id).order("version", { ascending: false })
      .then(({ data }) => setThemes((data ?? []) as unknown as ThemeRow[]));
    void supabase.from("video_assets" as never).select("video_dna, performance")
      .eq("designer_id", designer.id)
      .then(({ data }) => setVideos((data ?? []) as unknown as VideoRow[]));
  }, [designer]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("domain_events").select("created_at, payload")
      .eq("actor", user.id).eq("type", "designer.dna_suggestion_accepted")
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setSuggestions((data ?? []) as unknown as SuggestionEvent[]));
  }, [user]);

  const dna = (designer?.brand_dna ?? {}) as BrandDna;
  const worlds = dna.worlds ?? {};
  const signals = dna.signals ?? [];
  const hasDna = Object.keys(worlds).length > 0 || signals.length > 0;

  const topWorld = useMemo(() => {
    const entries = Object.entries(worlds);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [worlds]);

  const distill = async (withCorrection: boolean) => {
    setBusy(true);
    try {
      const body = withCorrection && correction.trim() ? { correction: correction.trim() } : {};
      const { data, error } = await supabase.functions.invoke("distill-brand-dna", { body });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string; message?: string };
      if (!r.ok) { toast.error(r.message ?? r.error ?? "DNA konnte nicht destilliert werden."); return; }
      toast.success(withCorrection ? "DNA korrigiert." : "DNA destilliert.");
      setCorrection("");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const performanceBySignature = useMemo(() => {
    const map = new Map<string, { views: number; clicks: number }>();
    for (const v of videos) {
      const key = v.video_dna?.signatur ?? "Ohne Signatur";
      const cur = map.get(key) ?? { views: 0, clicks: 0 };
      cur.views += v.performance?.premiere_views ?? 0;
      cur.clicks += v.performance?.shop_clicks ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort((a, b) => (b[1].views + b[1].clicks * 3) - (a[1].views + a[1].clicks * 3));
  }, [videos]);
  const totalViews = performanceBySignature.reduce((s, [, v]) => s + v.views, 0);
  const totalClicks = performanceBySignature.reduce((s, [, v]) => s + v.clicks, 0);

  const currentTheme = themes.find((t) => t.is_current) ?? null;

  const timeline = useMemo(() => {
    const history = dna.history ?? [];
    const entries: { at: string; label: string }[] = history.map((h) => ({
      at: h.at,
      label: `DNA-${h.reason === "Korrektur" ? "Korrektur" : "Neu-Destillation"} — davor: ${(h.signals ?? []).slice(0, 3).join(", ") || "—"}`,
    }));
    for (const t of themes) {
      entries.push({ at: t.created_at, label: `Haus-Thema Version ${t.version}${t.name ? ` „${t.name}"` : ""} (${QUELLE_LABEL[t.quelle] ?? t.quelle})` });
    }
    if (history.length === 0 && dna.distilled_at) entries.push({ at: dna.distilled_at, label: "DNA zum ersten Mal destilliert" });
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12);
  }, [dna, themes]);

  if (loading) return <StudioShell title="Werkbuch"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Werkbuch"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Werkbuch" eyebrow="Eure Marken-DNA">
      <section className="border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Der Kern</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-black">Verstehst du meine Arbeit?</h2>

        {!hasDna ? (
          <div className="mt-6 border border-dashed border-black/30 p-6 text-center">
            <p className="text-sm text-black/60">Noch keine DNA — sobald Story, Manifest oder erste Produkte da sind, lässt sich eine erste Fassung destillieren.</p>
            <button type="button" onClick={() => void distill(false)} disabled={busy}
              className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-50">
              {busy ? "Destilliert…" : "Erstbefüllung starten"}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 max-w-2xl text-[1.05rem] leading-relaxed text-black/85">
              {designer.brand_name} steht vor allem in {topWorld ? `${topWorld[0]} (${Math.round(topWorld[1] * 100)}%)` : "mehreren Welten"}
              {signals.length > 0 ? `, mit einer Stimme, die sich zeigt in ${signals.slice(0, 5).join(", ")}` : ""}.
            </p>
            {designer.manifesto && <p className="mt-4 max-w-2xl font-serif text-lg italic text-black/70">„{designer.manifesto}"</p>}

            {Object.keys(worlds).length > 0 && (
              <div className="mt-6 space-y-3">
                {Object.entries(worlds).map(([label, value]) => (
                  <div key={label}>
                    <div className="flex items-baseline justify-between text-[0.68rem] uppercase tracking-[0.2em] text-black">
                      <span>{label}</span><span className="tabular-nums text-black/50">{Math.round(value * 100)}</span>
                    </div>
                    <div className="mt-1.5"><GenomeRung value={value * 100} /></div>
                  </div>
                ))}
              </div>
            )}
            {signals.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-black/15 pt-4">
                {signals.map((s) => <span key={s} className="border-[1.5px] border-black px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-black">{s}</span>)}
              </div>
            )}

            <div className="mt-6 border-t border-black/15 pt-4">
              <button type="button" onClick={() => void distill(false)} disabled={busy}
                className="border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-50">
                {busy ? "…" : "Neu destillieren"}
              </button>
            </div>

            <div className="mt-6 border-t border-black/15 pt-4">
              <p className="editorial-eyebrow text-black/50">Das trifft nicht ganz zu?</p>
              <textarea value={correction} onChange={(e) => setCorrection(e.target.value)}
                placeholder="Sag uns in eigenen Worten, was daran nicht stimmt — wir schreiben die DNA neu."
                className="mt-2 w-full min-h-24 border border-border bg-background p-3 text-sm" />
              <button type="button" onClick={() => void distill(true)} disabled={busy || !correction.trim()}
                className="mt-2 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-50">
                {busy ? "…" : "DNA korrigieren"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="mt-8 border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Die Wirkung</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-black">Was daraus entstanden ist</h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <WirkungZahl label="Signaturen" value={signatures.length} hint={signatures.map((s) => s.name).slice(0, 3).join(", ") || undefined} href="/studio/kampagnen/neu" />
          <WirkungZahl label="Haus-Thema" value={themes.length} hint={currentTheme ? `aktuell: ${currentTheme.name ?? `Version ${currentTheme.version}`} · ${QUELLE_LABEL[currentTheme.quelle] ?? currentTheme.quelle}` : undefined} href="/studio/hausseite" />
          <WirkungZahl label="Kampagnen-Vorschläge übernommen" value={suggestions.length} hint={suggestions[0]?.payload?.summary} href="/studio/kampagnen/neu" />
        </div>

        <div className="mt-8 border-t border-black/15 pt-6">
          <p className="editorial-eyebrow text-black/50">Aufrufe &amp; Klicks je Signatur</p>
          {performanceBySignature.length === 0 ? (
            <p className="mt-3 text-sm text-black/60">Noch keine Aufrufe — sobald erste Videos laufen, zeigt sich hier, was wirkt.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5">
                {performanceBySignature.map(([sig, p]) => (
                  <li key={sig} className="flex items-center justify-between text-sm text-black">
                    <span>{sig}</span>
                    <span className="tabular-nums text-black/60">{p.views} Aufrufe · {p.clicks} Klicks</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.7rem] uppercase tracking-[0.2em] text-black/40">Insgesamt {totalViews} Aufrufe, {totalClicks} Klicks zur Kasse</p>
            </>
          )}
        </div>
      </section>

      <section className="mt-8 border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">Die Entwicklung</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight text-black">Wie sie sich verändert hat</h2>

        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-black/60">Noch kein Verlauf — er entsteht, sobald sich eure DNA oder euer Thema weiterentwickelt.</p>
        ) : (
          <ol className="mt-6 space-y-4 border-l-[1.5px] border-black/20 pl-5">
            {timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.44rem] top-1 h-2 w-2 border-[1.5px] border-black bg-white" />
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-black/40">
                  {new Date(e.at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                <p className="mt-0.5 text-sm text-black">{e.label}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </StudioShell>
  );
}

function WirkungZahl({ label, value, hint, href }: { label: string; value: number; hint?: string; href: string }) {
  return (
    <Link to={href} className="block border border-black/15 p-4 hover:border-black">
      <p className="font-serif text-3xl leading-none text-black">{value}</p>
      <p className="mt-2 editorial-eyebrow text-black/50">{label}</p>
      {hint && <p className="mt-1 text-xs text-black/60">{hint}</p>}
    </Link>
  );
}
