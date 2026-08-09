/**
 * Teil 37/AP3 — "Beweis": Sichtbarkeit in Zahlen. Nur echte Daten aus page_visits,
 * wishlists, orders, designer_opportunities, media_assets — keine erfundenen Werte.
 * Bei 1 Designer im Live-System ist "leer" der Normalfall, deshalb hat jede Kachel
 * einen eigenen, konkreten Empty State statt einer generischen Null.
 *
 * Payout-Transparenz nutzt orders + designers.stripe_charges_enabled statt der im
 * Auftrag genannten designer_payout_profiles-Tabelle: die stammt aus der Zeit vor
 * Stripe Connect (direkte IBAN-Eingabe) und wird nirgends mehr geschrieben oder
 * gelesen — echte Auszahlungsdaten leben seit der Umstellung in orders/designers.
 */
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

interface Kennzahlen { besuche: { gesamt: number; zeitraum: number }; wunschlisten: { gesamt: number; zeitraum: number } }
interface TuerZaehlung { offen: number; gesendet: number; zugestellt: number; fehlgeschlagen: number; angenommen: number }
interface MedienZaehlung { privat: number; eingereicht: number; angenommen: number; abgelehnt: number }

function Kachel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-[1.5px] border-foreground bg-white p-6">
      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{title}</p>
      <div className="mt-4">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function StudioBeweis() {
  const { designer, loading: loadingDesigner } = useMyDesigner();
  const { t } = useI18n();
  const [days, setDays] = useState<7 | 30>(7);
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(null);
  const [loadingKennzahlen, setLoadingKennzahlen] = useState(true);
  const [tueren, setTueren] = useState<TuerZaehlung | null>(null);
  const [medien, setMedien] = useState<MedienZaehlung | null>(null);
  const { lines: orderLines, loading: loadingOrders } = useDesignerOrders(designer?.id);

  useEffect(() => {
    if (!designer) return;
    let alive = true;
    setLoadingKennzahlen(true);
    void supabase.functions.invoke("studio-dashboard", { body: { days } }).then(({ data }) => {
      if (!alive) return;
      const r = data as (Kennzahlen & { ok?: boolean }) | null;
      setKennzahlen(r?.ok ? r : null);
      setLoadingKennzahlen(false);
    });
    return () => { alive = false; };
  }, [designer?.id, days]);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("designer_opportunities" as never).select("status, delivery_status").eq("designer_id", designer.id)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as { status: string; delivery_status: string | null }[];
        setTueren({
          offen: rows.filter((r) => r.status === "gefunden" || r.status === "interessiert").length,
          gesendet: rows.filter((r) => r.status === "kontaktiert" && r.delivery_status !== "zugestellt").length,
          zugestellt: rows.filter((r) => r.delivery_status === "zugestellt").length,
          fehlgeschlagen: rows.filter((r) => r.delivery_status === "fehler").length,
          angenommen: rows.filter((r) => r.status === "angenommen").length,
        });
      });
    void supabase.from("media_assets").select("review_status").eq("designer_id", designer.id)
      .then(({ data }) => {
        const rows = (data ?? []) as { review_status: string }[];
        setMedien({
          privat: rows.filter((r) => r.review_status === "privat").length,
          eingereicht: rows.filter((r) => r.review_status === "eingereicht").length,
          angenommen: rows.filter((r) => r.review_status === "angenommen").length,
          abgelehnt: rows.filter((r) => r.review_status === "abgelehnt").length,
        });
      });
  }, [designer?.id]);

  if (loadingDesigner) return <StudioShell title={t("studio.beweis.title")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studio.beweis.title")}><p className="text-muted-foreground">{t("studio.beweis.noAccess")}</p></StudioShell>;

  const cutoff = new Date(Date.now() - days * 86_400_000);
  const ordersInPeriod = orderLines.filter((l) => new Date(l.order_created_at) >= cutoff);
  const revenueInPeriod = ordersInPeriod.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const revenueTotal = orderLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const designerShare = (eur: number) => eur * 0.93;

  const tuerenGesamt = tueren ? tueren.offen + tueren.gesendet + tueren.zugestellt + tueren.fehlgeschlagen + tueren.angenommen : 0;
  const medienGesamt = medien ? medien.privat + medien.eingereicht + medien.angenommen + medien.abgelehnt : 0;

  return (
    <StudioShell title={t("studio.beweis.title")} eyebrow={t("studio.beweis.eyebrow")}>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("studio.beweis.intro")}</p>
          <div className="flex shrink-0 gap-1 border-[1.5px] border-foreground">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] ${days === d ? "bg-foreground text-background" : "text-foreground hover:bg-muted"}`}
              >
                {d} {t("studio.beweis.tage")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kachel title={t("studio.beweis.seitenaufrufe")}>
            {loadingKennzahlen ? (
              <PawnLoading className="h-16" />
            ) : !kennzahlen || kennzahlen.besuche.gesamt === 0 ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.besuche.title")}
                description={t("studio.beweis.empty.besuche.body")}
                action={<Link to="/studio/hausseite" className="text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.empty.besuche.cta")}</Link>}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">{kennzahlen.besuche.zeitraum}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("studio.beweis.imZeitraum", { days })} — {t("studio.beweis.insgesamt", { n: kennzahlen.besuche.gesamt })}</p>
              </>
            )}
          </Kachel>

          <Kachel title={t("studio.beweis.wunschlisten")}>
            {loadingKennzahlen ? (
              <PawnLoading className="h-16" />
            ) : !kennzahlen || kennzahlen.wunschlisten.gesamt === 0 ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.wunschlisten.title")}
                description={t("studio.beweis.empty.wunschlisten.body")}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">+{kennzahlen.wunschlisten.zeitraum}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("studio.beweis.imZeitraum", { days })} — {t("studio.beweis.insgesamt", { n: kennzahlen.wunschlisten.gesamt })}</p>
              </>
            )}
          </Kachel>

          <Kachel title={t("studio.beweis.bestellungen")}>
            {loadingOrders ? (
              <PawnLoading className="h-16" />
            ) : orderLines.length === 0 ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.bestellungen.title")}
                description={t("studio.beweis.empty.bestellungen.body")}
                action={<Link to="/studio/produkte" className="text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.empty.bestellungen.cta")}</Link>}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">{ordersInPeriod.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("studio.beweis.imZeitraum", { days })} · {designerShare(revenueInPeriod).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} {t("studio.beweis.deinAnteil")}
                </p>
                <p className="mt-3 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("studio.beweis.insgesamt", { n: orderLines.length })} · {designerShare(revenueTotal).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </p>
              </>
            )}
          </Kachel>

          <Kachel title={t("studio.beweis.tueren")}>
            {!tueren ? (
              <PawnLoading className="h-16" />
            ) : tuerenGesamt === 0 ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.tueren.title")}
                description={t("studio.beweis.empty.tueren.body")}
                action={<Link to="/studio/tueren" className="text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.empty.tueren.cta")}</Link>}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">{tueren.angenommen}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("studio.beweis.tuerenAngenommen")} — {t("studio.beweis.tuerenZugestellt")}: {tueren.zugestellt} · {t("studio.beweis.tuerenOffen", { n: tueren.offen })}
                </p>
                <Link to="/studio/tueren" className="mt-3 inline-block text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.zuDenTueren")}</Link>
              </>
            )}
          </Kachel>

          <Kachel title={t("studio.beweis.medien")}>
            {!medien ? (
              <PawnLoading className="h-16" />
            ) : medienGesamt === 0 ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.medien.title")}
                description={t("studio.beweis.empty.medien.body")}
                action={<Link to="/studio/mediathek" className="text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.empty.medien.cta")}</Link>}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">{medienGesamt}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("studio.beweis.medienAngenommen", { n: medien.angenommen })} · {t("studio.beweis.medienEingereicht", { n: medien.eingereicht })}
                </p>
                <Link to="/studio/mediathek" className="mt-3 inline-block text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.zurMediathek")}</Link>
              </>
            )}
          </Kachel>

          <Kachel title={t("studio.beweis.auszahlung")}>
            {!designer.stripe_charges_enabled ? (
              <PawnEmptyState
                title={t("studio.beweis.empty.auszahlung.title")}
                description={t("studio.beweis.empty.auszahlung.body")}
                action={<Link to="/studio/auszahlung" className="text-[0.65rem] uppercase tracking-[0.24em] underline">{t("studio.beweis.empty.auszahlung.cta")}</Link>}
              />
            ) : (
              <>
                <p className="font-serif text-4xl">{designerShare(revenueTotal).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("studio.beweis.auszahlungHinweis")}</p>
              </>
            )}
          </Kachel>
        </div>
      </div>
    </StudioShell>
  );
}
