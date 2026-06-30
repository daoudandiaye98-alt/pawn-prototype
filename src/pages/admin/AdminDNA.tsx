import { useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { ChartPlaceholder, RadarPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { dnaSegments, colorTrends } from "@/data/mock";
import { cn } from "@/lib/utils";

const TABS = ["Übersicht", "Segmente", "Farben", "Schnitte", "Materialien", "Trends"] as const;

const AdminDNA = () => {
  const [tab, setTab] = useState<typeof TABS[number]>("Übersicht");
  return (
    <AdminShell eyebrow="Intelligence" title="Global DNA">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="border border-border bg-card p-8">
          <p className="editorial-eyebrow">Global DNA Score</p>
          <p className="mt-4 font-serif text-[6rem] leading-none">82</p>
          <p className="text-sm uppercase tracking-[0.22em] text-accent">Highly coherent platform DNA</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Aggregated across 12.4K designers and 2.1M community members. Updated daily.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs">
            <Kpi label="Cohesion" v="88" />
            <Kpi label="Edge" v="74" />
            <Kpi label="Diversity" v="81" />
          </div>
        </section>
        <section className="border border-border bg-card p-8">
          <p className="editorial-eyebrow">Composition radar</p>
          <RadarPlaceholder className="mt-2" values={[78, 62, 88, 70, 55, 80]} labels={dnaSegments.map((s) => s.label).concat(["Heritage"]).slice(0, 6)} />
        </section>
      </div>

      <div className="mt-10">
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-2 text-xs uppercase tracking-[0.18em]",
                tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Übersicht" && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Section title="DNA Komposition">
              {dnaSegments.map((s) => (
                <Bar key={s.label} label={s.label} value={s.value} />
              ))}
            </Section>
            <Section title="Trend (90 Tage)">
              <ChartPlaceholder series={[18, 22, 26, 24, 30, 34, 32, 38, 42, 48]} />
            </Section>
          </div>
        )}
        {tab === "Farben" && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Section title="Top Farben">
              {colorTrends.map((c) => <Bar key={c.label} label={c.label} value={c.value} />)}
            </Section>
            <Section title="Farb-Trend">
              <ChartPlaceholder variant="bars" series={colorTrends.map((c) => c.value)} labels={colorTrends.map((c) => c.label)} />
            </Section>
          </div>
        )}
        {(tab === "Segmente" || tab === "Schnitte" || tab === "Materialien" || tab === "Trends") && (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border border-border bg-card p-6">
                <p className="editorial-eyebrow">{tab} · #{i}</p>
                <p className="mt-2 font-serif text-xl">Insight {i}</p>
                <ChartPlaceholder series={[10, 14, 18, 16, 22, 30, 28, 36]} className="mt-4" height={120} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
};

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="border border-border p-3">
      <p className="editorial-eyebrow">{label}</p>
      <p className="mt-1 font-serif text-2xl">{v}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-6">
      <p className="editorial-eyebrow">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1 w-full bg-secondary">
        <div className="h-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default AdminDNA;
