import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { canUse, ladePlanGate, limitFor, type Plan } from "@/lib/planGate";
import { Gesperrt } from "@/components/Gesperrt";

/**
 * Teil 34a/34b — Offene Türen: reale, ortsnahe Chancen (Galerien, Ausstellungen, Märkte, offene
 * Ateliers, Schulen/Hochschulen), die pawn-jarvis (Modus tueren_finden) wöchentlich findet.
 * Karten wie der Sende-Stapel im Admin — Fund, Warum, Entwurf, Entscheidung. Absenden ist
 * immer ein bewusster Klick, nie automatisch. Ohne gefundene Kontakt-Adresse bleibt nur
 * "Text kopieren" — der Mensch verschickt dann selbst.
 */

interface Tuer {
  id: string;
  title: string;
  ort: string | null;
  typ: string;
  art: string;
  match_score: number | null;
  quelle_url: string | null;
  warum: string | null;
  status: string;
  message_draft: string | null;
  contact_email: string | null;
  sent_at: string | null;
  followup_sent_at: string | null;
  delivery_status: string | null;
  created_at: string;
  sichtbar_ab: string | null;
}

const TYP_KEYS = ["galerie", "ausstellung", "markt", "offenes_atelier", "schule_hochschule", "sonstiges"];
const ART_KEYS = ["physisch", "presse", "edition", "kollektions_slot"];
const OFFENE_STATUS = ["gefunden", "interessiert", "kontaktiert", "geantwortet"];
const MIN_FOLLOWUP_DAYS = 7;
/** Editionen entscheidet das Haus auf /studio/kampagnen — hier nur Anzeige, keine Aktionen. */
const FREMDGESTEUERTE_ART = new Set(["edition"]);

