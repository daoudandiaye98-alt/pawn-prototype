import { useState, type ReactNode } from "react";
import { PortalShell } from "@/components/pawn/PortalShell";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { useStore, portalSelectors } from "@/core";
import { RoleGate, PrototypeAccessBanner } from "@/features/access/RoleGate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowUpRight, Sparkles, Package, MessageSquare, Truck, Wallet, Dna } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card as ShadcnCard, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Designer Studio — the tenant surface.
 * Teil 26b: eine Bibliothek (shadcn) statt der stillgelegten pawn/primitives.
 */

function Card({ title, eyebrow, action, children, className }: {
  title: ReactNode; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <ShadcnCard className={cn("border-[hsl(var(--border-strong))]", className)}>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 border-b border-border px-6 py-4">
        <div>
          {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
          <CardTitle className="mt-1 t-display-sm font-normal">{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </ShadcnCard>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string; tone?: "accent" }) {
  return (
    <div className="border border-[hsl(var(--border))] bg-card p-5 md:p-6">
      <p className="t-eyebrow">{label}</p>
      <p className="mt-4 t-display-md leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-2 text-[0.65rem] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StudioBody() {
  const { t } = useI18n();
  const studio = useStore((s) => portalSelectors.getStudioOverview(s, "primary"));
  const { products, revenueSeries, months } = studio;

  // Studio-local publishing queue (client only — designers wouldn't see events)
  const [drafts, setDrafts] = useState([
    { id: "d1", label: "SS26 · Look 04 · Deconstructed Blazer", status: "Draft", updated: t("portal.overview.time.minutesAgo", { n: 12 }) },
    { id: "d2", label: "SS26 · Look 09 · Tailored Trouser", status: "Review", updated: t("portal.overview.time.hoursAgo", { n: 2 }) },
    { id: "d3", label: "SS26 · Look 11 · Cropped Vest", status: "Ready", updated: t("portal.overview.time.yesterday") },
  ]);

  const suggestions = [
    { title: t("portal.overview.suggestions.s1.title"), body: t("portal.overview.suggestions.s1.body"), cta: t("portal.overview.suggestions.s1.cta") },
    { title: t("portal.overview.suggestions.s2.title"), body: t("portal.overview.suggestions.s2.body"), cta: t("portal.overview.suggestions.s2.cta") },
    { title: t("portal.overview.suggestions.s3.title"), body: t("portal.overview.suggestions.s3.body"), cta: t("portal.overview.suggestions.s3.cta") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">Studio · Y/PROJECT</p>
        <h2 className="mt-2 font-serif text-4xl">{t("portal.overview.greeting", { brand: "Y/PROJECT" })}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("portal.overview.subtitle")}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("portal.overview.kpi.revenue")} value="€128.460" sub={t("portal.overview.kpi.revenueSub")} />
        <Kpi label={t("portal.overview.kpi.orders")} value="284" sub={t("portal.overview.kpi.ordersSub")} />
        <Kpi label={t("portal.overview.kpi.conversion")} value="4.2 %" sub={t("portal.overview.kpi.conversionSub")} />
        <Kpi label={t("portal.overview.kpi.nextPayout")} value="€18.420" sub={t("portal.overview.kpi.nextPayoutSub")} tone="accent" />
      </div>

      {/* Revenue + Countries */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={t("portal.overview.chart.revenueTitle")} eyebrow={t("portal.overview.chart.revenueEyebrow")}>
          <div className="p-6"><ChartPlaceholder series={revenueSeries} labels={months} variant="area" /></div>
        </Card>
        <Card title={t("portal.overview.chart.countryTitle")} eyebrow="Top 6">
          <div className="p-6">
            <ChartPlaceholder variant="bars" series={[42, 28, 22, 16, 12, 8]} labels={["DE", "FR", "UK", "US", "JP", "IT"]} />
          </div>
        </Card>
      </div>

      {/* AI suggestions + Publishing queue + Customer DNA alignment */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t("portal.overview.suggestions.title")} eyebrow={t("portal.overview.suggestions.eyebrow")}>
          <ul className="divide-y divide-border">
            {suggestions.map((s) => (
              <li key={s.title} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-accent/40 text-accent">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{s.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                    <button onClick={() => toast(s.cta)}
                      className="mt-2 text-[0.65rem] uppercase tracking-[0.22em] text-accent-foreground/90 underline-offset-4 hover:underline">
                      {s.cta} <ArrowUpRight className="ml-0.5 inline h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Publishing" eyebrow={t("portal.overview.publishing.eyebrow", { n: 3 })}
          action={<button onClick={() => toast.success(t("portal.overview.publishing.publishedToast"))}
            className="border border-accent bg-accent px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] text-accent-foreground hover:opacity-90">{t("portal.overview.publishing.publish")}</button>}>
          <ul className="divide-y divide-border">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.label}</p>
                  <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{d.updated}</p>
                </div>
                <span className={cn("border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]",
                  d.status === "Ready" && "border-accent text-accent-foreground bg-accent/10",
                  d.status === "Review" && "border-border text-foreground",
                  d.status === "Draft" && "border-border text-muted-foreground",
                )}>{d.status}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border p-4">
            <button onClick={() => setDrafts((prev) => [{ id: `d${prev.length + 1}`, label: t("portal.overview.publishing.newDraftLabel"), status: "Draft", updated: t("portal.overview.publishing.justNow") }, ...prev])}
              className="w-full border border-dashed border-border py-2 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground hover:border-foreground hover:text-foreground">
              {t("portal.overview.publishing.addDraft")}
            </button>
          </div>
        </Card>

        <Card title="Customer DNA Alignment" eyebrow={t("portal.overview.dna.eyebrow")}>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">{t("portal.overview.dna.intro")}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Shadow", 62, t("portal.overview.dna.trend.growing")],
                ["Editorial", 24, t("portal.overview.dna.trend.stable")],
                ["Minimal", 14, t("portal.overview.dna.trend.slightlyDeclining")],
              ].map(([label, pct, trend]) => (
                <li key={String(label)}>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2"><Dna className="h-3 w-3 text-accent" /> {label}</span>
                    <span className="tabular-nums">{pct} %</span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-secondary">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{trend}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Fulfillment queue + Top products + Payouts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Fulfillment Queue" eyebrow={t("portal.overview.fulfillment.eyebrow", { n: 6 })}
          action={<span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{t("portal.overview.fulfillment.sla")}</span>}>
          <ul className="divide-y divide-border">
            {[
              ["#P-24818", "Berlin, DE", t("portal.overview.time.hoursAgo", { n: 2 }), <Truck key="a" className="h-3 w-3" />],
              ["#P-24817", "Paris, FR", t("portal.overview.time.hoursAgo", { n: 4 }), <Truck key="b" className="h-3 w-3" />],
              ["#P-24816", "Tokyo, JP", t("portal.overview.time.hoursAgo", { n: 6 }), <Package key="c" className="h-3 w-3" />],
              ["#P-24815", "London, UK", t("portal.overview.time.yesterday"), <Package key="d" className="h-3 w-3" />],
            ].map(([id, city, when, icon]) => (
              <li key={String(id)} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center border border-border text-muted-foreground">{icon}</span>
                  <div>
                    <p className="font-mono text-xs">{id}</p>
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{city} · {when}</p>
                  </div>
                </div>
                <button onClick={() => toast(t("portal.overview.fulfillment.labelPrinted", { id: String(id) }))}
                  className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">{t("portal.overview.fulfillment.label")}</button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("portal.overview.topProducts.title")} eyebrow={t("portal.overview.topProducts.eyebrow")}>
          <ul className="divide-y divide-border">
            {products.slice(0, 5).map((p, i) => (
              <li key={p.id} className="px-6 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">{84 - i * 14}</span>
                </div>
                <div className="mt-1 h-1 w-full bg-secondary">
                  <div className="h-full bg-accent" style={{ width: `${Math.max(20, 100 - i * 18)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("portal.overview.payouts.title")} eyebrow={t("portal.overview.payouts.eyebrow")}>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-accent" />
              <div>
                <p className="font-serif text-2xl tabular-nums">€18.420</p>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{t("portal.overview.payouts.nextPayoutLine")}</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">
              {[
                [t("portal.overview.payouts.month.june2026"), "€18.420", t("portal.overview.payouts.status.scheduled")],
                [t("portal.overview.payouts.month.may2026"), "€21.900", t("portal.overview.payouts.status.paidOut")],
                [t("portal.overview.payouts.month.apr2026"), "€19.180", t("portal.overview.payouts.status.paidOut")],
              ].map(([m, v, s]) => (
                <li key={m} className="flex items-center justify-between py-2">
                  <span>{m}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{v}</span>
                    <span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{s}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Messages */}
      <Card title={t("portal.overview.messages.title")} eyebrow={t("portal.overview.messages.eyebrow", { n: 4 })}
        action={<button onClick={() => toast(t("portal.overview.messages.inboxOpened"))} className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">{t("portal.overview.messages.open")}</button>}>
        <ul className="divide-y divide-border">
          {[
            ["Marie L.", t("portal.overview.messages.m1"), t("portal.overview.time.minutesAgo", { n: 20 }), t("portal.overview.messages.prio.high")],
            ["Support PAWN", t("portal.overview.messages.m2"), t("portal.overview.time.hoursAgo", { n: 3 }), t("portal.overview.messages.prio.info")],
            [t("portal.overview.messages.customerLabel", { id: "JP-1284" }), t("portal.overview.messages.m3"), t("portal.overview.time.yesterday"), t("portal.overview.messages.prio.normal")],
          ].map(([name, msg, when, prio]) => (
            <li key={String(msg)} className="flex items-start gap-3 px-6 py-4">
              <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-medium">{name}</span> <span className="text-muted-foreground">— {msg}</span></p>
                <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{when} · {prio}</p>
              </div>
              <button onClick={() => toast(t("portal.overview.messages.replyToast", { name: String(name) }))}
                className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">{t("portal.overview.messages.reply")}</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const PortalOverview = () => {
  const { t } = useI18n();
  return (
    <RoleGate role="designer">
      <PortalShell eyebrow="Y/PROJECT · Studio" title={t("account.overview")}>
        <PrototypeAccessBanner role="Designer Studio" />
        <StudioBody />
      </PortalShell>
    </RoleGate>
  );
};

export default PortalOverview;
