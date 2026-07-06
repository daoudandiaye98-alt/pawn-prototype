import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Pencil, Package as PackageIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Designer = Database["public"]["Tables"]["designers"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type World = Database["public"]["Enums"]["product_world"];
type Status = Database["public"]["Enums"]["product_status"];
type InvMode = Database["public"]["Enums"]["inventory_mode"];

const PAGE = 30;

export default function AdminDesigners() {
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<{ designer: Designer; view: "brand" | "products" } | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("designers").select("*", { count: "exact" }).order("brand_name");
    if (search.trim()) q = q.ilike("brand_name", `%${search.trim()}%`);
    const from = page * PAGE;
    q = q.range(from, from + PAGE - 1);
    const { data, count } = await q;
    setDesigners(((data ?? []) as Designer[]));
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [page, search]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <AdminShell title="Designer" eyebrow="Governance">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} placeholder="Suche nach Brand …"
          className="w-64 border border-border bg-background px-3 py-1.5 text-sm" />
        <span className="ml-auto text-xs text-muted-foreground">{total} · Seite {page + 1}/{totalPages}</span>
      </div>

      {loading ? (
        <div className="animate-pulse h-40 bg-muted" />
      ) : designers.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center text-muted-foreground">Keine Designer.</div>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Ort</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Share%</th>
                <th className="px-4 py-3">Sichtbar</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {designers.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-serif">{d.brand_name}<div className="text-[0.62rem] text-muted-foreground">/{d.slug}</div></td>
                  <td className="px-4 py-3 text-muted-foreground">{[d.location, d.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 uppercase text-xs tracking-widest">{d.status}</td>
                  <td className="px-4 py-3 tabular-nums">{Number(d.revenue_share_pct)}%</td>
                  <td className="px-4 py-3">{d.published ? "Ja" : "Nein"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDrawer({ designer: d, view: "brand" })} className="mr-3 inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.22em] hover:underline">
                      <Pencil className="h-3 w-3" /> Store bearbeiten
                    </button>
                    <button onClick={() => setDrawer({ designer: d, view: "products" })} className="inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.22em] hover:underline">
                      <PackageIcon className="h-3 w-3" /> Produkte verwalten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Zurück</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] disabled:opacity-40">Weiter</button>
        </div>
      )}

      {drawer && (
        <DetailDrawer designer={drawer.designer} view={drawer.view}
          onClose={() => setDrawer(null)}
          onSaved={(d) => { setDrawer({ designer: d, view: drawer.view }); void load(); }}
          setView={(v) => setDrawer(drawer ? { ...drawer, view: v } : null)}
        />
      )}
    </AdminShell>
  );
}

