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
import {
  DISCIPLINES,
  DISCIPLINE_LIST,
  parseDiscipline,
  type Discipline,
  type DisciplineId,
} from "@/features/apply/disciplines";

const DRAFT_KEY = "pawn.apply.draft";

const accountSchema = z.object({
  displayName: z.string().trim().min(2, "Bitte gib deinen Namen an.").max(120),
  email: z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse an.").max(255),
  password: z.string().min(8, "Dein Passwort braucht mindestens 8 Zeichen."),
});
const houseSchema = z.object({
  brandName: z.string().trim().min(2, "Wie heißt dein Haus?").max(120),
  location: z.string().trim().min(2, "In welcher Stadt arbeitest du?").max(120),
  country: z.string().trim().min(2, "In welchem Land arbeitest du?").max(120),
});
const workSchema = z.object({
  story: z.string().trim().min(30, "Erzähl uns ein paar Sätze über deine Arbeit — mindestens 30 Zeichen."),
  tags: z.string().trim().min(2, "Nenne mindestens ein Stichwort zu deinem Stil."),
});

const STEPS = ["Konto", "Welt", "Dein Haus", "Deine Arbeit", "Verträge", "Absenden"] as const;
const STEP_MINUTES = [3, 1, 2, 4, 2, 1];

const STEP_WHY: Record<number, string> = {
  0: "Damit du deine Bewerbung später fortsetzen und dein Studio betreten kannst.",
  1: "Deine Welt bestimmt, welche Angaben wir brauchen und wie deine Seite später aussieht.",
  2: "Name, Ort und Land stehen auf deiner Hausseite und auf deinen Rechnungen.",
  3: "Das ist der Teil, den unsere Kuratoren wirklich lesen. Nimm dir hier Zeit.",
  4: "Zwei kurze Vereinbarungen. Du kannst jeden Text vorher vollständig lesen.",
  5: "Letzter Blick, dann geht sie raus.",
};

interface ContractRow {
  id: string;
  kind: string;
  version: number;
  title: string;
  body_markdown: string;
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

