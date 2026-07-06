import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/pawn/AdminShell";
import { ChartPlaceholder } from "@/components/pawn/ChartPlaceholder";
import { useStore, adminSelectors } from "@/core";
import { cn } from "@/lib/utils";
import { RoleGate, PrototypeAccessBanner } from "@/features/access/RoleGate";
import { OsBusProvider, useOsBus, type EngineKey, type EngineState, type OsAction } from "@/features/os/systemBus";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, CircleDot, Cpu, Dna, Package,
  Sparkles, TrendingUp, UserPlus, Zap, Layers, BookOpen, ShieldCheck, Send, Radio,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────── Cockpit primitives ─────────────────────── */

function Panel({
  title, action, children, className, eyebrow, live,
}: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
  className?: string; eyebrow?: string; live?: boolean;
}) {
  return (
    <section className={cn("flex flex-col border border-white/[0.07] bg-[hsl(18_10%_7%)]/70 backdrop-blur-[1px]", className)}>
      <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-[15px] leading-none text-[hsl(36_25%_92%)]">{title}</h3>
          {eyebrow && <span className="text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(36_15%_55%)]">{eyebrow}</span>}
          {live && <LiveDot />}
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em] text-emerald-300/90">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  );
}

function Btn({
  children, onClick, variant = "ghost",
}: { children: React.ReactNode; onClick?: () => void; variant?: "ghost" | "solid" | "danger" }) {
  return (
    <button onClick={onClick} className={cn(
      "border px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.2em] transition-colors",
      variant === "ghost" && "border-white/15 text-[hsl(36_25%_82%)] hover:border-white/40 hover:bg-white/[0.04]",
      variant === "solid" && "border-[hsl(350_55%_35%)] bg-[hsl(350_55%_22%)] text-[hsl(36_28%_94%)] hover:bg-[hsl(350_55%_28%)]",
      variant === "danger" && "border-red-500/40 text-red-200 hover:bg-red-500/10",
    )}>{children}</button>
  );
}

