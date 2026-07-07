import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload, X, Sparkles, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth";

type World = "Mode" | "Interior" | "Kunst";
type Status = "draft" | "published" | "archived";
type InventoryMode = "stock" | "made_to_order";
type Variant = { name: string; options: string[] };

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  world: World;
  price: number;
  compare_at_price: number | null;
  description: string | null;
  tags: string[];
  image_url: string | null;
  status: Status;
  inventory_mode: InventoryMode;
  stock_quantity: number;
  allow_custom_requests: boolean;
  sku: string | null;
  variants: Variant[];
  weight_grams: number | null;
  lead_time_days: number | null;
}

const emptyEdit = (): Partial<ProductRow> => ({
  world: "Mode", status: "draft", price: 0, tags: [], name: "", description: "",
  inventory_mode: "stock", stock_quantity: 0, allow_custom_requests: false,
  variants: [], compare_at_price: null, sku: "", weight_grams: null, lead_time_days: null,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const PAGE = 20;

export default function StudioProducts() {
  const { designer, loading } = useMyDesigner();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  const refresh = async () => {
    if (!designer) return;
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, count } = await supabase.from("products")
      .select("id, name, slug, world, price, compare_at_price, description, tags, image_url, status, inventory_mode, stock_quantity, allow_custom_requests, sku, variants, weight_grams, lead_time_days", { count: "exact" })
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    setItems(((data ?? []) as unknown) as ProductRow[]);
    setTotal(count ?? 0);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designer?.id, page]);

  const startNew = () => setEditing(emptyEdit());

  const save = async () => {
    if (!designer || !editing) return;
    if (!editing.name || editing.name.trim().length < 2) return toast.error("Name fehlt.");
    setBusy(true);
    const payload = {
      designer_id: designer.id,
      name: editing.name.trim(),
      slug: editing.slug?.trim() || `${slugify(designer.brand_name)}-${slugify(editing.name)}`,
      world: (editing.world ?? "Mode") as World,
      price: Number(editing.price ?? 0),
      compare_at_price: editing.compare_at_price != null && Number(editing.compare_at_price) > 0 ? Number(editing.compare_at_price) : null,
      description: editing.description ?? null,
      tags: editing.tags ?? [],
      image_url: editing.image_url ?? null,
      status: (editing.status ?? "draft") as Status,
      inventory_mode: (editing.inventory_mode ?? "stock") as InventoryMode,
      stock_quantity: Math.max(0, Number(editing.stock_quantity ?? 0)),
      allow_custom_requests: !!editing.allow_custom_requests,
      sku: editing.sku?.trim() || null,
      variants: (editing.variants ?? []) as unknown as never,
      weight_grams: editing.weight_grams != null ? Number(editing.weight_grams) : null,
      lead_time_days: editing.lead_time_days != null ? Number(editing.lead_time_days) : null,
    };
    const q = editing.id
      ? supabase.from("products").update(payload).eq("id", editing.id)
      : supabase.from("products").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert.");
    setEditing(null);
    void refresh();
  };

  const togglePublish = async (p: ProductRow) => {
    const next: Status = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("products").update({ status: next }).eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  const remove = async (p: ProductRow) => {
    if (!confirm(`"${p.name}" löschen?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  const uploadImage = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("designer-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    setEditing((e) => e ? { ...e, image_url: data?.signedUrl ?? null } : e);
  };

  const setVariant = (i: number, patch: Partial<Variant>) => {
    setEditing((e) => {
      if (!e) return e;
      const vs = [...(e.variants ?? [])];
      vs[i] = { ...vs[i], ...patch } as Variant;
      return { ...e, variants: vs };
    });
  };
  const addVariant = () => setEditing((e) => e ? { ...e, variants: [...(e.variants ?? []), { name: "Größe", options: [] }] } : e);
  const removeVariant = (i: number) => setEditing((e) => e ? { ...e, variants: (e.variants ?? []).filter((_, k) => k !== i) } : e);

  if (loading) return <StudioShell title="Produkte"><div className="animate-pulse h-64 bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Produkte"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <StudioShell title="Produkte" eyebrow="Deine Kollektion">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} Produkte · Seite {page + 1} / {totalPages}</p>
        <button onClick={startNew} className="flex items-center gap-2 border border-accent bg-accent px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground">
          <Plus className="h-3 w-3" /> Neues Produkt
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 border border-dashed border-border p-12 text-center">
          <p className="editorial-eyebrow">Leer</p>
          <p className="mt-3 font-serif text-2xl">Noch keine Produkte.</p>
          <p className="mt-2 text-sm text-muted-foreground">Leg das erste Stück deiner Kollektion an.</p>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border border border-border bg-card">
            {items.map((p) => {
              const lowStock = p.inventory_mode === "stock" && p.stock_quantity > 0 && p.stock_quantity < 3;
              const soldOut = p.inventory_mode === "stock" && p.stock_quantity === 0;
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 shrink-0 bg-muted">
                    {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover grayscale" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.world} · €{p.price} · {p.status}
                      {p.inventory_mode === "made_to_order"
                        ? <> · <span className="text-foreground">Auf Anfertigung{p.lead_time_days ? ` · ${p.lead_time_days} Tage` : ""}</span></>
                        : soldOut ? <> · <span className="text-destructive">Ausverkauft</span></>
                        : lowStock ? <> · <span className="text-foreground">Nur noch {p.stock_quantity}</span></>
                        : <> · Lager {p.stock_quantity}</>}
                    </p>
                  </div>
                  <button onClick={() => togglePublish(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                    {p.status === "published" ? "Depublizieren" : "Veröffentlichen"}
                  </button>
                  <button onClick={() => setEditing(p)} className="text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">Bearbeiten</button>
                  <button onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "campaign_draft", product_id: p.id } });
                    if (error) return toast.error(error.message);
                    const d = data as { error?: string; message?: string; campaign_id?: string };
                    if (d?.error === "consent_missing") return toast.error(d.message ?? "Bildnutzungs-Einwilligung fehlt.");
                    if (d?.campaign_id) toast.success("Kampagnen-Entwurf angelegt.");
                  }} className="flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">
                    <Megaphone className="h-3 w-3" /> Kampagne
                  </button>
                  <button onClick={() => remove(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-destructive hover:text-destructive/70">Löschen</button>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Zurück</button>
              <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Weiter</button>
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEditing(null)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-border bg-card p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{editing.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <Field label="Name">
                <input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Welt">
                  <select value={editing.world ?? "Mode"} onChange={(e) => setEditing({ ...editing, world: e.target.value as World })} className="inp">
                    <option>Mode</option><option>Interior</option><option>Kunst</option>
                  </select>
                </Field>
                <Field label="SKU (optional)">
                  <input value={editing.sku ?? ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className="inp" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Preis (EUR)">
                  <input type="number" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="inp" />
                </Field>
                <Field label="Streichpreis (optional)">
                  <input type="number" min={0} value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value ? Number(e.target.value) : null })} className="inp" />
                </Field>
              </div>

              <div className="border border-border p-4">
                <p className="editorial-eyebrow">Bestand</p>
                <div className="mt-3 flex gap-2">
                  {(["stock","made_to_order"] as InventoryMode[]).map((m) => (
                    <button key={m} type="button" onClick={() => setEditing({ ...editing, inventory_mode: m })}
                      className={`border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] ${editing.inventory_mode === m ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                      {m === "stock" ? "Lagerbestand" : "Auf Anfertigung"}
                    </button>
                  ))}
                </div>
                {editing.inventory_mode === "stock" ? (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Field label="Stückzahl im Lager">
                      <input type="number" min={0} value={editing.stock_quantity ?? 0} onChange={(e) => setEditing({ ...editing, stock_quantity: Math.max(0, Number(e.target.value)) })} className="inp" />
                    </Field>
                    <Field label="Gewicht (g, optional)">
                      <input type="number" min={0} value={editing.weight_grams ?? ""} onChange={(e) => setEditing({ ...editing, weight_grams: e.target.value ? Number(e.target.value) : null })} className="inp" />
                    </Field>
                  </div>
                ) : (
                  <Field label="Lieferzeit (Tage)">
                    <input type="number" min={0} value={editing.lead_time_days ?? ""} onChange={(e) => setEditing({ ...editing, lead_time_days: e.target.value ? Number(e.target.value) : null })} className="inp" />
                  </Field>
                )}
                <label className="mt-4 flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={!!editing.allow_custom_requests} onChange={(e) => setEditing({ ...editing, allow_custom_requests: e.target.checked })} />
                  Individuelle Anfragen zu diesem Stück erlauben
                </label>
              </div>

              <div className="border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="editorial-eyebrow">Varianten</p>
                  <button type="button" onClick={addVariant} className="text-[0.6rem] uppercase tracking-[0.28em] hover:text-foreground">+ hinzufügen</button>
                </div>
                {(editing.variants ?? []).length === 0 && <p className="mt-3 text-xs text-muted-foreground">Keine. Optional: Größe, Farbe, Format …</p>}
                <div className="mt-3 space-y-3">
                  {(editing.variants ?? []).map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
                      <Field label="Name"><input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} className="inp" /></Field>
                      <Field label="Optionen (Komma)"><input value={v.options.join(", ")} onChange={(e) => setVariant(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="inp" /></Field>
                      <button type="button" onClick={() => removeVariant(i)} className="border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.28em] text-destructive">Entf.</button>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Beschreibung">
                <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="inp min-h-24" />
                {editing.id && (
                  <button type="button" onClick={async () => {
                    const { data, error } = await supabase.functions.invoke("studio-ai", { body: { mode: "product_text", product_id: editing.id } });
                    if (error) return toast.error(error.message);
                    const t = (data as { text?: string })?.text;
                    if (t) { setEditing((e) => e ? { ...e, description: t } : e); toast.success("Vorschlag eingefügt."); }
                  }} className="mt-2 inline-flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                    <Sparkles className="h-3 w-3" /> Text von PAWN
                  </button>
                )}
              </Field>
              <Field label="Tags (Komma-getrennt)">
                <input value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="inp" />
              </Field>
              <Field label="Bild">
                <div className="flex items-center gap-3">
                  {editing.image_url && <img src={editing.image_url} alt="" className="h-16 w-16 object-cover grayscale" />}
                  <label className="flex cursor-pointer items-center gap-2 border border-dashed border-border px-4 py-2 text-xs">
                    <Upload className="h-3 w-3" /> Bild hochladen
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  </label>
                </div>
              </Field>
              <Field label="Status">
                <select value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })} className="inp">
                  <option value="draft">Entwurf</option>
                  <option value="published">Veröffentlicht</option>
                  <option value="archived">Archiviert</option>
                </select>
              </Field>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setEditing(null)} className="border border-border px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em]">Abbrechen</button>
                <button onClick={save} disabled={busy} className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
                  {busy ? "…" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`.inp { width:100%; border:1px solid hsl(var(--border)); background:hsl(var(--background)); padding: 0.6rem 0.8rem; font-size: 0.9rem; }`}</style>
    </StudioShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="editorial-eyebrow">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
