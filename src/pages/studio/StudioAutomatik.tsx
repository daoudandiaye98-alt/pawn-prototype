import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { useI18n } from "@/lib/i18n";
import { schreibePawnSignal } from "@/lib/pawnSignal";

/**
 * Teil 28c — Die Automatik-Tafel: drei feste Vertrauens-Zonen, dieselbe Einteilung wie bei
 * PAWN Jarvis (Teil 9b), nur diesmal für ein einzelnes Haus. Nur Zone Grün hat einen echten
 * Schalter — Gelb und Rot beschreiben, wie PAWN sich in diesen Fällen ohnehin verhält, ohne
 * dass sich daran etwas einstellen ließe.
 */
const GRUEN_KEYS = ["inszenieren_bei_upload", "caption_nach_inszenierung", "aufraeumen_woechentlich", "sharekit_bei_live"] as const;
const GELB_KEYS = ["veroeffentlichen", "preisvorschlag"] as const;
const ROT_KEYS = ["kundennachrichten", "geld", "loeschen"] as const;
// Teil 38 AP6 — Mini-PAWNs: zusätzliche, pro Haus schaltbare Organe, nur für den Maison-Plan.
// 'impuls' ist bewusst kein Schalter hier — der wochenimpuls aus Teil 38 AP2 bleibt für alle
// Pläne kostenlos und läuft immer, wird hier nur informativ erwähnt.
const ORGAN_KEYS = ["sichtbarkeitszug", "presse", "verstaerker_haus"] as const;

export default function StudioAutomatik() {
  const { designer, loading } = useMyDesigner();
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [rowsLoading, setRowsLoading] = useState(true);

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const { data } = await supabase.from("designer_automations" as never).select("automation_key, enabled").eq("designer_id", designer.id);
      const map: Record<string, boolean> = {};
      for (const row of (data as { automation_key: string; enabled: boolean }[] | null) ?? []) map[row.automation_key] = row.enabled;
      setEnabled(map);
      setRowsLoading(false);
    })();
  }, [designer]);

  const toggle = async (key: string) => {
    if (!designer) return;
    const next = !enabled[key];
    setEnabled((prev) => ({ ...prev, [key]: next }));
    await supabase.from("designer_automations" as never).upsert(
      { designer_id: designer.id, automation_key: key, enabled: next, updated_at: new Date().toISOString() } as never,
      { onConflict: "designer_id,automation_key" },
    );
    void schreibePawnSignal(next ? "automatik_an" : "automatik_aus", { modus: key });
  };

  if (loading) return <StudioShell title={t("studioShell.nav.automatik")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.automatik")}><p className="text-sm text-muted-foreground">{t("studio.settings.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studioShell.nav.automatik")} eyebrow={t("studioShell.nav.automatik")}>
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">{t("studio.automatik.intro")}</p>

      <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.automatik.gruen.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("studio.automatik.gruen.hint")}</p>
        <ul className="mt-4 divide-y divide-border">
          {GRUEN_KEYS.map((key) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{t(`studio.automatik.key.${key}`)}</p>
                <p className="text-xs text-muted-foreground">{t(`studio.automatik.key.${key}.hint`)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!enabled[key]}
                disabled={rowsLoading}
                onClick={() => void toggle(key)}
                className={`h-6 w-11 shrink-0 border-[1.5px] border-foreground transition-colors ${enabled[key] ? "bg-foreground" : "bg-white"}`}
              >
                <span className={`block h-[18px] w-[18px] bg-background transition-transform ${enabled[key] ? "translate-x-[22px] bg-white" : "translate-x-[2px] bg-foreground"}`} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.automatik.organe.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("studio.automatik.organe.hint")}</p>
        {designer.plan === "maison" ? (
          <ul className="mt-4 divide-y divide-border">
            {ORGAN_KEYS.map((key) => (
              <li key={key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t(`studio.automatik.organ.${key}`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`studio.automatik.organ.${key}.hint`)}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!enabled[key]}
                  disabled={rowsLoading}
                  onClick={() => void toggle(key)}
                  className={`h-6 w-11 shrink-0 border-[1.5px] border-foreground transition-colors ${enabled[key] ? "bg-foreground" : "bg-white"}`}
                >
                  <span className={`block h-[18px] w-[18px] bg-background transition-transform ${enabled[key] ? "translate-x-[22px] bg-white" : "translate-x-[2px] bg-foreground"}`} />
                </button>
              </li>
            ))}
            <li className="py-3">
              <p className="text-sm font-medium">{t("studio.automatik.organ.impuls")}</p>
              <p className="text-xs text-muted-foreground">{t("studio.automatik.organ.impuls.hint")}</p>
            </li>
          </ul>
        ) : (
          <div className="mt-4 border-[1.5px] border-dashed border-border p-4">
            <p className="text-sm text-muted-foreground">{t("studio.automatik.organe.locked")}</p>
            <Link to="/studio/plan" className="mt-2 inline-block text-sm font-medium underline">
              {t("studio.automatik.organe.lockedCta")}
            </Link>
          </div>
        )}
      </section>

      <section className="mb-6 border-[1.5px] border-foreground bg-white p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.automatik.gelb.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("studio.automatik.gelb.hint")}</p>
        <ul className="mt-4 divide-y divide-border">
          {GELB_KEYS.map((key) => (
            <li key={key} className="py-3">
              <p className="text-sm font-medium">{t(`studio.automatik.key.${key}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`studio.automatik.key.${key}.hint`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-[1.5px] border-foreground bg-white p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.automatik.rot.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("studio.automatik.rot.hint")}</p>
        <ul className="mt-4 divide-y divide-border">
          {ROT_KEYS.map((key) => (
            <li key={key} className="py-3">
              <p className="text-sm font-medium">{t(`studio.automatik.key.${key}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`studio.automatik.key.${key}.hint`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </StudioShell>
  );
}
