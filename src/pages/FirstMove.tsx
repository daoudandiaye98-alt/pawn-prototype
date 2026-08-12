import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";
import { toast } from "sonner";

/**
 * PART 51 Teil B — First Move Flow (/start). Drei Züge: Zeigen, Bestätigen, Ziehen.
 * Reines PAWN-Design (kein Platte-Stil wie Apply.tsx — der Auftrag verlangt hier ausdrücklich
 * das bestehende #000/#FFF-Designsystem, deshalb die gemeinsamen ui/-Komponenten statt roher
 * Elemente). Jeder Zug wird nach `first_move_sessions` gespeichert (debounced), Wiedereinstieg
 * lädt den letzten Stand. "Zug machen." ruft die RPC `first_move_publish()` — sie legt Haus +
 * Werke in einer Transaktion an, sofort veröffentlicht, ohne Prüfung durch einen Menschen.
 *
 * Judgment call (disclosed): ein eingeloggter Zugang ist technische Voraussetzung, bevor
 * überhaupt etwas gespeichert werden kann — dafür steht ein minimales Konto-Gate vor Zug 1,
 * nicht als eigener Zug gezählt, sondern als Teil der Karte "Zeigen".
 */

type WorkKind = "original" | "print";
type StepKey = "zeigen" | "bestaetigen" | "ziehen";

interface Work {
  id: string;
  file?: File;
  previewUrl: string;
  kind: WorkKind;
  title: string;
  description: string;
  priceCents: number | null;
  uploading: boolean;
  uploaded: boolean;
  imageUrl: string | null;
  analyzing: boolean;
}

interface Billing {
  legal_name: string;
  address_line1: string;
  postal_code: string;
  city: string;
  country: string;
  tax_id: string;
  kleinunternehmer: boolean;
}

const STEP_ORDER: StepKey[] = ["zeigen", "bestaetigen", "ziehen"];
const STEP_LABEL: Record<StepKey, string> = { zeigen: "Zeigen", bestaetigen: "Bestätigen", ziehen: "Ziehen" };
const MAX_WORKS = 10;

