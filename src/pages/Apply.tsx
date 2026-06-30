import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Upload } from "lucide-react";
import { PublicHeader } from "@/components/pawn/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STEPS = ["Konto", "Profil", "Über dich", "Bestätigung"] as const;

interface FormState {
  fullName: string;
  email: string;
  password: string;
  brandName: string;
  location: string;
  website: string;
  instagram: string;
  story: string;
  tags: string;
  production: string;
}

const initialState: FormState = {
  fullName: "",
  email: "",
  password: "",
  brandName: "",
  location: "",
  website: "",
  instagram: "",
  story: "",
  tags: "",
  production: "",
};

const Apply = () => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormState>(initialState);
  const [submitted, setSubmitted] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
        {/* Editorial intro */}
        <aside className="relative hidden flex-col justify-between bg-gradient-shadow p-12 text-primary-foreground lg:flex">
          <p className="editorial-eyebrow text-primary-foreground/60">PAWN · Designer Application</p>
          <div>
            <h1 className="font-serif text-6xl leading-[0.95] xl:text-7xl">
              Apply once.
              <br /> Be seen forever.
            </h1>
            <p className="mt-6 max-w-md text-primary-foreground/70">
              Our curators review every application within seven days. Tell us your story — we'll build the stage.
            </p>
          </div>
          <ol className="space-y-1 text-xs uppercase tracking-[0.22em] text-primary-foreground/50">
            {[
              "Curator review within 7 days",
              "Editorial onboarding session",
              "Dedicated designer success contact",
            ].map((t) => (
              <li key={t}>— {t}</li>
            ))}
          </ol>
        </aside>

        {/* Form */}
        <section className="p-6 md:p-12">
          <div className="mx-auto w-full max-w-xl">
            <Link to="/designers" className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">← Back to designers</Link>
            {submitted ? (
              <SuccessState />
            ) : (
              <>
                <Stepper current={step} />
                <form onSubmit={submit} className="mt-10 border border-border bg-card p-8">
                  {step === 0 && (
                    <Fieldset title="Konto" subtitle="Your PAWN designer account.">
                      <Field id="fullName" label="Full name" value={data.fullName} onChange={(v) => update("fullName", v)} />
                      <Field id="email" type="email" label="Email" value={data.email} onChange={(v) => update("email", v)} />
                      <Field id="password" type="password" label="Password" value={data.password} onChange={(v) => update("password", v)} />
                    </Fieldset>
                  )}
                  {step === 1 && (
                    <Fieldset title="Profil" subtitle="Your studio identity.">
                      <Field id="brandName" label="Designer / Brand name" value={data.brandName} onChange={(v) => update("brandName", v)} />
                      <UploadField label="Profile image" />
                      <UploadField label="Banner image" />
                      <Field id="location" label="Location" value={data.location} onChange={(v) => update("location", v)} />
                    </Fieldset>
                  )}
                  {step === 2 && (
                    <Fieldset title="Über dich" subtitle="Tell us who you are.">
                      <Field id="website" label="Website" value={data.website} onChange={(v) => update("website", v)} />
                      <Field id="instagram" label="Instagram" value={data.instagram} onChange={(v) => update("instagram", v)} placeholder="@studio" />
                      <div className="space-y-2">
                        <Label htmlFor="story" className="editorial-eyebrow">Brand story</Label>
                        <Textarea id="story" value={data.story} onChange={(e) => update("story", e.target.value)} rows={5} className="rounded-none" />
                      </div>
                      <Field id="tags" label="Category / style tags" placeholder="avant-tailoring, brutalist, romantic" value={data.tags} onChange={(v) => update("tags", v)} />
                      <Field id="production" label="Production status" placeholder="in production / made-to-order / archive" value={data.production} onChange={(v) => update("production", v)} />
                    </Fieldset>
                  )}
                  {step === 3 && (
                    <Fieldset title="Bestätigung" subtitle="Review and submit.">
                      <ul className="divide-y divide-border text-sm">
                        {Object.entries(data).map(([k, v]) => (
                          <li key={k} className="grid grid-cols-2 py-2">
                            <span className="text-muted-foreground capitalize">{k}</span>
                            <span className="truncate">{v || <em className="text-muted-foreground">—</em>}</span>
                          </li>
                        ))}
                      </ul>
                    </Fieldset>
                  )}

                  <div className="mt-8 flex items-center justify-between">
                    <Button type="button" variant="outline" onClick={back} disabled={step === 0} className="rounded-none">
                      Zurück
                    </Button>
                    {step < STEPS.length - 1 ? (
                      <Button type="button" onClick={next} className="rounded-none">
                        Weiter
                      </Button>
                    ) : (
                      <Button type="submit" className="rounded-none bg-accent text-accent-foreground hover:bg-accent/90">
                        Bewerbung einreichen
                      </Button>
                    )}
                  </div>
                </form>
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
    <ol className="mt-8 grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => (
        <li key={label} className={cn("border-t-2 pt-3", i <= current ? "border-accent" : "border-border")}>
          <p className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">0{i + 1}</p>
          <p className={cn("mt-1 text-sm uppercase tracking-[0.18em]", i === current && "text-accent")}>{label}</p>
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

function Field({
  id, label, value, onChange, type = "text", placeholder,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="editorial-eyebrow">{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="rounded-none" />
    </div>
  );
}

function UploadField({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <Label className="editorial-eyebrow">{label}</Label>
      <button type="button" className="flex w-full items-center gap-3 border border-dashed border-border bg-background p-4 text-left text-sm text-muted-foreground hover:border-foreground">
        <Upload className="h-4 w-4" />
        Upload an image (placeholder)
      </button>
    </div>
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
        Wir melden uns innerhalb von 7 Tagen mit dem Ergebnis unserer Kuratoren. In der Zwischenzeit kannst du dein Portal vorbereiten.
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

export default Apply;
