import { useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { ChartPlaceholder, RadarPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { useStore, adminSelectors } from "@/core";
import { cn } from "@/lib/utils";
import { Panel, Metric, SectionHeader } from "@/components/pawn/primitives";

const TABS = ["Übersicht", "Segmente", "Farben", "Schnitte", "Materialien", "Trends"] as const;

const AdminDNA = () => {
  const { segments: dnaSegments, colorTrends } = useStore(adminSelectors.getGlobalDnaView);
  const [tab, setTab] = useState<typeof TABS[number]>("Übersicht");
  return (
    <AdminShell eyebrow="Intelligence" title="Global DNA">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel eyebrow="Global DNA Score" title="82">
          <div className="p-6 md:p-8">
            <p className="t-eyebrow text-[hsl(var(--oxblood))]">Highly coherent platform DNA</p>
            <p className="mt-4 t-body-md text-muted-foreground">
              Aggregated across 12.4K designers and 2.1M community members. Updated daily.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <Metric label="Cohesion" value="88" />
              <Metric label="Edge" value="74" />
              <Metric label="Diversity" value="81" />
            </div>
          </div>
        </Panel>
        <Panel eyebrow="Composition radar" title="Signature axes">
          <div className="p-6 md:p-8">
            <RadarPlaceholder
              values={[78, 62, 88, 70, 55, 80]}
              labels={dnaSegments.map((s) => s.label).concat(["Heritage"]).slice(0, 6)}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-10">
        <SectionHeader eyebrow="Explore" title="Signature dimensions" />
        <div className="mt-6 flex gap-1 border-b border-[hsl(var(--border))]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-2 t-eyebrow motion-micro",
                tab === t ? "border-[hsl(var(--oxblood))] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Übersicht" && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Panel eyebrow="Composition" title="DNA Komposition">
              <div className="space-y-3 p-6">{dnaSegments.map((s) => <Bar key={s.label} label={s.label} value={s.value} />)}</div>
            </Panel>
            <Panel eyebrow="90-day trend" title="Signature drift">
              <div className="p-6"><ChartPlaceholder series={[18, 22, 26, 24, 30, 34, 32, 38, 42, 48]} /></div>
            </Panel>
          </div>
        )}
        {tab === "Farben" && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Panel eyebrow="Palette" title="Top Farben">
              <div className="space-y-3 p-6">{colorTrends.map((c) => <Bar key={c.label} label={c.label} value={c.value} />)}</div>
            </Panel>
            <Panel eyebrow="Trend" title="Farb-Trend">
              <div className="p-6"><ChartPlaceholder variant="bars" series={colorTrends.map((c) => c.value)} labels={colorTrends.map((c) => c.label)} /></div>
            </Panel>
          </div>
        )}
        {(tab === "Segmente" || tab === "Schnitte" || tab === "Materialien" || tab === "Trends") && (
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Panel key={i} eyebrow={`${tab} · #${i}`} title={`Insight ${i}`}>
                <div className="p-6"><ChartPlaceholder series={[10, 14, 18, 16, 22, 30, 28, 36]} height={120} /></div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between t-body-sm">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1 w-full bg-secondary">
        <div className="h-full bg-[hsl(var(--oxblood))]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default AdminDNA;