export default function StudioOffeneTueren() {
  const { designer, loading } = useMyDesigner();
  const { t } = useI18n();
  const [rows, setRows] = useState<Tuer[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const plan: Plan = (designer as unknown as { plan?: Plan })?.plan ?? "haus";
  // PART 48 AP7: unterscheidet "kein Entwurf, weil noch keine Kontakt-Adresse gefunden" von
  // "kein Entwurf, weil das monatliche Tür-Kontingent des Plans aufgebraucht ist" — sonst wirkt
  // eine plangebundene Sperre wie ein echter Rechercheausfall.
  const [tuerenAufgebraucht, setTuerenAufgebraucht] = useState(false);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      await ladePlanGate();
      const { data } = await supabase.from("designer_opportunities" as never)
        .select("id, title, ort, typ, art, match_score, quelle_url, warum, status, message_draft, contact_email, sent_at, followup_sent_at, delivery_status, created_at, sichtbar_ab")
        .eq("designer_id", designer.id).order("match_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      // PART 48 AP2/AP4: ohne Tür-Vorlauf (nur Maison) bleiben ganz neue Türen 48h unsichtbar —
      // die Tür selbst existiert schon (Zeitpunkt der KI-Suche), erscheint dem Haus aber erst
      // nach der Frist. sichtbar_ab=null (ältere Zeilen vor dieser Migration) gilt als sichtbar.
      const alle = (data as unknown as Tuer[]) ?? [];
      const sichtbar = canUse(plan, "tuer_vorlauf")
        ? alle
        : alle.filter((r) => !r.sichtbar_ab || new Date(r.sichtbar_ab).getTime() <= Date.now());
      setRows(sichtbar);
      setRowsLoading(false);

      const limit = limitFor(plan, "tuer_oeffnen");
      if (limit >= 0) {
        const { data: stand } = await supabase.rpc("plan_usage_stand" as never, {
          p_designer_id: designer.id, p_feature: "tuer_oeffnen",
        } as never);
        setTuerenAufgebraucht((Number(stand) || 0) >= limit);
      }
    })();
  }, [designer, plan]);

  async function decide(door: Tuer, decision: "interessiert" | "verworfen" | "angenommen" | "abgelehnt") {
    setBusy(door.id);
    try {
      const { data, error } = await supabase.functions.invoke("designer-opportunity-decide", {
        body: { opportunity_id: door.id, decision },
      });
      const result = data as { ok?: boolean; error?: string } | null;
      if (error || !result?.ok) { toast.error(result?.error ?? t("studio.tueren.toast.error")); return; }
      setRows((prev) => prev.map((r) => (r.id === door.id ? { ...r, status: decision } : r)));
      const toastKey = decision === "interessiert" ? "studio.tueren.toast.interested"
        : decision === "angenommen" ? "studio.tueren.toast.accepted"
        : decision === "abgelehnt" ? "studio.tueren.toast.declined"
        : "studio.tueren.toast.dismissed";
      toast.success(t(toastKey));
    } catch {
      toast.error(t("studio.tueren.toast.error"));
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft(door: Tuer) {
    setBusy(door.id);
    try {
      const { data, error } = await supabase.functions.invoke("designer-opportunity-decide", {
        body: { opportunity_id: door.id, message_draft: draftText },
      });
      if (error || !(data as { ok?: boolean })?.ok) throw new Error("failed");
      setRows((prev) => prev.map((r) => (r.id === door.id ? { ...r, message_draft: draftText } : r)));
      setEditing(null);
      toast.success(t("studio.tueren.toast.saved"));
    } catch {
      toast.error(t("studio.tueren.toast.error"));
    } finally {
      setBusy(null);
    }
  }

  async function send(door: Tuer, isFollowup: boolean) {
    const message = (isFollowup ? draftFor(door) : door.message_draft) ?? "";
    if (!message.trim()) { toast.error(t("studio.tueren.toast.error")); return; }
    setBusy(door.id);
    try {
      const { data, error } = await supabase.functions.invoke("designer-opportunity-send", {
        body: { opportunity_id: door.id, message, is_followup: isFollowup },
      });
      const result = data as { ok?: boolean; delivery_status?: string; error?: string } | null;
      if (error || !result?.ok) { toast.error(result?.error ?? t("studio.tueren.toast.error")); return; }
      setRows((prev) => prev.map((r) => r.id === door.id
        ? {
          ...r,
          status: "kontaktiert",
          delivery_status: result.delivery_status ?? "versendet",
          sent_at: isFollowup ? r.sent_at : new Date().toISOString(),
          followup_sent_at: isFollowup ? new Date().toISOString() : r.followup_sent_at,
        }
        : r));
      toast.success(isFollowup ? t("studio.tueren.toast.followupSent") : t("studio.tueren.toast.sent"));
    } catch {
      toast.error(t("studio.tueren.toast.error"));
    } finally {
      setBusy(null);
    }
  }

  function draftFor(door: Tuer): string {
    return door.message_draft ?? "";
  }

  async function copyDraft(door: Tuer) {
    if (!door.message_draft) { toast.error(t("studio.tueren.toast.error")); return; }
    await navigator.clipboard.writeText(door.message_draft);
    toast.success(t("studio.tueren.toast.copied"));
  }

  if (loading || rowsLoading) return <StudioShell title={t("studioShell.nav.tueren")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.tueren")}><p className="text-sm text-muted-foreground">{t("studio.settings.noAccess")}</p></StudioShell>;

  const offene = rows.filter((r) => OFFENE_STATUS.includes(r.status));
  const entschieden = rows.filter((r) => r.status === "angenommen" || r.status === "abgelehnt");
  const verworfen = rows.filter((r) => r.status === "verworfen");

  return (
    <StudioShell title={t("studioShell.nav.tueren")} eyebrow={t("studioShell.nav.tueren")}>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">{t("studio.tueren.intro")}</p>

      {offene.length === 0 ? (
        <PawnEmptyState title={t("studio.tueren.empty.title")} description={t("studio.tueren.empty.description")} />
      ) : (
        <ul className="space-y-4">
          {offene.map((door) => {
            const isEditing = editing === door.id;
            const canFollowUp = door.status === "kontaktiert" && door.sent_at && !door.followup_sent_at
              && (Date.now() - new Date(door.sent_at).getTime()) / 86_400_000 >= MIN_FOLLOWUP_DAYS;
            return (
              <li key={door.id} className="border-[1.5px] border-foreground bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                      {t(`studio.tueren.art.${ART_KEYS.includes(door.art) ? door.art : "physisch"}`)}
                      {door.art === "physisch" && ` · ${t(`studio.tueren.typ.${TYP_KEYS.includes(door.typ) ? door.typ : "sonstiges"}`)}`}
                      {door.ort ? ` · ${door.ort}` : ""}
                    </p>
                    <p className="mt-1 font-serif text-lg">
                      {door.quelle_url ? (
                        <a href={door.quelle_url} target="_blank" rel="noreferrer" className="hover:underline">{door.title}</a>
                      ) : door.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <span className="block">{t(`studio.tueren.status.${door.status}`)}</span>
                    {door.delivery_status && <span className="mt-0.5 block">{t(`studio.tueren.delivery.${door.delivery_status}`)}</span>}
                  </span>
                </div>

                {door.warum && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="text-[0.6rem] uppercase tracking-[0.2em]">{t("studio.tueren.warum.label")}</span>{" "}
                    {door.warum}
                  </p>
                )}

                {door.art === "physisch" && !door.contact_email && !door.message_draft && tuerenAufgebraucht ? (
                  <div className="mt-3"><Gesperrt feature="tuer_oeffnen" was="Tür-Entwürfe" plan={plan} grund="kontingent" /></div>
                ) : door.art === "physisch" && !door.contact_email && (
                  <p className="mt-3 text-sm text-muted-foreground">{t("studio.tueren.noContact")}</p>
                )}

                {door.message_draft && !isEditing && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.tueren.entwurf.label")}</summary>
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-foreground pl-3 text-sm">{door.message_draft}</p>
                  </details>
                )}

                {isEditing && (
                  <div className="mt-3">
                    <p className="mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{t("studio.tueren.entwurf.label")}</p>
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={5}
                      className="w-full border-[1.5px] border-foreground p-3 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button" disabled={busy === door.id}
                        onClick={() => void saveDraft(door)}
                        className="flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground disabled:opacity-50"
                      >
                        {busy === door.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t("studio.tueren.entwurf.save")}
                      </button>
                      <button
                        type="button" onClick={() => setEditing(null)}
                        className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                      >
                        {t("studio.tueren.entwurf.cancel")}
                      </button>
                    </div>
                  </div>
                )}

                {!isEditing && FREMDGESTEUERTE_ART.has(door.art) && (
                  <div className="mt-4">
                    <Link to="/studio/kampagnen" className="text-[0.65rem] uppercase tracking-[0.24em] underline">
                      {t("studio.tueren.action.zurEntscheidung")}
                    </Link>
                  </div>
                )}

                {!isEditing && !FREMDGESTEUERTE_ART.has(door.art) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {door.status === "gefunden" && (
                      <button
                        type="button" disabled={busy === door.id}
                        onClick={() => void decide(door, "interessiert")}
                        className="flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground disabled:opacity-50"
                      >
                        {busy === door.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t("studio.tueren.action.interested")}
                      </button>
                    )}
                    {door.status === "interessiert" && door.contact_email && !door.sent_at && (
                      <button
                        type="button" disabled={busy === door.id}
                        onClick={() => void send(door, false)}
                        className="flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground disabled:opacity-50"
                      >
                        {busy === door.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t("studio.tueren.action.send")}
                      </button>
                    )}
                    {canFollowUp && (
                      <button
                        type="button" disabled={busy === door.id}
                        onClick={() => void send(door, true)}
                        className="flex items-center gap-2 border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                      >
                        {busy === door.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t("studio.tueren.action.followup")}
                      </button>
                    )}
                    {(door.status === "interessiert" || door.status === "kontaktiert" || door.status === "geantwortet") && (
                      <>
                        <button
                          type="button" disabled={busy === door.id}
                          onClick={() => void decide(door, "angenommen")}
                          className="flex items-center gap-2 border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground disabled:opacity-50"
                        >
                          {busy === door.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{t("studio.tueren.action.accept")}
                        </button>
                        <button
                          type="button" disabled={busy === door.id}
                          onClick={() => void decide(door, "abgelehnt")}
                          className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                        >
                          {t("studio.tueren.action.decline")}
                        </button>
                      </>
                    )}
                    {door.status !== "verworfen" && (
                      <button
                        type="button" disabled={busy === door.id}
                        onClick={() => void decide(door, "verworfen")}
                        className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                      >
                        {t("studio.tueren.action.dismiss")}
                      </button>
                    )}
                    {door.art === "physisch" && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditing(door.id); setDraftText(door.message_draft ?? ""); }}
                          className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                        >
                          {t("studio.tueren.entwurf.edit")}
                        </button>
                        <button
                          type="button" onClick={() => void copyDraft(door)}
                          className="flex items-center gap-2 border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                        >
                          <Copy className="h-3.5 w-3.5" />{t("studio.tueren.action.copy")}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {entschieden.length > 0 && (
        <div className="mt-8 border-[1.5px] border-foreground bg-white p-6">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.tueren.erfolgskette")}</p>
          <ul className="mt-3 divide-y divide-border">
            {entschieden.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{d.title}</span>
                <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{t(`studio.tueren.status.${d.status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verworfen.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
            {t("studio.tueren.status.verworfen")} · {verworfen.length}
          </summary>
          <ul className="mt-3 divide-y divide-border">
            {verworfen.map((d) => (
              <li key={d.id} className="py-2 text-sm text-muted-foreground">{d.title}</li>
            ))}
          </ul>
        </details>
      )}
    </StudioShell>
  );
}
