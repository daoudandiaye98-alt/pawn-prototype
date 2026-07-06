import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

type World = "Mode" | "Interior" | "Kunst";
type Status = "draft" | "published" | "archived";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  world: World;
  price: number;
  description: string | null;
  tags: string[];
  image_url: string | null;
  status: Status;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function StudioProducts() {
  const { designer, loading } = useMyDesigner();
  const [items, setItems] = useState<ProductRow[]>([]);
  const [editing, setEditing] = useState<Partial<ProductRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  const refresh = async () => {
    if (!designer) return;
    const { data } = await supabase.from("products")
      .select("id, name, slug, world, price, description, tags, image_url, status")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as ProductRow[]);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designer?.id]);

  const startNew = () => setEditing({ world: "Mode", status: "draft", price: 0, tags: [], name: "", description: "" });

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
      description: editing.description ?? null,
      tags: editing.tags ?? [],
      image_url: editing.image_url ?? null,
      status: (editing.status ?? "draft") as Status,
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

  if (loading) return <StudioShell title="Produkte"><div className="animate-pulse h-64 bg-muted" /></StudioShell>;

  if (!designer) return (
    <StudioShell title="Produkte">
      <p className="text-muted-foreground">Kein Studio-Zugang.</p>
    </StudioShell>
  );

  return (
    <StudioShell title="Produkte" eyebrow="Deine Kollektion">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} Produkte</p>
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
        <ul className="mt-6 divide-y divide-border border border-border bg-card">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-4">
              <div className="h-14 w-14 shrink-0 bg-muted">
                {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover grayscale" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.world} · €{p.price} · {p.status}</p>
              </div>
              <button onClick={() => togglePublish(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
                {p.status === "published" ? "Depublizieren" : "Veröffentlichen"}
              </button>
              <button onClick={() => setEditing(p)} className="text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">Bearbeiten</button>
              <button onClick={() => remove(p)} className="text-[0.62rem] uppercase tracking-[0.28em] text-destructive hover:text-destructive/70">Löschen</button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl border border-border bg-card p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">{editing.id ? "Produkt bearbeiten" : "Neues Produkt"}</h2>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <Field label="Name">
                <input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Welt">
                  <select value={editing.world ?? "Mode"} onChange={(e) => setEditing({ ...editing, world: e.target.value as World })} className="input">
                    <option>Mode</option><option>Interior</option><option>Kunst</option>
                  </select>
                </Field>
                <Field label="Preis (EUR)">
                  <input type="number" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="input" />
                </Field>
              </div>
              <Field label="Beschreibung">
                <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input min-h-24" />
              </Field>
              <Field label="Tags (Komma-getrennt)">
                <input value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} className="input" />
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
                <select value={editing.status ?? "draft"} onChange={(e) => setEditing({ ...editing, status: e.target.value as Status })} className="input">
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

      <style>{`.input { width:100%; border:1px solid hsl(var(--border)); background:hsl(var(--background)); padding: 0.6rem 0.8rem; font-size: 0.9rem; }`}</style>
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
