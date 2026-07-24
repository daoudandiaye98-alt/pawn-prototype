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
  const [form, setForm] = useState({
    story: "",
    quote: "",
    quote_role: "",
    hero_image_url: "",
    banner_url: "",
    portrait_url: "",
    manifesto: "",
    atelier_image_url: "",
    atelier_caption: "",
    collection_title: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!designer) return;
    const d = designer as typeof designer & Partial<typeof form>;
    setForm({
      story: d.story ?? "",
      quote: d.quote ?? "",
      quote_role: d.quote_role ?? "",
      hero_image_url: d.hero_image_url ?? "",
      banner_url: d.banner_url ?? "",
      portrait_url: d.portrait_url ?? "",
      manifesto: d.manifesto ?? "",
      atelier_image_url: d.atelier_image_url ?? "",
      atelier_caption: d.atelier_caption ?? "",
      collection_title: d.collection_title ?? "",
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

  const upload = async (kind: "hero_image_url" | "banner_url" | "portrait_url" | "atelier_image_url", file: File) => {
    if (!user) return;
    const path = `${user.id}/brand/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error } = await supabase.storage.from("designer-media").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
    setForm((f) => ({ ...f, [kind]: data?.signedUrl ?? "" }));
  };

  if (loading) return <StudioShell title="Retrospektive"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Retrospektive"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Retrospektive" eyebrow={`Öffentlich unter /designer/${designer.slug}`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="editorial-eyebrow">Porträt & Story</p>
          <Field label="Story · für den Katalog">
            <textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} className="input min-h-40" />
          </Field>

          <p className="editorial-eyebrow pt-4">Manifest & Zitat</p>
          <Field label="Manifest / Zitat (groß gesetzt)">
            <textarea value={form.manifesto} onChange={(e) => setForm({ ...form, manifesto: e.target.value })} className="input min-h-32" placeholder="Ein Satz, der eure Handschrift auf den Punkt bringt." />
          </Field>
          <Field label="Kurz-Zitat (optional, zusätzlich)">
            <textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} className="input min-h-20" />
          </Field>
          <Field label="Signatur · Autor:in / Rolle">
            <input value={form.quote_role} onChange={(e) => setForm({ ...form, quote_role: e.target.value })} className="input" />
          </Field>

          <p className="editorial-eyebrow pt-4">Kollektion</p>
          <Field label={"Kollektionstitel (z.B. \u201eAusgabe 07 — Marmor\u201c)"}>
            <input value={form.collection_title} onChange={(e) => setForm({ ...form, collection_title: e.target.value })} className="input" />
          </Field>

          <p className="editorial-eyebrow pt-4">Atelier</p>
          <Field label={"Atelier-Caption (z.B. \u201eBerlin · 06:14 Uhr\u201c)"}>
            <input value={form.atelier_caption} onChange={(e) => setForm({ ...form, atelier_caption: e.target.value })} className="input" />
          </Field>
        </div>
        <div className="space-y-6">
          <ImageField label="Header-/Porträtbild" url={form.portrait_url || form.hero_image_url} onUpload={(f) => upload("portrait_url", f)} />
          <ImageField label="Hero-Bild (alternativer Header)" url={form.hero_image_url} onUpload={(f) => upload("hero_image_url", f)} />
          <ImageField label="Atelier-Bild (Parallax)" url={form.atelier_image_url} onUpload={(f) => upload("atelier_image_url", f)} />
          <ImageField label="Banner" url={form.banner_url} onUpload={(f) => upload("banner_url", f)} />
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <button onClick={save} disabled={busy} className="border border-accent bg-accent px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
          {busy ? "…" : "Speichern"}
        </button>
      </div>

      <ImageUsageConsent />

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

function ImageUsageConsent() {
  const { user } = useAuth();
  const [state, setState] = useState<{ contractId: string | null; accepted: boolean; revoked: boolean; loading: boolean }>({ contractId: null, accepted: false, revoked: false, loading: true });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: cv } = await supabase.from("contract_versions").select("id").eq("kind", "image_usage").order("version", { ascending: false }).limit(1).maybeSingle();
    if (!cv) { setState({ contractId: null, accepted: false, revoked: false, loading: false }); return; }
    const { data: cons } = await supabase.from("designer_consents").select("id, revoked_at").eq("user_id", user.id).eq("contract_version_id", cv.id).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
    setState({ contractId: cv.id, accepted: !!cons, revoked: !!cons?.revoked_at, loading: false });
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const accept = async () => {
    if (!user || !state.contractId) return;
    setBusy(true);
    const { error } = await supabase.from("designer_consents").insert({
      user_id: user.id, contract_version_id: state.contractId, checksum_at_accept: "studio_accept", user_agent: navigator.userAgent,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from("domain_events").insert({ type: "designer.consent_accepted", actor: user.id, payload: { kind: "image_usage" } } as never);
    toast.success("Einwilligung erteilt.");
    void load();
  };
  const revoke = async () => {
    if (!user || !state.contractId) return;
    setBusy(true);
    const { error } = await supabase.from("designer_consents")
      .update({ revoked_at: new Date().toISOString(), revoke_reason: "studio_revoke" } as never)
      .eq("user_id", user.id).eq("contract_version_id", state.contractId).is("revoked_at", null);
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from("domain_events").insert({ type: "consent.revoked", actor: user.id, payload: { kind: "image_usage" } } as never);
    toast.message("Einwilligung widerrufen. Laufende Kampagnen mit diesen Bildern werden pausiert.");
    void load();
  };

  if (state.loading || !state.contractId) return null;
  const active = state.accepted && !state.revoked;

  return (
    <section className="mt-12 border border-border bg-card p-6">
      <p className="editorial-eyebrow">Bildnutzung · Einwilligung</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Deine Zustimmung erlaubt PAWN, die von dir eingereichten Bilder für Ausstellungs- und Werbezwecke auf pawn.com und in PAWN-Kanälen zu verwenden. Bildrechte bleiben bei dir. Widerruf jederzeit — laufende Kampagnen mit diesen Bildern werden dann pausiert.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <span className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.62rem] uppercase tracking-[0.28em] ${active ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
          {active ? "Aktiv" : state.revoked ? "Widerrufen" : "Nicht erteilt"}
        </span>
        {active ? (
          <button type="button" disabled={busy} onClick={revoke} className="border border-destructive px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-destructive disabled:opacity-50">Widerrufen</button>
        ) : (
          <button type="button" disabled={busy} onClick={accept} className="border border-accent bg-accent px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">Zustimmen</button>
        )}
      </div>
    </section>
  );
}
