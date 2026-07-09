import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ContractRow {
  id: string;
  version: number;
  title: string;
  body_markdown: string;
  checksum: string;
}

/**
 * Persistent (non-blocking) banner for designers who haven't accepted the
 * current designer contract (v2). Opens a modal with the full text and a
 * confirm checkbox. On accept: inserts designer_consents row + emits event.
 */
export function ContractV2Banner({ applicationId }: { applicationId?: string | null }) {
  const { user } = useAuth();
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [needsAccept, setNeedsAccept] = useState(false);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data: c } = await supabase
        .from("contract_versions")
        .select("id, version, title, body_markdown, checksum")
        .eq("kind", "designer")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive || !c) return;
      setContract(c as ContractRow);

      const { data: consent } = await supabase
        .from("designer_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("contract_version_id", c.id)
        .is("revoked_at", null)
        .maybeSingle();
      if (!alive) return;
      setNeedsAccept(!consent);
    })();
    return () => { alive = false; };
  }, [user]);

  const accept = async () => {
    if (!user || !contract) return;
    setBusy(true);
    const { error } = await supabase.from("designer_consents").insert({
      user_id: user.id,
      application_id: applicationId ?? null,
      contract_version_id: contract.id,
      checksum_at_accept: contract.checksum,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("domain_events").insert({
      type: "consent.accepted_v2",
      actor: user.id,
      payload: { contract_version_id: contract.id, version: contract.version },
    } as never);
    setNeedsAccept(false);
    setOpen(false);
    setBusy(false);
    toast.success("Vertrag bestätigt.");
  };

  if (!needsAccept || !contract) return null;

  return (
    <>
      <div className="border-b-[1.5px] border-foreground bg-[#FEF6E1] px-6 py-3 text-[0.78rem]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="min-w-0">
            <span className="mr-2 inline-block border border-foreground px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.24em]">Vertrag v{contract.version}</span>
            Aktualisierter Vertrag — bitte bestätigen, damit alle Rechte klar sind.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="border-[1.5px] border-foreground bg-foreground px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground"
          >
            Vertrag ansehen
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col border-[1.5px] border-foreground bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-6 py-4">
              <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">Version {contract.version}</p>
              <h2 className="mt-1 font-serif text-2xl">{contract.title}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/85">{contract.body_markdown}</pre>
            </div>
            <div className="border-t border-border px-6 py-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>Ich habe den Vertrag gelesen und stimme zu.</span>
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="border border-border px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] hover:bg-muted disabled:opacity-40"
                >
                  Später
                </button>
                <button
                  disabled={!checked || busy}
                  onClick={accept}
                  className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground disabled:opacity-40"
                >
                  {busy ? "Speichere…" : "Bestätigen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
