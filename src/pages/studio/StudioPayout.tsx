import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useVerkaufsbereitschaft } from "@/features/studio/useVerkaufsbereitschaft";
import { STRIPE_ANFORDERUNGEN } from "@/features/commerce/verkaufsbereit";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useAuth } from "@/lib/auth";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Stripe nennt fehlende Angaben in Fachbegriffen — hier in Klartext übersetzt.
const REQUIREMENT_LABEL_KEYS: Record<string, string> = {
  "individual.verification.document": "studio.payout.requirement.idPhoto",
  "individual.id_number": "studio.payout.requirement.idNumber",
  "individual.address.line1": "studio.payout.requirement.address",
  "external_account": "studio.payout.requirement.bankAccount",
  "business_profile.url": "studio.payout.requirement.website",
  "business_profile.mcc": "studio.payout.requirement.industry",
  "tos_acceptance.date": "studio.payout.requirement.tosAcceptance",
};

type ConnectState = "none" | "pending" | "active" | "payouts" | "error";


interface ConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled?: boolean;
  requirements_due?: string[];
}


interface BillingProfile {
  legal_name: string; address_line1: string; address_line2: string; postal_code: string; city: string; country: string;
  tax_id: string; kleinunternehmer: boolean;
  return_address_line1: string; return_address_line2: string; return_postal_code: string; return_city: string; return_country: string;
}
const EMPTY_BILLING: BillingProfile = {
  legal_name: "", address_line1: "", address_line2: "", postal_code: "", city: "", country: "DE",
  tax_id: "", kleinunternehmer: false,
  return_address_line1: "", return_address_line2: "", return_postal_code: "", return_city: "", return_country: "",
};

interface ShippingZone { flat_cents: number; free_from_cents: number | null }
interface ShippingRates { inland: ShippingZone; eu: ShippingZone; world: ShippingZone }
const EMPTY_SHIPPING: ShippingRates = {
  inland: { flat_cents: 0, free_from_cents: null },
  eu: { flat_cents: 0, free_from_cents: null },
  world: { flat_cents: 0, free_from_cents: null },
};

