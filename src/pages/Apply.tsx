import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Upload, Loader2, X } from "lucide-react";
import { PublicHeader } from "@/components/pawn/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Designer Application — persisted end-to-end.
 *
 * Steps:
 *  0 Konto         — email/password (signup with intent=designer) OR existing session
 *  1 Profil        — brand, legal name, location, country, contact
 *  2 Über dich     — story, tags, production, portfolio uploads
 *  3 Verträge      — contract_versions with explicit consent per contract
 *  4 Bestätigung   — review + submit
 */

const STEPS = ["Konto", "Profil", "Über dich", "Verträge", "Bestätigung"] as const;

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

const Apply = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormState>(initial);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [portfolio, setPortfolio] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((prev) => ({ ...prev, [k]: v }));

  // Load latest contract per kind
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

  // If already signed in, skip account step + check for existing application
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    setStep((s) => (s === 0 ? 1 : s));
    (async () => {
      const { data: app } = await supabase
        .from("designer_applications")
        .select("status, brand_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (app) {
        setExistingStatus(app.status);
      }
    })();
  }, [user, loading]);

  const allContractsAccepted = contracts.length > 0 && contracts.every((c) => accepted[c.id]);

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  async function ensureAuth(): Promise<string | null> {
    if (user) return user.id;
    if (!data.email || !data.password) {
      toast.error("Email und Passwort sind erforderlich.");
      return null;
    }
    const { data: signup, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/apply`,
        data: {
          display_name: data.displayName || data.brandName || data.email.split("@")[0],
          intent: "designer",
        },
      },
    });
    if (error) { toast.error(error.message); return null; }
    if (!signup.user) {
      toast.error("Signup fehlgeschlagen.");
      return null;
    }
    return signup.user.id;
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

  async function submit() {
    if (!allContractsAccepted) {
      toast.error("Bitte stimme allen Verträgen zu.");
      return;
    }
    setBusy(true);
    try {
      const userId = await ensureAuth();
      if (!userId) { setBusy(false); return; }

      const portfolioPaths = await uploadPortfolio(userId).catch((e) => {
        toast.error(`Upload fehlgeschlagen: ${e.message}`);
        return [];
      });

      const tagsArr = data.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { data: app, error: insErr } = await supabase
        .from("designer_applications")
        .upsert({
          user_id: userId,
          brand_name: data.brandName,
          legal_name: data.legalName || null,
          location: data.location || null,
          country: data.country || null,
          website: data.website || null,
          instagram: data.instagram || null,
          story: data.story || null,
          tags: tagsArr,
          production_status: data.productionStatus || null,
          portfolio_paths: portfolioPaths,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select()
        .single();

      if (insErr || !app) {
        toast.error(insErr?.message ?? "Bewerbung konnte nicht gespeichert werden.");
        setBusy(false);
        return;
      }

      // Consents
      const consentRows = contracts
        .filter((c) => accepted[c.id])
        .map((c) => ({
          application_id: app.id,
          user_id: userId,
          contract_version_id: c.id,
          checksum_at_accept: c.checksum,
          user_agent: navigator.userAgent,
        }));
      if (consentRows.length) {
        await supabase.from("designer_consents").upsert(consentRows, {
          onConflict: "application_id,contract_version_id",
        });
      }

      // Event
      await supabase.from("domain_events").insert({
        type: "designer.application_submitted",
        actor: userId,
        payload: { application_id: app.id, brand_name: data.brandName },
      });

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
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        <aside className="relative hidden flex-col justify-between bg-gradient-shadow p-12 text-primary-foreground lg:flex">
          <p className="editorial-eyebrow text-primary-foreground/60">PAWN · Designer Application</p>
          <div>
            <h1 className="font-serif text-6xl leading-[0.95] xl:text-7xl">
              Apply once.<br /> Be seen forever.
            </h1>
            <p className="mt-6 max-w-md text-primary-foreground/70">
              Our curators review every application within seven days. Tell us your story — we'll build the stage.
            </p>
          </div>
          <ol className="space-y-1 text-xs uppercase tracking-[0.22em] text-primary-foreground/50">
            <li>— Curator review within 7 days</li>
            <li>— Editorial onboarding session</li>
            <li>— Dedicated designer success contact</li>
          </ol>
        </aside>

        <section className="p-6 md:p-12">
          <div className="mx-auto w-full max-w-xl">
            <Link to="/designers" className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">← Back to designers</Link>

            {submitted ? (
              <SuccessState />
            ) : existingStatus && existingStatus !== "draft" ? (
              <ExistingState status={existingStatus} />
            ) : (
              <>
                <Stepper current={step} />
                <div className="mt-10 border border-border bg-card p-8">
                  {step === 0 && (
                    <Fieldset title="Konto" subtitle="Deine PAWN-Designer-Anmeldung.">
                      <Field id="displayName" label="Vollständiger Name" value={data.displayName} onChange={(v) => update("displayName", v)} />
                      <Field id="email" type="email" label="Email" value={data.email} onChange={(v) => update("email", v)} />
                      <Field id="password" type="password" label="Passwort" value={data.password} onChange={(v) => update("password", v)} />
                    </Fieldset>
                  )}
                  {step === 1 && (
                    <Fieldset title="Profil" subtitle="Deine Studio-Identität.">
                      <Field id="brandName" label="Designer / Brand-Name" value={data.brandName} onChange={(v) => update("brandName", v)} />
                      <Field id="legalName" label="Rechtsname (für Auszahlungen)" value={data.legalName} onChange={(v) => update("legalName", v)} />
                      <Field id="location" label="Ort" value={data.location} onChange={(v) => update("location", v)} />
                      <Field id="country" label="Land" value={data.country} onChange={(v) => update("country", v)} placeholder="Deutschland" />
                    </Fieldset>
                  )}
                  {step === 2 && (
                    <Fieldset title="Über dich" subtitle="Erzähl uns, wer du bist.">
                      <Field id="website" label="Website" value={data.website} onChange={(v) => update("website", v)} />
                      <Field id="instagram" label="Instagram" value={data.instagram} onChange={(v) => update("instagram", v)} placeholder="@studio" />
                      <div className="space-y-2">
                        <Label htmlFor="story" className="editorial-eyebrow">Brand-Story</Label>
                        <Textarea id="story" value={data.story} onChange={(e) => update("story", e.target.value)} rows={5} className="rounded-none" />
                      </div>
                      <Field id="tags" label="Kategorien / Stil-Tags" placeholder="avant-tailoring, brutalist, romantic" value={data.tags} onChange={(v) => update("tags", v)} />
                      <Field id="productionStatus" label="Produktionsstatus" placeholder="in production / made-to-order / archive" value={data.productionStatus} onChange={(v) => update("productionStatus", v)} />
                      <PortfolioUpload files={portfolio} setFiles={setPortfolio} />
                    </Fieldset>
                  )}
                  {step === 3 && (
                    <Fieldset title="Verträge" subtitle="Bitte lies und bestätige jede Vereinbarung einzeln.">
                      {contracts.length === 0 && (
                        <p className="text-sm text-muted-foreground">Lade Verträge…</p>
                      )}
                      {contracts.map((c) => (
                        <div key={c.id} className="border border-border bg-background p-4">
                          <div className="mb-3 flex items-baseline justify-between">
                            <p className="font-serif text-lg">{c.title}</p>
                            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">v{c.version}</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                            {c.body_markdown}
                          </div>
                          <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-border pt-3 text-sm">
                            <Checkbox
                              checked={!!accepted[c.id]}
                              onCheckedChange={(v) => setAccepted((p) => ({ ...p, [c.id]: !!v }))}
                            />
                            <span>Ich stimme <strong>{c.title}</strong> zu.</span>
                          </label>
                        </div>
                      ))}
                    </Fieldset>
                  )}
                  {step === 4 && (
                    <Fieldset title="Bestätigung" subtitle="Prüfen und einreichen.">
                      <ReviewList data={data} portfolio={portfolio} accepted={accepted} contracts={contracts} />
                    </Fieldset>
                  )}

                  <div className="mt-8 flex items-center justify-between">
                    <Button type="button" variant="outline" onClick={back} disabled={step === 0 || busy} className="rounded-none">
                      Zurück
                    </Button>
                    {step < STEPS.length - 1 ? (
                      <Button
                        type="button"
                        onClick={next}
                        disabled={busy || (step === 3 && !allContractsAccepted)}
                        className="rounded-none"
                      >
                        Weiter
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={submit}
                        disabled={busy || !data.brandName || !allContractsAccepted}
                        className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Einreichen…</> : "Bewerbung einreichen"}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mt-8 grid grid-cols-5 gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className={cn("border-t-2 pt-3", i <= current ? "border-accent" : "border-border")}>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">0{i + 1}</p>
          <p className={cn("mt-1 text-xs uppercase tracking-[0.18em] md:text-sm", i === current && "text-accent")}>{label}</p>
        </li>
      ))}
    </ol>
  );
}

function Fieldset({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-3xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="editorial-eyebrow">{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="rounded-none" />
    </div>
  );
}

function PortfolioUpload({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  return (
    <div className="space-y-2">
      <Label className="editorial-eyebrow">Portfolio (mind. 3 Bilder)</Label>
      <label className="flex w-full cursor-pointer items-center gap-3 border border-dashed border-border bg-background p-4 text-left text-sm text-muted-foreground hover:border-foreground">
        <Upload className="h-4 w-4" />
        <span>Dateien auswählen…</span>
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            setFiles([...files, ...chosen].slice(0, 10));
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between border border-border bg-background px-3 py-2">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewList({ data, portfolio, accepted, contracts }: {
  data: FormState; portfolio: File[]; accepted: Record<string, boolean>; contracts: ContractRow[];
}) {
  const rows: [string, string][] = [
    ["Brand", data.brandName],
    ["Rechtsname", data.legalName],
    ["Ort", `${data.location}${data.country ? `, ${data.country}` : ""}`],
    ["Website", data.website],
    ["Instagram", data.instagram],
    ["Tags", data.tags],
    ["Produktion", data.productionStatus],
    ["Portfolio", `${portfolio.length} Datei(en)`],
  ];
  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map(([k, v]) => (
        <li key={k} className="grid grid-cols-2 py-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="truncate">{v || <em className="text-muted-foreground">—</em>}</span>
        </li>
      ))}
      <li className="grid grid-cols-2 py-2">
        <span className="text-muted-foreground">Verträge</span>
        <span>
          {contracts.filter((c) => accepted[c.id]).length} / {contracts.length} akzeptiert
        </span>
      </li>
    </ul>
  );
}

function SuccessState() {
  return (
    <div className="mt-12 border border-border bg-card p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center border border-accent text-accent">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-6 font-serif text-4xl">Bewerbung eingereicht.</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Wir melden uns innerhalb von 7 Tagen mit dem Ergebnis unserer Kuratoren. Sobald wir dich annehmen, startet PAWN dein AI-Onboarding im Portal.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild className="rounded-none">
          <Link to="/portal">Zum Designer Portal</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-none">
          <Link to="/">Zur Startseite</Link>
        </Button>
      </div>
    </div>
  );
}

function ExistingState({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: "Deine Bewerbung liegt bei uns. Wir melden uns innerhalb von 7 Tagen.",
    in_review: "Deine Bewerbung wird gerade geprüft.",
    approved: "Du wurdest angenommen. Willkommen im Portal.",
    rejected: "Deine Bewerbung wurde diesmal nicht angenommen.",
    archived: "Deine Bewerbung wurde archiviert.",
  };
  return (
    <div className="mt-12 border border-border bg-card p-12 text-center">
      <p className="editorial-eyebrow">Status</p>
      <h2 className="mt-2 font-serif text-3xl capitalize">{status.replace("_", " ")}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{map[status] ?? ""}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild className="rounded-none"><Link to="/">Zur Startseite</Link></Button>
        {status === "approved" && (
          <Button asChild variant="outline" className="rounded-none"><Link to="/portal">Zum Portal</Link></Button>
        )}
      </div>
    </div>
  );
}

export default Apply;
