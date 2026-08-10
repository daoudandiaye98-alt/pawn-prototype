import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Upload, Loader2, X } from "lucide-react";
import { z } from "zod";
import { PublicHeader } from "@/components/pawn/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { readLeadRef, clearLeadRef, readRefCode, clearRefCode } from "@/features/acquisition/leadAttribution";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n";
import {
  DISCIPLINES,
  DISCIPLINE_LIST,
  parseDiscipline,
  type Discipline,
  type DisciplineId,
} from "@/features/apply/disciplines";

const DRAFT_KEY = "pawn.apply.draft";

/** PART 40 WP2 "Sprachheilung": Zod-Schemas brauchen die aktuelle t()-Funktion für ihre
 * Fehlermeldungen — deshalb Fabrikfunktionen statt statischer Objekte. */
function makeAccountSchema(t: (k: string) => string) {
  return z.object({
    displayName: z.string().trim().min(2, t("apply.zod.nameRequired")).max(120),
    email: z.string().trim().email(t("apply.zod.emailInvalid")).max(255),
    password: z.string().min(8, t("apply.zod.passwordShort")),
  });
}
function makeHouseSchema(t: (k: string) => string) {
  return z.object({
    brandName: z.string().trim().min(2, t("apply.zod.brandNameRequired")).max(120),
    location: z.string().trim().min(2, t("apply.zod.locationRequired")).max(120),
    country: z.string().trim().min(2, t("apply.zod.countryRequired")).max(120),
  });
}
function makeWorkSchema(t: (k: string) => string) {
  return z.object({
    story: z.string().trim().min(30, t("apply.zod.storyShort")),
    tags: z.string().trim().min(2, t("apply.zod.tagsRequired")),
  });
}

const STEP_KEYS = ["apply.step.konto", "apply.step.welt", "apply.step.haus", "apply.step.arbeit", "apply.step.vertraege", "apply.step.absenden"] as const;
const STEP_MINUTES = [3, 1, 2, 4, 2, 1];
const STEP_WHY_KEYS = ["apply.stepWhy.0", "apply.stepWhy.1", "apply.stepWhy.2", "apply.stepWhy.3", "apply.stepWhy.4", "apply.stepWhy.5"];

/** Übersetzte Sicht auf eine Disziplin — disciplines.ts selbst bleibt deutsch (dort stehen
 * nur die technischen Schlüssel), die sichtbaren Texte kommen für Apply.tsx aus dem Wörterbuch. */
function translateDiscipline(t: (k: string, vars?: Record<string, string | number>) => string, d: Discipline) {
  return {
    id: d.id,
    label: t(`apply.discipline.${d.id}.label`),
    tagline: t(`apply.discipline.${d.id}.tagline`),
    portfolioHint: t(`apply.discipline.${d.id}.portfolioHint`),
    tagExample: t(`apply.discipline.${d.id}.tagExample`),
    fields: d.fields.map((f) => ({
      key: f.key,
      label: t(`apply.discipline.${d.id}.field.${f.key}.label`),
      placeholder: t(`apply.discipline.${d.id}.field.${f.key}.placeholder`),
      hint: t(`apply.discipline.${d.id}.field.${f.key}.hint`),
    })),
  };
}
type TranslatedDiscipline = ReturnType<typeof translateDiscipline>;

interface ContractRow {
  id: string;
  kind: string;
  version: number;
  title: string;
  body_markdown: string;
  body_markdown_en: string | null;
  checksum: string;
}

interface FormState {
  email: string;
  password: string;
  displayName: string;
  brandName: string;
  legalName: string;
  location: string;
  country: string;
  website: string;
  instagram: string;
  story: string;
  tags: string;
  productionStatus: string;
}

const initial: FormState = {
  email: "", password: "", displayName: "",
  brandName: "", legalName: "", location: "", country: "",
  website: "", instagram: "",
  story: "", tags: "", productionStatus: "",
};

