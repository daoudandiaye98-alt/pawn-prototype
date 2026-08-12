import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Upload, Loader2, X } from "lucide-react";
import { z } from "zod";
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
import { useI18n, type Locale } from "@/lib/i18n";
import {
  DISCIPLINES,
  DISCIPLINE_LIST,
  parseDiscipline,
  type Discipline,
  type DisciplineId,
} from "@/features/apply/disciplines";

/**
 * PART 50 WP3 "Die Aufnahme": das Formular übernimmt die Bildsprache der Platte
 * (src/features/acquisition/Platte.tsx) — dunkel, ruhig, ein Umblättern statt ein Seitenwechsel.
 * Die Farb-/Schrift-Konstanten sind bewusst hier dupliziert statt aus Platte.tsx importiert: die
 * Platte selbst ist laut Auftrag "nicht anfassen", ein Import hätte eine Abhängigkeit zwischen
 * zwei unabhängigen Flächen geschaffen, wo eine lokale Kopie genügt.
 */
const COL = {
  grund: "#0A0A0B",
  panel: "#141416",
  schrift: "#F2F0EA",
  sekundaer: "#89857D",
  linie: "#26262A",
  akzent: "#A8BEB2",
};
const DISPLAY = '"Fraunces", Georgia, serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SANS = "Inter, system-ui, sans-serif";

function useSchriften() {
  useEffect(() => {
    const href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);
}

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

type StepKey = "konto" | "welt" | "haus" | "arbeit" | "vertraege" | "absenden";
const ALL_STEP_KEYS: StepKey[] = ["konto", "welt", "haus", "arbeit", "vertraege", "absenden"];
const STEP_LABEL_KEY: Record<StepKey, string> = {
  konto: "apply.step.konto", welt: "apply.step.welt", haus: "apply.step.haus",
  arbeit: "apply.step.arbeit", vertraege: "apply.step.vertraege", absenden: "apply.step.absenden",
};
const STEP_WHY_KEY: Record<StepKey, string> = {
  konto: "apply.stepWhy.0", welt: "apply.stepWhy.1", haus: "apply.stepWhy.2",
  arbeit: "apply.stepWhy.3", vertraege: "apply.stepWhy.4", absenden: "apply.stepWhy.5",
};
const STEP_MINUTES_KEY: Record<StepKey, number> = {
  konto: 3, welt: 1, haus: 2, arbeit: 4, vertraege: 2, absenden: 1,
};
/** PART 50 WP3: Bestärkung beim Ankommen auf dem Schritt — "konto" hat keine, weil es der
 * allererste Schritt ist (nichts, wovon man gerade "ankommt"). */
const STEP_ARRIVAL_KEY: Partial<Record<StepKey, string>> = {
  welt: "apply.arrival.welt", haus: "apply.arrival.haus", arbeit: "apply.arrival.arbeit",
  vertraege: "apply.arrival.vertraege", absenden: "apply.arrival.absenden",
};

type UploadState = "idle" | "compressing" | "uploading" | "done" | "error";

/** PART 40 WP3 "Formular beschleunigen": Bilder client-seitig auf ~1600px längste Kante /
 * ~85% Qualität verkleinern, bevor sie hochgeladen werden — WebP wenn der Browser es
 * unterstützt, sonst JPEG. Schlägt die Verkleinerung fehl, geht das Original hoch statt
 * die Bewerbung abzubrechen. */
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", 0.85);
  let ext = "webp";
  if (!blob) {
    blob = await toBlob("image/jpeg", 0.85);
    ext = "jpg";
  }
  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}

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

/** PART 50 WP3: pro Feld statt einem einzigen Balken — jede Zeile sagt, wofür die Angabe
 * gebraucht wird (siehe die überarbeiteten apply.zod.*-Texte). */
type FieldErrors = Partial<Record<string, string>>;

