import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function StudioBrand() {
  const { designer, loading, refresh } = useMyDesigner();
  const { user } = useAuth();
  const [form, setForm] = useState({ story: "", quote: "", quote_role: "", hero_image_url: "", banner_url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!designer) return;
    setForm({
      story: designer.story ?? "",
      quote: designer.quote ?? "",
      quote_role: designer.quote_role ?? "",
      hero_image_url: designer.hero_image_url ?? "",
      banner_url: designer.banner_url ?? "",
    });
  }, [designer]);

  const save = async () => {
    if (!designer) return;
    setBusy(true);
    const { error } = await supabase.from("designers").update(form).eq("id", designer.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Brand-Page gespeichert.");
    void refresh();
  };

  const upload = async (kind: "hero_image_url" | "banner_url", file: File) => {
    if (!user) return;
    const path = `${user.id}/brand/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("designer-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    setForm((f) => ({ ...f, [kind]: data?.signedUrl ?? "" }));
  };

  if (loading) return <StudioShell title="Brand-Page"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Brand-Page"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Brand-Page" eyebrow={`Öffentlich unter /designer/${designer.slug}`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Field label="Story">
            <textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} className="input min-h-40" />
          </Field>
          <Field label="Zitat">
            <textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} className="input min-h-20" />
          </Field>
          <Field label="Zitat · Autor:in">
            <input value={form.quote_role} onChange={(e) => setForm({ ...form, quote_role: e.target.value })} className="input" />
          </Field>
        </div>
        <div className="space-y-6">
          <ImageField label="Hero-Bild" url={form.hero_image_url} onUpload={(f) => upload("hero_image_url", f)} />
          <ImageField label="Banner" url={form.banner_url} onUpload={(f) => upload("banner_url", f)} />
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <button onClick={save} disabled={busy} className="border border-accent bg-accent px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
          {busy ? "…" : "Speichern"}
        </button>
      </div>

      <style>{`.input { width:100%; border:1px solid hsl(var(--border)); background:hsl(var(--background)); padding: 0.6rem 0.8rem; font-size: 0.9rem; }`}</style>
    </StudioShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="editorial-eyebrow">{label}</span><div className="mt-2">{children}</div></label>;
}

function ImageField({ label, url, onUpload }: { label: string; url: string; onUpload: (f: File) => void }) {
  return (
    <div>
      <p className="editorial-eyebrow">{label}</p>
      <div className="mt-2 aspect-[16/9] w-full border border-border bg-muted">
        {url && <img src={url} alt="" className="h-full w-full object-cover grayscale" />}
      </div>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 border border-dashed border-border px-4 py-2 text-xs">
        <Upload className="h-3 w-3" /> Neu hochladen
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
    </div>
  );
}