export default function StudioPayout() {
  const { t } = useI18n();
  const { designer, refresh } = useMyDesigner();
  const verkauf = useVerkaufsbereitschaft();
  // Stripe-Fachbegriffe in Klartext, ohne Dopplungen; unbekannte Schlüssel bleiben ehrlich stehen.
  const reqTexte = (keys: string[]): string[] => {
    const out: string[] = [];
    for (const k of keys) {
      const text = REQUIREMENT_LABEL_KEYS[k] ? t(REQUIREMENT_LABEL_KEYS[k]) : (STRIPE_ANFORDERUNGEN[k] ?? k);
      if (!out.includes(text)) out.push(text);
    }
    return out.slice(0, 8);
  };
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setupBlocked, setSetupBlocked] = useState<string | null>(null);
  const [commissionPct, setCommissionPct] = useState<number>(7);


  const [billing, setBilling] = useState<BillingProfile>(EMPTY_BILLING);
  const [billingSaving, setBillingSaving] = useState(false);
  const [shipping, setShipping] = useState<ShippingRates>(EMPTY_SHIPPING);
  const [shippingSaving, setShippingSaving] = useState(false);
  const [vatRate, setVatRate] = useState<number>(19);
  const [returnDays, setReturnDays] = useState<number>(14);
  const [taxSaving, setTaxSaving] = useState(false);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("designer_billing_profiles").select("*").eq("designer_id", designer.id).maybeSingle()
      .then(({ data }) => { if (data) setBilling({ ...EMPTY_BILLING, ...(data as Partial<BillingProfile>) }); });
    const rates = designer.shipping_rates as Partial<ShippingRates> | null;
    if (rates) setShipping({ ...EMPTY_SHIPPING, ...rates, inland: { ...EMPTY_SHIPPING.inland, ...rates.inland }, eu: { ...EMPTY_SHIPPING.eu, ...rates.eu }, world: { ...EMPTY_SHIPPING.world, ...rates.world } });
    setVatRate(Number(designer.vat_rate ?? 19));
    setReturnDays(Number(designer.return_window_days ?? 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer?.id]);

  async function saveBilling() {
    if (!designer) return;
    setBillingSaving(true);
    const { error } = await supabase.from("designer_billing_profiles").upsert({ designer_id: designer.id, ...billing }, { onConflict: "designer_id" });
    setBillingSaving(false);
    if (error) { toast.error("Deine Rechnungsdaten konnten nicht gespeichert werden. Prüfe die Felder und versuch es noch einmal."); return; }
    toast.success(t("studio.payout.billing.saved"));
  }

  async function saveTax() {
    if (!designer) return;
    setTaxSaving(true);
    const { error } = await supabase.from("designers")
      .update({ vat_rate: vatRate, return_window_days: returnDays })
      .eq("id", designer.id);
    setTaxSaving(false);
    if (error) { toast.error("Die Steuer-Angaben konnten nicht gespeichert werden. Versuch es gleich noch einmal."); return; }
    toast.success(t("studio.payout.tax.saved"));
    void refresh();
  }

  async function saveShipping() {
    if (!designer) return;
    setShippingSaving(true);
    const { error } = await supabase.from("designers").update({ shipping_rates: JSON.parse(JSON.stringify(shipping)) }).eq("id", designer.id);
    setShippingSaving(false);
    if (error) { toast.error("Die Versandkosten konnten nicht gespeichert werden. Versuch es gleich noch einmal."); return; }
    toast.success(t("studio.payout.shipping.saved"));
  }

  useEffect(() => {
    void supabase.from("ai_config").select("value").eq("key", "platform_commission").maybeSingle()
      .then(({ data }) => {
        const pct = Number(((data?.value ?? {}) as { pct?: number }).pct ?? 7);
        setCommissionPct(pct);
      });
  }, []);

  useEffect(() => {
    if (!designer) return;
    setLoadingStatus(true);
    void supabase.functions.invoke("stripe-connect", { body: { action: "status" } })
      .then(({ data, error }) => {
        if (error) { toast.error(t("studio.payout.error.settingUp")); setLoadingStatus(false); return; }
        const result = data as { error?: string; message?: string } & ConnectStatus;
        if (result?.error) { toast.error(result.message ?? t("studio.payout.error.statusLoadFailed")); setLoadingStatus(false); return; }
        setStatus(result);
        setLoadingStatus(false);
        void refresh();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer?.id]);

  async function connect() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", { body: { action: "onboard" } });
      if (error) { toast.error(t("studio.payout.error.settingUp")); return; }
      const result = data as { error?: string; message?: string; url?: string; detail?: string };
      if (result?.error === "platform_setup_required") {
        setSetupBlocked(result.message ?? t("studio.payout.error.platformSetup"));
        if (isAdmin && result.detail) toast.error(result.detail, { duration: 12000 });
        else toast.error(result.message ?? t("studio.payout.error.platformSetup"));
        return;
      }
      if (result?.error) { toast.error(result.message ?? t("studio.payout.error.connectFailed")); return; }
      if (result?.url) window.location.href = result.url;
    } catch {
      toast.error(t("studio.payout.error.settingUp"));
    } finally {
      setBusy(false);
    }
  }


  async function openDashboard() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", { body: { action: "dashboard" } });
      if (error) { toast.error(t("studio.payout.error.dashboardUnavailable")); return; }
      const result = data as { error?: string; message?: string; url?: string };
      if (result?.error) { toast.error(result.message ?? t("studio.payout.error.dashboardUnavailable")); return; }
      if (result?.url) window.open(result.url, "_blank", "noopener");
    } catch {
      toast.error(t("studio.payout.error.dashboardUnavailable"));
    } finally {
      setBusy(false);
    }
  }

  if (!designer) return <StudioShell title={t("studio.payout.title")}><p className="text-muted-foreground">{t("common.loading")}</p></StudioShell>;

  const retryParam = searchParams.get("connect") === "retry";
  const requirementsDue = status?.requirements_due ?? [];
  const state: ConnectState = retryParam ? "error"
    : loadingStatus ? "none"
    : !status?.connected ? "none"
    : status.charges_enabled && status.payouts_enabled ? "payouts"
    : status.charges_enabled ? "active"
    : "pending";


  return (
    <StudioShell title={t("studio.payout.title")} eyebrow={t("studio.payout.eyebrow")}>
      <HowItWorks
        storageKey="payout-connect"
        title={t("studio.payout.howItWorks.title")}
        intro={t("studio.payout.howItWorks.intro")}
        steps={[
          t("studio.payout.howItWorks.step1"),
          t("studio.payout.howItWorks.step2"),
          t("studio.payout.howItWorks.step3"),
        ]}
      />
      <div className="max-w-xl space-y-6">
        {/* PART 45 — die Kasse in drei Zeilen: was fehlt, steht hier und nirgends sonst versteckt. */}
        <div className={`border-[1.5px] border-black p-5 ${verkauf.bereit ? "bg-white" : "bg-black text-white"}`}>
          <p className="editorial-eyebrow">{verkauf.bereit ? "Deine Kasse ist offen" : "Bis zum ersten Verkauf fehlt noch"}</p>
          <ul className="mt-3 space-y-2">
            {verkauf.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-3 text-sm">
                <span aria-hidden className="mt-[2px] inline-block w-4 text-center">{c.done ? "×" : "○"}</span>
                <span>
                  <span className={c.done ? "line-through opacity-50" : ""}>{c.label}</span>
                  {!c.done && <span className={`block text-xs ${verkauf.bereit ? "text-muted-foreground" : "opacity-70"}`}>{c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          {!verkauf.bereit && verkauf.offen.some((c) => c.key === "versand") && (
            <Link to="/studio/versand" className="mt-4 inline-block border-[1.5px] border-white px-5 py-2 text-[0.7rem] uppercase tracking-[0.24em] hover:bg-white hover:text-black">
              Versandkosten setzen
            </Link>
          )}
        </div>

        {/* Konto verbunden, aber Stripe wartet noch auf Angaben — der häufigste stille Stillstand. */}
        {status?.connected && !status.charges_enabled && requirementsDue.length > 0 && (
          <div className="border-[1.5px] border-black p-5">
            <p className="editorial-eyebrow">Stripe wartet auf dich</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Dein Konto ist verbunden, aber noch nicht freigeschaltet. Diese Angaben fehlen:
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {reqTexte(requirementsDue).map((r) => <li key={r}>· {r}</li>)}
            </ul>
          </div>
        )}

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">{t("studio.payout.share.title")}</p>
          <p className="mt-2 font-serif text-2xl">
            {t("studio.payout.share.youReceivePrefix")} <span className="tabular-nums">{100 - commissionPct} %</span> {t("studio.payout.share.youReceiveSuffix")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("studio.payout.share.pawnTakes", { pct: commissionPct })}
          </p>
        </div>


        {setupBlocked && (
          <div className="border-[1.5px] border-black bg-black p-5 text-white">
            <p className="editorial-eyebrow">{t("studio.payout.setupBlocked.title")}</p>
            <p className="mt-2 text-sm">{setupBlocked}</p>
            {isAdmin && (
              <p className="mt-3 text-xs opacity-70">
                {t("studio.payout.setupBlocked.adminHint")}
              </p>
            )}
          </div>
        )}


        {loadingStatus ? (
          <div className="flex items-center gap-2 border border-border p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("studio.payout.loadingStatus")}
          </div>
        ) : state === "none" ? (
          <div className="border-[1.5px] border-black p-6">
            <button
              onClick={connect}
              disabled={busy}
              className="w-full bg-black px-6 py-4 text-[0.72rem] uppercase tracking-[0.24em] text-white disabled:opacity-40"
            >
              {busy ? t("studio.payout.openingStripe") : t("studio.payout.connectAccount")}
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("studio.payout.none.description", { pct: 100 - commissionPct })}
            </p>
          </div>
        ) : state === "pending" ? (
          <div className="border-[1.5px] border-black p-6">
            <p className="editorial-eyebrow">{t("studio.payout.status.label")}</p>
            <p className="mt-2 font-serif text-xl">{t("studio.payout.status.pending")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("studio.payout.pending.description")}
            </p>
            {requirementsDue.length > 0 && (
              <div className="mt-4 border border-black p-4">
                <p className="editorial-eyebrow">{t("studio.payout.requirementsDue")}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {reqTexte(requirementsDue).map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={connect}
              disabled={busy}
              className="mt-4 bg-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] text-white disabled:opacity-40"
            >
              {busy ? t("studio.payout.openingStripe") : t("studio.payout.completeDetails")}
            </button>
          </div>
        ) : state === "active" || state === "payouts" ? (
          <div className="border-[1.5px] border-black p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center bg-black text-white">
                <Check className="h-4 w-4" />
              </span>
              <p className="font-serif text-xl">{state === "payouts" ? t("studio.payout.status.activePayouts") : t("studio.payout.status.activeSelling")}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {state === "payouts"
                ? t("studio.payout.active.payoutsDescription", { pct: commissionPct })
                : t("studio.payout.active.sellingDescription")}
            </p>
            {requirementsDue.length > 0 && (
              <div className="mt-4 border border-black p-4">
                <p className="editorial-eyebrow">{t("studio.payout.requirementsDue")}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {reqTexte(requirementsDue).map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={openDashboard}
                disabled={busy}
                className="border border-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white disabled:opacity-40"
              >
                {busy ? t("studio.payout.openingStripe") : t("studio.payout.openStripeAccount")}
              </button>
              <button
                onClick={connect}
                disabled={busy}
                className="border border-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white disabled:opacity-40"
              >
                {t("studio.payout.changeDetails")}
              </button>
            </div>
          </div>

        ) : (
          <div className="border-[1.5px] border-black p-6">
            <p className="editorial-eyebrow">{t("studio.payout.status.label")}</p>
            <p className="mt-2 font-serif text-xl">{t("studio.payout.status.error")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("studio.payout.error.description")}
            </p>
            <button
              onClick={connect}
              disabled={busy}
              className="mt-4 bg-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] text-white disabled:opacity-40"
            >
              {busy ? t("studio.payout.openingStripe") : t("studio.payout.retry")}
            </button>
          </div>
        )}

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">{t("studio.payout.billing.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("studio.payout.billing.description")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("studio.payout.billing.legalName")} value={billing.legal_name} onChange={(v) => setBilling((b) => ({ ...b, legal_name: v }))} full />
            <Field label={t("studio.payout.billing.street")} value={billing.address_line1} onChange={(v) => setBilling((b) => ({ ...b, address_line1: v }))} full />
            <Field label={t("studio.payout.billing.addressLine2")} value={billing.address_line2} onChange={(v) => setBilling((b) => ({ ...b, address_line2: v }))} full optional />
            <Field label={t("studio.payout.billing.postalCode")} value={billing.postal_code} onChange={(v) => setBilling((b) => ({ ...b, postal_code: v }))} />
            <Field label={t("studio.payout.billing.city")} value={billing.city} onChange={(v) => setBilling((b) => ({ ...b, city: v }))} />
            <Field label={t("studio.payout.billing.country")} value={billing.country} onChange={(v) => setBilling((b) => ({ ...b, country: v }))} />
            <Field label={t("studio.payout.billing.taxId")} value={billing.tax_id} onChange={(v) => setBilling((b) => ({ ...b, tax_id: v }))} optional={billing.kleinunternehmer} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={billing.kleinunternehmer} onChange={(e) => setBilling((b) => ({ ...b, kleinunternehmer: e.target.checked }))} />
            {t("studio.payout.billing.kleinunternehmer")}
          </label>
          <p className="mt-6 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.payout.billing.returnAddress")}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("studio.payout.billing.street")} value={billing.return_address_line1} onChange={(v) => setBilling((b) => ({ ...b, return_address_line1: v }))} full optional />
            <Field label={t("studio.payout.billing.postalCode")} value={billing.return_postal_code} onChange={(v) => setBilling((b) => ({ ...b, return_postal_code: v }))} optional />
            <Field label={t("studio.payout.billing.city")} value={billing.return_city} onChange={(v) => setBilling((b) => ({ ...b, return_city: v }))} optional />
            <Field label={t("studio.payout.billing.country")} value={billing.return_country} onChange={(v) => setBilling((b) => ({ ...b, return_country: v }))} optional />
          </div>
          <button onClick={saveBilling} disabled={billingSaving} className="mt-5 border border-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {billingSaving ? t("common.saving") : t("studio.payout.billing.save")}
          </button>
        </div>

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">{t("studio.payout.tax.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("studio.payout.tax.description")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.payout.tax.vatRate")}</span>
              <input type="number" min={0} max={30} step={0.1} value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.payout.tax.returnWindow")}</span>
              <input type="number" min={0} max={365} value={returnDays}
                onChange={(e) => setReturnDays(Number(e.target.value))}
                className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
            </label>
          </div>
          <button onClick={saveTax} disabled={taxSaving} className="mt-5 border border-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {taxSaving ? t("common.saving") : t("studio.payout.tax.save")}
          </button>
        </div>

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">{t("studio.payout.shipping.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("studio.payout.shipping.description")}
          </p>
          <div className="mt-4 space-y-3">
            {(["inland", "eu", "world"] as const).map((zone) => (
              <div key={zone} className="grid grid-cols-1 items-end gap-3 border-b border-border pb-3 sm:grid-cols-3">
                <p className="text-sm font-medium sm:col-span-1">{zone === "inland" ? t("studio.payout.shipping.zone.inland") : zone === "eu" ? t("studio.payout.shipping.zone.eu") : t("studio.payout.shipping.zone.world")}</p>
                <label className="block">
                  <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.payout.shipping.flatRate")}</span>
                  <input
                    type="number" min={0} step={0.5}
                    value={shipping[zone].flat_cents / 100}
                    onChange={(e) => setShipping((s) => ({ ...s, [zone]: { ...s[zone], flat_cents: Math.round(Number(e.target.value || 0) * 100) } }))}
                    className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.payout.shipping.freeFrom")}</span>
                  <input
                    type="number" min={0} step={1}
                    value={shipping[zone].free_from_cents != null ? shipping[zone].free_from_cents! / 100 : ""}
                    onChange={(e) => setShipping((s) => ({ ...s, [zone]: { ...s[zone], free_from_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) } }))}
                    className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ))}
          </div>
          <button onClick={saveShipping} disabled={shippingSaving} className="mt-5 border border-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {shippingSaving ? t("common.saving") : t("studio.payout.shipping.save")}
          </button>
        </div>
      </div>
    </StudioShell>
  );
}

function Field({ label, value, onChange, full, optional }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; optional?: boolean }) {
  const { t } = useI18n();
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{label}{optional ? ` ${t("studio.payout.optionalSuffix")}` : ""}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
    </label>
  );
}
