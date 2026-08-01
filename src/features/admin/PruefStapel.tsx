/**
 * Der Prüf-Stapel: die letzte menschliche Instanz vor dem Kontakt. Jarvis hat vorbewertet,
 * hier entscheidest du in einem Zug Ja oder Nein — mit Bild, Bio, Score und Begründung vor Augen.
 * Reines Frontend gegen `acquisition_leads` (Felder admin_decision / decided_at / status).
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, ExternalLink } from "lucide-react";

export interface PruefLead {
  id: string;
  handle: string;
  world: string;
  bio: string | null;
  followers: number | null;
  email: string | null;
  website?: string | null;
  status: string;
  kurator_score: number | null;
  score_reasons: Record<string, unknown> | null;
  admin_decision?: string | null;
  scrape_images?: unknown;
}

function images(lead: PruefLead): string[] {
  return Array.isArray(lead.scrape_images) ? (lead.scrape_images as string[]).slice(0, 3) : [];
}

function reasonText(lead: PruefLead): string | null {
  const r = lead.score_reasons;
  if (!r) return null;
  const candidate = r.begruendung ?? r.hinweis ?? r.reason ?? r.urteil;
  return typeof candidate === "string" ? candidate : null;
}

export function PruefStapel({
  rows, onChange,
}: {
  rows: PruefLead[];
  onChange: (id: string, patch: Partial<PruefLead>) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(
    () => rows
      .filter((r) => r.status === "qualifiziert" && !r.admin_decision)
      .sort((a, b) => (b.kurator_score ?? 0) - (a.kurator_score ?? 0))
      .slice(0, 12),
    [rows],
  );

  async function decide(lead: PruefLead, decision: "ja" | "nein") {
    setBusy(lead.id);
    const patch = {
      admin_decision: decision,
      decided_at: new Date().toISOString(),
      ...(decision === "nein" ? { status: "aussortiert" } : {}),
    };
    const { error } = await supabase.from("acquisition_leads").update(patch).eq("id", lead.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    onChange(lead.id, patch as Partial<PruefLead>);
    toast.success(decision === "ja" ? `@${lead.handle} freigegeben.` : `@${lead.handle} aussortiert.`);
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">Prüfen · dein Ja oder Nein · {items.length}</p>
      </header>

      <ul className="divide-y divide-border">
        {items.map((lead) => {
          const reason = reasonText(lead);
          return (
            <li key={lead.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start">
              <div className="flex gap-2">
                {images(lead).map((src) => (
                  <img
                    key={src} src={src} alt={`Arbeit von @${lead.handle}`} loading="lazy"
                    className="h-20 w-20 border border-black object-cover"
                  />
                ))}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg">
                  <a
                    href={`https://instagram.com/${lead.handle}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    @{lead.handle} <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {lead.world}
                  {lead.followers ? ` · ${lead.followers.toLocaleString("de-DE")} Follower` : ""}
                  {lead.kurator_score !== null ? ` · Score ${lead.kurator_score}` : " · noch nicht bewertet"}
                  {lead.email ? " · E-Mail vorhanden" : " · nur DM"}
                </p>
                {lead.bio && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.bio}</p>}
                {reason && <p className="mt-2 text-sm">{reason}</p>}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button" disabled={busy === lead.id} onClick={() => void decide(lead, "ja")}
                  className="flex items-center gap-2 border-[1.5px] border-black bg-black px-4 py-2 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Ja
                </button>
                <button
                  type="button" disabled={busy === lead.id} onClick={() => void decide(lead, "nein")}
                  className="flex items-center gap-2 border-[1.5px] border-black px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-black hover:text-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Nein
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
