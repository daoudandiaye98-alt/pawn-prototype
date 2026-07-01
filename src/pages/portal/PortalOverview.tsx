import { useState } from "react";
import { PortalShell } from "@/components/pawn/PortalShell";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { useStore, portalSelectors } from "@/core";
import { RoleGate, PrototypeAccessBanner } from "@/features/access/RoleGate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowUpRight, Sparkles, Package, MessageSquare, Truck, Wallet, Dna } from "lucide-react";
import { Panel, Metric, Command, Status, Recommendation } from "@/components/pawn/primitives";

/**
 * Designer Studio — the tenant surface.
 * Uses the shared primitive language. No tenant-local card variants.
 */

const Card = Panel;
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "accent" }) {
  return (
    <Metric
      label={label}
      value={value}
      delta={sub}
      trend={tone === "accent" ? "up" : "neutral"}
    />
  );
}

function StudioBody() {
  const studio = useStore((s) => portalSelectors.getStudioOverview(s, "primary"));
  const { products, revenueSeries, months } = studio;

  // Studio-local publishing queue (client only — designers wouldn't see events)
  const [drafts, setDrafts] = useState([
    { id: "d1", label: "SS26 · Look 04 · Deconstructed Blazer", status: "Draft", updated: "vor 12 Min" },
    { id: "d2", label: "SS26 · Look 09 · Tailored Trouser", status: "Review", updated: "vor 2 Std" },
    { id: "d3", label: "SS26 · Look 11 · Cropped Vest", status: "Ready", updated: "gestern" },
  ]);

  const suggestions = [
    { title: "Dein Shadow-Cluster wächst", body: "132 neue Kunden passen zu deiner Ästhetik. Ein Look-Drop wäre jetzt sinnvoll.", cta: "Kollektion planen" },
    { title: "Preisgestaltung Look 04", body: "Predicted CTR +18 % bei €890 statt €780. AOV-Gewinn: geschätzt €4.2k / Monat.", cta: "Preis testen" },
    { title: "Fehlender Kontext", body: "Deine Beschreibung enthält keine Materialangabe. Kunden fragen 12× diese Woche danach.", cta: "Ergänzen" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">Studio · Y/PROJECT</p>
        <h2 className="mt-2 font-serif text-4xl">Guten Abend, Studio Y/PROJECT.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Dein Studio läuft ruhig. 284 Bestellungen im laufenden Monat, 3 Kollektionen im Entwurf,
          nächste Auszahlung Montag. Alles unten ist deins — kein Blick auf die Plattform.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Umsatz (Monat)" value="€128.460" sub="+8.2 % ggü. Vormonat" />
        <Kpi label="Bestellungen" value="284" sub="+24 diese Woche" />
        <Kpi label="Konversion" value="4.2 %" sub="Marktplatz-Ø 3.1 %" />
        <Kpi label="Nächste Auszahlung" value="€18.420" sub="Montag, 6. Juli" tone="accent" />
      </div>

      {/* Revenue + Countries */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Umsatzentwicklung" eyebrow="12 Monate">
          <div className="p-6"><ChartPlaceholder series={revenueSeries} labels={months} variant="area" /></div>
        </Card>
        <Card title="Umsatz nach Land" eyebrow="Top 6">
          <div className="p-6">
            <ChartPlaceholder variant="bars" series={[42, 28, 22, 16, 12, 8]} labels={["DE", "FR", "UK", "US", "JP", "IT"]} />
          </div>
        </Card>
      </div>

      {/* AI suggestions + Publishing queue + Customer DNA alignment */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Deine KI-Empfehlungen" eyebrow="Beobachtung → Handlung">
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

        <Card title="Publishing" eyebrow="Kollektionen · 3 offen"
          action={<button onClick={() => toast.success("Kollektion veröffentlicht")}
            className="border border-accent bg-accent px-3 py-1 text-[0.6rem] uppercase tracking-[0.22em] text-accent-foreground hover:opacity-90">Publish</button>}>
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
            <button onClick={() => setDrafts((prev) => [{ id: `d${prev.length + 1}`, label: "Neuer Entwurf", status: "Draft", updated: "gerade eben" }, ...prev])}
              className="w-full border border-dashed border-border py-2 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground hover:border-foreground hover:text-foreground">
              + Neuer Entwurf
            </button>
          </div>
        </Card>

        <Card title="Customer DNA Alignment" eyebrow="dein Kundenprofil">
          <div className="p-6">
            <p className="text-sm text-muted-foreground">Deine Kunden verteilen sich auf drei DNA-Cluster.</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Shadow", 62, "wächst"],
                ["Editorial", 24, "stabil"],
                ["Minimal", 14, "leicht rückläufig"],
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
        <Card title="Fulfillment Queue" eyebrow="offen · 6"
          action={<span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">SLA 24 h</span>}>
          <ul className="divide-y divide-border">
            {[
              ["#P-24818", "Berlin, DE", "vor 2 Std", <Truck key="a" className="h-3 w-3" />],
              ["#P-24817", "Paris, FR", "vor 4 Std", <Truck key="b" className="h-3 w-3" />],
              ["#P-24816", "Tokyo, JP", "vor 6 Std", <Package key="c" className="h-3 w-3" />],
              ["#P-24815", "London, UK", "gestern", <Package key="d" className="h-3 w-3" />],
            ].map(([id, city, when, icon]) => (
              <li key={String(id)} className="flex items-center justify-between px-6 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center border border-border text-muted-foreground">{icon}</span>
                  <div>
                    <p className="font-mono text-xs">{id}</p>
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">{city} · {when}</p>
                  </div>
                </div>
                <button onClick={() => toast(`${id} · Label gedruckt`)}
                  className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">Label</button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Top Produkte" eyebrow="30 Tage">
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

        <Card title="Auszahlungen" eyebrow="Historie">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-accent" />
              <div>
                <p className="font-serif text-2xl tabular-nums">€18.420</p>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Nächste Auszahlung Mo. · Commerzbank ••00</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">
              {[["Juni 2026", "€18.420", "geplant"], ["Mai 2026", "€21.900", "ausgezahlt"], ["Apr 2026", "€19.180", "ausgezahlt"]].map(([m, v, s]) => (
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
      <Card title="Nachrichten & Feedback" eyebrow="4 offen"
        action={<button onClick={() => toast("Inbox geöffnet")} className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">Öffnen</button>}>
        <ul className="divide-y divide-border">
          {[
            ["Marie L.", "Frage zur Passform Look 04", "vor 20 Min", "hoch"],
            ["Support PAWN", "Deine Kollektion wurde reviewed", "vor 3 Std", "info"],
            ["Kunde JP-1284", "Rücksendung eingegangen", "gestern", "normal"],
          ].map(([name, msg, when, prio]) => (
            <li key={String(msg)} className="flex items-start gap-3 px-6 py-4">
              <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="font-medium">{name}</span> <span className="text-muted-foreground">— {msg}</span></p>
                <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">{when} · {prio}</p>
              </div>
              <button onClick={() => toast(`Antwort an ${name}`)}
                className="text-[0.65rem] uppercase tracking-[0.22em] underline-offset-4 hover:underline">Antworten</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const PortalOverview = () => (
  <RoleGate role="designer">
    <PortalShell eyebrow="Y/PROJECT · Studio" title="Übersicht">
      <PrototypeAccessBanner role="Designer Studio" />
      <StudioBody />
    </PortalShell>
  </RoleGate>
);

export default PortalOverview;
