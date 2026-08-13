import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { FlaechenTabs } from "@/components/pawn/FlaechenTabs";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function StudioBrand() {
  const { t } = useI18n();
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
    toast.success(t("studio.brand.toast.saved"));
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

  if (loading) return <StudioShell title={t("studioShell.nav.doppelseite")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.doppelseite")}><p className="text-muted-foreground">{t("studio.brand.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studioShell.nav.doppelseite")} eyebrow={t("studio.brand.publicUnder", { slug: designer.slug })}>
      <FlaechenTabs tabs={[
        { label: t("studio.tabs.seite"), to: "/studio/doppelseite" },
        { label: t("studio.tabs.stil"), to: "/studio/doppelseite/stil" },
      ]} />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="editorial-eyebrow">{t("studio.brand.section.portraitStory")}</p>
          <Field label={t("studio.brand.field.story")}>
            <textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} className="input min-h-40" />
          </Field>

          <p className="editorial-eyebrow pt-4">{t("studio.brand.section.manifestoQuote")}</p>
          <Field label={t("studio.brand.field.manifesto")}>
            <textarea value={form.manifesto} onChange={(e) => setForm({ ...form, manifesto: e.target.value })} className="input min-h-32" placeholder={t("studio.brand.field.manifestoPlaceholder")} />
          </Field>
          <Field label={t("studio.brand.field.quote")}>
            <textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} className="input min-h-20" />
          </Field>
          <Field label={t("studio.brand.field.quoteRole")}>
            <input value={form.quote_role} onChange={(e) => setForm({ ...form, quote_role: e.target.value })} className="input" />
          </Field>

          <p className="editorial-eyebrow pt-4">{t("studio.brand.section.collection")}</p>
          <Field label={t("studio.brand.field.collectionTitle")}>
            <input value={form.collection_title} onChange={(e) => setForm({ ...form, collection_title: e.target.value })} className="input" />
          </Field>

          <p className="editorial-eyebrow pt-4">{t("studio.brand.section.atelier")}</p>
          <Field label={t("studio.brand.field.atelierCaption")}>
            <input value={form.atelier_caption} onChange={(e) => setForm({ ...form, atelier_caption: e.target.value })} className="input" />
          </Field>
        </div>
        <div className="space-y-6">
          <ImageField label={t("studio.brand.image.portrait")} url={form.portrait_url || form.hero_image_url} onUpload={(f) => upload("portrait_url", f)} />
          <ImageField label={t("studio.brand.image.hero")} url={form.hero_image_url} onUpload={(f) => upload("hero_image_url", f)} />
          <ImageField label={t("studio.brand.image.atelier")} url={form.atelier_image_url} onUpload={(f) => upload("atelier_image_url", f)} />
          <ImageField label={t("studio.brand.image.banner")} url={form.banner_url} onUpload={(f) => upload("banner_url", f)} />
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <button onClick={save} disabled={busy} className="border border-accent bg-accent px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
          {busy ? "…" : t("common.save")}
        </button>
      </div>

      <div className="mt-12 border-[1.5px] border-black bg-white p-6 md:p-8">
        <p className="editorial-eyebrow text-black/50">{t("studio.brand.dna.eyebrow")}</p>
        <h3 className="mt-1 font-serif text-xl leading-tight text-black">{t("studio.brand.dna.heading")}</h3>
        <p className="mt-2 max-w-xl text-sm text-black/60">
          {t("studio.brand.dna.description")}
        </p>
        <Link to="/studio/dna" className="mt-4 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
          {t("studio.brand.dna.link")}
        </Link>
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
  const { t } = useI18n();
  return (
    <div>
      <p className="editorial-eyebrow">{label}</p>
      <div className="mt-2 aspect-[16/9] w-full border border-border bg-muted">
        {url && <img src={url} alt="" className="h-full w-full object-cover grayscale" />}
      </div>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 border border-dashed border-border px-4 py-2 text-xs">
        <Upload className="h-3 w-3" /> {t("studio.brand.image.uploadNew")}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
    </div>
  );
}

function ImageUsageConsent() {
  const { t } = useI18n();
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
    toast.success(t("studio.brand.consent.toastAccepted"));
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
    toast.message(t("studio.brand.consent.toastRevoked"));
    void load();
  };

  if (state.loading || !state.contractId) return null;
  const active = state.accepted && !state.revoked;

  return (
    <section className="mt-12 border border-border bg-card p-6">
      <p className="editorial-eyebrow">{t("studio.brand.consent.eyebrow")}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {t("studio.brand.consent.description")}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <span className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.62rem] uppercase tracking-[0.28em] ${active ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-foreground" : "border border-muted-foreground"}`} />
          {active ? t("studio.brand.consent.active") : state.revoked ? t("studio.brand.consent.revoked") : t("studio.brand.consent.notGranted")}
        </span>
        {active ? (
          <button type="button" disabled={busy} onClick={revoke} className="border border-destructive px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-destructive disabled:opacity-50">{t("studio.brand.consent.revoke")}</button>
        ) : (
          <button type="button" disabled={busy} onClick={accept} className="border border-accent bg-accent px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">{t("studio.brand.consent.accept")}</button>
        )}
      </div>
    </section>
  );
}
