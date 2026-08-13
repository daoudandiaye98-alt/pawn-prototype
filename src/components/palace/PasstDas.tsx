import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Teil 21c — "Steht mir das?": zu einem Stück fragen, ob es zum eigenen
 * Stil/Ziel passt. PAWN antwortet mit Einschätzung + Begründung aus der
 * eigenen DNA, und — passt es nicht — mit einer echten Alternative.
 */

interface PasstResult {
  ok: boolean;
  fruehzustand?: { erreicht: boolean };
  passt?: boolean;
  urteil?: string;
  alternative_slug?: string | null;
  alternative_grund?: string | null;
  message?: string;
  error?: string;
}

export function PasstDas({ productSlug, productName }: { productSlug: string; productName?: string }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PasstResult | null>(null);

  const check = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dna-voice", { body: { mode: "passt", produkt_slug: productSlug } });
      if (error) throw error;
      const r = data as PasstResult;
      if (!r.ok) { toast.error(r.message ?? r.error ?? "Konnte das noch nicht einschätzen."); return; }
      setResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  if (!result) {
    return (
      <button type="button" onClick={() => void check()} disabled={busy}
        className="editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline disabled:opacity-40">
        {busy ? "…" : productName ? `Steht mir "${productName}"?` : "Steht mir das?"}
      </button>
    );
  }

  if (!result.fruehzustand?.erreicht) {
    return (
      <div className="border-[1.5px] border-black bg-white p-4">
        <p className="text-sm text-black/70">
          Noch zu früh, um das zu sagen — wische durch ein paar Stücke, erzähl mir von dir, oder lade ein Bild hoch. Dann weiß ich mehr.
        </p>
        <Link to="/dna" className="mt-2 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
          Zur DNA →
        </Link>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-black bg-white p-5" style={{ boxShadow: "6px 6px 0 #000" }}>
      <p className="editorial-eyebrow text-black/60">{result.passt ? "Passt" : "Passt nicht ganz"}</p>
      <p className="mt-2 text-sm text-black">{result.urteil}</p>
      {!result.passt && result.alternative_slug && (
        <div className="mt-4 border-t border-black/15 pt-3">
          <p className="text-xs text-black/60">{result.alternative_grund}</p>
          <Link to={`/product/${result.alternative_slug}`} className="mt-2 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
            Stattdessen ansehen →
          </Link>
        </div>
      )}
      <button type="button" onClick={() => setResult(null)} className="mt-4 text-[0.62rem] uppercase tracking-[0.24em] text-black/60 hover:text-black">
        Schließen
      </button>
    </div>
  );
}