function Sparkline({ series, stroke = "hsl(350 55% 50%)", height = 28 }: { series: number[]; stroke?: string; height?: number }) {
  const width = 120;
  const max = Math.max(...series, 1); const min = Math.min(...series); const span = max - min || 1;
  const stepX = width / Math.max(series.length - 1, 1);
  const path = series.map((v, i) => `${i === 0 ? "M" : "L"}${i * stepX},${height - ((v - min) / span) * height * 0.85 - 2}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none"><path d={path} fill="none" stroke={stroke} strokeWidth={1.25} /></svg>;
}

/* ─────────────────────── KPI cell (self-explaining, pulses on chain) ─────────────────────── */

function KpiCell({
  label, value, delta, trend, why, series, accent, pulseKey,
}: {
  label: string; value: string; delta?: string; trend?: "up" | "down" | "neutral";
  why?: string[]; series?: number[]; accent?: "wine" | "emerald" | "amber"; pulseKey?: number;
}) {
  const stroke = accent === "emerald" ? "hsl(160 55% 55%)" : accent === "amber" ? "hsl(38 90% 60%)" : "hsl(350 55% 55%)";
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (pulseKey === undefined) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [pulseKey]);
  return (
    <div className={cn(
      "group relative flex flex-col justify-between border border-white/[0.07] bg-[hsl(18_10%_6%)] p-5 transition-colors hover:bg-[hsl(18_10%_8%)]",
      flash && "border-[hsl(350_55%_45%)]",
    )}>
      <div className="flex items-start justify-between">
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-[hsl(36_15%_58%)]">{label}</p>
        {trend && (
          <span className={cn("text-[0.6rem]",
            trend === "up" && "text-emerald-300/90",
            trend === "down" && "text-red-300/90",
            trend === "neutral" && "text-[hsl(36_15%_55%)]",
          )}>{delta}</span>
        )}
      </div>
      <p className={cn("mt-4 font-serif text-[28px] leading-none tabular-nums transition-colors", flash ? "text-[hsl(36_35%_98%)]" : "text-[hsl(36_28%_94%)]")}>{value}</p>
      {series && <div className="pointer-events-none mt-2 -mx-1 opacity-70"><Sparkline series={series} stroke={stroke} /></div>}
      {why && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[hsl(18_10%_5%)] via-[hsl(18_10%_5%)]/95 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <p className="text-[0.55rem] uppercase tracking-[0.28em] text-[hsl(36_15%_55%)]">Warum</p>
          <ul className="mt-2 space-y-1 text-[11px] leading-snug text-[hsl(36_25%_86%)]">
            {why.map((w) => (
              <li key={w} className="flex gap-2"><span className="mt-1.5 h-px w-2 shrink-0 bg-[hsl(350_55%_50%)]" /><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Backend engines panel — the OS made visible ─────────────────────── */

const ENGINE_META: Record<EngineKey, { label: string; sub: string; icon: React.ComponentType<{ className?: string }> }> = {
  identity:     { label: "Identity Engine",     sub: "Cluster · Cold-Start · Verifikation",   icon: UserPlus },
  dna:          { label: "DNA Engine",          sub: "Genome · Mutations · Ratifikation",     icon: Dna },
  recommender:  { label: "Recommendation Graph", sub: "Rerank · Predicted CTR · Diversity",   icon: Cpu },
  knowledge:    { label: "Knowledge Graph",     sub: "Docs · Entities · Semantic Links",      icon: BookOpen },
  vector:       { label: "Vector Search",       sub: "Embeddings · Sync · Nearest Neighbour", icon: Layers },
  marketplace:  { label: "Marketplace Index",   sub: "Designer · Produkt · Kollektion",       icon: Package },
  prompt:       { label: "Prompt Runtime",      sub: "Versionen · A/B · Deployment",          icon: Bot },
  policy:       { label: "Policy Engine",       sub: "Rules · Guardrails · Audit",            icon: ShieldCheck },
  plugin:       { label: "Plugin Runtime",      sub: "Klaviyo · Stripe · Shopify",            icon: Zap },
  revenue:      { label: "Revenue Forecast",    sub: "Modelle · Prognose · Kohorten",         icon: TrendingUp },
};

function EngineRow({ k, state }: { k: EngineKey; state: EngineState }) {
  const meta = ENGINE_META[k];
  const Icon = meta.icon;
  const active = state.status !== "idle";
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center border transition-colors",
        active ? "border-[hsl(350_55%_45%)] text-[hsl(350_55%_65%)]" : "border-white/10 text-[hsl(36_20%_72%)]",
      )}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[12.5px] text-[hsl(36_28%_92%)]">{meta.label}</p>
          <span className={cn(
            "border px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.22em]",
            active ? "border-[hsl(350_55%_45%)] text-[hsl(350_55%_70%)]" : "border-white/10 text-[hsl(36_15%_55%)]",
          )}>{active ? "computing" : "idle"}</span>
        </div>
        <p className="mt-0.5 truncate text-[10.5px] text-[hsl(36_15%_55%)]">
          {state.lastOp ? <>letzte Op: <span className="text-[hsl(36_20%_72%)]">{state.lastOp}</span></> : meta.sub}
        </p>
        <div className="mt-1.5 h-0.5 w-full bg-white/[0.05]">
          <div className="h-full bg-[hsl(350_55%_55%)] transition-[width] duration-500" style={{ width: `${state.progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Command Deck (OS body) ─────────────────────── */

function CommandDeck() {
  const { orders, revenueSeries, months, kpis } = useStore(adminSelectors.getPlatformOverview);
  const { feed, engines, pulse, fire } = useOsBus();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setTick((v) => v + 1), 15_000); return () => window.clearInterval(t); }, []);
  void tick;

  // Real pending-review count from the DB (submitted + in_review)
  const [pendingApplications, setPendingApplications] = useState<number | null>(null);
  const [activeDesignerCount, setActiveDesignerCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: pending }, { count: active }] = await Promise.all([
        supabase
          .from("designer_applications")
          .select("*", { count: "exact", head: true })
          .in("status", ["submitted", "in_review"]),
        supabase
          .from("designers")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      setPendingApplications(pending ?? 0);
      setActiveDesignerCount(active ?? 0);
    })();
    return () => { cancelled = true; };
  }, []);

  // Numbers that visibly react to the causal chain (owner-only "operating state")
  const [derivedKpi, setDerivedKpi] = useState({ designers: 0, forecast: 0, dnaCoverage: 0 });
  useEffect(() => {
    setDerivedKpi((prev) => {
      const last = feed[0];
      if (!last) return prev;
      if (last.action === "designer.approve") return { ...prev, designers: prev.designers + 1, forecast: prev.forecast + 4200 };
      if (last.action === "dna.recompute") return { ...prev, dnaCoverage: Math.min(100, prev.dnaCoverage + 2) };
      return prev;
    });
  }, [feed]);

  const attention = useMemo(() => {
    const pending = pendingApplications ?? 0;
    return [
      pending > 0
        ? { id: "designers", label: `${pending} Designer warten auf Freigabe`, sub: "Bewerbungen · Kuratoren-Inbox", weight: "high" as const, action: "designer.approve" as OsAction, actionLabel: "Inbox öffnen", route: "/admin/designers" }
        : { id: "designers", label: "Keine offenen Bewerbungen", sub: "Inbox sauber", weight: "medium" as const, action: "designer.approve" as OsAction, actionLabel: "Inbox öffnen", route: "/admin/designers" },
      { id: "stripe", label: "4 Zahlungen fehlgeschlagen · €3.240 offen", sub: "Stripe · Chargeback-Risiko", weight: "critical" as const, action: "plugin.enable" as OsAction, actionLabel: "Stripe öffnen" },
      { id: "logistics", label: "23 Bestellungen warten auf Versand", sub: "SLA-Grenze in 6 h", weight: "medium" as const, action: "broadcast.send" as OsAction, actionLabel: "Auto-Versand" },
      { id: "prompt", label: "Prompt v18 · CTR −3.1 %", sub: "A/B unter Baseline", weight: "medium" as const, action: "prompt.rollback" as OsAction, actionLabel: "Rollback v17" },
    ];
  }, [pendingApplications]);


  const insights = [
    { title: "Umsatz-Anomalie", body: "Umsatz 24 % über Prognose · Rick Owens Launch treibt Shadow-Cluster",
      severity: "high" as const, actions: [
        { label: "Prognose anpassen", chain: "insight.act" as OsAction },
        { label: "Ranking boosten", chain: "recommender.rebuild" as OsAction },
      ]},
    { title: "Cluster verschiebt sich", body: "Editorial → Shadow · +8 % in 14 Tagen · 312 Kunden migriert",
      severity: "medium" as const, actions: [
        { label: "DNA rekalkulieren", chain: "dna.recompute" as OsAction },
        { label: "Kollektion vorschlagen", chain: "insight.act" as OsAction },
      ]},
    { title: "Produktchance", body: "3 Produkte +37 % Predicted CTR · Bestand niedrig",
      severity: "medium" as const, actions: [
        { label: "Bestand ordern", chain: "insight.act" as OsAction },
        { label: "Boost aktivieren", chain: "recommender.rebuild" as OsAction },
      ]},
    { title: "Knowledge-Lücke", body: "12 Anfragen ohne passenden Kontext · Nachhaltigkeits-Dossier fehlt",
      severity: "low" as const, actions: [
        { label: "Reindex starten", chain: "knowledge.reindex" as OsAction },
      ]},
  ];

  const weightDot = (w: "critical" | "high" | "medium") =>
    w === "critical" ? "bg-red-500" : w === "high" ? "bg-amber-400" : "bg-[hsl(36_15%_50%)]";

  return (
    <div className="-mx-6 -my-6 min-h-[calc(100vh-4rem)] bg-[hsl(18_10%_4%)] p-6 text-[hsl(36_25%_90%)] md:-mx-10 md:-my-10 md:p-10">
      {/* Header strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-[0.6rem] uppercase tracking-[0.32em] text-[hsl(36_15%_55%)]">
            Operating System · Identity · Intelligence · Marketplace
          </p>
          <h2 className="mt-2 font-serif text-3xl leading-tight text-[hsl(36_28%_94%)]">
            Guten Abend, Alexander.
            <span className="ml-3 text-[hsl(36_15%_55%)]">
              PAWN läuft · {Object.values(engines).filter((e) => e.status !== "idle").length} Engines aktiv · {feed.length} Ereignisse in dieser Session
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[hsl(36_20%_78%)]">
            <CircleDot className="h-3 w-3 text-emerald-400" /> Alle Systeme online
          </span>
          <button onClick={() => fire("broadcast.send")} className="border border-[hsl(350_55%_35%)] bg-[hsl(350_55%_22%)] px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.22em] text-[hsl(36_28%_94%)] hover:bg-[hsl(350_55%_28%)]">
            <Send className="mr-1.5 inline h-3 w-3" /> Broadcast
          </button>
        </div>
      </div>

      {/* KPI row — reacts to chain */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCell
          label="Umsatz (Monat)"
          value={`€${((kpis.revenue || 482910) + derivedKpi.forecast).toLocaleString("de-DE")}`}
          delta={derivedKpi.forecast ? `+€${derivedKpi.forecast.toLocaleString("de-DE")} live` : "+12.4 %"}
          trend="up" series={revenueSeries} pulseKey={pulse}
          why={["Rick Owens Launch: +€38k", "Recommender v18 aktiv", "Newsletter #18 CVR +9 %"]}
        />
        <KpiCell label="Bestellungen" value={String(kpis.ordersCount || 1284)} delta="+186" trend="up"
          series={[10, 14, 12, 20, 22, 24, 30, 34, 33, 40, 44, 48]} accent="emerald" pulseKey={pulse}
          why={["23 warten auf Versand", "4 Zahlungen fehlgeschlagen"]} />
        <KpiCell label="Ø Bestellwert" value="€376" delta="−2.1 %" trend="down"
          series={[42, 40, 41, 39, 40, 38, 37, 38, 37, 36, 37, 37]} accent="amber" pulseKey={pulse}
          why={["Rabatt-Kampagne aktiv", "Kleinere Warenkörbe im Sale"]} />
        <KpiCell label="Neue Kunden" value="312" delta="+18 %" trend="up"
          series={[8, 9, 12, 11, 14, 16, 18, 22, 25, 27, 30, 34]} accent="emerald" pulseKey={pulse}
          why={["Referral +42 %", "Editorial Vogue DE"]} />
        <KpiCell label="DNA Coverage" value={`${Math.min(100, 94 + derivedKpi.dnaCoverage)} %`} delta={derivedKpi.dnaCoverage ? `+${derivedKpi.dnaCoverage} pt live` : "+3.2 pt"}
          trend="up" series={[70, 74, 78, 82, 85, 87, 89, 91, 92, 93, 94, 94]} pulseKey={pulse}
          why={["284 Identitäten neu vermessen", "Cold-Start auf 6 %"]} />
        <KpiCell label="Aktive Designer" value={String((kpis.designerCount || 142) + derivedKpi.designers)} delta={derivedKpi.designers ? `+${derivedKpi.designers} live` : "+7 diesen Monat"}
          trend="up" series={[120, 122, 125, 128, 131, 133, 135, 137, 138, 140, 141, 142]} accent="emerald" pulseKey={pulse}
          why={["18 warten auf Review", "3 Onboarding heute"]} />
      </div>

      {/* Row: Backend engines + Live feed + Decision queue */}
      <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_1fr_1fr]">
        <Panel title="Systemzustand" eyebrow="10 Engines" live>
          <div className="divide-y divide-white/[0.05]">
            {(Object.keys(ENGINE_META) as EngineKey[]).map((k) => (
              <EngineRow key={k} k={k} state={engines[k]} />
            ))}
          </div>
        </Panel>

        <Panel title="Kausalstrom" eyebrow="jede Aktion propagiert" live
          action={<Btn onClick={() => fire("recommender.rebuild")}>Rebuild</Btn>}>
          {feed.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
              <Radio className="h-4 w-4 text-[hsl(36_15%_45%)]" />
              <p className="max-w-[240px] text-[11.5px] leading-relaxed text-[hsl(36_15%_55%)]">
                Ruhezustand. Eine Aktion (Freigabe, Deploy, Rebuild) erzeugt eine sichtbare Kette durch das System.
              </p>
              <Btn variant="solid" onClick={() => fire("designer.approve", { label: "LEMAIRE Studio freigegeben", actor: "Governance" })}>
                Beispiel-Kette starten
              </Btn>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto">
              {feed.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-5 py-3 text-[12px] animate-in fade-in slide-in-from-top-1 duration-500">
                  <span className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border font-serif text-[10px]",
                    e.tone === "positive" && "border-emerald-500/30 text-emerald-300",
                    e.tone === "critical" && "border-red-500/30 text-red-300",
                    e.tone === "warn" && "border-amber-500/30 text-amber-200",
                    e.tone === "neutral" && "border-white/15 text-[hsl(36_20%_78%)]",
                  )}>↳</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[hsl(36_25%_86%)]">
                      <span className="font-medium text-[hsl(36_28%_94%)]">{e.actor}</span>{" "}
                      <span className="text-[hsl(36_18%_66%)]">{e.label}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[hsl(36_15%_45%)]">
                      {timeAgo(e.at)} · {e.action}{e.effect && <> · <span className="text-[hsl(36_25%_72%)]">{e.effect}</span></>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Entscheidungs-Queue" action={
          <span className="border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em] text-red-200">{attention.length}</span>
        }>
          <ul className="divide-y divide-white/[0.06]">
            {attention.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-4">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", weightDot(item.weight))} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-[hsl(36_28%_92%)]">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-[hsl(36_15%_55%)]">{item.sub}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Btn variant={item.weight === "critical" ? "danger" : "solid"}
                      onClick={() => { fire(item.action, { label: `${item.label} → ausgelöst`, actor: "Owner" }); toast(item.actionLabel); }}>
                      {item.actionLabel}
                    </Btn>
                    <Btn>Zur Queue</Btn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Row: Revenue with causal annotations + AI Insights (with propagating actions) */}
      <div className="mt-4 grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <Panel title="Umsatzentwicklung" eyebrow="12 Monate · mit Ursachen"
          action={<div className="flex gap-1.5"><Btn>12M</Btn><Btn>90T</Btn><Btn>30T</Btn></div>}>
          <div className="relative px-4 pb-4 pt-2">
            <ChartPlaceholder series={revenueSeries} labels={months} tone="dark" variant="area" height={240} />
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              {[
                { m: "Sep", cause: "Recommender v17 deployed", tone: "emerald" },
                { m: "Okt", cause: "Rick Owens Launch", tone: "wine" },
                { m: "Nov", cause: "Newsletter #18 · +9 % CVR", tone: "emerald" },
              ].map((c) => (
                <div key={c.m} className="flex items-start gap-2 border-l border-white/10 pl-2 text-[hsl(36_20%_74%)]">
                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", c.tone === "emerald" ? "bg-emerald-400" : "bg-[hsl(350_55%_55%)]")} />
                  <span><span className="text-[hsl(36_15%_55%)]">{c.m} · </span>{c.cause}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="AI Observations" eyebrow="Beobachtung → Grund → Handlung"
          action={<span className="inline-flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-[hsl(36_20%_74%)]"><Bot className="h-3 w-3" /> 12 Agents</span>}>
          <ul className="divide-y divide-white/[0.06]">
            {insights.map((i) => (
              <li key={i.title} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-[hsl(36_28%_92%)]">{i.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[hsl(36_18%_66%)]">{i.body}</p>
                  </div>
                  <span className={cn("shrink-0 border px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.22em]",
                    i.severity === "high" && "border-red-500/40 text-red-200",
                    i.severity === "medium" && "border-amber-500/40 text-amber-200",
                    i.severity === "low" && "border-white/15 text-[hsl(36_20%_74%)]",
                  )}>{i.severity === "high" ? "Hoch" : i.severity === "medium" ? "Mittel" : "Niedrig"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.actions.map((a) => (
                    <Btn key={a.label} onClick={() => { fire(a.chain, { label: `${i.title} → ${a.label}`, actor: "AI Observer" }); }}>
                      {a.label} <ArrowUpRight className="ml-1 inline h-2.5 w-2.5" />
                    </Btn>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Row: Orders + Top Designers + System perf */}
      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_1.1fr]">
        <Panel title="Letzte Bestellungen" action={<Btn>Alle</Btn>}>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[0.55rem] uppercase tracking-[0.24em] text-[hsl(36_15%_50%)]">
                <th className="px-5 py-2.5 font-normal">Bestellung</th>
                <th className="px-5 py-2.5 font-normal">Kunde</th>
                <th className="px-5 py-2.5 font-normal">Status</th>
                <th className="px-5 py-2.5 text-right font-normal">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-2.5 font-mono text-[11px] text-[hsl(36_20%_78%)]">{o.id}</td>
                  <td className="px-5 py-2.5 text-[hsl(36_25%_88%)]">{o.customer}</td>
                  <td className="px-5 py-2.5">
                    <span className="border border-white/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.2em] text-[hsl(36_20%_78%)]">{o.status}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-[hsl(36_28%_92%)]">€{o.total.toLocaleString("de-DE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top Designer" eyebrow="Umsatz · 30T" action={<Btn>Alle</Btn>}>
          <ul>
            {[["Y/PROJECT", 120, "+24%"], ["Rick Owens", 106, "+18%"], ["LEMAIRE", 92, "+16%"], ["1017 ALYX 9SM", 78, "+12%"], ["Our Legacy", 64, "+9%"]].map(([name, k, d], i) => (
              <li key={String(name)} className="flex items-center justify-between border-t border-white/[0.05] px-5 py-2.5 text-[12px] first:border-t-0">
                <div className="flex items-center gap-3">
                  <span className="w-4 text-[10px] tabular-nums text-[hsl(36_15%_50%)]">{i + 1}</span>
                  <span className="flex h-6 w-6 items-center justify-center border border-white/10 font-serif text-[10px] text-[hsl(36_28%_92%)]">{String(name).slice(0, 2)}</span>
                  <span className="text-[hsl(36_25%_88%)]">{name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-[hsl(36_28%_92%)]">€{k}K</span>
                  <span className="text-[11px] text-emerald-300/90">{d}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="System Performance" eyebrow="letzte 24 h">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3">
            {[
              { l: "API Latenz", v: "142ms", s: [130, 128, 135, 140, 138, 142, 141, 143, 142], c: "hsl(160 55% 55%)" },
              { l: "Uptime", v: "99.98%", s: [99.9, 99.95, 99.98, 99.98, 99.98, 99.97, 99.98, 99.98], c: "hsl(160 55% 55%)" },
              { l: "Events (24h)", v: "12.431", s: [400, 520, 480, 610, 700, 680, 730, 780], c: "hsl(220 60% 70%)" },
              { l: "AI Requests", v: "3.247", s: [120, 160, 180, 210, 260, 300, 340, 360], c: "hsl(280 40% 70%)" },
              { l: "Fehlerquote", v: "0.02%", s: [0.03, 0.02, 0.04, 0.02, 0.02, 0.03, 0.02, 0.02], c: "hsl(0 60% 55%)" },
              { l: "Vector Ops", v: "18.9K", s: [12, 14, 15, 17, 16, 18, 19, 19], c: "hsl(350 55% 55%)" },
            ].map((m) => (
              <div key={m.l}>
                <p className="text-[0.55rem] uppercase tracking-[0.24em] text-[hsl(36_15%_50%)]">{m.l}</p>
                <p className="mt-1 font-serif text-[18px] text-[hsl(36_28%_94%)] tabular-nums">{m.v}</p>
                <div className="mt-1 opacity-80"><Sparkline series={m.s} stroke={m.c} height={22} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quick actions — every one fires a real chain */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { l: "Designer freigeben", i: UserPlus, chain: "designer.approve" as OsAction },
          { l: "Prompt deployen", i: Bot, chain: "prompt.deploy" as OsAction },
          { l: "Recommender rebuild", i: Cpu, chain: "recommender.rebuild" as OsAction },
          { l: "Knowledge reindex", i: BookOpen, chain: "knowledge.reindex" as OsAction },
          { l: "DNA rekomputieren", i: Dna, chain: "dna.recompute" as OsAction },
          { l: "Broadcast senden", i: Activity, chain: "broadcast.send" as OsAction },
        ].map((q) => {
          const I = q.i;
          return (
            <button key={q.l} onClick={() => fire(q.chain)}
              className="group flex items-center gap-2 border border-white/10 bg-[hsl(18_10%_6%)] px-3 py-3 text-left text-[11px] uppercase tracking-[0.2em] text-[hsl(36_25%_84%)] transition-colors hover:border-[hsl(350_55%_35%)] hover:bg-[hsl(350_55%_10%)]/40">
              <I className="h-3.5 w-3.5 text-[hsl(350_55%_60%)] transition-transform group-hover:scale-110" />
              {q.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `vor ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m}m`;
  return `vor ${Math.floor(m / 60)}h`;
}

/* ─────────────────────── Page ─────────────────────── */

const AdminOverview = () => {
  // Suppress unused import warning until we surface AlertTriangle/Sparkles inside future insights.
  void AlertTriangle; void Sparkles;
  return (
    <RoleGate role="admin">
      <AdminShell eyebrow="Operating System" title="Command Deck">
        <PrototypeAccessBanner role="Owner OS" />
        <OsBusProvider>
          <CommandDeck />
        </OsBusProvider>
      </AdminShell>
    </RoleGate>
  );
};

export default AdminOverview;
