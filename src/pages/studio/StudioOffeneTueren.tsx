import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Teil 34a — Offene Türen: reale, ortsnahe Chancen (Galerien, Ausstellungen, Märkte, offene
 * Ateliers, Schulen/Hochschulen), die pawn-jarvis (Modus tueren_finden) wöchentlich findet.
 * Karten wie der Sende-Stapel im Admin — Fund, Warum, Entwurf, Entscheidung. Gesendet wird
 * hier nie automatisch: Text kopieren/anpassen und selbst verschicken bleibt Sache des Hauses.
 */

interface Tuer {
  id: string;
  title: string;
  ort: string | null;
  typ: string;
  quelle_url: string | null;
  warum: string | null;
  status: string;
  message_draft: string | null;
  created_at: string;
}

const TYP_KEYS = ["galerie", "ausstellung", "markt", "offenes_atelier", "schule_hochschule", "sonstiges"];
const OFFENE_STATUS = ["gefunden", "interessiert", "kontaktiert", "geantwortet"];

export default function StudioOffeneTueren() {
  const { designer, loading } = useMyDesigner();
  const { t } = useI18n();
  const [rows, setRows] = useState<Tuer[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.from("designer_opportunities" as never)
        .select("id, title, ort, typ, quelle_url, warum, status, message_draft, created_at")
        .eq("designer_id", designer.id).order("created_at", { ascending: false });
      setRows((data as unknown as Tuer[]) ?? []);
      setRowsLoading(false);
    })();
  }, [designer]);

  async function decide(door: Tuer, decision: "interessiert" | "verworfen") {
    setBusy(door.id);
    try {
      const { data, error } = await supabase.functions.invoke("designer-opportunity-decide", {
        body: { opportunity_id: door.id, decision },
      });
      if (error || !(data as { ok?: boolean })?.ok) throw new Error("failed");
      setRows((prev) => prev.map((r) => (r.id === door.id ? { ...r, status: decision } : r)));
      toast.success(decision === "interessiert" ? t("studio.tueren.toast.interested") : t("studio.tueren.toast.dismissed"));
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

  if (loading || rowsLoading) return <StudioShell title={t("studioShell.nav.tueren")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.tueren")}><p className="text-sm text-muted-foreground">{t("studio.settings.noAccess")}</p></StudioShell>;

  const offene = rows.filter((r) => OFFENE_STATUS.includes(r.status));
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
            return (
              <li key={door.id} className="border-[1.5px] border-foreground bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                      {t(`studio.tueren.typ.${TYP_KEYS.includes(door.typ) ? door.typ : "sonstiges"}`)}
                      {door.ort ? ` · ${door.ort}` : ""}
                    </p>
                    <p className="mt-1 font-serif text-lg">
                      {door.quelle_url ? (
                        <a href={door.quelle_url} target="_blank" rel="noreferrer" className="hover:underline">{door.title}</a>
                      ) : door.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {t(`studio.tueren.status.${door.status}`)}
                  </span>
                </div>

                {door.warum && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="text-[0.6rem] uppercase tracking-[0.2em]">{t("studio.tueren.warum.label")}</span>{" "}
                    {door.warum}
                  </p>
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

                {!isEditing && (
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
                    <button
                      type="button" disabled={busy === door.id}
                      onClick={() => void decide(door, "verworfen")}
                      className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      {t("studio.tueren.action.dismiss")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(door.id); setDraftText(door.message_draft ?? ""); }}
                      className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
                    >
                      {t("studio.tueren.entwurf.edit")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
