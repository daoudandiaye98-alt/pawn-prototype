import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

type ConnectState = "none" | "pending" | "active" | "error";

interface ConnectStatus { connected: boolean; charges_enabled: boolean; details_submitted: boolean }

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
  const { designer, refresh } = useMyDesigner();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer?.id]);

  async function saveBilling() {
    if (!designer) return;
    setBillingSaving(true);
    const { error } = await supabase.from("designer_billing_profiles").upsert({ designer_id: designer.id, ...billing }, { onConflict: "designer_id" });
    setBillingSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rechnungsdaten gespeichert.");
  }

  async function saveShipping() {
    if (!designer) return;
    setShippingSaving(true);
    const { error } = await supabase.from("designers").update({ shipping_rates: JSON.parse(JSON.stringify(shipping)) }).eq("id", designer.id);
    setShippingSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Versandkosten gespeichert.");
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
        if (error) { toast.error("Auszahlungen werden gerade eingerichtet — melde dich, sobald es weitergeht."); setLoadingStatus(false); return; }
        const result = data as { error?: string; message?: string } & ConnectStatus;
        if (result?.error) { toast.error(result.message ?? "Status konnte nicht geladen werden."); setLoadingStatus(false); return; }
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
      if (error) { toast.error("Auszahlungen werden gerade eingerichtet — melde dich, sobald es weitergeht."); return; }
      const result = data as { error?: string; message?: string; url?: string };
      if (result?.error) { toast.error(result.message ?? "Verbindung konnte nicht gestartet werden."); return; }
      if (result?.url) window.location.href = result.url;
    } catch {
      toast.error("Auszahlungen werden gerade eingerichtet — melde dich, sobald es weitergeht.");
    } finally {
      setBusy(false);
    }
  }

  if (!designer) return <StudioShell title="Auszahlung"><p className="text-muted-foreground">Lädt…</p></StudioShell>;

  const retryParam = searchParams.get("connect") === "retry";
  const state: ConnectState = retryParam ? "error"
    : loadingStatus ? "none"
    : !status?.connected ? "none"
    : status.charges_enabled ? "active"
    : "pending";

  return (
    <StudioShell title="Auszahlung" eyebrow="Zahlung">
      <HowItWorks
        storageKey="payout-connect"
        title="Auszahlungen"
        intro="Dein Verkaufserlös fließt direkt auf dein eigenes Konto — PAWN berührt das Geld nie."
        steps={[
          "Auszahlungskonto bei unserem Zahlungspartner Stripe verbinden (5 Minuten).",
          "Stripe prüft deine Angaben.",
          "Sobald aktiv: jeder Verkauf fließt automatisch und direkt zu dir.",
        ]}
      />
      <div className="max-w-xl space-y-6">
        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">Dein Anteil</p>
          <p className="mt-2 font-serif text-2xl">
            Du erhältst <span className="tabular-nums">{100 - commissionPct} %</span> jedes Verkaufs.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            PAWN nimmt {commissionPct} % — bewusst weit unter Galerien und klassischen Marktplätzen. Kein Aufpreis für Rückgaben, keine Listing-Gebühr.
          </p>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 border border-border p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt Status…
          </div>
        ) : state === "none" ? (
          <div className="border-[1.5px] border-black p-6">
            <button
              onClick={connect}
              disabled={busy}
              className="w-full bg-black px-6 py-4 text-[0.72rem] uppercase tracking-[0.24em] text-white disabled:opacity-40"
            >
              {busy ? "Öffnet Stripe…" : "Auszahlungskonto verbinden"}
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              5 Minuten bei unserem Zahlungspartner Stripe: Name, IBAN, Ausweis. Danach fließt dein Geld direkt zu dir — PAWN berührt es nie. Du erhältst {100 - commissionPct}% jedes Verkaufs.
            </p>
          </div>
        ) : state === "pending" ? (
          <div className="border-[1.5px] border-black p-6">
            <p className="editorial-eyebrow">Status</p>
            <p className="mt-2 font-serif text-xl">In Prüfung</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Stripe prüft gerade deine Angaben. Das dauert normalerweise nur kurz — sobald es fertig ist, kannst du direkt verkaufen.
            </p>
          </div>
        ) : state === "active" ? (
          <div className="border-[1.5px] border-black p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center bg-black text-white">
                <Check className="h-4 w-4" />
              </span>
              <p className="font-serif text-xl">Aktiv</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Dein Konto ist verbunden. Jeder Verkauf fließt automatisch direkt zu dir.
            </p>
            <button
              onClick={connect}
              disabled={busy}
              className="mt-4 border border-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white disabled:opacity-40"
            >
              {busy ? "Öffnet Stripe…" : "Konto verwalten"}
            </button>
          </div>
        ) : (
          <div className="border-[1.5px] border-black p-6">
            <p className="editorial-eyebrow">Status</p>
            <p className="mt-2 font-serif text-xl">Es gab ein Problem</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Die Verbindung zu Stripe wurde nicht abgeschlossen. Versuch es noch einmal.
            </p>
            <button
              onClick={connect}
              disabled={busy}
              className="mt-4 bg-black px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] text-white disabled:opacity-40"
            >
              {busy ? "Öffnet Stripe…" : "Erneut versuchen"}
            </button>
          </div>
        )}

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">Rechnungsdaten</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ohne diese Angaben kann keine Bestellung als versendet markiert werden — jede Rechnung trägt deine Daten, nicht die von PAWN.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Firmierung / Name" value={billing.legal_name} onChange={(v) => setBilling((b) => ({ ...b, legal_name: v }))} full />
            <Field label="Straße, Hausnummer" value={billing.address_line1} onChange={(v) => setBilling((b) => ({ ...b, address_line1: v }))} full />
            <Field label="Adresszusatz" value={billing.address_line2} onChange={(v) => setBilling((b) => ({ ...b, address_line2: v }))} full optional />
            <Field label="PLZ" value={billing.postal_code} onChange={(v) => setBilling((b) => ({ ...b, postal_code: v }))} />
            <Field label="Stadt" value={billing.city} onChange={(v) => setBilling((b) => ({ ...b, city: v }))} />
            <Field label="Land" value={billing.country} onChange={(v) => setBilling((b) => ({ ...b, country: v }))} />
            <Field label="Steuernummer / USt-IdNr." value={billing.tax_id} onChange={(v) => setBilling((b) => ({ ...b, tax_id: v }))} optional={billing.kleinunternehmer} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={billing.kleinunternehmer} onChange={(e) => setBilling((b) => ({ ...b, kleinunternehmer: e.target.checked }))} />
            Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer auf Rechnungen)
          </label>
          <p className="mt-6 text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Rückversandadresse (falls abweichend)</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Straße, Hausnummer" value={billing.return_address_line1} onChange={(v) => setBilling((b) => ({ ...b, return_address_line1: v }))} full optional />
            <Field label="PLZ" value={billing.return_postal_code} onChange={(v) => setBilling((b) => ({ ...b, return_postal_code: v }))} optional />
            <Field label="Stadt" value={billing.return_city} onChange={(v) => setBilling((b) => ({ ...b, return_city: v }))} optional />
            <Field label="Land" value={billing.return_country} onChange={(v) => setBilling((b) => ({ ...b, return_country: v }))} optional />
          </div>
          <button onClick={saveBilling} disabled={billingSaving} className="mt-5 border border-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {billingSaving ? "Speichert…" : "Rechnungsdaten speichern"}
          </button>
        </div>

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">Mehrwertsteuer & Rückgabe</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Preise auf PAWN sind immer Endpreise inklusive Mehrwertsteuer. Trag hier den Satz deines Landes ein — einzelne Stücke können davon abweichen.
            Kleinunternehmer tragen 0 ein; dann erscheint der Hinweis nach § 19 UStG statt eines Steuerausweises.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Mehrwertsteuersatz (%)</span>
              <input type="number" min={0} max={30} step={0.1} value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Rückgabefrist (Tage)</span>
              <input type="number" min={0} max={365} value={returnDays}
                onChange={(e) => setReturnDays(Number(e.target.value))}
                className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
            </label>
          </div>
          <button onClick={saveTax} disabled={taxSaving} className="mt-5 border border-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {taxSaving ? "Speichert…" : "Steuerangaben speichern"}
          </button>
        </div>

        <div className="border border-foreground bg-white p-5">
          <p className="editorial-eyebrow">Versandkosten</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pauschale je Zone. Leer lassen = kostenlos. Käufer:innen wählen ihre Zone selbst beim Bezahlen.
          </p>
          <div className="mt-4 space-y-3">
            {(["inland", "eu", "world"] as const).map((zone) => (
              <div key={zone} className="grid grid-cols-1 items-end gap-3 border-b border-border pb-3 sm:grid-cols-3">
                <p className="text-sm font-medium sm:col-span-1">{zone === "inland" ? "Inland (DE)" : zone === "eu" ? "EU" : "Weltweit"}</p>
                <label className="block">
                  <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Pauschale (€)</span>
                  <input
                    type="number" min={0} step={0.5}
                    value={shipping[zone].flat_cents / 100}
                    onChange={(e) => setShipping((s) => ({ ...s, [zone]: { ...s[zone], flat_cents: Math.round(Number(e.target.value || 0) * 100) } }))}
                    className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Kostenlos ab (€, optional)</span>
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
            {shippingSaving ? "Speichert…" : "Versandkosten speichern"}
          </button>
        </div>
      </div>
    </StudioShell>
  );
}

function Field({ label, value, onChange, full, optional }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; optional?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{label}{optional ? " (optional)" : ""}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm" />
    </label>
  );
}
