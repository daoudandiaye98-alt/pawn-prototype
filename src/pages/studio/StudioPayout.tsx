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

export default function StudioPayout() {
  const { designer, refresh } = useMyDesigner();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [commissionPct, setCommissionPct] = useState<number>(7);

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
        if (error) { toast.error(error.message); setLoadingStatus(false); return; }
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
      if (error) { toast.error(error.message); return; }
      const result = data as { error?: string; message?: string; url?: string };
      if (result?.error) { toast.error(result.message ?? "Verbindung konnte nicht gestartet werden."); return; }
      if (result?.url) window.location.href = result.url;
    } catch (e) {
      toast.error((e as Error).message);
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
      </div>
    </StudioShell>
  );
}
