import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { AccountSettingsPanel } from "@/components/palace/AccountSettings";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";

const PLAN_LABEL: Record<string, string> = { haus: "Haus", atelier: "Atelier", maison: "Maison" };

interface BrandDna {
  worlds?: Record<string, number>;
  signals?: string[];
  price_band?: { min?: number; max?: number; avg?: number };
  inventory_mix?: { stock?: number; made_to_order?: number };
  product_count?: number;
}

export default function StudioSettings() {
  const { designer, loading, refresh } = useMyDesigner();
  const { t, locale } = useI18n();
  const shellTitle = t("studioShell.nav.einstellungen");
  if (loading) return <StudioShell title={shellTitle}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={shellTitle}><p className="text-sm text-muted-foreground">{t("studio.settings.noAccess")}</p></StudioShell>;

  const dna = (designer.brand_dna ?? {}) as BrandDna;
  const worlds = dna.worlds ?? {};
  const hasDna = (dna.product_count ?? 0) > 0;

  return (
    <StudioShell title={shellTitle} eyebrow={shellTitle}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand-DNA */}
        <section className="border border-border bg-white p-8">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.settings.dna.eyebrow")}</p>
          <h2 className="mt-2 font-serif text-2xl font-medium">{t("studio.settings.dna.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("studio.settings.dna.subtitle")}</p>

          {!hasDna ? (
            <PawnEmptyState
              className="mt-6"
              title={t("studio.settings.dna.empty")}
              action={<Link to="/studio/produkte" className="inline-flex border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">{t("studio.settings.dna.createFirst")}</Link>}
            />
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {(["Mode", "Interior", "Kunst"] as const).map((w) => {
                  const ratio = worlds[w] ?? 0;
                  const label = w === "Mode" ? t("nav.mode") : w === "Interior" ? t("nav.interior") : t("nav.kunst");
                  return (
                    <div key={w}>
                      <div className="flex items-baseline justify-between text-[0.68rem] uppercase tracking-[0.22em]">
                        <span>{label}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(ratio * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-muted">
                        <div className="h-full bg-foreground transition-all" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {dna.signals && dna.signals.length > 0 && (
                <div className="mt-6">
                  <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.settings.dna.signals")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dna.signals.slice(0, 8).map((s) => (
                      <span key={s} className="border border-border bg-white px-2 py-1 text-[0.68rem]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {dna.price_band && (
                <div className="mt-6 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
                  <Stat label={t("studio.settings.dna.avgPrice")} value={`€ ${Math.round(dna.price_band.avg ?? 0)}`} />
                  <Stat label={t("studio.settings.dna.priceBand")} value={`€ ${Math.round(dna.price_band.min ?? 0)}–${Math.round(dna.price_band.max ?? 0)}`} />
                  <Stat label={t("studio.settings.dna.pieces")} value={String(dna.product_count ?? 0)} />
                </div>
              )}
            </>
          )}
        </section>

        {/* Meta */}
        <section className="border border-border bg-white p-8">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.settings.meta.eyebrow")}</p>
          <h2 className="mt-2 font-serif text-2xl font-medium">{t("studio.settings.meta.house", { number: designer.house_number ? `№ ${designer.house_number}` : "" })}</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <Row k={t("studio.settings.meta.brand")} v={designer.brand_name} />
            <Row k={t("studio.settings.meta.slug")} v={designer.slug} />
            <Row k={t("studio.settings.meta.location")} v={designer.location ?? "—"} />
            <Row k={t("studio.settings.meta.country")} v={designer.country ?? "—"} />
            <Row k={t("studio.settings.meta.status")} v={designer.status} />
            <Row k={t("studio.settings.meta.memberSince")} v={designer.created_at ? formatDate(designer.created_at, locale, { month: "long", year: "numeric" }) : "—"} />
          </dl>
          <Link to="/studio/brand" className="mt-6 inline-flex border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">{t("studio.settings.meta.editReview")}</Link>
        </section>
      </div>

      <section className="mt-6 border border-border bg-white p-8">
        <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.settings.guide.eyebrow")}</p>
        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={designer.pawn_guide_enabled !== false}
            onChange={async (e) => {
              const { error } = await supabase.from("designers").update({ pawn_guide_enabled: e.target.checked }).eq("id", designer.id);
              if (!error) void refresh();
            }}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block font-serif text-lg">{t("studio.settings.guide.title")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t("studio.settings.guide.body")}</span>
          </span>
        </label>
      </section>

      <div className="mt-6">
        <AccountSettingsPanel
          role="designer"
          paymentSlot={
            <div className="space-y-4">
              <p className="text-sm text-black/70">
                {t("studio.settings.payment.planPrefix")} <strong>{PLAN_LABEL[designer.plan] ?? designer.plan}</strong> ·{" "}
                {designer.stripe_charges_enabled ? t("studio.settings.payment.connectedActive") : t("studio.settings.payment.connectedInactive")}.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/studio/auszahlung" className="border-[1.5px] border-black px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white">
                  {t("studio.settings.payment.toPayout")}
                </Link>
                <Link to="/studio/plan" className="border-[1.5px] border-black px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] hover:bg-black hover:text-white">
                  {t("studio.settings.payment.toPlan")}
                </Link>
              </div>
            </div>
          }
        />
      </div>
    </StudioShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pb-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{k}</dt>
      <dd className="font-serif">{v}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-lg">{value}</p>
    </div>
  );
}
