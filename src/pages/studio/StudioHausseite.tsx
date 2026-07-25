/**
 * Hausseite (Teil 12c): der Designer baut seine öffentliche Seite selbst aus Bausteinen,
 * jeder zieht sein Material aus der Mediathek. Vorschau ist die echte Darstellung
 * (HausseiteBlocks) — kein separates Preview-Modell. Reihenfolge über Pfeile, nicht per
 * Ziehen (dieselbe, bereits bewährte Interaktion wie beim Kampagnen-Schnitt in Teil 11b).
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Trash2, ExternalLink } from "lucide-react";
import { HausseiteBlocks, type PageBlockKind, type PageBlockRow, type BlockMediaLite, type BlockProductLite } from "@/components/palace/HausseiteBlocks";

const BLOCK_LABEL: Record<PageBlockKind, string> = {
  auftakt: "Auftaktbild/-video", editorial_text: "Editorial-Text", zitat: "Zitat",
  produktreihe: "Produktreihe", lookbook_streifen: "Lookbook-Streifen",
  banner_seitlich: "Seitlicher Banner", banner_vollbreite: "Vollbreiten-Banner",
};

export default function StudioHausseite() {
  const { designer, loading } = useMyDesigner();
  const [blocks, setBlocks] = useState<PageBlockRow[]>([]);
  const [media, setMedia] = useState<BlockMediaLite[]>([]);
  const [products, setProducts] = useState<BlockProductLite[]>([]);
  const [published, setPublished] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!designer) return;
    const [{ data: b }, { data: m }, { data: p }, { data: d }] = await Promise.all([
      supabase.from("designer_page_blocks" as never).select("id, kind, position, content").eq("designer_id", designer.id).order("position"),
      supabase.from("media_assets" as never).select("id, url, kind").eq("designer_id", designer.id).order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, slug, price, image_url").eq("designer_id", designer.id),
      supabase.from("designers").select("page_published_at").eq("id", designer.id).maybeSingle(),
    ]);
    setBlocks((b ?? []) as unknown as PageBlockRow[]);
    setMedia((m ?? []) as unknown as BlockMediaLite[]);
    setProducts((p ?? []) as unknown as BlockProductLite[]);
    setPublished((d as { page_published_at?: string | null } | null)?.page_published_at ?? null);
  };

  useEffect(() => { void refresh(); }, [designer]);

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
          <p className="editorial-eyebrow mb-3">Vorschau</p>
          <div className="max-h-[80vh] overflow-y-auto border border-border">
            {blocks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Noch nichts zu zeigen.</p>
            ) : (
              <HausseiteBlocks blocks={blocks} mediaById={mediaById} products={products} />
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
    default:
      return null;
  }
}
