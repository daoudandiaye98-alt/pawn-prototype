/**
 * Der Prüf-Stapel: nur noch das, was wirklich deine Hand braucht.
 * Studios mit gefundener E-Mail schickt Jarvis selbstständig an — die tauchen hier gar nicht auf.
 * Übrig bleiben Konten ohne Adresse: Kontaktformular öffnen oder Text kopieren und per DM senden.
 * Presse-Kontakte bleiben unverändert bei deiner Freigabe.
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, ExternalLink, Copy, Loader2, Send } from "lucide-react";

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
  message_draft?: string | null;
  language?: string | null;
  lead_type?: string | null;
  outlet?: string | null;
  contact_name?: string | null;
  personal_line?: string | null;
  contact_url?: string | null;
  contact_channel?: string | null;
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
  rows, onChange, leadType = "designer", title,
}: {
  rows: PruefLead[];
  onChange: (id: string, patch: Partial<PruefLead>) => void;
  /** "designer" = Häuser-Akquise, "presse" = Presse-Kontakte. */
  leadType?: "designer" | "presse";
  title?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const isPresse = leadType === "presse";

  const items = useMemo(
    () => rows
      .filter((r) => (r.lead_type ?? "designer") === leadType)
      .filter((r) => r.status === "qualifiziert" && !r.admin_decision)
      // Häuser mit Adresse gehen automatisch raus — hier bleibt, was einen Menschen braucht.
      .filter((r) => isPresse || !r.email)
      .sort((a, b) => (b.kurator_score ?? 0) - (a.kurator_score ?? 0))
      .slice(0, 20),
    [rows, leadType, isPresse],
  );


  async function decide(lead: PruefLead, decision: "ja" | "nein") {
    setBusy(lead.id);
    const patch = {
      admin_decision: decision,
      decided_at: new Date().toISOString(),
      ...(decision === "nein" ? { status: "aussortiert" } : {}),
    };
    const { error } = await supabase.from("acquisition_leads").update(patch).eq("id", lead.id);
    if (error) { setBusy(null); toast.error(error.message); return; }
    onChange(lead.id, patch as Partial<PruefLead>);

    if (decision === "nein") {
      setBusy(null);
      toast.success(`@${lead.handle} aussortiert.`);
      return;
    }

    if (!lead.email) {
      setBusy(null);
      toast.success(`@${lead.handle} freigegeben — keine E-Mail bekannt, bitte per DM senden.`);
      return;
    }

    // Ja = senden. Der Versand läuft über Jarvis, damit Vorlage, Sprache und Folgetermin stimmen.
    const { data, error: sendError } = await supabase.functions.invoke("pawn-jarvis", {
      body: { mode: "akquise_senden", lead_ids: [lead.id] },
    });
    setBusy(null);
    const sent = (data as { sent?: number } | null)?.sent ?? 0;
    if (sendError || sent === 0) {
      toast.warning(`@${lead.handle} freigegeben — Versand hat noch nicht geklappt, läuft beim nächsten Lauf erneut.`);
      return;
    }
    onChange(lead.id, { status: "kontaktiert" });
    toast.success(`Nachricht an @${lead.handle} ist raus.`);
  }

  async function copyDraft(lead: PruefLead) {
    if (!lead.message_draft) { toast.error("Noch kein Text verfasst — Jarvis schreibt ihn im nächsten Lauf."); return; }
    await navigator.clipboard.writeText(lead.message_draft);
    toast.success("Text kopiert — jetzt als DM einfügen.");
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">
          {title ?? "Von Hand · Formular oder DM"} · {items.length}
        </p>
        {!isPresse && (
          <p className="mt-1 text-xs text-muted-foreground">
            Studios mit gefundener Adresse schreibt Jarvis selbst an. Hier stehen die Konten, bei denen ein
            Formular oder eine DM den Weg öffnet.
          </p>
        )}
      </header>

      <ul className="divide-y divide-border">
        {items.map((lead) => {
          const reason = reasonText(lead);
          const label = isPresse ? (lead.contact_name || lead.outlet || lead.handle) : `@${lead.handle}`;
          const href = isPresse
            ? (lead.website ?? undefined)
            : `https://instagram.com/${lead.handle}`;
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
                  {href ? (
                    <a
                      href={href} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {isPresse && lead.outlet && lead.contact_name ? `${lead.outlet} · ` : ""}
                  {lead.world}
                  {!isPresse && lead.followers ? ` · ${lead.followers.toLocaleString("de-DE")} Follower` : ""}
                  {lead.kurator_score !== null ? ` · Score ${lead.kurator_score}` : " · noch nicht bewertet"}
                  {lead.email
                    ? ` · E-Mail · Ja sendet sofort${lead.language === "en" ? " (English)" : " (Deutsch)"}`
                    : isPresse ? " · keine Adresse · Text kopieren" : " · nur DM · Text kopieren"}
                </p>
                {lead.email && (
                  <p className="mt-1 text-xs text-muted-foreground">Gefunden: {lead.email}</p>
                )}
                {isPresse && lead.personal_line && (
                  <p className="mt-1 text-xs text-muted-foreground">Betreff: {lead.personal_line}</p>
                )}

                {lead.bio && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lead.bio}</p>}

                {reason && <p className="mt-2 text-sm">{reason}</p>}
                {lead.message_draft && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-muted-foreground">Nachricht ansehen</summary>
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-black pl-3 text-sm">{lead.message_draft}</p>
                  </details>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button" disabled={busy === lead.id} onClick={() => void decide(lead, "ja")}
                  className="flex items-center gap-2 border-[1.5px] border-black bg-black px-4 py-2 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50"
                >
                  {busy === lead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ja
                </button>
                <button
                  type="button" disabled={busy === lead.id} onClick={() => void decide(lead, "nein")}
                  className="flex items-center gap-2 border-[1.5px] border-black px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-black hover:text-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Nein
                </button>
                {!lead.email && (
                  <button
                    type="button" onClick={() => void copyDraft(lead)}
                    className="flex items-center gap-2 border-[1.5px] border-black px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-black hover:text-white"
                  >
                    <Copy className="h-4 w-4" /> Text kopieren
                  </button>
                )}
                {!lead.email && lead.contact_url && (
                  <a
                    href={lead.contact_url} target="_blank" rel="noreferrer"
                    onClick={() => void copyDraft(lead)}
                    className="flex items-center gap-2 border-[1.5px] border-black px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-black hover:text-white"
                  >
                    <Send className="h-4 w-4" /> Formular öffnen
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