function DetailDrawer({ designer, view, onClose, onSaved, setView }: {
  designer: Designer; view: "brand" | "products";
  onClose: () => void; onSaved: (d: Designer) => void;
  setView: (v: "brand" | "products") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="editorial-eyebrow">Designer</p>
            <h2 className="font-serif text-2xl">{designer.brand_name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-border px-6">
          <div className="flex gap-2">
            {(["brand", "products"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-3 text-[0.62rem] uppercase tracking-[0.28em] border-b-2 ${view === v ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}>
                {v === "brand" ? "Store bearbeiten" : "Produkte"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {view === "brand" ? <BrandEditor designer={designer} onSaved={onSaved} /> : <ProductsManager designerId={designer.id} />}
        </div>
      </div>
    </div>
  );
}

function BrandEditor({ designer, onSaved }: { designer: Designer; onSaved: (d: Designer) => void }) {
  const [d, setD] = useState<Designer>(designer);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("designers").update({
      brand_name: d.brand_name, slug: d.slug, location: d.location, country: d.country,
      website: d.website, instagram: d.instagram, story: d.story, tags: d.tags,
      quote: d.quote, quote_role: d.quote_role,
      avatar_url: d.avatar_url, banner_url: d.banner_url, hero_image_url: d.hero_image_url,
      status: d.status, revenue_share_pct: d.revenue_share_pct,
      published: d.published, is_featured: d.is_featured,
    }).eq("id", d.id).select("*").maybeSingle();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Speichern fehlgeschlagen.");
    toast.success("Gespeichert.");
    onSaved(data as Designer);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <F label="Brand"><input className="inp" value={d.brand_name} onChange={(e) => setD({ ...d, brand_name: e.target.value })} /></F>
        <F label="Slug"><input className="inp" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} /></F>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <F label="Ort"><input className="inp" value={d.location ?? ""} onChange={(e) => setD({ ...d, location: e.target.value })} /></F>
        <F label="Land"><input className="inp" value={d.country ?? ""} onChange={(e) => setD({ ...d, country: e.target.value })} /></F>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <F label="Website"><input className="inp" value={d.website ?? ""} onChange={(e) => setD({ ...d, website: e.target.value })} /></F>
        <F label="Instagram"><input className="inp" value={d.instagram ?? ""} onChange={(e) => setD({ ...d, instagram: e.target.value })} /></F>
      </div>
      <F label="Story"><textarea className="inp min-h-32" value={d.story ?? ""} onChange={(e) => setD({ ...d, story: e.target.value })} /></F>
      <div className="grid grid-cols-2 gap-4">
        <F label="Zitat"><textarea className="inp min-h-20" value={d.quote ?? ""} onChange={(e) => setD({ ...d, quote: e.target.value })} /></F>
        <F label="Zitat-Rolle"><input className="inp" value={d.quote_role ?? ""} onChange={(e) => setD({ ...d, quote_role: e.target.value })} /></F>
      </div>
      <F label="Tags (Komma)"><input className="inp" value={(d.tags ?? []).join(", ")} onChange={(e) => setD({ ...d, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></F>
      <div className="grid grid-cols-3 gap-4">
        <F label="Avatar URL"><input className="inp" value={d.avatar_url ?? ""} onChange={(e) => setD({ ...d, avatar_url: e.target.value })} /></F>
        <F label="Banner URL"><input className="inp" value={d.banner_url ?? ""} onChange={(e) => setD({ ...d, banner_url: e.target.value })} /></F>
        <F label="Hero URL"><input className="inp" value={d.hero_image_url ?? ""} onChange={(e) => setD({ ...d, hero_image_url: e.target.value })} /></F>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <F label="Status"><select className="inp" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>
          <option value="active">active</option><option value="paused">paused</option><option value="hidden">hidden</option>
        </select></F>
        <F label="Share %"><input type="number" className="inp" value={Number(d.revenue_share_pct)} onChange={(e) => setD({ ...d, revenue_share_pct: Number(e.target.value) })} /></F>
        <F label="Sichtbar"><select className="inp" value={String(d.published)} onChange={(e) => setD({ ...d, published: e.target.value === "true" })}>
          <option value="true">Ja</option><option value="false">Nein</option>
        </select></F>
        <F label="Featured"><select className="inp" value={String(d.is_featured)} onChange={(e) => setD({ ...d, is_featured: e.target.value === "true" })}>
          <option value="false">Nein</option><option value="true">Ja</option>
        </select></F>
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={save} disabled={busy} className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
          {busy ? "…" : "Speichern"}
        </button>
      </div>
      <style>{`.inp{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:.5rem .7rem;font-size:.9rem}`}</style>
    </div>
  );
}

type EditProd = Partial<Product> & { variants?: { name: string; options: string[] }[] };

function ProductsManager({ designerId }: { designerId: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const [editing, setEditing] = useState<EditProd | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const { data } = await supabase.from("products").select("*").eq("designer_id", designerId).order("created_at", { ascending: false });
    setItems(((data ?? []) as Product[]));
  };
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designerId]);

  const startNew = () => setEditing({
    designer_id: designerId, name: "", slug: "", world: "Mode" as World, status: "draft" as Status,
    price: 0, tags: [], inventory_mode: "stock" as InvMode, stock_quantity: 0, allow_custom_requests: false, variants: [],
  });

  const save = async () => {
    if (!editing?.name || editing.name.trim().length < 2) return toast.error("Name fehlt.");
    setBusy(true);
    const slugBase = editing.slug?.trim() || editing.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const payload = {
      designer_id: designerId,
      name: editing.name.trim(),
      slug: slugBase,
      world: (editing.world ?? "Mode") as World,
      status: (editing.status ?? "draft") as Status,
      price: Number(editing.price ?? 0),
      compare_at_price: editing.compare_at_price != null && Number(editing.compare_at_price) > 0 ? Number(editing.compare_at_price) : null,
      description: editing.description ?? null,
      tags: (editing.tags ?? []) as string[],
      image_url: editing.image_url ?? null,
      inventory_mode: (editing.inventory_mode ?? "stock") as InvMode,
      stock_quantity: Math.max(0, Number(editing.stock_quantity ?? 0)),
      allow_custom_requests: !!editing.allow_custom_requests,
      sku: editing.sku ?? null,
      variants: (editing.variants ?? []) as unknown as never,
      weight_grams: editing.weight_grams ?? null,
      lead_time_days: editing.lead_time_days ?? null,
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

  const del = async (p: Product) => {
    if (!confirm(`"${p.name}" löschen?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} Produkte</p>
        <button onClick={startNew} className="border border-accent bg-accent px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-accent-foreground">+ Neu</button>
      </div>
      <ul className="mt-4 divide-y divide-border border border-border">
        {items.length === 0 && <li className="p-8 text-center text-muted-foreground">Keine Produkte.</li>}
        {items.map((p) => (
          <li key={p.id} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.world} · €{Number(p.price)} · {p.status} · {p.inventory_mode === "made_to_order" ? `Anfertigung${p.lead_time_days ? " " + p.lead_time_days + "T" : ""}` : `Lager ${p.stock_quantity}`}</p>
            </div>
            <button onClick={() => setEditing({ ...(p as EditProd), variants: (p.variants ?? []) as { name: string; options: string[] }[] })} className="text-[0.6rem] uppercase tracking-[0.28em] hover:text-foreground">Bearbeiten</button>
            <button onClick={() => del(p)} className="text-[0.6rem] uppercase tracking-[0.28em] text-destructive">Löschen</button>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6" onClick={() => setEditing(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl">{editing.id ? "Produkt bearbeiten" : "Neues Produkt"}</h3>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <F label="Name"><input className="inp" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></F>
              <div className="grid grid-cols-3 gap-3">
                <F label="Welt"><select className="inp" value={editing.world ?? "Mode"} onChange={(e) => setEditing({ ...editing, world: e.target.value as World })}>
                  <option>Mode</option><option>Interior</option><option>Kunst</option>
                </select></F>
                <F label="Preis"><input type="number" className="inp" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></F>
                <F label="Streichpreis"><input type="number" className="inp" value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value ? Number(e.target.value) : null })} /></F>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <F label="Modus"><select className="inp" value={editing.inventory_mode ?? "stock"} onChange={(e) => setEditing({ ...editing, inventory_mode: e.target.value as InvMode })}>
                  <option value="stock">Lager</option><option value="made_to_order">Anfertigung</option>
                </select></F>
                <F label={editing.inventory_mode === "made_to_order" ? "Lieferzeit (T)" : "Stückzahl"}>
                  {editing.inventory_mode === "made_to_order"
                    ? <input type="number" className="inp" value={editing.lead_time_days ?? ""} onChange={(e) => setEditing({ ...editing, lead_time_days: e.target.value ? Number(e.target.value) : null })} />
                    : <input type="number" className="inp" value={editing.stock_quantity ?? 0} onChange={(e) => setEditing({ ...editing, stock_quantity: Math.max(0, Number(e.target.value)) })} />}
                </F>
                <F label="Status"><select className="inp" value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })}>
                  <option value="draft">Entwurf</option><option value="published">Veröffentlicht</option><option value="archived">Archiviert</option>
                </select></F>
              </div>
              <F label="Beschreibung"><textarea className="inp min-h-20" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></F>
              <F label="Tags (Komma)"><input className="inp" value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></F>
              <F label="Bild URL"><input className="inp" value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></F>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.allow_custom_requests} onChange={(e) => setEditing({ ...editing, allow_custom_requests: e.target.checked })} />
                Individuelle Anfragen erlauben
              </label>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setEditing(null)} className="border border-border px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em]">Abbrechen</button>
                <button onClick={save} disabled={busy} className="border border-accent bg-accent px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">{busy ? "…" : "Speichern"}</button>
              </div>
            </div>
            <style>{`.inp{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:.5rem .7rem;font-size:.9rem}`}</style>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="editorial-eyebrow">{label}</span><div className="mt-1">{children}</div></label>;
}
