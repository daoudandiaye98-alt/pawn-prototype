import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PayoutProfile {
  id?: string; designer_id: string;
  account_holder: string; iban: string; bic: string | null; tax_id: string | null;
}

export default function StudioPayout() {
  const { designer } = useMyDesigner();
  const [profile, setProfile] = useState<PayoutProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("designer_payout_profiles").select("*").eq("designer_id", designer.id).maybeSingle()
      .then(({ data }) => {
        setProfile(data as PayoutProfile ?? { designer_id: designer.id, account_holder: "", iban: "", bic: "", tax_id: "" });
      });
  }, [designer]);

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("designer_payout_profiles").upsert({
      designer_id: profile.designer_id,
      account_holder: profile.account_holder.trim(),
      iban: profile.iban.replace(/\s/g, ""),
      bic: profile.bic?.trim() || null,
      tax_id: profile.tax_id?.trim() || null,
    }, { onConflict: "designer_id" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Auszahlungsdaten gespeichert.");
  };

  if (!designer) return <StudioShell title="Auszahlung"><p className="text-muted-foreground">Lädt…</p></StudioShell>;
  if (!profile) return null;

  return (
    <StudioShell title="Auszahlung" eyebrow="Zahlung">
      <div className="max-w-xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Deine Auszahlungsdaten werden für kommende automatische Abrechnungen genutzt. Deine Daten sind nur für dich und PAWN sichtbar.
        </p>
        <Field label="Kontoinhaber:in" value={profile.account_holder} onChange={(v) => setProfile({ ...profile, account_holder: v })} />
        <Field label="IBAN" value={profile.iban} onChange={(v) => setProfile({ ...profile, iban: v })} />
        <Field label="BIC" value={profile.bic ?? ""} onChange={(v) => setProfile({ ...profile, bic: v })} />
        <Field label="USt-ID (optional)" value={profile.tax_id ?? ""} onChange={(v) => setProfile({ ...profile, tax_id: v })} />
        <button onClick={save} disabled={busy || !profile.account_holder || !profile.iban}
          className="px-6 py-3 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">
          {busy ? "Speichert…" : "Speichern"}
        </button>
        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Automatische Abrechnung folgt in Kürze. Bis dahin erfolgt die Auszahlung monatlich manuell.
        </p>
      </div>
    </StudioShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="editorial-eyebrow">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border-b border-border bg-transparent py-2 focus:outline-none" />
    </label>
  );
}