interface Draft {
  data: Omit<FormState, "password">;
  discipline: DisciplineId | null;
  extra: Record<string, string>;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

const Apply = () => {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const { t, locale, setLocale } = useI18n();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormState>(initial);
  const [discipline, setDiscipline] = useState<DisciplineId | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [portfolio, setPortfolio] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const accountSchema = useMemo(() => makeAccountSchema(t), [t]);
  const houseSchema = useMemo(() => makeHouseSchema(t), [t]);
  const workSchema = useMemo(() => makeWorkSchema(t), [t]);
  const STEPS = useMemo(() => STEP_KEYS.map((k) => t(k)), [t]);
  const STEP_WHY = useMemo(() => STEP_WHY_KEYS.map((k) => t(k)), [t]);

  const rawWorld: Discipline | null = discipline ? DISCIPLINES[discipline] : null;
  const world: TranslatedDiscipline | null = useMemo(
    () => (rawWorld ? translateDiscipline(t, rawWorld) : null),
    [rawWorld, t],
  );

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((prev) => ({ ...prev, [k]: v }));

  // Zwischenstand laden (ohne Passwort)
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setData((prev) => ({ ...prev, ...draft.data }));
      setExtra(draft.extra ?? {});
      if (draft.discipline) setDiscipline(draft.discipline);
    }
    const fromUrl = parseDiscipline(params.get("welt"));
    if (fromUrl) setDiscipline(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PART 40 WP2 "Sprachheilung": Initialsprache aus dem gespeicherten Ref-Code-Lead (falls
  // vorhanden) — sonst bleibt es bei Browser-Erkennung/manuellem Toggle aus dem I18nProvider.
  useEffect(() => {
    const code = readRefCode();
    if (!code) return;
    (async () => {
      const { data: rows } = await supabase.rpc("get_lead_invitation", { _ref_code: code });
      const row = (rows as { language: string | null }[] | null)?.[0];
      if (row?.language === "en" || row?.language === "de") setLocale(row.language as Locale);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zwischenstand sichern (niemals das Passwort)
  useEffect(() => {
    if (submitted) return;
    const { password: _pw, ...rest } = data;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: rest, discipline, extra } satisfies Draft));
    } catch {
      /* Speicher voll oder gesperrt — nicht kritisch */
    }
  }, [data, discipline, extra, submitted]);

  useEffect(() => {
    (async () => {
      // WP1 "Hochtouren": nur die zwei bewerbungsrelevanten Vertragsarten (Hauptvertrag +
      // Haus-Ordnung) — Revenue-Share, Bildnutzung, KI-Nutzungsrechte und das Ranking gehören
      // ins Studio-Onboarding NACH der Annahme, nicht vor die Bewerbung.
      const { data: rows } = await supabase
        .from("contract_versions")
        .select("id, kind, version, title, body_markdown, body_markdown_en, checksum")
        .in("kind", ["designer", "designer_terms"])
        .is("effective_to", null)
        .order("version", { ascending: false });
      const latest = new Map<string, ContractRow>();
      (rows ?? []).forEach((r) => { if (!latest.has(r.kind)) latest.set(r.kind, r); });
      setContracts(Array.from(latest.values()));
    })();
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    setStep((s) => (s === 0 ? 1 : s));
    (async () => {
      const { data: app } = await supabase
        .from("designer_applications")
        .select("status, brand_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (app) setExistingStatus(app.status);
    })();
  }, [user, loading]);

  const allContractsAccepted = contracts.length > 0 && contracts.every((c) => accepted[c.id]);

  const minutesLeft = useMemo(
    () => STEP_MINUTES.slice(step).reduce((a, b) => a + b, 0),
    [step],
  );

  function validateStep(current: number): boolean {
    setFieldError(null);
    let message: string | null = null;
    if (current === 0 && !user) {
      const r = accountSchema.safeParse(data);
      if (!r.success) message = r.error.issues[0]?.message ?? null;
    } else if (current === 1) {
      if (!discipline) message = t("apply.zod.disciplineRequired");
    } else if (current === 2) {
      const r = houseSchema.safeParse(data);
      if (!r.success) message = r.error.issues[0]?.message ?? null;
    } else if (current === 3) {
      const r = workSchema.safeParse({ story: data.story, tags: data.tags });
      if (!r.success) message = r.error.issues[0]?.message ?? null;
      else if (portfolio.length < 3) message = t("apply.zod.portfolioMin");
    } else if (current === 4 && !allContractsAccepted) {
      message = t("apply.zod.contractsRequired");
    }
    if (message) {
      setFieldError(message);
      toast.error(message);
      return false;
    }
    return true;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function back() {
    setFieldError(null);
    setStep((s) => Math.max(s - 1, user ? 1 : 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPortfolio(userId: string): Promise<string[]> {
    const paths: string[] = [];
    for (const file of portfolio) {
      const path = `${userId}/portfolio/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("designer-applications")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  }

  /** Disziplin-Antworten hängen wir lesbar an die Story — kein Schema-Eingriff nötig. */
  function composedStory(): string {
    if (!world) return data.story;
    const lines = world.fields
      .filter((f) => extra[f.key]?.trim())
      .map((f) => `${f.label} ${extra[f.key].trim()}`);
    return lines.length ? `${data.story}\n\n${lines.join("\n")}` : data.story;
  }

  async function submit() {
    if (!allContractsAccepted) {
      toast.error(t("apply.zod.contractsRequired"));
      return;
    }
    setBusy(true);
    try {
      let portfolioPaths: string[] = [];
      if (user && portfolio.length > 0) {
        portfolioPaths = await uploadPortfolio(user.id).catch((e) => {
          toast.error(t("apply.toast.uploadFailed", { error: e.message }));
          return [];
        });
      }

      const styleTags = data.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
      const payload = {
        email: user ? undefined : data.email,
        password: user ? undefined : data.password,
        displayName: data.displayName || data.brandName,
        brandName: data.brandName,
        legalName: data.legalName || undefined,
        location: data.location || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
        instagram: data.instagram || undefined,
        story: composedStory() || undefined,
        // Kanonischer (deutscher) Weltname geht ins Backend — Matching/Kategorisierung
        // erwartet "Mode"/"Interior"/"Kunst", unabhängig von der Anzeigesprache.
        tags: rawWorld ? [rawWorld.label, ...styleTags] : styleTags,
        productionStatus: data.productionStatus || extra.fertigung || extra.auflage || undefined,
        portfolioPaths,
        acceptedContractIds: contracts.filter((c) => accepted[c.id]).map((c) => c.id),
        acquisitionLeadId: readLeadRef() ?? undefined,
        ref: readRefCode() ?? undefined,
      };

      const { data: res, error } = await supabase.functions.invoke("submit-application", { body: payload });
      if (error) {
        toast.error(error.message);
        setBusy(false);
        return;
      }
      const r = res as { ok?: boolean; error?: string; needs_email_confirmation?: boolean } | null;
      if (!r?.ok) {
        toast.error(r?.error ?? t("apply.toast.submitFailed"));
        setBusy(false);
        return;
      }
      if (r.needs_email_confirmation) {
        toast.success(t("apply.toast.submittedNeedsConfirm"));
      } else {
        toast.success(t("apply.toast.submitted"));
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* egal */ }
      clearLeadRef();
      clearRefCode();
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("apply.toast.unknownError"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
        <aside className="relative hidden flex-col justify-between border-r border-border bg-foreground p-12 text-background lg:flex">
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-background/60">{t("apply.aside.eyebrow")}</p>
          <div>
            <h1 className="font-serif text-6xl font-light leading-[0.92] xl:text-7xl">
              {t("apply.aside.title1")}<br />
              <em>{t("apply.aside.title2")}</em>
            </h1>
            <p className="mt-6 max-w-md text-background/70">
              {world
                ? t("apply.aside.introWithWorld", { tagline: world.tagline })
                : t("apply.aside.introNoWorld")}
            </p>
          </div>
          <ol className="space-y-2 text-xs uppercase tracking-[0.22em] text-background/50">
            <li>{t("apply.aside.point1")}</li>
            <li>{t("apply.aside.point2")}</li>
            <li>{t("apply.aside.point3")}</li>
          </ol>
        </aside>

        <section className="p-6 md:p-12">
          <div className="mx-auto w-full max-w-xl">
            <Link to="/apply" className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
              {t("apply.backToOverview")}
            </Link>

            {submitted ? (
              <SuccessState />
            ) : existingStatus && existingStatus !== "draft" ? (
              <ExistingState status={existingStatus} />
            ) : (
              <>
                <Progress current={step} minutesLeft={minutesLeft} steps={STEPS} />

                <div className="mt-8 border border-border bg-card p-6 md:p-8">
                  <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
                    {t("apply.stepOf", { current: step + 1, total: STEPS.length })}
                  </p>
                  <h2 className="mt-2 font-serif text-3xl font-light">{STEPS[step]}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{STEP_WHY[step]}</p>

                  <div className="mt-8 space-y-5">
                    {step === 0 && (
                      <>
                        <Field id="displayName" label={t("apply.field.displayName.label")} value={data.displayName} onChange={(v) => update("displayName", v)} hint={t("apply.field.displayName.hint")} />
                        <Field id="email" type="email" label={t("apply.field.email.label")} value={data.email} onChange={(v) => update("email", v)} hint={t("apply.field.email.hint")} />
                        <Field id="password" type="password" label={t("apply.field.password.label")} value={data.password} onChange={(v) => update("password", v)} hint={t("apply.field.password.hint")} />
                      </>
                    )}

                    {step === 1 && (
                      <div className="grid grid-cols-1 gap-3">
                        {DISCIPLINE_LIST.map((rawD) => {
                          const d = translateDiscipline(t, rawD);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              aria-pressed={discipline === d.id}
                              onClick={() => setDiscipline(d.id)}
                              className={cn(
                                "border p-5 text-left transition-colors",
                                discipline === d.id
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border hover:border-foreground",
                              )}
                            >
                              <span className="font-serif text-2xl font-light">{d.label}</span>
                              <span className="mt-1 block text-sm opacity-75">{d.tagline}</span>
                            </button>
                          );
                        })}
                        <p className="text-xs text-muted-foreground">
                          {t("apply.discipline.multiHint")}
                        </p>
                      </div>
                    )}

                    {step === 2 && (
                      <>
                        <Field id="brandName" label={t("apply.field.brandName.label")} value={data.brandName} onChange={(v) => update("brandName", v)} hint={t("apply.field.brandName.hint")} />
                        <Field id="legalName" label={t("apply.field.legalName.label")} value={data.legalName} onChange={(v) => update("legalName", v)} hint={t("apply.field.legalName.hint")} />
                        <Field id="location" label={t("apply.field.location.label")} value={data.location} onChange={(v) => update("location", v)} />
                        <Field id="country" label={t("apply.field.country.label")} value={data.country} onChange={(v) => update("country", v)} placeholder={t("apply.field.country.placeholder")} hint={t("apply.field.country.hint")} />
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="story" className="text-[0.65rem] uppercase tracking-[0.28em]">
                            {t("apply.field.story.label")}
                          </Label>
                          <Textarea
                            id="story"
                            value={data.story}
                            onChange={(e) => update("story", e.target.value)}
                            rows={6}
                            className="rounded-none"
                            placeholder={t("apply.field.story.placeholder")}
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("apply.field.story.hint")}
                          </p>
                        </div>

                        {world?.fields.map((f) => (
                          <Field
                            key={f.key}
                            id={f.key}
                            label={f.label}
                            placeholder={f.placeholder}
                            hint={f.hint}
                            value={extra[f.key] ?? ""}
                            onChange={(v) => setExtra((p) => ({ ...p, [f.key]: v }))}
                          />
                        ))}

                        <Field
                          id="tags"
                          label={t("apply.field.tags.label")}
                          placeholder={world?.tagExample ?? t("apply.field.tags.placeholderFallback")}
                          hint={t("apply.field.tags.hint")}
                          value={data.tags}
                          onChange={(v) => update("tags", v)}
                        />
                        <Field id="website" label={t("apply.field.website.label")} value={data.website} onChange={(v) => update("website", v)} />
                        <Field id="instagram" label={t("apply.field.instagram.label")} value={data.instagram} onChange={(v) => update("instagram", v)} placeholder={t("apply.field.instagram.placeholder")} />

                        <PortfolioUpload files={portfolio} setFiles={setPortfolio} hint={world?.portfolioHint} />
                      </>
                    )}

                    {step === 4 && (
                      <>
                        {contracts.length === 0 && <p className="text-sm text-muted-foreground">{t("apply.contracts.loading")}</p>}
                        {contracts.map((c) => (
                          <div key={c.id} className="border border-border bg-background p-4">
                            <div className="mb-3 flex items-baseline justify-between">
                              <p className="font-serif text-lg">{c.title}</p>
                              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{t("apply.contracts.version", { version: c.version })}</span>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <button type="button" className="text-xs uppercase tracking-[0.22em] text-muted-foreground underline underline-offset-4 hover:text-foreground">
                                  {t("apply.contracts.readFull")}
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-none">
                                <DialogHeader>
                                  <DialogTitle className="font-serif text-2xl">{t("apply.contracts.dialogTitle", { title: c.title, version: c.version })}</DialogTitle>
                                </DialogHeader>
                                <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                  {locale === "en" && c.body_markdown_en ? c.body_markdown_en : c.body_markdown}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-border pt-3 text-sm">
                              <Checkbox
                                checked={!!accepted[c.id]}
                                onCheckedChange={(v) => setAccepted((p) => ({ ...p, [c.id]: !!v }))}
                              />
                              <span>{t("apply.contracts.agreePrefix")}<strong>{c.title}</strong>{t("apply.contracts.agreeSuffix")}</span>
                            </label>
                          </div>
                        ))}
                      </>
                    )}

                    {step === 5 && (
                      <ReviewList
                        data={data}
                        world={world}
                        extra={extra}
                        portfolio={portfolio}
                        accepted={accepted}
                        contracts={contracts}
                      />
                    )}
                  </div>

                  {fieldError && (
                    <p role="alert" className="mt-6 border border-foreground bg-foreground px-4 py-3 text-sm text-background">
                      {fieldError}
                    </p>
                  )}

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={back}
                      disabled={step === (user ? 1 : 0) || busy}
                      className="rounded-none"
                    >
                      {t("common.back")}
                    </Button>
                    {step < STEPS.length - 1 ? (
                      <Button type="button" onClick={next} disabled={busy} className="rounded-none">
                        {t("apply.nav.next")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={submit}
                        disabled={busy || !data.brandName || !allContractsAccepted}
                        className="rounded-none"
                      >
                        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("apply.nav.submitting")}</> : t("apply.nav.submit")}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  {t("apply.draftHint")}
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

function Progress({ current, minutesLeft, steps }: { current: number; minutesLeft: number; steps: string[] }) {
  const { t } = useI18n();
  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
        <span>{steps[current]}</span>
        <span>{t("apply.progress.minutesLeft", { min: minutesLeft })}</span>
      </div>
      <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === current ? "step" : undefined}
            className={cn("h-[3px]", i <= current ? "bg-foreground" : "bg-border")}
          />
        ))}
      </ol>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", placeholder, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[0.65rem] uppercase tracking-[0.28em]">{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="rounded-none" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PortfolioUpload({ files, setFiles, hint }: { files: File[]; setFiles: (f: File[]) => void; hint?: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <Label className="text-[0.65rem] uppercase tracking-[0.28em]">{t("apply.portfolio.label")}</Label>
      <p className="text-xs text-muted-foreground">
        {hint ?? t("apply.portfolio.hintFallback")}
      </p>
      <label className="flex w-full cursor-pointer items-center gap-3 border border-dashed border-border bg-background p-4 text-left text-sm text-muted-foreground hover:border-foreground">
        <Upload className="h-4 w-4" />
        <span>{t("apply.portfolio.choose")}</span>
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            setFiles([...files, ...chosen].slice(0, 8));
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between border border-border bg-background px-3 py-2">
              <span className="truncate">{f.name}</span>
              <button type="button" aria-label={t("apply.portfolio.remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewList({ data, world, extra, portfolio, accepted, contracts }: {
  data: FormState;
  world: TranslatedDiscipline | null;
  extra: Record<string, string>;
  portfolio: File[];
  accepted: Record<string, boolean>;
  contracts: ContractRow[];
}) {
  const { t } = useI18n();
  const empty = t("apply.review.empty");
  const rows: [string, string][] = [
    [t("apply.review.welt"), world?.label ?? empty],
    [t("apply.review.haus"), data.brandName],
    [t("apply.review.rechtsname"), data.legalName],
    [t("apply.review.ort"), `${data.location}${data.country ? `, ${data.country}` : ""}`],
    [t("apply.review.website"), data.website],
    [t("apply.review.instagram"), data.instagram],
    [t("apply.review.stichworte"), data.tags],
    ...(world ? world.fields.map((f) => [f.label, extra[f.key] ?? ""] as [string, string]) : []),
    [t("apply.review.bilder"), t("apply.review.bilderCount", { n: portfolio.length })],
  ];
  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map(([k, v]) => (
        <li key={k} className="grid grid-cols-2 gap-3 py-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="truncate">{v || <em className="text-muted-foreground">{empty}</em>}</span>
        </li>
      ))}
      <li className="grid grid-cols-2 gap-3 py-2">
        <span className="text-muted-foreground">{t("apply.review.vereinbarungen")}</span>
        <span>{t("apply.review.vereinbarungenCount", { accepted: contracts.filter((c) => accepted[c.id]).length, total: contracts.length })}</span>
      </li>
    </ul>
  );
}

function SuccessState() {
  const { t } = useI18n();
  return (
    <div className="mt-12 border border-border bg-card p-8 text-center md:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-foreground">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-serif text-4xl font-light">{t("apply.success.title")}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {t("apply.success.body")}
      </p>
      <div className="mx-auto mt-8 max-w-md border border-border p-5 text-left text-sm text-muted-foreground">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-foreground">{t("apply.success.untilThenTitle")}</p>
        <ul className="mt-3 space-y-2">
          <li>{t("apply.success.point1")}</li>
          <li>{t("apply.success.point2")}</li>
          <li>{t("apply.success.point3")}</li>
        </ul>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="outline" className="rounded-none">
          <Link to="/">{t("apply.toHome")}</Link>
        </Button>
      </div>
    </div>
  );
}

function ExistingState({ status }: { status: string }) {
  const { t } = useI18n();
  const known = ["submitted", "in_review", "approved", "rejected", "archived"];
  const title = known.includes(status) ? t(`apply.existing.status.${status}.title`) : status;
  const body = known.includes(status) ? t(`apply.existing.status.${status}.body`) : "";
  return (
    <div className="mt-12 border border-border bg-card p-8 text-center md:p-12">
      <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">{t("apply.existing.eyebrow")}</p>
      <h2 className="mt-2 font-serif text-3xl font-light">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild className="rounded-none"><Link to="/">{t("apply.toHome")}</Link></Button>
        {status === "approved" && (
          <Button asChild variant="outline" className="rounded-none"><Link to="/studio">{t("apply.existing.toStudio")}</Link></Button>
        )}
      </div>
    </div>
  );
}

export default Apply;
