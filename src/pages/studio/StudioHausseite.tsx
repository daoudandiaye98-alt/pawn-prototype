/**
 * Hausseite (Teil 12c): der Designer baut seine öffentliche Seite selbst aus Bausteinen,
 * jeder zieht sein Material aus der Mediathek. Vorschau ist die echte Darstellung
 * (HausseiteBlocks) — kein separates Preview-Modell. Reihenfolge über Pfeile, nicht per
 * Ziehen (dieselbe, bereits bewährte Interaktion wie beim Kampagnen-Schnitt in Teil 11b).
 *
 * Teil 15a: dazu das Haus-Thema per Vibecoding — die eigene Welt in Worten beschreiben statt
 * über Regler einstellen. Jede Fassung bleibt als Version erhalten (vergleichbar, zurücknehmbar).
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Trash2, ExternalLink } from "lucide-react";
import { HausseiteBlocks, type PageBlockKind, type PageBlockRow, type BlockMediaLite, type BlockProductLite } from "@/components/palace/HausseiteBlocks";
import {
  DEFAULT_HOUSE_THEME, resolveTheme, type HouseTheme,
  TYPOGRAFIE_LABEL, FLAECHENRHYTHMUS_LABEL, KANTENHAERTE_LABEL, BEWEGUNGSCHARAKTER_LABEL, TEXTUR_LABEL,
} from "@/features/houseTheme/theme";

const BLOCK_LABEL: Record<PageBlockKind, string> = {
  auftakt: "Großes Bild oben", editorial_text: "Text-Abschnitt", zitat: "Zitat",
  produktreihe: "Reihe mit Stücken", lookbook_streifen: "Bilderstreifen zum Wischen",
  banner_seitlich: "Bild seitlich", banner_vollbreite: "Bild über die ganze Breite",
  ueberlappend: "Zwei Bilder versetzt",
};

/** Startvorlagen: ein Klick legt eine sinnvolle Grundstruktur an. */
const TEMPLATES: { key: string; label: string; hint: string; kinds: PageBlockKind[] }[] = [
  { key: "ein_stueck", label: "Ein Stück im Mittelpunkt", hint: "Großes Bild, kurzer Text, ein Stück verlinkt", kinds: ["auftakt", "editorial_text", "banner_seitlich"] },
  { key: "kollektion", label: "Geschichte einer Kollektion", hint: "Bild, Text, Zitat, Reihe mit Stücken", kinds: ["auftakt", "editorial_text", "zitat", "produktreihe"] },
  { key: "lookbook", label: "Lookbook zum Wischen", hint: "Bilderstreifen, Text, Reihe mit Stücken", kinds: ["lookbook_streifen", "editorial_text", "produktreihe"] },
];


const ABSTAND_OPTIONS = [
  { value: "", label: "Wie Flächenrhythmus des Themas" },
  { value: "eng", label: "Eng" }, { value: "ruhig", label: "Ruhig" },
  { value: "luftig", label: "Luftig" }, { value: "episch", label: "Episch" },
] as const;
/** Bausteine, die eine eigene Video-Tonspur erlauben können. */
const TON_FAEHIG: PageBlockKind[] = ["auftakt", "banner_seitlich", "banner_vollbreite", "lookbook_streifen"];
/** Bausteine mit eigenem Abstand (house-gap-y-getrieben). */
const ABSTAND_FAEHIG: PageBlockKind[] = ["editorial_text", "zitat", "produktreihe", "banner_seitlich", "ueberlappend"];
/** Teil 16c: jedes Medium bekommt ein Ziel — diese Bausteine können ein Stück verlinken
    (produktreihe hat das Ziel bereits fest eingebaut, hier ist es optional je Baustein). */
const PRODUKT_LINK_FAEHIG: PageBlockKind[] = ["banner_seitlich", "banner_vollbreite", "ueberlappend", "lookbook_streifen"];

interface ThemeRow extends HouseTheme { id: string; version: number; is_current: boolean; created_at: string }

