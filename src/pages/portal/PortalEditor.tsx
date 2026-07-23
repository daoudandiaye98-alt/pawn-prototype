import { useState } from "react";
import { Eye, Upload, Send } from "lucide-react";
import { PortalShell } from "@/components/pawn/PortalShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ProductImage } from "@/components/pawn/ProductImage";

const PortalEditor = () => {
  const [name, setName] = useState("Y/PROJECT");
  const [slogan, setSlogan] = useState("Architecture of the asymmetric.");
  const [bio, setBio] = useState("A Paris-based studio building garments around the tension between tailoring and deconstruction.");
  const [website, setWebsite] = useState("yproject.fr");
  const [instagram, setInstagram] = useState("@yproject");

  return (
    <PortalShell eyebrow="Editor" title="Profil bearbeiten">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr_300px]">
        {/* Form */}
        <section className="border border-border bg-card p-6">
          <p className="editorial-eyebrow">Designer Information</p>
          <div className="mt-6 space-y-4">
            <Field label="Designer Name" v={name} set={setName} />
            <Field label="Slogan" v={slogan} set={setSlogan} />
            <div className="space-y-2">
              <Label className="editorial-eyebrow">Biography</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} className="rounded-none" />
            </div>
            <Field label="Website" v={website} set={setWebsite} />
            <Field label="Instagram" v={instagram} set={setInstagram} />
          </div>
          <p className="editorial-eyebrow mt-8">Attribute</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Avant-Tailoring", "Brutalist", "Romantic", "Unisex", "Paris"].map((t) => (
              <span key={t} className="border border-border bg-background px-3 py-1 text-xs uppercase tracking-[0.18em]">{t}</span>
            ))}
          </div>
        </section>

        {/* Live preview */}
        <section className="border border-border bg-card">
          <div className="border-b border-border px-6 py-3">
            <p className="editorial-eyebrow">Live preview</p>
          </div>
          <div className="relative">
            <ProductImage seed="y-project_editor_hero" className="h-72 w-full" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-6 text-primary-foreground">
              <p className="text-[0.65rem] uppercase tracking-[0.28em] text-primary-foreground/60">Paris, France</p>
              <h2 className="mt-2 font-serif text-4xl">{name}</h2>
              <p className="mt-1 text-sm text-primary-foreground/80">{slogan}</p>
            </div>
          </div>
          <div className="p-6">
            <p className="editorial-eyebrow">The story</p>
            <p className="mt-2 text-sm text-foreground/80">{bio}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[["12", "Collections"], ["86", "Products"], ["184K", "Followers"], ["2021", "Since"]].map(([v, l]) => (
                <div key={l} className="border border-border p-3">
                  <p className="font-serif text-xl">{v}</p>
                  <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Media + publish */}
        <aside className="space-y-4">
          <div className="border border-border bg-card p-6">
            <p className="editorial-eyebrow">Media</p>
            <div className="mt-4 space-y-3">
              <UploadTile label="Banner image" />
              <UploadTile label="Profile image" />
              <UploadTile label="Showreel video" />
            </div>
          </div>
          <div className="border border-border bg-card p-6">
            <p className="editorial-eyebrow">Publishing</p>
            <p className="mt-2 text-xs text-muted-foreground">Letzter Stand: vor 4 Minuten</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-none" onClick={() => toast("Vorschau geöffnet")}>
                <Eye className="mr-2 h-4 w-4" /> Vorschau
              </Button>
              <Button className="rounded-none" onClick={() => toast.success("Veröffentlicht")}>
                <Send className="mr-2 h-4 w-4" /> Veröffentlichen
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </PortalShell>
  );
};

function Field({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="editorial-eyebrow">{label}</Label>
      <Input value={v} onChange={(e) => set(e.target.value)} className="rounded-none" />
    </div>
  );
}

function UploadTile({ label }: { label: string }) {
  return (
    <button className="flex w-full items-center gap-3 border border-dashed border-border p-3 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground hover:border-foreground hover:text-foreground">
      <Upload className="h-4 w-4" />
      {label}
    </button>
  );
}

export default PortalEditor;
