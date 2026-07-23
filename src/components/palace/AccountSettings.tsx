import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Gemeinsamer Einstellungs-Aufbau für Kunden (/account) und Designer
 * (/studio/einstellungen) — in der Bildsprache der Genom-Karte (harte
 * schwarz/weiß-Karten, editorial-eyebrow, Playfair-Serifen). Fünf Abschnitte:
 * Zugang, Zahlung (rollenspezifischer Slot von außen), Datenschutz,
 * Benachrichtigungen, Sprache. Alles read-safe.
 */

export function SettingsSection({
  eyebrow, title, subtitle, children, className,
}: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("border-[1.5px] border-black bg-white p-6 md:p-8", className)}>
      <div>
        {eyebrow && <p className="editorial-eyebrow text-black/50">{eyebrow}</p>}
        <h3 className="mt-1 font-serif text-xl leading-tight text-black">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-black/60">{subtitle}</p>}
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

export function SettingsRow({
  label, description, action,
}: { label: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 pt-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-black">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-black/60">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SettingsToggle({
  checked, onChange, disabled, label,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40"
    >
      <span className={cn("relative h-6 w-11 border-[1.5px] border-black transition-colors", checked ? "bg-black" : "bg-white")}>
        <span
          className={cn(
            "absolute top-0.5 h-[18px] w-[18px] transition-transform",
            checked ? "translate-x-[22px] bg-white" : "translate-x-0.5 bg-black",
          )}
        />
      </span>
    </button>
  );
}

function inputClass() {
  return "w-full border-[1.5px] border-black bg-white px-3 py-2 text-sm focus:outline-none";
}
function btnClass() {
  return "border-[1.5px] border-black px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white disabled:opacity-40";
}

function useUserPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
      setPrefs(((data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {}) as Record<string, unknown>);
      setLoading(false);
    })();
  }, [user]);

  const save = async (patch: Record<string, unknown>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await supabase.from("user_memory" as never).upsert({
      user_id: user.id,
      preferences: next,
      updated_at: new Date().toISOString(),
    } as never);
  };

  return { prefs, loading, save };
}

function ZugangSection() {
  const { user, signOut } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const provider = user?.app_metadata?.provider === "google" ? "Google" : t("auth.password");
  const hasPasswordIdentity = !user?.identities || user.identities.some((i) => i.provider === "email");

  const saveEmail = async () => {
    if (!email || email === user?.email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Bestätigungslink an die neue Adresse gesendet.");
  };

  const savePassword = async () => {
    if (pw1.length < 8) return toast.error("Mindestens 8 Zeichen.");
    if (pw1 !== pw2) return toast.error("Passwörter stimmen nicht überein.");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setPw1(""); setPw2("");
    toast.success("Passwort geändert.");
  };

  return (
    <SettingsSection eyebrow={t("settings.access")} title="Wie du reinkommst" subtitle={t("settings.accessSubtitle")}>
      <SettingsRow label={t("settings.signInMethod")} description={`Du meldest dich über ${provider} an.`} />

      <SettingsRow
        label={t("settings.emailAddress")}
        description="Änderung braucht eine Bestätigung über die neue Adresse."
        action={
          <div className="flex items-center gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={cn(inputClass(), "w-56")} />
            <button type="button" onClick={() => void saveEmail()} disabled={savingEmail} className={btnClass()}>
              {savingEmail ? "…" : t("common.change")}
            </button>
          </div>
        }
      />

      {hasPasswordIdentity && (
        <SettingsRow
          label={t("settings.changePassword")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" placeholder="Neues Passwort" value={pw1} onChange={(e) => setPw1(e.target.value)} className={cn(inputClass(), "w-40")} />
              <input type="password" placeholder="Wiederholen" value={pw2} onChange={(e) => setPw2(e.target.value)} className={cn(inputClass(), "w-40")} />
              <button type="button" onClick={() => void savePassword()} disabled={savingPw} className={btnClass()}>
                {savingPw ? "…" : t("common.save")}
              </button>
            </div>
          }
        />
      )}

      <SettingsRow
        label={t("settings.session")}
        description={user?.last_sign_in_at ? `Zuletzt angemeldet am ${formatDate(user.last_sign_in_at, locale)}.` : undefined}
        action={
          <button type="button" onClick={() => { void signOut(); navigate("/"); }} className={btnClass()}>
            {t("nav.logout")}
          </button>
        }
      />
    </SettingsSection>
  );
}

function DatenschutzSection() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const consent = useConsent();
  const [personalization, setPersonalization] = useState(profile?.consent.personalization ?? false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { setPersonalization(profile?.consent.personalization ?? false); }, [profile?.consent.personalization]);

  const togglePersonalization = async (v: boolean) => {
    if (!user) return;
    setBusy(true);
    setPersonalization(v);
    const { error } = await supabase.from("profiles").update({ consent_personalization: v }).eq("id", user.id);
    setBusy(false);
    if (error) { setPersonalization(!v); toast.error(error.message); return; }
    toast.success(v ? "Personalisierung an." : "Personalisierung aus.");
  };

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    const [profileRow, events, signals, sessions] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("domain_events").select("*").eq("actor", user.id).limit(500),
      supabase.from("domain_events").select("*").eq("type", "ai.taste_signal").contains("payload", { user_id: user.id }).limit(500),
      supabase.from("ai_sessions").select("*").eq("user_id", user.id),
    ]);
    const bundle = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile: profileRow.data,
      events: events.data,
      signals: signals.data,
      sessions: sessions.data,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pawn-daten-${user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("Deine Daten wurden heruntergeladen.");
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("delete-account", {});
    if (error || (data as { error?: string })?.error) {
      setBusy(false);
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Löschen fehlgeschlagen.");
      return;
    }
    window.location.href = "/";
  };

  return (
    <SettingsSection eyebrow={t("settings.privacy")} title="Was PAWN weiß — und was nicht" subtitle={t("settings.privacySubtitle")}>
      <SettingsRow
        label="Speicherung über diesen Besuch hinaus"
        description={consent.value === "accepted" ? "Aktiv — Signale werden dauerhaft aggregiert." : "Aus — nur technisch Notwendiges, nichts wird dauerhaft gemerkt."}
        action={
          <button type="button" onClick={consent.reopen} className={btnClass()}>
            Einstellungen öffnen
          </button>
        }
      />
      <SettingsRow
        label={t("settings.personalization")}
        description="Passt Vorschläge und Ton an das an, was du in Gesprächen und beim Merken zeigst. Aus lässt PAWN neutral."
        action={<SettingsToggle checked={personalization} onChange={(v) => void togglePersonalization(v)} disabled={busy || !user} label={t("settings.personalization")} />}
      />
      <SettingsRow
        label="Was PAWN sich merkt"
        description="Kleine Notizen aus Gesprächen — einsehbar und einzeln löschbar unter Deine DNA."
        action={
          <a href="/dna" className="text-[0.68rem] uppercase tracking-[0.22em] underline decoration-1 underline-offset-4 hover:no-underline">
            Ansehen →
          </a>
        }
      />
      <SettingsRow
        label={t("settings.dataExport")}
        description="Alles, was wir über dich wissen — als JSON."
        action={
          <button type="button" onClick={() => void exportData()} disabled={exporting} className={btnClass()}>
            {exporting ? "…" : t("common.download")}
          </button>
        }
      />
      <SettingsRow
        label={t("settings.deleteAccount")}
        description="Endgültig. Bestellungen und Buchhaltungsdaten bleiben — anonymisiert — aus gesetzlichen Gründen erhalten."
        action={
          !confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className="border-[1.5px] border-destructive px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] text-destructive hover:bg-destructive hover:text-destructive-foreground">
              {t("common.delete")}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void deleteAccount()} disabled={busy} className="border-[1.5px] border-destructive bg-destructive px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] text-destructive-foreground disabled:opacity-50">
                {busy ? "…" : "Ja, endgültig"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={btnClass()}>{t("common.cancel")}</button>
            </div>
          )
        }
      />
    </SettingsSection>
  );
}

function BenachrichtigungenSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { prefs, loading, save } = useUserPreferences();
  const orderMails = (prefs.notify_orders_email as boolean | undefined) ?? true;
  const newsMails = (prefs.notify_news_email as boolean | undefined) ?? false;

  return (
    <SettingsSection eyebrow={t("settings.notifications")} title="Was dich erreicht" subtitle="Per Mail — oder nur im Haus, wenn du eh vorbeischaust.">
      <SettingsRow
        label="Bestellungen & Versand"
        description="Status-Updates zu deinen Bestellungen per E-Mail."
        action={<SettingsToggle checked={orderMails} onChange={(v) => void save({ notify_orders_email: v })} disabled={loading || !user} label="Bestellungen per E-Mail" />}
      />
      <SettingsRow
        label="Neuigkeiten & Empfehlungen"
        description="Gelegentliche Post zu neuen Häusern und Editionen."
        action={<SettingsToggle checked={newsMails} onChange={(v) => void save({ notify_news_email: v })} disabled={loading || !user} label="Neuigkeiten per E-Mail" />}
      />
      <SettingsRow
        label="Im Haus"
        description="Anfragen, Signale und Konto-Ereignisse siehst du immer in deinem Konto — unabhängig von der Mail-Wahl oben."
      />
    </SettingsSection>
  );
}

function SpracheSection() {
  const { locale, setLocale, t } = useI18n();
  return (
    <SettingsSection eyebrow={t("settings.language")} title="Deutsch oder Englisch" subtitle="Gilt überall — dieselbe Einstellung wie im Kopf der Seite.">
      <SettingsRow
        label={t("settings.languageOfInterface")}
        action={
          <div className="flex border-[1.5px] border-black">
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={cn(
                  "min-h-[44px] px-4 text-[0.68rem] uppercase tracking-[0.22em] transition-colors",
                  locale === l ? "bg-black text-white" : "bg-white text-black hover:bg-black/5",
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />
    </SettingsSection>
  );
}

export function AccountSettingsPanel({
  role, paymentSlot,
}: { role: "customer" | "designer"; paymentSlot?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <ZugangSection />
      {paymentSlot && (
        <SettingsSection eyebrow={t("settings.payment")} title={role === "designer" ? "Auszahlung & Plan" : "Zahlung & Adressen"}>
          {paymentSlot}
        </SettingsSection>
      )}
      <DatenschutzSection />
      <BenachrichtigungenSection />
      <SpracheSection />
    </div>
  );
}