  const world: Discipline | null = discipline ? DISCIPLINES[discipline] : null;

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
      const { data: rows } = await supabase
        .from("contract_versions")
        .select("id, kind, version, title, body_markdown, checksum")
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
      if (!discipline) message = "Bitte wähle eine Welt.";
    } else if (current === 2) {
      const r = houseSchema.safeParse(data);
      if (!r.success) message = r.error.issues[0]?.message ?? null;
    } else if (current === 3) {
      const r = workSchema.safeParse({ story: data.story, tags: data.tags });
      if (!r.success) message = r.error.issues[0]?.message ?? null;
      else if (portfolio.length < 3) message = "Bitte lade mindestens drei Bilder deiner Arbeit hoch.";
    } else if (current === 4 && !allContractsAccepted) {
      message = "Bitte bestätige beide Vereinbarungen.";
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
      toast.error("Bitte bestätige beide Vereinbarungen.");
      return;
    }
    setBusy(true);
    try {
      let portfolioPaths: string[] = [];
      if (user && portfolio.length > 0) {
        portfolioPaths = await uploadPortfolio(user.id).catch((e) => {
          toast.error(`Bilder konnten nicht hochgeladen werden: ${e.message}`);
          return [];
        });
      }

      const styleTags = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
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
        tags: world ? [world.label, ...styleTags] : styleTags,
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
        toast.error(r?.error ?? "Deine Bewerbung konnte nicht gespeichert werden.");
        setBusy(false);
        return;
      }
      if (r.needs_email_confirmation) {
        toast.success("Bewerbung eingereicht. Bitte bestätige noch deine E-Mail-Adresse.");
      } else {
        toast.success("Bewerbung eingereicht.");
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* egal */ }
      clearLeadRef();
      clearRefCode();
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unbekannter Fehler.");
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
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-background/60">PAWN · Bewerbung</p>
          <div>
            <h1 className="font-serif text-6xl font-light leading-[0.92] xl:text-7xl">
              Einmal bewerben.<br />
              <em>Dann gestalten.</em>
            </h1>
            <p className="mt-6 max-w-md text-background/70">
              {world
                ? `${world.tagline} Wir lesen jede Bewerbung persönlich und antworten innerhalb von sieben Tagen.`
                : "Wir lesen jede Bewerbung persönlich und antworten innerhalb von sieben Tagen — auch bei einer Absage."}
            </p>
          </div>
          <ol className="space-y-2 text-xs uppercase tracking-[0.22em] text-background/50">
            <li>— Antwort in sieben Tagen</li>
            <li>— Wir bauen deine Hausseite mit dir auf</li>
            <li>— 93 % jedes Verkaufs gehen direkt an dich</li>
          </ol>
        </aside>

        <section className="p-6 md:p-12">
          <div className="mx-auto w-full max-w-xl">
            <Link to="/apply" className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
              ← Zurück zur Übersicht
            </Link>

            {submitted ? (
              <SuccessState />
            ) : existingStatus && existingStatus !== "draft" ? (
              <ExistingState status={existingStatus} />
            ) : (
              <>
                <Progress current={step} minutesLeft={minutesLeft} />

                <div className="mt-8 border border-border bg-card p-6 md:p-8">
                  <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
                    Schritt {step + 1} von {STEPS.length}
                  </p>
                  <h2 className="mt-2 font-serif text-3xl font-light">{STEPS[step]}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{STEP_WHY[step]}</p>

                  <div className="mt-8 space-y-5">
                    {step === 0 && (
                      <>
                        <Field id="displayName" label="Dein Name" value={data.displayName} onChange={(v) => update("displayName", v)} hint="Der Name der Person hinter dem Haus — nicht öffentlich sichtbar." />
                        <Field id="email" type="email" label="E-Mail-Adresse" value={data.email} onChange={(v) => update("email", v)} hint="Hierhin schicken wir unsere Antwort." />
                        <Field id="password" type="password" label="Passwort" value={data.password} onChange={(v) => update("password", v)} hint="Mindestens 8 Zeichen." />
                      </>
                    )}

                    {step === 1 && (
                      <div className="grid grid-cols-1 gap-3">
                        {DISCIPLINE_LIST.map((d) => (
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
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Du arbeitest in mehreren Welten? Wähle deinen Schwerpunkt — im Studio ordnest du später jedes Stück einzeln zu.
                        </p>
                      </div>
                    )}

                    {step === 2 && (
                      <>
                        <Field id="brandName" label="Name deines Hauses" value={data.brandName} onChange={(v) => update("brandName", v)} hint="So steht er auf deiner Seite. Dein eigener Name geht auch." />
                        <Field id="legalName" label="Rechtsname (für Auszahlungen)" value={data.legalName} onChange={(v) => update("legalName", v)} hint="Nur für Verträge und Auszahlung, nie öffentlich." />
                        <Field id="location" label="Stadt" value={data.location} onChange={(v) => update("location", v)} />
                        <Field id="country" label="Land" value={data.country} onChange={(v) => update("country", v)} placeholder="Deutschland" hint="Bestimmt Versandwege und Steuersatz." />
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="story" className="text-[0.65rem] uppercase tracking-[0.28em]">
                            {world ? `Erzähl uns von deiner Arbeit` : "Erzähl uns von deiner Arbeit"}
                          </Label>
                          <Textarea
                            id="story"
                            value={data.story}
                            onChange={(e) => update("story", e.target.value)}
                            rows={6}
                            className="rounded-none"
                            placeholder="Wie bist du dazu gekommen? Was unterscheidet deine Arbeit von anderen? Woran arbeitest du gerade?"
                          />
                          <p className="text-xs text-muted-foreground">
                            Kein Marketingtext. Schreib so, wie du es jemandem in deiner Werkstatt erzählen würdest.
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
                          label="Stichworte zu deinem Stil"
                          placeholder={world?.tagExample ?? "reduziert, handgefertigt, Vintage-Stoffe"}
                          hint="Drei bis fünf Begriffe, mit Komma getrennt. Danach finden dich Menschen mit passendem Geschmack."
                          value={data.tags}
                          onChange={(v) => update("tags", v)}
                        />
                        <Field id="website" label="Website (falls vorhanden)" value={data.website} onChange={(v) => update("website", v)} />
                        <Field id="instagram" label="Instagram (falls vorhanden)" value={data.instagram} onChange={(v) => update("instagram", v)} placeholder="@atelier" />

                        <PortfolioUpload files={portfolio} setFiles={setPortfolio} hint={world?.portfolioHint} />
                      </>
                    )}

                    {step === 4 && (
                      <>
                        {contracts.length === 0 && <p className="text-sm text-muted-foreground">Vereinbarungen werden geladen…</p>}
                        {contracts.map((c) => (
                          <div key={c.id} className="border border-border bg-background p-4">
                            <div className="mb-3 flex items-baseline justify-between">
                              <p className="font-serif text-lg">{c.title}</p>
                              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Fassung {c.version}</span>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <button type="button" className="text-xs uppercase tracking-[0.22em] text-muted-foreground underline underline-offset-4 hover:text-foreground">
                                  Ganzen Text lesen →
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-none">
                                <DialogHeader>
                                  <DialogTitle className="font-serif text-2xl">{c.title} · Fassung {c.version}</DialogTitle>
                                </DialogHeader>
                                <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                  {c.body_markdown}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-border pt-3 text-sm">
                              <Checkbox
                                checked={!!accepted[c.id]}
                                onCheckedChange={(v) => setAccepted((p) => ({ ...p, [c.id]: !!v }))}
                              />
                              <span>Ich habe <strong>{c.title}</strong> gelesen und stimme zu.</span>
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
                      Zurück
                    </Button>
                    {step < STEPS.length - 1 ? (
                      <Button type="button" onClick={next} disabled={busy} className="rounded-none">
                        Weiter
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={submit}
                        disabled={busy || !data.brandName || !allContractsAccepted}
                        className="rounded-none"
                      >
                        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird gesendet…</> : "Bewerbung absenden"}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Dein Zwischenstand bleibt in diesem Browser gespeichert — du kannst jederzeit pausieren.
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

function Progress({ current, minutesLeft }: { current: number; minutesLeft: number }) {
  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
        <span>{STEPS[current]}</span>
        <span>noch ca. {minutesLeft} Min.</span>
      </div>
      <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0,1fr))` }}>
        {STEPS.map((label, i) => (
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
  return (
    <div className="space-y-2">
      <Label className="text-[0.65rem] uppercase tracking-[0.28em]">Bilder deiner Arbeit (3–8)</Label>
      <p className="text-xs text-muted-foreground">
        {hint ?? "3–8 Bilder deiner Arbeit. Handyfotos sind völlig in Ordnung — Hauptsache ehrlich und gut belichtet."}
      </p>
      <label className="flex w-full cursor-pointer items-center gap-3 border border-dashed border-border bg-background p-4 text-left text-sm text-muted-foreground hover:border-foreground">
        <Upload className="h-4 w-4" />
        <span>Bilder auswählen…</span>
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
              <button type="button" aria-label="Bild entfernen" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
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
  world: Discipline | null;
  extra: Record<string, string>;
  portfolio: File[];
  accepted: Record<string, boolean>;
  contracts: ContractRow[];
}) {
  const rows: [string, string][] = [
    ["Welt", world?.label ?? "—"],
    ["Haus", data.brandName],
    ["Rechtsname", data.legalName],
    ["Ort", `${data.location}${data.country ? `, ${data.country}` : ""}`],
    ["Website", data.website],
    ["Instagram", data.instagram],
    ["Stichworte", data.tags],
    ...(world ? world.fields.map((f) => [f.label, extra[f.key] ?? ""] as [string, string]) : []),
    ["Bilder", `${portfolio.length} Datei(en)`],
  ];
  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map(([k, v]) => (
        <li key={k} className="grid grid-cols-2 gap-3 py-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="truncate">{v || <em className="text-muted-foreground">—</em>}</span>
        </li>
      ))}
      <li className="grid grid-cols-2 gap-3 py-2">
        <span className="text-muted-foreground">Vereinbarungen</span>
        <span>{contracts.filter((c) => accepted[c.id]).length} von {contracts.length} bestätigt</span>
      </li>
    </ul>
  );
}

function SuccessState() {
  return (
    <div className="mt-12 border border-border bg-card p-8 text-center md:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-foreground">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-serif text-4xl font-light">Deine Bewerbung ist da.</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Wir sehen sie uns persönlich an und antworten innerhalb von sieben Tagen per E-Mail — auch bei einer Absage, mit Begründung.
      </p>
      <div className="mx-auto mt-8 max-w-md border border-border p-5 text-left text-sm text-muted-foreground">
        <p className="text-[0.65rem] uppercase tracking-[0.28em] text-foreground">Bis dahin</p>
        <ul className="mt-3 space-y-2">
          <li>— Leg dir Fotos deiner ersten drei Stücke bereit.</li>
          <li>— Überleg dir Preise inklusive Steuer und Versand.</li>
          <li>— Halte deine Bankdaten für die Auszahlung parat.</li>
        </ul>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="outline" className="rounded-none">
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    </div>
  );
}

function ExistingState({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "Deine Bewerbung liegt bei uns. Wir melden uns innerhalb von sieben Tagen.",
    in_review: "Deine Bewerbung wird gerade gelesen.",
    approved: "Du bist aufgenommen. Willkommen — dein Studio steht bereit.",
    rejected: "Deine Bewerbung wurde diesmal nicht angenommen. Du kannst dich später erneut bewerben.",
    archived: "Deine Bewerbung wurde archiviert.",
  };
  const titles: Record<string, string> = {
    submitted: "Eingegangen",
    in_review: "In Prüfung",
    approved: "Angenommen",
    rejected: "Nicht angenommen",
    archived: "Archiviert",
  };
  return (
    <div className="mt-12 border border-border bg-card p-8 text-center md:p-12">
      <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">Status</p>
      <h2 className="mt-2 font-serif text-3xl font-light">{titles[status] ?? status}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{map[status] ?? ""}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild className="rounded-none"><Link to="/">Zur Startseite</Link></Button>
        {status === "approved" && (
          <Button asChild variant="outline" className="rounded-none"><Link to="/studio">Zum Studio</Link></Button>
        )}
      </div>
    </div>
  );
}

export default Apply;