const Apply = () => {
  useSchriften();
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
  const [uploadStates, setUploadStates] = useState<UploadState[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  // PART 40 WP3 "Formular beschleunigen": true, sobald die Welt aus einem Ref-Code-Lead
  // vorbefüllt wurde — dann fällt der Welt-Schritt aus der Strecke (weiterhin in der
  // Übersicht änderbar), und refPrefillDone entkoppelt den Vorbefüll-Versuch (async) vom
  // Login-Sprung-Effekt weiter unten, damit beide nicht um den Startschritt konkurrieren.
  const [worldPrefilled, setWorldPrefilled] = useState(false);
  const [refPrefillDone, setRefPrefillDone] = useState(false);

  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const accountSchema = useMemo(() => makeAccountSchema(t), [t]);
  const houseSchema = useMemo(() => makeHouseSchema(t), [t]);
  const workSchema = useMemo(() => makeWorkSchema(t), [t]);
  const stepKeys = useMemo(
    () => (worldPrefilled ? ALL_STEP_KEYS.filter((k) => k !== "welt") : ALL_STEP_KEYS),
    [worldPrefilled],
  );
  const STEPS = useMemo(() => stepKeys.map((k) => t(STEP_LABEL_KEY[k])), [stepKeys, t]);
  const STEP_WHY = useMemo(() => stepKeys.map((k) => t(STEP_WHY_KEY[k])), [stepKeys, t]);
  const STEP_MINUTES = useMemo(() => stepKeys.map((k) => STEP_MINUTES_KEY[k]), [stepKeys]);
  const minStep = useMemo(() => (user ? stepKeys.indexOf(worldPrefilled ? "haus" : "welt") : 0), [user, stepKeys, worldPrefilled]);

  const rawWorld: Discipline | null = discipline ? DISCIPLINES[discipline] : null;
  const world: TranslatedDiscipline | null = useMemo(
    () => (rawWorld ? translateDiscipline(t, rawWorld) : null),
    [rawWorld, t],
  );

  // PART 50 WP3: sobald ein Vorname bekannt ist (aus "Dein Name" im ersten Schritt, oder — bei
  // bereits eingeloggten Personen — leer bleibend), wird ab "Dein Haus" jede Ankunfts-Zeile
  // persönlich. Kein Name bekannt → die Zeile bleibt einfach unpersönlich, nie ein Platzhalter.
  const firstName = useMemo(() => {
    const first = data.displayName.trim().split(/\s+/)[0];
    return first && first.length >= 2 ? first : null;
  }, [data.displayName]);
  const greet = firstName ? t("apply.arrival.greet", { name: firstName }) : "";
  const arrivalKey = STEP_ARRIVAL_KEY[stepKeys[step]];
  const arrivalLine = arrivalKey ? `${greet}${t(arrivalKey)}` : null;

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

  // PART 40 WP2 "Sprachheilung" + WP3 "Formular beschleunigen": aus dem gespeicherten
  // Ref-Code-Lead kommen Sprache, Welt und Instagram-Handle vorausgefüllt. Ein vorhandener
  // Entwurf (loadDraft(), synchron statt über React-State gelesen, um kein Race mit dem
  // Draft-Lade-Effekt oben zu riskieren) hat Vorrang — wer schon mittendrin war, wird nicht
  // überschrieben.
  useEffect(() => {
    const code = readRefCode();
    if (!code) { setRefPrefillDone(true); return; }
    const existingDraft = loadDraft();
    (async () => {
      const { data: rows } = await supabase.rpc("get_lead_invitation", { _ref_code: code });
      const row = (rows as { world: string | null; handle: string | null; language: string | null }[] | null)?.[0] ?? null;
      if (row) {
        if (row.language === "en" || row.language === "de") setLocale(row.language as Locale);
        if (!existingDraft?.discipline) {
          const disc = parseDiscipline(row.world);
          if (disc) { setDiscipline(disc); setWorldPrefilled(true); }
        }
        if (row.handle && !existingDraft?.data?.instagram) {
          const handle = `@${row.handle.replace(/^@/, "")}`;
          setData((prev) => (prev.instagram ? prev : { ...prev, instagram: handle }));
        }
      }
      setRefPrefillDone(true);
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
    if (loading || !user || !refPrefillDone) return;
    setStep((s) => (s === 0 ? minStep : s));
    (async () => {
      const { data: app } = await supabase
        .from("designer_applications")
        .select("status, brand_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (app) setExistingStatus(app.status);
    })();
  }, [user, loading, refPrefillDone, minStep]);

  const allContractsAccepted = contracts.length > 0 && contracts.every((c) => accepted[c.id]);

  const minutesLeft = useMemo(
    () => STEP_MINUTES.slice(step).reduce((a, b) => a + b, 0),
    [step, STEP_MINUTES],
  );

  /** PART 50 WP3: baut eine Fehlerkarte je Feld statt eines einzelnen Textes — jedes betroffene
   * Feld zeigt seinen eigenen Hinweis, der erste Grund geht zusätzlich als Toast raus. */
  function validateStep(current: number): boolean {
    const key = stepKeys[current];
    const fieldErrs: FieldErrors = {};
    if (key === "konto" && !user) {
      const r = accountSchema.safeParse(data);
      if (!r.success) for (const issue of r.error.issues) fieldErrs[String(issue.path[0])] = issue.message;
    } else if (key === "welt") {
      if (!discipline) fieldErrs.discipline = t("apply.zod.disciplineRequired");
    } else if (key === "haus") {
      const r = houseSchema.safeParse(data);
      if (!r.success) for (const issue of r.error.issues) fieldErrs[String(issue.path[0])] = issue.message;
    } else if (key === "arbeit") {
      const r = workSchema.safeParse({ story: data.story, tags: data.tags });
      if (!r.success) for (const issue of r.error.issues) fieldErrs[String(issue.path[0])] = issue.message;
      if (portfolio.length < 3) fieldErrs.portfolio = t("apply.zod.portfolioMin");
    } else if (key === "vertraege" && !allContractsAccepted) {
      fieldErrs.contracts = t("apply.zod.contractsRequired");
    }
    setErrors(fieldErrs);
    const first = Object.values(fieldErrs)[0];
    if (first) {
      toast.error(first);
      return false;
    }
    return true;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, minStep));
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }

  /** PART 40 WP3 "Formular beschleunigen": Bilder parallel hochladen (statt nacheinander),
   * pro Bild verkleinern und einen Status führen — ein einzelnes fehlgeschlagenes Bild
   * blockiert nicht mehr die ganze Bewerbung. */
  async function uploadOneImage(userId: string, file: File, index: number): Promise<string | null> {
    setUploadStates((s) => { const next = [...s]; next[index] = "compressing"; return next; });
    let toUpload: File;
    try {
      toUpload = await compressImage(file);
    } catch {
      toUpload = file;
    }
    setUploadStates((s) => { const next = [...s]; next[index] = "uploading"; return next; });
    const ext = toUpload.name.split(".").pop() || "jpg";
    const path = `${userId}/portfolio/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("designer-applications")
      .upload(path, toUpload, { upsert: false });
    setUploadStates((s) => { const next = [...s]; next[index] = error ? "error" : "done"; return next; });
    return error ? null : path;
  }

  async function uploadPortfolio(userId: string): Promise<string[]> {
    setUploadStates(new Array(portfolio.length).fill("idle"));
    const results = await Promise.all(portfolio.map((file, i) => uploadOneImage(userId, file, i)));
    return results.filter((p): p is string => !!p);
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
        try {
          portfolioPaths = await uploadPortfolio(user.id);
        } catch (e) {
          toast.error(t("apply.toast.uploadFailed", { error: e instanceof Error ? e.message : String(e) }));
          portfolioPaths = [];
        }
        const failed = portfolio.length - portfolioPaths.length;
        if (failed > 0 && portfolioPaths.length > 0) {
          toast.error(t("apply.toast.uploadPartialFailed", { failed, total: portfolio.length }));
        }
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

  // refPrefillDone verhindert für eingeloggte Nutzer einen kurzen Aufblitzer des Konto-Schritts,
  // bevor der Ref-Code-Vorbefüll-Versuch (Welt/Sprache/Instagram) abgeschlossen ist.
  if (loading || (user && !refPrefillDone)) return null;

  return (
    <div style={{ background: COL.grund, color: COL.schrift, minHeight: "100vh", fontFamily: SANS, fontWeight: 300 }}>
      <header style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link
          to="/apply"
          style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer, textDecoration: "none" }}
        >
          {t("apply.backToOverview")}
        </Link>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>
          ♟ PAWN
        </span>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 96px" }}>
        {submitted ? (
          <SuccessState brandName={data.brandName} />
        ) : existingStatus && existingStatus !== "draft" ? (
          <ExistingState status={existingStatus} />
        ) : (
          <>
            <Progress current={step} minutesLeft={minutesLeft} steps={STEPS} />

            {arrivalLine && (
              <p style={{ marginTop: 24, fontFamily: DISPLAY, fontSize: 20, color: COL.schrift, lineHeight: 1.4 }}>
                {arrivalLine}
              </p>
            )}

            <div style={{ marginTop: 20, border: `1px solid ${COL.linie}`, background: COL.panel, padding: "28px 22px" }}>
              <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>
                {t("apply.stepOf", { current: step + 1, total: STEPS.length })}
              </p>
              <h2 style={{ marginTop: 8, fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(1.7rem,5vw,2.4rem)", color: COL.schrift }}>
                {STEPS[step]}
              </h2>
              <p style={{ marginTop: 8, fontSize: 14, color: COL.sekundaer, lineHeight: 1.6 }}>{STEP_WHY[step]}</p>

              <div style={{ marginTop: 28, display: "grid", gap: 20 }}>
                {stepKeys[step] === "konto" && (
                  <>
                    <Field id="displayName" label={t("apply.field.displayName.label")} value={data.displayName} onChange={(v) => update("displayName", v)} hint={t("apply.field.displayName.hint")} error={errors.displayName} />
                    <Field id="email" type="email" label={t("apply.field.email.label")} value={data.email} onChange={(v) => update("email", v)} hint={t("apply.field.email.hint")} error={errors.email} />
                    <Field id="password" type="password" label={t("apply.field.password.label")} value={data.password} onChange={(v) => update("password", v)} hint={t("apply.field.password.hint")} error={errors.password} />
                  </>
                )}

                {stepKeys[step] === "welt" && (
                  <DisciplinePicker discipline={discipline} onChange={setDiscipline} error={errors.discipline} />
                )}

                {stepKeys[step] === "haus" && (
                  <>
                    <Field id="brandName" label={t("apply.field.brandName.label")} value={data.brandName} onChange={(v) => update("brandName", v)} hint={t("apply.field.brandName.hint")} error={errors.brandName} />
                    <Field id="legalName" label={t("apply.field.legalName.label")} value={data.legalName} onChange={(v) => update("legalName", v)} hint={t("apply.field.legalName.hint")} />
                    <Field id="location" label={t("apply.field.location.label")} value={data.location} onChange={(v) => update("location", v)} error={errors.location} />
                    <Field id="country" label={t("apply.field.country.label")} value={data.country} onChange={(v) => update("country", v)} placeholder={t("apply.field.country.placeholder")} hint={t("apply.field.country.hint")} error={errors.country} />
                  </>
                )}

                {stepKeys[step] === "arbeit" && (
                  <>
                    <div style={{ display: "grid", gap: 8 }}>
                      <label htmlFor="story" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>
                        {t("apply.field.story.label")}
                      </label>
                      <textarea
                        id="story"
                        value={data.story}
                        onChange={(e) => update("story", e.target.value)}
                        rows={6}
                        placeholder={t("apply.field.story.placeholder")}
                        style={inputStyle(!!errors.story)}
                      />
                      {errors.story ? <FieldError text={errors.story} /> : (
                        <p style={{ fontSize: 12, color: COL.sekundaer, lineHeight: 1.5 }}>{t("apply.field.story.hint")}</p>
                      )}
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
                      error={errors.tags}
                    />
                    <Field id="website" label={t("apply.field.website.label")} value={data.website} onChange={(v) => update("website", v)} />
                    <Field id="instagram" label={t("apply.field.instagram.label")} value={data.instagram} onChange={(v) => update("instagram", v)} placeholder={t("apply.field.instagram.placeholder")} />

                    <PortfolioUpload files={portfolio} setFiles={setPortfolio} hint={world?.portfolioHint} error={errors.portfolio} />
                  </>
                )}

                {stepKeys[step] === "vertraege" && (
                  <>
                    {contracts.length === 0 && <p style={{ fontSize: 14, color: COL.sekundaer }}>{t("apply.contracts.loading")}</p>}
                    {contracts.map((c) => (
                      <div key={c.id} style={{ border: `1px solid ${COL.linie}`, background: COL.grund, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                          <p style={{ fontFamily: DISPLAY, fontSize: 18, color: COL.schrift }}>{c.title}</p>
                          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>
                            {t("apply.contracts.version", { version: c.version })}
                          </span>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              type="button"
                              style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: COL.akzent, background: "none", border: "none", padding: 0, textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" }}
                            >
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
                        <label style={{ marginTop: 12, display: "flex", cursor: "pointer", alignItems: "flex-start", gap: 12, borderTop: `1px solid ${COL.linie}`, paddingTop: 12, fontSize: 14, color: COL.schrift }}>
                          <Checkbox
                            checked={!!accepted[c.id]}
                            onCheckedChange={(v) => setAccepted((p) => ({ ...p, [c.id]: !!v }))}
                            className="border-[#89857D] data-[state=checked]:border-[#A8BEB2] data-[state=checked]:bg-[#A8BEB2] data-[state=checked]:text-[#0A0A0B]"
                          />
                          <span>{t("apply.contracts.agreePrefix")}<strong>{c.title}</strong>{t("apply.contracts.agreeSuffix")}</span>
                        </label>
                      </div>
                    ))}
                    {errors.contracts && <FieldError text={errors.contracts} />}
                  </>
                )}

                {stepKeys[step] === "absenden" && (
                  <ReviewList
                    data={data}
                    world={world}
                    extra={extra}
                    portfolio={portfolio}
                    accepted={accepted}
                    contracts={contracts}
                    worldChangeable={worldPrefilled}
                    onChangeDiscipline={setDiscipline}
                    uploadStates={busy ? uploadStates : undefined}
                  />
                )}
              </div>

              <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <button
                  type="button"
                  onClick={back}
                  disabled={step === minStep || busy}
                  style={outlineButtonStyle(step === minStep || busy)}
                >
                  {t("common.back")}
                </button>
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={next} disabled={busy} style={accentButtonStyle(busy)}>
                    {t("apply.nav.next")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !data.brandName || !allContractsAccepted}
                    style={solidButtonStyle(busy || !data.brandName || !allContractsAccepted)}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 8 }} />}
                    {busy ? t("apply.nav.submitting") : t("apply.nav.submit")}
                  </button>
                )}
              </div>
            </div>

            <p style={{ marginTop: 16, fontSize: 12, color: COL.sekundaer, lineHeight: 1.6 }}>
              {t("apply.draftHint")}
            </p>
          </>
        )}
      </main>
    </div>
  );
};

/* ─────────────────────── Gemeinsame Feld-Bausteine ─────────────────────── */

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    background: "transparent",
    color: COL.schrift,
    border: `1px solid ${hasError ? COL.akzent : COL.linie}`,
    padding: "12px 14px",
    fontFamily: SANS,
    fontSize: 15,
    outline: "none",
  };
}

function outlineButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase",
    padding: "12px 20px", border: `1px solid ${COL.linie}`, background: "transparent",
    color: disabled ? COL.linie : COL.sekundaer, cursor: disabled ? "default" : "pointer",
  };
}
function accentButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase",
    padding: "12px 24px", border: `1px solid ${COL.akzent}`, background: "transparent",
    color: disabled ? COL.linie : COL.akzent, cursor: disabled ? "default" : "pointer",
  };
}
function solidButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase",
    padding: "12px 24px", border: `1px solid ${COL.akzent}`,
    background: disabled ? COL.linie : COL.akzent, color: disabled ? COL.sekundaer : COL.grund,
    cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center",
  };
}

/** PART 50 WP3: warmer, feldbezogener Hinweis statt eines schwarzen Fehlerbalkens — links ein
 * Akzentstrich statt einer Signalfarbe, die es im Farbgesetz dieser Seite nicht gibt. */
function FieldError({ text }: { text: string }) {
  return (
    <p role="alert" style={{ fontSize: 12, color: COL.schrift, lineHeight: 1.5, borderLeft: `2px solid ${COL.akzent}`, paddingLeft: 10 }}>
      {text}
    </p>
  );
}

function Field({ id, label, value, onChange, type = "text", placeholder, hint, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string; error?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label htmlFor={id} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>{label}</label>
      <input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle(!!error)} />
      {error ? <FieldError text={error} /> : (hint && <p style={{ fontSize: 12, color: COL.sekundaer, lineHeight: 1.5 }}>{hint}</p>)}
    </div>
  );
}

/* ─────────────────────── Fortschritt ─────────────────────── */

function Progress({ current, minutesLeft, steps }: { current: number; minutesLeft: number; steps: string[] }) {
  const { t } = useI18n();
  // PART 50 WP3: ab der Hälfte der Strecke ein ermutigender Zusatz statt nur der reinen
  // Restzeit — "noch X Minuten" allein liest sich wie ein Countdown, nicht wie ein Fortschritt.
  const pastHalf = current >= Math.ceil(steps.length / 2);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>
        <span>{steps[current]}</span>
        <span>{t("apply.progress.minutesLeft", { min: minutesLeft })}{pastHalf ? ` ${t("apply.progress.mostBehind")}` : ""}</span>
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))`, gap: 4 }}>
        {steps.map((label, i) => (
          <span
            key={label}
            aria-current={i === current ? "step" : undefined}
            style={{ height: 3, background: i <= current ? COL.akzent : COL.linie }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Welt-Auswahl ─────────────────────── */

function DisciplinePicker({ discipline, onChange, error }: { discipline: DisciplineId | null; onChange: (id: DisciplineId) => void; error?: string }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {DISCIPLINE_LIST.map((rawD) => {
        const d = translateDiscipline(t, rawD);
        const active = discipline === d.id;
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d.id)}
            style={{
              textAlign: "left", padding: 20, border: `1px solid ${active ? COL.akzent : COL.linie}`,
              background: active ? COL.akzent : "transparent", color: active ? COL.grund : COL.schrift,
              cursor: "pointer", transition: "border-color .2s, background-color .2s, color .2s",
            }}
          >
            <span style={{ display: "block", fontFamily: DISPLAY, fontSize: 22, fontWeight: 400 }}>{d.label}</span>
            <span style={{ display: "block", marginTop: 4, fontSize: 14, opacity: 0.8 }}>{d.tagline}</span>
          </button>
        );
      })}
      <p style={{ fontSize: 12, color: COL.sekundaer, lineHeight: 1.5 }}>{t("apply.discipline.multiHint")}</p>
      {error && <FieldError text={error} />}
    </div>
  );
}

/* ─────────────────────── Portfolio-Upload ─────────────────────── */

function PortfolioUpload({ files, setFiles, hint, error }: { files: File[]; setFiles: (f: File[]) => void; hint?: string; error?: string }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>{t("apply.portfolio.label")}</label>
      <p style={{ fontSize: 12, color: COL.sekundaer, lineHeight: 1.5 }}>{hint ?? t("apply.portfolio.hintFallback")}</p>
      <label style={{ display: "flex", width: "100%", cursor: "pointer", alignItems: "center", gap: 12, border: `1px dashed ${COL.linie}`, background: "transparent", padding: 16, textAlign: "left", fontSize: 14, color: COL.sekundaer }}>
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
      {files.length >= 3 && (
        <p style={{ fontSize: 12, color: COL.akzent, lineHeight: 1.5 }}>{t("apply.portfolio.enoughAlready")}</p>
      )}
      {error && <FieldError text={error} />}
      {files.length > 0 && (
        <ul style={{ marginTop: 4, display: "grid", gap: 6 }}>
          {files.map((f, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COL.linie}`, background: COL.grund, padding: "8px 12px", fontSize: 12, color: COL.schrift }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <button type="button" aria-label={t("apply.portfolio.remove")} onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: COL.sekundaer, cursor: "pointer" }}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────── Übersicht vor dem Absenden ─────────────────────── */

function ReviewList({ data, world, extra, portfolio, accepted, contracts, worldChangeable, onChangeDiscipline, uploadStates }: {
  data: FormState;
  world: TranslatedDiscipline | null;
  extra: Record<string, string>;
  portfolio: File[];
  accepted: Record<string, boolean>;
  contracts: ContractRow[];
  worldChangeable?: boolean;
  onChangeDiscipline?: (id: DisciplineId) => void;
  uploadStates?: UploadState[];
}) {
  const { t } = useI18n();
  const [changingWorld, setChangingWorld] = useState(false);
  const empty = t("apply.review.empty");
  const rows: [string, string][] = [
    [t("apply.review.haus"), data.brandName],
    [t("apply.review.rechtsname"), data.legalName],
    [t("apply.review.ort"), `${data.location}${data.country ? `, ${data.country}` : ""}`],
    [t("apply.review.website"), data.website],
    [t("apply.review.instagram"), data.instagram],
    [t("apply.review.stichworte"), data.tags],
    ...(world ? world.fields.map((f) => [f.label, extra[f.key] ?? ""] as [string, string]) : []),
    [t("apply.review.bilder"), t("apply.review.bilderCount", { n: portfolio.length })],
  ];
  const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "10px 0", borderTop: `1px solid ${COL.linie}` };
  const labelStyle: React.CSSProperties = { color: COL.sekundaer, fontSize: 13 };
  const valueStyle: React.CSSProperties = { color: COL.schrift, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  return (
    <ul style={{ fontSize: 14 }}>
      <li style={{ padding: "0 0 10px" }}>
        <div style={rowStyle}>
          <span style={labelStyle}>{t("apply.review.welt")}</span>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, ...valueStyle, whiteSpace: "normal" }}>
            {world?.label ?? empty}
            {worldChangeable && onChangeDiscipline && (
              <button type="button" onClick={() => setChangingWorld((v) => !v)} style={{ flexShrink: 0, fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: COL.akzent, background: "none", border: "none", textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" }}>
                {t("common.change")}
              </button>
            )}
          </span>
        </div>
        {changingWorld && onChangeDiscipline && (
          <div style={{ marginTop: 12 }}>
            <DisciplinePicker discipline={world?.id ?? null} onChange={(id) => { onChangeDiscipline(id); setChangingWorld(false); }} />
          </div>
        )}
      </li>
      {rows.map(([k, v]) => (
        <li key={k} style={rowStyle}>
          <span style={labelStyle}>{k}</span>
          <span style={valueStyle}>{v || <em style={{ color: COL.sekundaer }}>{empty}</em>}</span>
        </li>
      ))}
      <li style={rowStyle}>
        <span style={labelStyle}>{t("apply.review.vereinbarungen")}</span>
        <span style={valueStyle}>{t("apply.review.vereinbarungenCount", { accepted: contracts.filter((c) => accepted[c.id]).length, total: contracts.length })}</span>
      </li>
      {uploadStates && uploadStates.length > 0 && (
        <li style={{ padding: "16px 0 0" }}>
          <p style={{ marginBottom: 8, fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>{t("apply.upload.progressTitle")}</p>
          <ul style={{ display: "grid", gap: 6, fontSize: 12 }}>
            {portfolio.map((f, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: COL.sekundaer }}>{f.name}</span>
                <span style={{ flexShrink: 0, color: COL.schrift }}>{t(`apply.upload.${uploadStates[i] ?? "idle"}`)}</span>
              </li>
            ))}
          </ul>
        </li>
      )}
    </ul>
  );
}

/* ─────────────────────── Erfolgs- und Statusseiten ─────────────────────── */

/** PART 50 WP3: der Abschlussmoment wird gefeiert, im Stil der Platte — der Hausname groß, das
 * 48-Stunden-Versprechen als ruhige Zusage statt einer weiteren Formularzeile. */
function SuccessState({ brandName }: { brandName: string }) {
  const { t } = useI18n();
  return (
    <div style={{ textAlign: "center", padding: "56px 8px 16px" }}>
      <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.akzent }}>♟ PAWN</p>
      <h2 style={{ marginTop: 20, fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(2.2rem,10vw,3.6rem)", lineHeight: 1, color: COL.schrift }}>
        {brandName || t("apply.success.title")}
      </h2>
      <p style={{ marginTop: 18, fontSize: 15, color: COL.schrift }}>{t("apply.success.title")}</p>
      <p style={{ margin: "10px auto 0", maxWidth: 420, fontSize: 14, lineHeight: 1.7, color: COL.sekundaer }}>{t("apply.success.body")}</p>

      <div style={{ margin: "40px auto 0", maxWidth: 420, border: `1px solid ${COL.linie}`, background: COL.panel, padding: 22, textAlign: "left" }}>
        <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.akzent }}>{t("apply.success.untilThenTitle")}</p>
        <ul style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 14, color: COL.schrift, lineHeight: 1.5 }}>
          <li>{t("apply.success.point1")}</li>
          <li>{t("apply.success.point2")}</li>
          <li>{t("apply.success.point3")}</li>
        </ul>
      </div>

      <Link
        to="/"
        style={{ display: "inline-block", marginTop: 40, padding: "14px 28px", border: `1px solid ${COL.akzent}`, color: COL.akzent, textDecoration: "none", fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase" }}
      >
        {t("apply.toHome")}
      </Link>
    </div>
  );
}

function ExistingState({ status }: { status: string }) {
  const { t } = useI18n();
  const known = ["submitted", "in_review", "approved", "rejected", "archived"];
  const title = known.includes(status) ? t(`apply.existing.status.${status}.title`) : status;
  const body = known.includes(status) ? t(`apply.existing.status.${status}.body`) : "";
  return (
    <div style={{ textAlign: "center", padding: "56px 8px 16px" }}>
      <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>{t("apply.existing.eyebrow")}</p>
      <h2 style={{ marginTop: 12, fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(1.8rem,7vw,2.6rem)", color: COL.schrift }}>{title}</h2>
      <p style={{ margin: "10px auto 0", maxWidth: 420, fontSize: 14, lineHeight: 1.7, color: COL.sekundaer }}>{body}</p>
      <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 12 }}>
        <Link to="/" style={{ padding: "14px 28px", border: `1px solid ${COL.akzent}`, background: COL.akzent, color: COL.grund, textDecoration: "none", fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase" }}>
          {t("apply.toHome")}
        </Link>
        {status === "approved" && (
          <Link to="/studio" style={{ padding: "14px 28px", border: `1px solid ${COL.linie}`, color: COL.schrift, textDecoration: "none", fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase" }}>
            {t("apply.existing.toStudio")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default Apply;