export default function StudioHausseite() {
  const { designer, loading } = useMyDesigner();
  const [blocks, setBlocks] = useState<PageBlockRow[]>([]);
  const [media, setMedia] = useState<BlockMediaLite[]>([]);
  const [products, setProducts] = useState<BlockProductLite[]>([]);
  const [published, setPublished] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [themeHistory, setThemeHistory] = useState<ThemeRow[]>([]);
  const [vibeText, setVibeText] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "telefon">("desktop");
  const [themeBusy, setThemeBusy] = useState(false);
  const currentTheme = themeHistory.find((t) => t.is_current) ?? null;

  const refresh = async () => {
    if (!designer) return;
    const [{ data: b }, { data: m }, { data: p }, { data: d }, { data: th }] = await Promise.all([
      supabase.from("designer_page_blocks" as never).select("id, kind, position, content").eq("designer_id", designer.id).order("position"),
      supabase.from("media_assets" as never).select("id, url, kind").eq("designer_id", designer.id).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, slug, price, image_url").eq("designer_id", designer.id),
      supabase.from("designers").select("page_published_at").eq("id", designer.id).maybeSingle(),
      supabase.from("house_themes" as never).select("*").eq("designer_id", designer.id).order("version", { ascending: false }),
    ]);
    setBlocks((b ?? []) as unknown as PageBlockRow[]);
    setMedia((m ?? []) as unknown as BlockMediaLite[]);
    setProducts((p ?? []) as unknown as BlockProductLite[]);
    setPublished((d as { page_published_at?: string | null } | null)?.page_published_at ?? null);
    setThemeHistory((th ?? []) as unknown as ThemeRow[]);
  };

  useEffect(() => { void refresh(); }, [designer]);

  const generateTheme = async () => {
    if (!designer) return;
    setThemeBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-house-theme", { body: { prompt: vibeText.trim() || undefined } });
      if (error) throw error;
      const r = data as { ok?: boolean; message?: string; error?: string; guardrail_notes?: { grund: string }[] } | null;
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? "Thema konnte nicht erzeugt werden.");
      setVibeText("");
      if (r.guardrail_notes?.length) toast.info(r.guardrail_notes.map((n) => n.grund).join(" · "));
      toast.success("Thema aktualisiert.");
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setThemeBusy(false);
    }
  };

  const revertTheme = async (version: number) => {
    setThemeBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-house-theme", { body: { action: "revert", revert_to_version: version } });
      if (error) throw error;
      const r = data as { ok?: boolean; message?: string; error?: string } | null;
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? "Fassung konnte nicht übernommen werden.");
      toast.success(`Fassung ${version} ist jetzt aktiv.`);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setThemeBusy(false);
    }
  };

  const mediaById = Object.fromEntries(media.map((m) => [m.id, m]));

  const addBlock = async (kind: PageBlockKind) => {
    if (!designer) return;
    const position = blocks.length;
    const { error } = await supabase.from("designer_page_blocks" as never).insert({
      designer_id: designer.id, kind, position, content: {},
    } as never);
    if (error) return toast.error(error.message);
    void refresh();
  };

  const updateContent = async (block: PageBlockRow, content: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, content } : b)));
    await supabase.from("designer_page_blocks" as never).update({ content } as never).eq("id", block.id);
  };

  const removeBlock = async (block: PageBlockRow) => {
    await supabase.from("designer_page_blocks" as never).delete().eq("id", block.id);
    void refresh();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...blocks];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setBlocks(next);
    await Promise.all(next.map((b, i) => supabase.from("designer_page_blocks" as never).update({ position: i } as never).eq("id", b.id)));
  };

  const publish = async (on: boolean) => {
    if (!designer) return;
    setBusy(true);
    await supabase.from("designers").update({ page_published_at: on ? new Date().toISOString() : null }).eq("id", designer.id);
    setBusy(false);
    setPublished(on ? new Date().toISOString() : null);
    toast.success(on ? "Hausseite veröffentlicht." : "Von der Ausstellung genommen.");
  };

  if (loading) return <StudioShell title="Hausseite"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Hausseite"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Hausseite" eyebrow="Deine öffentliche Doppelseite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Baue deine öffentliche Seite aus Bausteinen — jeder zieht sein Material aus der Mediathek. Reihenfolge über die Pfeile.
        </p>
        <div className="flex items-center gap-2">
          <a href={`/designer/${designer.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex min-h-[36px] items-center gap-1.5 border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
            Live ansehen <ExternalLink className="h-3 w-3" />
          </a>
          <button onClick={() => void publish(!published)} disabled={busy}
            className="min-h-[36px] border border-foreground bg-foreground px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:opacity-50">
            {published ? "Von der Ausstellung nehmen" : "Veröffentlichen"}
          </button>
        </div>
      </div>
      {!published && <p className="mt-3 text-xs text-muted-foreground">Noch nicht veröffentlicht — Besucher sehen bis dahin deine bisherige Seite.</p>}

      <div className="mt-8 border border-border bg-white p-5">
        <p className="editorial-eyebrow">Thema deines Hauses</p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Beschreib deine Welt in eigenen Worten — z. B. „ein verlassenes Hallenbad bei Neonlicht" oder „Großmutters Nähzimmer im Spätsommer".
          PAWN übersetzt das zusammen mit deiner Marken-DNA in Farben, Schrift, Abstände, Bewegung und Kanten deiner Hausseite.
          {currentTheme ? ' Verfeinere jederzeit mit einem weiteren Satz — „wärmer", „strenger", „mehr Luft".' : ""}
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <textarea value={vibeText} onChange={(e) => setVibeText(e.target.value)} rows={2}
            placeholder={currentTheme ? "z. B. wärmer, mehr Luft, strenger…" : "Beschreib deine Welt in ein bis zwei Sätzen…"}
            className="w-full flex-1 border border-border bg-white p-3 text-sm" />
          <button onClick={() => void generateTheme()} disabled={themeBusy || (!vibeText.trim() && !!currentTheme)}
            className="min-h-[44px] shrink-0 border border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-foreground/90 disabled:opacity-50">
            {themeBusy ? "Einen Moment…" : currentTheme ? "Verfeinern" : "Thema erzeugen"}
          </button>
        </div>
        {!currentTheme && (
          <button onClick={() => void generateTheme()} disabled={themeBusy}
            className="mt-2 text-[0.62rem] uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50">
            Oder: Vorschlag direkt aus meiner DNA
          </button>
        )}

        {currentTheme && (
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-1">
              {[currentTheme.farbwelt.bg, currentTheme.farbwelt.fg, currentTheme.farbwelt.accent].map((hex, i) => (
                <span key={i} className="h-6 w-6 border border-border" style={{ background: hex }} title={hex} />
              ))}
            </div>
            <p className="text-sm">{currentTheme.name || "Ohne Namen"} <span className="text-muted-foreground">· v{currentTheme.version}</span></p>
            <p className="text-xs text-muted-foreground">
              {TYPOGRAFIE_LABEL[currentTheme.typografie]} · {FLAECHENRHYTHMUS_LABEL[currentTheme.flaechenrhythmus]} · {KANTENHAERTE_LABEL[currentTheme.kantenhaerte]} · {BEWEGUNGSCHARAKTER_LABEL[currentTheme.bewegungscharakter]} · {TEXTUR_LABEL[currentTheme.hintergrundtextur.typ]}
            </p>
          </div>
        )}
        {!!currentTheme?.guardrail_notes?.length && (
          <p className="mt-3 text-xs text-muted-foreground">Automatisch angepasst: {currentTheme.guardrail_notes.map((n) => n.grund).join(" · ")}</p>
        )}

        {themeHistory.length > 1 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="editorial-eyebrow">Frühere Fassungen</p>
            <div className="mt-2 space-y-1.5">
              {themeHistory.filter((t) => !t.is_current).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span>v{t.version} — {t.name || "Ohne Namen"} <span className="text-muted-foreground">({new Date(t.created_at).toLocaleDateString("de-DE")})</span></span>
                  <button onClick={() => void revertTheme(t.version)} disabled={themeBusy}
                    className="border border-border px-2 py-1 uppercase tracking-widest hover:border-foreground disabled:opacity-50">
                    Übernehmen
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(BLOCK_LABEL) as PageBlockKind[]).map((k) => (
          <button key={k} onClick={() => void addBlock(k)}
            className="min-h-[36px] border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
            + {BLOCK_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          {blocks.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Bausteine. Füge oben einen hinzu.</p>}
          {blocks.map((b, i) => (
            <div key={b.id} className="border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="editorial-eyebrow">{BLOCK_LABEL[b.kind]}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => void move(i, -1)} disabled={i === 0} className="p-1 hover:text-foreground disabled:opacity-30" aria-label="Nach oben"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => void move(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:text-foreground disabled:opacity-30" aria-label="Nach unten"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => void removeBlock(b)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <BlockEditor block={b} media={media} products={products} onChange={(c) => void updateContent(b, c)} />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <p className="editorial-eyebrow">Vorschau — vor dem Veröffentlichen prüfen</p>
            <div className="flex border border-border">
              <button onClick={() => setPreviewDevice("desktop")}
                className={`min-h-[32px] px-3 text-[0.6rem] uppercase tracking-widest ${previewDevice === "desktop" ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                Bildschirm
              </button>
              <button onClick={() => setPreviewDevice("telefon")}
                className={`min-h-[32px] border-l border-border px-3 text-[0.6rem] uppercase tracking-widest ${previewDevice === "telefon" ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                Telefon
              </button>
            </div>
          </div>
          <div className={`mx-auto max-h-[80vh] overflow-y-auto border border-border ${previewDevice === "telefon" ? "max-w-[390px]" : ""}`}>
            {blocks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Noch nichts zu zeigen.</p>
            ) : (
              <HausseiteBlocks blocks={blocks} mediaById={mediaById} products={products} theme={currentTheme ? resolveTheme(currentTheme) : DEFAULT_HOUSE_THEME} />
            )}
          </div>
        </div>
      </div>
    </StudioShell>
  );
}

function BlockEditor({
  block, media, products, onChange,
}: { block: PageBlockRow; media: BlockMediaLite[]; products: BlockProductLite[]; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  const mediaPicker = (value: string, onSelect: (id: string) => void, filterKind?: "bild" | "video") => (
    <select value={value} onChange={(e) => onSelect(e.target.value)} className="mt-2 w-full border border-border bg-white p-2 text-sm">
      <option value="">Aus der Mediathek wählen…</option>
      {media.filter((m) => !filterKind || m.kind === filterKind).map((m) => (
        <option key={m.id} value={m.id}>{m.kind === "video" ? "🎬" : "🖼"} {m.id.slice(0, 8)}</option>
      ))}
    </select>
  );

  const body = (() => {
    switch (block.kind) {
      case "auftakt":
      case "banner_seitlich":
      case "banner_vollbreite":
        return mediaPicker((c.media_asset_id as string) ?? "", (id) => onChange({ ...c, media_asset_id: id }));
      case "editorial_text":
        return (
          <div className="mt-2 space-y-2">
            <input defaultValue={(c.heading as string) ?? ""} onBlur={(e) => onChange({ ...c, heading: e.target.value })}
              placeholder="Überschrift" className="w-full border border-border bg-white p-2 text-sm" />
            <textarea defaultValue={(c.text as string) ?? ""} onBlur={(e) => onChange({ ...c, text: e.target.value })}
              placeholder="Text" rows={3} className="w-full border border-border bg-white p-2 text-sm" />
          </div>
        );
      case "zitat":
        return (
          <div className="mt-2 space-y-2">
            <textarea defaultValue={(c.quote as string) ?? ""} onBlur={(e) => onChange({ ...c, quote: e.target.value })}
              placeholder="Zitat" rows={2} className="w-full border border-border bg-white p-2 text-sm" />
            <input defaultValue={(c.author as string) ?? ""} onBlur={(e) => onChange({ ...c, author: e.target.value })}
              placeholder="Wer sagt das?" className="w-full border border-border bg-white p-2 text-sm" />
          </div>
        );
      case "produktreihe": {
        const ids = new Set((c.product_ids as string[]) ?? []);
        return (
          <div className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={ids.has(p.id)} onChange={(e) => {
                  const next = new Set(ids);
                  if (e.target.checked) next.add(p.id); else next.delete(p.id);
                  onChange({ ...c, product_ids: Array.from(next) });
                }} />
                {p.name}
              </label>
            ))}
            {products.length === 0 && <p className="col-span-2 text-muted-foreground">Noch keine Produkte.</p>}
          </div>
        );
      }
      case "lookbook_streifen": {
        const ids = new Set((c.media_asset_ids as string[]) ?? []);
        return (
          <div className="mt-2 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
            {media.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={ids.has(m.id)} onChange={(e) => {
                  const next = new Set(ids);
                  if (e.target.checked) next.add(m.id); else next.delete(m.id);
                  onChange({ ...c, media_asset_ids: Array.from(next) });
                }} />
                {m.kind === "video" ? "🎬" : "🖼"} {m.id.slice(0, 8)}
              </label>
            ))}
            {media.length === 0 && <p className="col-span-2 text-muted-foreground">Noch nichts in der Mediathek.</p>}
          </div>
        );
      }
      case "ueberlappend":
        return (
          <div className="mt-2 space-y-2">
            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Hinteres Medium</p>
            {mediaPicker((c.media_asset_id_a as string) ?? "", (id) => onChange({ ...c, media_asset_id_a: id }))}
            <p className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Vorderes Medium (versetzt)</p>
            {mediaPicker((c.media_asset_id_b as string) ?? "", (id) => onChange({ ...c, media_asset_id_b: id }))}
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <>
      {body}
      {ABSTAND_FAEHIG.includes(block.kind) && (
        <select value={(c.abstand as string) ?? ""} onChange={(e) => onChange({ ...c, abstand: e.target.value || undefined })}
          className="mt-2 w-full border border-border bg-white p-2 text-sm">
          {ABSTAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {TON_FAEHIG.includes(block.kind) && (
        <label className="mt-2 flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={!!c.ton} onChange={(e) => onChange({ ...c, ton: e.target.checked })} />
          Ton erlauben (Video startet trotzdem stumm, Besucher können ihn einschalten)
        </label>
      )}
      {PRODUKT_LINK_FAEHIG.includes(block.kind) && (
        <div className="mt-2">
          <label className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">Führt zum Stück (optional)</label>
          <select value={(c.product_id as string) ?? ""} onChange={(e) => onChange({ ...c, product_id: e.target.value || undefined })}
            className="mt-1 w-full border border-border bg-white p-2 text-sm">
            <option value="">Kein direktes Ziel</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