const CHIP_FRAGEN: { key: "medium" | "haltung" | "wunsch"; label: string; options: string[] }[] = [
  { key: "medium", label: "Womit arbeitest du vor allem?", options: ["Malerei", "Skulptur", "Fotografie", "Keramik", "Mixed Media"] },
  { key: "haltung", label: "Was treibt deine Arbeit an?", options: ["Beobachtung", "Erinnerung", "Material", "Form", "Gefühl"] },
  { key: "wunsch", label: "Wofür soll man dich finden?", options: ["Ausstellungen", "Auftragsarbeiten", "den Verkauf einzelner Werke", "alles davon"] },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function chipsToText(answers: Partial<Record<"medium" | "haltung" | "wunsch", string>>): string {
  if (!answers.medium || !answers.haltung || !answers.wunsch) return "";
  return `Ich arbeite vor allem mit ${answers.medium}. Meine Arbeit kommt aus ${answers.haltung}. Gefunden werden möchte ich für ${answers.wunsch}.`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(((reader.result as string) || "").split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatEur(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(0);
}

export default function FirstMove() {
  const { user, signUp, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [loadingSession, setLoadingSession] = useState(true);
  const [step, setStep] = useState<StepKey>("zeigen");

  const [accountMode, setAccountMode] = useState<"neu" | "login">("neu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("DE");

  const [works, setWorks] = useState<Work[]>([]);

  const [rochadeOpen, setRochadeOpen] = useState(false);
  const [rochadeMode, setRochadeMode] = useState<"url" | "screenshots" | "instagram">("url");
  const [rochadeConsent, setRochadeConsent] = useState(false);
  const [rochadeUrl, setRochadeUrl] = useState("");
  const [rochadeHandle, setRochadeHandle] = useState("");
  const [rochadeFiles, setRochadeFiles] = useState<File[]>([]);
  const [rochadeBusy, setRochadeBusy] = useState(false);
  const [rochadeDna, setRochadeDna] = useState<Record<string, unknown> | null>(null);
  const [rochadeSource, setRochadeSource] = useState<{ type: string; ref: string; at: string } | null>(null);
  const rochadeFileInputRef = useRef<HTMLInputElement>(null);

  const [aboutText, setAboutText] = useState("");
  const [aboutSource, setAboutSource] = useState<"voice" | "chips" | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showChips, setShowChips] = useState(false);
  const [chipAnswers, setChipAnswers] = useState<Partial<Record<"medium" | "haltung" | "wunsch", string>>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [shippingDeEu, setShippingDeEu] = useState(true);
  const [billing, setBilling] = useState<Billing>({
    legal_name: "", address_line1: "", postal_code: "", city: "", country: "DE", tax_id: "", kleinunternehmer: true,
  });

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ slug: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!user) { setLoadingSession(false); return; }
    void (async () => {
      const { data } = await supabase.from("first_move_sessions" as never).select("*").eq("user_id", user.id).maybeSingle();
      const sess = data as null | {
        step: StepKey; brand_name: string | null; location: string | null; country: string;
        about_text: string | null; about_source: "voice" | "chips" | null;
        works: Array<{ id: string; kind: WorkKind; image_url: string; title: string; description: string; price_cents: number | null }>;
        shipping_de_eu: boolean; billing: Partial<Billing>;
        rochade?: { source_type?: string; source_ref?: string; consent_at?: string; dna?: Record<string, unknown> };
      };
      if (sess) {
        setStep(sess.step ?? "zeigen");
        setBrandName(sess.brand_name ?? "");
        setLocation(sess.location ?? "");
        setCountry(sess.country ?? "DE");
        setAboutText(sess.about_text ?? "");
        setAboutSource(sess.about_source ?? null);
        setShippingDeEu(sess.shipping_de_eu ?? true);
        if (sess.billing) setBilling((b) => ({ ...b, ...sess.billing }));
        if (sess.rochade?.dna && sess.rochade.source_type) {
          setRochadeDna(sess.rochade.dna);
          setRochadeSource({ type: sess.rochade.source_type, ref: sess.rochade.source_ref ?? "", at: sess.rochade.consent_at ?? new Date().toISOString() });
        }
        if (Array.isArray(sess.works)) {
          setWorks(sess.works.map((w) => ({
            id: w.id, previewUrl: w.image_url, kind: w.kind, title: w.title ?? "", description: w.description ?? "",
            priceCents: w.price_cents ?? null, uploading: false, uploaded: true, imageUrl: w.image_url, analyzing: false,
          })));
        }
      }
      setLoadingSession(false);
    })();
  }, [user]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback((patch: Record<string, unknown>) => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void supabase.from("first_move_sessions" as never).upsert({ user_id: user.id, ...patch } as never);
    }, 900);
  }, [user]);

  useEffect(() => {
    if (loadingSession) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    saveDraft({
      step, brand_name: brandName || null, location: location || null, country, about_text: aboutText || null,
      about_source: aboutSource,
      works: works.filter((w) => w.uploaded && w.imageUrl).map((w) => ({
        id: w.id, kind: w.kind, image_url: w.imageUrl, title: w.title, description: w.description, price_cents: w.priceCents,
      })),
      shipping_de_eu: shippingDeEu, billing,
      rochade: rochadeDna && rochadeSource
        ? { source_type: rochadeSource.type, source_ref: rochadeSource.ref, consent_at: rochadeSource.at, dna: rochadeDna }
        : {},
    });
  }, [step, brandName, location, country, aboutText, aboutSource, works, shippingDeEu, billing, loadingSession, saveDraft, rochadeDna, rochadeSource]);

  async function handleAccount() {
    if (!email.trim() || password.length < 8) { toast.error("E-Mail und mindestens 8 Zeichen fürs Passwort."); return; }
    setAccountBusy(true);
    try {
      const r = accountMode === "neu"
        ? await signUp(email.trim(), password, brandName || email.split("@")[0])
        : await signInWithPassword(email.trim(), password);
      if (r.error) { toast.error(r.error); return; }
    } finally {
      setAccountBusy(false);
    }
  }

  async function uploadAndAnalyze(work: Work) {
    if (!user || !work.file) return;
    try {
      const compressed = await compressImage(work.file).catch(() => work.file!);
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = `${user.id}/first-move/${work.id}.${ext}`;
      const { error } = await supabase.storage.from("designer-media").upload(path, compressed, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
      const imageUrl = signed?.signedUrl ?? null;
      setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, uploading: false, uploaded: true, imageUrl, analyzing: !!imageUrl } : w)));
      if (!imageUrl) return;
      const { data: analysis } = await supabase.functions.invoke("analyze-artwork", { body: { source_url: imageUrl } });
      const a = analysis as { ok?: boolean; title?: string; description?: string; price_cents_min?: number; price_cents_max?: number } | null;
      setWorks((prev) => prev.map((w) => (w.id === work.id ? {
        ...w,
        analyzing: false,
        title: a?.ok && a.title ? a.title : w.title,
        description: a?.ok && a.description ? a.description : w.description,
        priceCents: a?.ok && a.price_cents_min
          ? Math.round((a.price_cents_min + (a.price_cents_max ?? a.price_cents_min)) / 2)
          : w.priceCents,
      } : w)));
    } catch {
      setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, uploading: false, uploaded: false, analyzing: false } : w)));
      toast.error("Ein Foto konnte nicht hochgeladen werden — versuch es nochmal.");
    }
  }

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList || !user) return;
    const room = MAX_WORKS - works.length;
    const files = Array.from(fileList).slice(0, Math.max(0, room));
    const newWorks: Work[] = files.map((file) => ({
      id: uid(), file, previewUrl: URL.createObjectURL(file), kind: "original", title: "", description: "",
      priceCents: null, uploading: true, uploaded: false, imageUrl: null, analyzing: false,
    }));
    setWorks((prev) => [...prev, ...newWorks]);
    newWorks.forEach((w) => void uploadAndAnalyze(w));
  }

  function removeWork(id: string) {
    setWorks((prev) => prev.filter((w) => w.id !== id));
  }

  function updateWork(id: string, patch: Partial<Work>) {
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  /** Die Rochade: lädt vorhandenes Material (Website, Screenshots, Instagram-Profil) ein und
   * befüllt Zug 1 vor — die Künstlerin bleibt frei, jedes übernommene Werk wieder abzuwählen. */
  async function runRochade() {
    if (!user || !rochadeConsent) return;
    setRochadeBusy(true);
    try {
      let screenshotUrls: string[] = [];
      if (rochadeMode === "screenshots") {
        if (rochadeFiles.length === 0) { toast.error("Bitte mindestens einen Screenshot auswählen."); return; }
        const uploaded = await Promise.all(rochadeFiles.slice(0, 6).map(async (file) => {
          try {
            const compressed = await compressImage(file).catch(() => file);
            const ext = compressed.name.split(".").pop() || "jpg";
            const path = `${user.id}/rochade-quelle/${uid()}.${ext}`;
            const { error } = await supabase.storage.from("designer-media").upload(path, compressed, { upsert: true });
            if (error) return null;
            const { data: signed } = await supabase.storage.from("designer-media").createSignedUrl(path, 60 * 60 * 24 * 365);
            return signed?.signedUrl ?? null;
          } catch { return null; }
        }));
        screenshotUrls = uploaded.filter((u): u is string => !!u);
        if (screenshotUrls.length === 0) { toast.error("Die Screenshots ließen sich nicht hochladen."); return; }
      }

      const { data } = await supabase.functions.invoke("haus-rochade", {
        body: {
          mode: rochadeMode, consent: true,
          url: rochadeMode === "url" ? rochadeUrl.trim() : undefined,
          screenshot_urls: rochadeMode === "screenshots" ? screenshotUrls : undefined,
          instagram_handle: rochadeMode === "instagram" ? rochadeHandle.trim() : undefined,
        },
      });
      const r = data as {
        ok?: boolean; message?: string; brand_name?: string | null; about_text?: string | null;
        works?: { kind: WorkKind; title: string; description: string; image_url: string }[];
        dna?: Record<string, unknown> | null; source_type?: string; source_ref?: string;
      } | null;

      if (!r?.ok) { toast.error(r?.message ?? "Das hat nicht geklappt — leg deine Werke lieber von Hand an."); return; }

      const imported: Work[] = (r.works ?? []).map((w) => ({
        id: uid(), previewUrl: w.image_url, kind: w.kind, title: w.title, description: w.description,
        priceCents: null, uploading: false, uploaded: true, imageUrl: w.image_url, analyzing: false,
      }));
      setWorks((prev) => [...imported, ...prev]);
      if (r.brand_name && !brandName.trim()) setBrandName(r.brand_name);
      if (r.about_text && !aboutText.trim()) { setAboutText(r.about_text); setAboutSource("chips"); }
      if (r.dna) setRochadeDna(r.dna);
      if (r.source_type) setRochadeSource({ type: r.source_type, ref: r.source_ref ?? "", at: new Date().toISOString() });
      setRochadeOpen(false);
      toast.success(`${imported.length} Werk${imported.length === 1 ? "" : "e"} übernommen — schau sie dir an und passe an, was nicht passt.`);
    } finally {
      setRochadeBusy(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        void sendRecording(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Mikrofon nicht verfügbar — beantworte stattdessen die kurzen Fragen.");
      setShowChips(true);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function sendRecording(blob: Blob) {
    setTranscribing(true);
    try {
      const base64 = await blobToBase64(blob);
      const { data } = await supabase.functions.invoke("transcribe-voice", { body: { audio_base64: base64, mime_type: blob.type } });
      const r = data as { ok?: boolean; text?: string; message?: string } | null;
      if (r?.ok && r.text) {
        setAboutText(r.text);
        setAboutSource("voice");
      } else {
        toast.error(r?.message ?? "Die Aufnahme ließ sich nicht verarbeiten.");
        setShowChips(true);
      }
    } finally {
      setTranscribing(false);
    }
  }

  function pickChip(key: "medium" | "haltung" | "wunsch", value: string) {
    const next = { ...chipAnswers, [key]: value };
    setChipAnswers(next);
    const text = chipsToText(next);
    if (text) { setAboutText(text); setAboutSource("chips"); }
  }

  const uploadedWorks = works.filter((w) => w.uploaded && w.imageUrl);
  const canProceedZeigen = !!user && brandName.trim().length > 0 && uploadedWorks.length >= 1 && aboutText.trim().length > 0;

  async function handlePublish() {
    setPublishing(true);
    try {
      const { data, error } = await supabase.rpc("first_move_publish" as never);
      const r = data as { ok?: boolean; slug?: string; error?: string } | null;
      if (error || !r?.ok) {
        toast.error("Das hat nicht geklappt — versuch's nochmal.");
        setPublishing(false);
        return;
      }
      setPublished({ slug: r.slug! });
      window.setTimeout(() => navigate("/studio"), reducedMotion ? 300 : 2200);
    } catch {
      toast.error("Das hat nicht geklappt — versuch's nochmal.");
      setPublishing(false);
    }
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="flex items-center justify-between border-b-[1.5px] border-black px-6 py-4 md:px-10">
        <PawnWordmark as="div" className="text-lg" />
        <Link to="/" className="text-[0.62rem] uppercase tracking-[0.3em] text-black/70 hover:text-black">
          Abbrechen
        </Link>
      </header>

      <div className="mx-auto max-w-[720px] px-6 py-10 md:px-10 md:py-16">
        {!published && (
          <p className="mb-8 text-[0.62rem] uppercase tracking-[0.34em] text-black/60">
            Zug {stepIndex + 1} von 3 · {STEP_LABEL[step]}
          </p>
        )}

        {loadingSession ? (
          <div className="flex items-center gap-3 py-16 text-sm text-black/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
          </div>
        ) : published ? (
          <SuccessState slug={published.slug} brandName={brandName} reducedMotion={reducedMotion} />
        ) : step === "zeigen" ? (
          <ZeigenStep
            user={!!user}
            accountMode={accountMode} setAccountMode={setAccountMode}
            email={email} setEmail={setEmail} password={password} setPassword={setPassword}
            accountBusy={accountBusy} onAccount={handleAccount}
            brandName={brandName} setBrandName={setBrandName}
            location={location} setLocation={setLocation} country={country} setCountry={setCountry}
            works={works} fileInputRef={fileInputRef} onFilesSelected={onFilesSelected}
            removeWork={removeWork} updateWork={updateWork}
            aboutText={aboutText} setAboutText={setAboutText} aboutSource={aboutSource}
            recording={recording} transcribing={transcribing}
            startRecording={startRecording} stopRecording={stopRecording}
            showChips={showChips} setShowChips={setShowChips}
            chipAnswers={chipAnswers} pickChip={pickChip}
            rochadeOpen={rochadeOpen} setRochadeOpen={setRochadeOpen}
            rochadeMode={rochadeMode} setRochadeMode={setRochadeMode}
            rochadeConsent={rochadeConsent} setRochadeConsent={setRochadeConsent}
            rochadeUrl={rochadeUrl} setRochadeUrl={setRochadeUrl}
            rochadeHandle={rochadeHandle} setRochadeHandle={setRochadeHandle}
            rochadeFiles={rochadeFiles} setRochadeFiles={setRochadeFiles}
            rochadeFileInputRef={rochadeFileInputRef}
            rochadeBusy={rochadeBusy} onRochade={runRochade}
            rochadeSource={rochadeSource}
          />
        ) : step === "bestaetigen" ? (
          <BestaetigenStep
            works={works} updateWork={updateWork}
            shippingDeEu={shippingDeEu} setShippingDeEu={setShippingDeEu}
            billing={billing} setBilling={setBilling} brandName={brandName}
          />
        ) : (
          <ZiehenStep brandName={brandName} works={uploadedWorks} publishing={publishing} onPublish={handlePublish} />
        )}

        {!published && !loadingSession && (
          <div className="mt-10 flex items-center justify-between border-t-[1.5px] border-black pt-6">
            <Button
              type="button" variant="outline" size="chip"
              disabled={stepIndex === 0}
              onClick={() => setStep(STEP_ORDER[Math.max(0, stepIndex - 1)])}
              className="disabled:invisible"
            >
              Zurück
            </Button>
            {step !== "ziehen" && (
              <Button
                type="button" variant="editorial" size="chip"
                disabled={step === "zeigen" ? !canProceedZeigen : false}
                onClick={() => setStep(STEP_ORDER[Math.min(STEP_ORDER.length - 1, stepIndex + 1)])}
              >
                Weiter
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ZeigenStep(props: {
  user: boolean;
  accountMode: "neu" | "login"; setAccountMode: (m: "neu" | "login") => void;
  email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void;
  accountBusy: boolean; onAccount: () => void;
  brandName: string; setBrandName: (v: string) => void;
  location: string; setLocation: (v: string) => void; country: string; setCountry: (v: string) => void;
  works: Work[]; fileInputRef: React.RefObject<HTMLInputElement>;
  onFilesSelected: (f: FileList | null) => void;
  removeWork: (id: string) => void; updateWork: (id: string, p: Partial<Work>) => void;
  aboutText: string; setAboutText: (v: string) => void; aboutSource: "voice" | "chips" | null;
  recording: boolean; transcribing: boolean;
  startRecording: () => void; stopRecording: () => void;
  showChips: boolean; setShowChips: (v: boolean) => void;
  chipAnswers: Partial<Record<"medium" | "haltung" | "wunsch", string>>;
  pickChip: (k: "medium" | "haltung" | "wunsch", v: string) => void;
  rochadeOpen: boolean; setRochadeOpen: (v: boolean) => void;
  rochadeMode: "url" | "screenshots" | "instagram"; setRochadeMode: (v: "url" | "screenshots" | "instagram") => void;
  rochadeConsent: boolean; setRochadeConsent: (v: boolean) => void;
  rochadeUrl: string; setRochadeUrl: (v: string) => void;
  rochadeHandle: string; setRochadeHandle: (v: string) => void;
  rochadeFiles: File[]; setRochadeFiles: (f: File[]) => void;
  rochadeFileInputRef: React.RefObject<HTMLInputElement>;
  rochadeBusy: boolean; onRochade: () => void;
  rochadeSource: { type: string; ref: string; at: string } | null;
}) {
  if (!props.user) {
    return (
      <div className="border-[1.5px] border-black p-6 md:p-8">
        <h1 className="font-serif text-2xl">Bevor's losgeht: dein Zugang.</h1>
        <p className="mt-2 text-sm text-black/70">Nur E-Mail und ein Passwort — der Rest ist Import, keine Konstruktion.</p>
        <div className="mt-6 space-y-3">
          <Input type="email" placeholder="E-Mail" value={props.email} onChange={(e) => props.setEmail(e.target.value)} />
          <Input type="password" placeholder="Passwort (mind. 8 Zeichen)" value={props.password} onChange={(e) => props.setPassword(e.target.value)} />
          <Button type="button" variant="editorial" size="chip" loading={props.accountBusy} onClick={props.onAccount} className="w-full">
            {props.accountMode === "neu" ? "Zugang anlegen" : "Anmelden"}
          </Button>
          <Button
            type="button" variant="link" size="sm"
            className="h-auto p-0 text-[0.62rem] uppercase tracking-[0.24em] text-black/60 hover:text-black hover:no-underline"
            onClick={() => props.setAccountMode(props.accountMode === "neu" ? "login" : "neu")}
          >
            {props.accountMode === "neu" ? "Ich hab schon einen Zugang" : "Neuen Zugang anlegen"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Zeig uns dein Werk.</h1>
        <p className="mt-2 text-sm text-black/70">5–10 Fotos zeigen dein Haus am besten — weniger geht auch.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input placeholder="Wie heißt dein Haus?" value={props.brandName} onChange={(e) => props.setBrandName(e.target.value)} className="sm:col-span-3" />
        <Input placeholder="Ort" value={props.location} onChange={(e) => props.setLocation(e.target.value)} className="sm:col-span-2" />
        <Input placeholder="Land" value={props.country} onChange={(e) => props.setCountry(e.target.value)} />
      </div>

      <RochadeBlock {...props} />

      <div>
        <Input
          ref={props.fileInputRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { props.onFilesSelected(e.target.files); e.target.value = ""; }}
        />
        <Button
          type="button" variant="outline"
          onClick={() => props.fileInputRef.current?.click()}
          className="flex h-auto w-full items-center justify-center border-[1.5px] border-dashed border-black px-6 py-10 text-[0.68rem] uppercase tracking-[0.28em] hover:bg-black hover:text-white"
        >
          Fotos hinzufügen
        </Button>

        {props.works.length > 0 && (
          <ul className="mt-6 space-y-4">
            {props.works.map((w) => (
              <li key={w.id} className="flex gap-4 border-[1.5px] border-black p-3">
                <img src={w.previewUrl} alt="" className="h-24 w-24 shrink-0 object-cover" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => props.updateWork(w.id, { kind: "original" })}
                      className={`h-auto border-[1.5px] border-black px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] ${w.kind === "original" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
                    >
                      Original
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => props.updateWork(w.id, { kind: "print" })}
                      className={`h-auto border-[1.5px] border-black px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] ${w.kind === "print" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
                    >
                      Print
                    </Button>
                    {(w.uploading || w.analyzing) && <Loader2 className="h-3.5 w-3.5 animate-spin text-black/50" />}
                    <Button type="button" variant="ghost" size="icon" onClick={() => props.removeWork(w.id)} className="ml-auto h-auto w-auto p-1 text-black/40 hover:bg-transparent hover:text-black">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Titel" value={w.title}
                    onChange={(e) => props.updateWork(w.id, { title: e.target.value })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-serif text-lg">Wer steht dahinter?</h2>
        {!props.showChips ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              {!props.recording ? (
                <Button type="button" variant="outline" size="chip" onClick={props.startRecording} disabled={props.transcribing}>
                  <Mic className="h-4 w-4" /> Aufnehmen
                </Button>
              ) : (
                <Button type="button" variant="editorial" size="chip" onClick={props.stopRecording}>
                  <Square className="h-4 w-4" /> Fertig
                </Button>
              )}
              {props.transcribing && <span className="flex items-center gap-2 text-sm text-black/60"><Loader2 className="h-4 w-4 animate-spin" /> Wird verschriftlicht …</span>}
              <Button
                type="button" variant="link" size="sm"
                className="ml-auto h-auto p-0 text-[0.6rem] uppercase tracking-[0.22em] text-black/50 hover:text-black hover:no-underline"
                onClick={() => props.setShowChips(true)}
              >
                Lieber kurze Fragen
              </Button>
            </div>
            {props.aboutText && (
              <p className="border-l-[1.5px] border-black pl-3 text-sm italic text-black/80">{props.aboutText}</p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-5">
            {CHIP_FRAGEN.map((f) => (
              <div key={f.key}>
                <p className="text-sm text-black/70">{f.label}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((opt) => (
                    <Button
                      key={opt} type="button" variant="outline" size="sm"
                      onClick={() => props.pickChip(f.key, opt)}
                      className={`h-auto border-[1.5px] border-black px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] ${props.chipAnswers[f.key] === opt ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {props.aboutText && <p className="border-l-[1.5px] border-black pl-3 text-sm italic text-black/80">{props.aboutText}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Die Rochade: bestehendes Material einlesen statt bei null anzufangen. Drei gleichwertige
 * Eingänge, ein Bestätigungs-Tap. Übernommene Werke landen als ganz normale, wieder abwählbare
 * Einträge in props.works — die Künstlerin bleibt in jedem Fall die letzte Instanz. */
function RochadeBlock(props: {
  rochadeOpen: boolean; setRochadeOpen: (v: boolean) => void;
  rochadeMode: "url" | "screenshots" | "instagram"; setRochadeMode: (v: "url" | "screenshots" | "instagram") => void;
  rochadeConsent: boolean; setRochadeConsent: (v: boolean) => void;
  rochadeUrl: string; setRochadeUrl: (v: string) => void;
  rochadeHandle: string; setRochadeHandle: (v: string) => void;
  rochadeFiles: File[]; setRochadeFiles: (f: File[]) => void;
  rochadeFileInputRef: React.RefObject<HTMLInputElement>;
  rochadeBusy: boolean; onRochade: () => void;
  rochadeSource: { type: string; ref: string; at: string } | null;
}) {
  if (!props.rochadeOpen) {
    return (
      <div>
        <Button
          type="button" variant="link" size="sm"
          className="h-auto p-0 text-[0.62rem] uppercase tracking-[0.24em] text-black/60 hover:text-black hover:no-underline"
          onClick={() => props.setRochadeOpen(true)}
        >
          Hast du schon eine Website oder ein Instagram-Profil? Einlesen.
        </Button>
        {props.rochadeSource && (
          <p className="mt-1 text-[0.62rem] text-black/50">Übernommen aus {props.rochadeSource.ref}.</p>
        )}
      </div>
    );
  }

  const modeLabel: Record<typeof props.rochadeMode, string> = { url: "Website", screenshots: "Screenshots", instagram: "Instagram" };

  return (
    <div className="border-[1.5px] border-black p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-black/60">Die Rochade — bestehendes Material einlesen</p>
        <Button type="button" variant="ghost" size="sm" className="h-auto w-auto p-1 text-black/40 hover:bg-transparent hover:text-black" onClick={() => props.setRochadeOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(modeLabel) as (typeof props.rochadeMode)[]).map((m) => (
          <Button
            key={m} type="button" variant="outline" size="sm"
            onClick={() => props.setRochadeMode(m)}
            className={`h-auto border-[1.5px] border-black px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] ${props.rochadeMode === m ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
          >
            {modeLabel[m]}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {props.rochadeMode === "url" && (
          <Input placeholder="https://deine-website.de" value={props.rochadeUrl} onChange={(e) => props.setRochadeUrl(e.target.value)} />
        )}
        {props.rochadeMode === "instagram" && (
          <Input placeholder="@dein.handle" value={props.rochadeHandle} onChange={(e) => props.setRochadeHandle(e.target.value)} />
        )}
        {props.rochadeMode === "screenshots" && (
          <div>
            <Input
              ref={props.rochadeFileInputRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { props.setRochadeFiles(Array.from(e.target.files ?? []).slice(0, 6)); }}
            />
            <Button type="button" variant="outline" onClick={() => props.rochadeFileInputRef.current?.click()} className="h-auto w-full py-3 text-[0.62rem] uppercase tracking-[0.24em]">
              {props.rochadeFiles.length > 0 ? `${props.rochadeFiles.length} ausgewählt` : "Screenshots auswählen"}
            </Button>
          </div>
        )}
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <Checkbox checked={props.rochadeConsent} onCheckedChange={(v) => props.setRochadeConsent(!!v)} className="mt-0.5" />
        Das ist meine Website — das sind meine Inhalte.
      </label>

      <Button
        type="button" variant="editorial" size="chip" loading={props.rochadeBusy}
        disabled={!props.rochadeConsent}
        onClick={props.onRochade}
        className="mt-4"
      >
        Übernehmen
      </Button>
    </div>
  );
}

function BestaetigenStep(props: {
  works: Work[]; updateWork: (id: string, p: Partial<Work>) => void;
  shippingDeEu: boolean; setShippingDeEu: (v: boolean) => void;
  billing: Billing; setBilling: (b: Billing) => void; brandName: string;
}) {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-2xl">Bestätigen.</h1>
        <p className="mt-2 text-sm text-black/70">Alles hier ist ein Vorschlag — antippen, was du ändern willst.</p>
      </div>

      <div>
        <h2 className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-black/60">Preise</h2>
        <ul className="space-y-3">
          {props.works.map((w) => (
            <li key={w.id} className="flex items-center gap-3 border-[1.5px] border-black p-3">
              <img src={w.previewUrl} alt="" className="h-12 w-12 shrink-0 object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm">{w.title || "Ohne Titel"}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Input
                  type="number" min={0}
                  value={formatEur(w.priceCents)}
                  onChange={(e) => props.updateWork(w.id, { priceCents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                  className="w-24"
                />
                <span className="text-sm">€</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-black/60">Versand</h2>
        <label className="flex items-center gap-3 text-sm">
          <Checkbox checked={props.shippingDeEu} onCheckedChange={(v) => props.setShippingDeEu(!!v)} />
          Deutschland &amp; EU versenden (Standard-Sätze, später anpassbar)
        </label>
      </div>

      <div>
        <h2 className="mb-1 text-[0.62rem] uppercase tracking-[0.28em] text-black/60">Rechtstexte</h2>
        <p className="mb-3 text-sm text-black/60">Automatisch erstellt aus deinen Angaben — jederzeit unter /studio/versand anpassbar.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Name (rechtlich)" value={props.billing.legal_name || props.brandName}
            onChange={(e) => props.setBilling({ ...props.billing, legal_name: e.target.value })} className="sm:col-span-2" />
          <Input placeholder="Straße, Hausnummer" value={props.billing.address_line1}
            onChange={(e) => props.setBilling({ ...props.billing, address_line1: e.target.value })} className="sm:col-span-2" />
          <Input placeholder="PLZ" value={props.billing.postal_code}
            onChange={(e) => props.setBilling({ ...props.billing, postal_code: e.target.value })} />
          <Input placeholder="Ort" value={props.billing.city}
            onChange={(e) => props.setBilling({ ...props.billing, city: e.target.value })} />
          <Input placeholder="Steuernummer / USt-IdNr. (optional)" value={props.billing.tax_id}
            onChange={(e) => props.setBilling({ ...props.billing, tax_id: e.target.value })} className="sm:col-span-2" />
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm">
          <Checkbox checked={props.billing.kleinunternehmer} onCheckedChange={(v) => props.setBilling({ ...props.billing, kleinunternehmer: !!v })} />
          Kleinunternehmerregelung (§19 UStG)
        </label>
      </div>
    </div>
  );
}

function ZiehenStep(props: { brandName: string; works: Work[]; publishing: boolean; onPublish: () => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl">Letzter Blick, dann geht's live.</h1>
        <p className="mt-2 text-sm text-black/70">
          <span className="font-serif italic">{props.brandName || "Dein Haus"}</span> mit {props.works.length} {props.works.length === 1 ? "Werk" : "Werken"}.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {props.works.slice(0, 5).map((w) => (
          <img key={w.id} src={w.previewUrl} alt="" className="aspect-square w-full object-cover" />
        ))}
      </div>
      <Button type="button" variant="editorial" size="chip" loading={props.publishing} onClick={props.onPublish} className="w-full">
        Zug machen.
      </Button>
    </div>
  );
}

function SuccessState({ slug, brandName, reducedMotion }: { slug: string; brandName: string; reducedMotion: boolean }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <svg
        viewBox="0 0 40 52" className={`h-16 w-auto ${reducedMotion ? "" : "animate-[first-move-step_1.6s_ease-out]"}`} aria-hidden
      >
        <g fill="#000">
          <circle cx="20" cy="10" r="7.5" /><path d="M13 18h14l-2.5 6h-9z" /><path d="M15.5 24h9l2.5 15H13z" /><rect x="8" y="39" width="24" height="6" />
        </g>
      </svg>
      <h1 className="mt-6 font-serif text-3xl">
        <span className="italic">{brandName || "Dein Haus"}</span> ist live.
      </h1>
      <p className="mt-3 text-sm text-black/70">pawn.vision/designer/{slug}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" size="chip">
          <Link to={`/designer/${slug}`}>Haus ansehen</Link>
        </Button>
        <Button asChild variant="editorial" size="chip">
          <Link to="/studio">Zum Studio</Link>
        </Button>
      </div>
      <style>{`@keyframes first-move-step { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
