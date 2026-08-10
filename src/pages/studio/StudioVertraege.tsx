/**
 * Teil 39 AP2 — "Verträge im Studio dauerhaft einsehbar" (P2B-VO). Zeigt die aktuell gültige
 * Fassung jeder Vertragsart, ob und wann das eigene Haus zugestimmt hat, und die Versionshistorie.
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

interface ContractRow {
  id: string; kind: string; version: number; title: string; body_markdown: string; checksum: string;
  effective_from: string; effective_to: string | null;
}
interface ConsentRow { contract_version_id: string; accepted_at: string; revoked_at: string | null }

export default function StudioVertraege() {
  const { designer, loading: designerLoading } = useMyDesigner();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    if (!designer || !user) return;
    (async () => {
      const [{ data: c }, { data: cs }, { data: app }] = await Promise.all([
        supabase.from("contract_versions").select("id, kind, version, title, body_markdown, checksum, effective_from, effective_to").order("kind").order("version", { ascending: false }),
        supabase.from("designer_consents").select("contract_version_id, accepted_at, revoked_at").eq("user_id", user.id),
        supabase.from("designer_applications").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      setContracts((c as ContractRow[] | null) ?? []);
      setConsents((cs as ConsentRow[] | null) ?? []);
      setApplicationId((app as { id: string } | null)?.id ?? null);
      setLoading(false);
    })();
  }, [designer, user]);

  // WP1 "Hochtouren": die vier Vertragsarten, die vor der Bewerbung nicht mehr abgefragt werden
  // (Revenue-Share, Bildnutzung, KI-Nutzungsrechte, Ranking), müssen hier aktiv bestätigt werden
  // können — sonst bekämen neue Häuser dafür nie eine designer_consents-Zeile.
  async function accept(c: ContractRow) {
    if (!user || !applicationId) return;
    setAccepting(c.id);
    const { error } = await supabase.from("designer_consents").upsert({
      application_id: applicationId, user_id: user.id, contract_version_id: c.id,
      checksum_at_accept: c.checksum, user_agent: navigator.userAgent,
    }, { onConflict: "application_id,contract_version_id" });
    setAccepting(null);
    if (error) { toast.error(error.message); return; }
    setConsents((cs) => [...cs.filter((x) => x.contract_version_id !== c.id), { contract_version_id: c.id, accepted_at: new Date().toISOString(), revoked_at: null }]);
    toast.success(t("studio.vertraege.acceptSuccess"));
  }

  if (designerLoading || loading) return <StudioShell title={t("studioShell.nav.vertraege")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.vertraege")}><p className="text-sm text-muted-foreground">{t("studio.settings.noAccess")}</p></StudioShell>;

  const current = contracts.filter((c) => !c.effective_to);
  const history = contracts.filter((c) => c.effective_to);
  const consentFor = (contractId: string) => consents.find((c) => c.contract_version_id === contractId && !c.revoked_at);

  return (
    <StudioShell title={t("studioShell.nav.vertraege")} eyebrow={t("studioShell.nav.vertraege")}>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">{t("studio.vertraege.intro")}</p>

      <div className="space-y-4">
        {current.map((c) => {
          const consent = consentFor(c.id);
          const open = openKind === c.kind;
          return (
            <section key={c.id} className="border-[1.5px] border-foreground bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">v{c.version}</p>
                  <h3 className="mt-1 font-serif text-xl">{c.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {consent
                      ? t("studio.vertraege.acceptedOn", { date: formatDate(consent.accepted_at, locale) })
                      : t("studio.vertraege.notYetAccepted")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!consent && (
                    <button type="button" disabled={accepting === c.id} onClick={() => void accept(c)}
                      className="border border-foreground bg-foreground px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] text-background hover:bg-background hover:text-foreground disabled:opacity-50">
                      {accepting === c.id ? t("studio.vertraege.accepting") : t("studio.vertraege.accept")}
                    </button>
                  )}
                  <button type="button" onClick={() => setOpenKind(open ? null : c.kind)}
                    className="border border-foreground px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                    {open ? t("studio.vertraege.hide") : t("studio.vertraege.show")}
                  </button>
                </div>
              </div>
              {open && (
                <pre className="mt-4 whitespace-pre-wrap border-t border-border pt-4 font-sans text-sm leading-relaxed text-foreground/85">{c.body_markdown}</pre>
              )}
            </section>
          );
        })}
        {!current.length && <p className="text-sm text-muted-foreground">{t("studio.vertraege.empty")}</p>}
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <p className="editorial-eyebrow">{t("studio.vertraege.historyTitle")}</p>
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {history.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{c.title} · v{c.version}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(c.effective_from, locale)} – {c.effective_to ? formatDate(c.effective_to, locale) : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StudioShell>
  );
}
