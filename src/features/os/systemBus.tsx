/**
 * OS System Bus
 *
 * Lightweight causal bus for the Owner Command Deck. A single user action
 * (approve designer, deploy prompt, rebuild recommender…) fans out a chain
 * of reactions that panels subscribe to. Panels animate ONLY when a real
 * chain fires — no idle breathing, no fake ticks.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type OsAction =
  | "designer.approve"
  | "designer.reject"
  | "prompt.deploy"
  | "prompt.rollback"
  | "recommender.rebuild"
  | "knowledge.reindex"
  | "dna.recompute"
  | "vector.sync"
  | "plugin.enable"
  | "policy.update"
  | "broadcast.send"
  | "insight.act";

export interface CausalStep {
  id: string;
  at: number;
  action: OsAction;
  label: string;
  actor: string;
  tone: "positive" | "neutral" | "warn" | "critical";
  /** downstream engines that this step visibly touches */
  targets: EngineKey[];
  /** optional human-readable metric delta caused by this step */
  effect?: string;
}

export type EngineKey =
  | "identity"
  | "dna"
  | "recommender"
  | "knowledge"
  | "vector"
  | "marketplace"
  | "prompt"
  | "policy"
  | "plugin"
  | "revenue";

export interface EngineState {
  status: "idle" | "computing" | "syncing";
  progress: number; // 0..1
  lastAt: number | null;
  lastOp: string | null;
}

export type EngineMap = Record<EngineKey, EngineState>;

const ENGINES: EngineKey[] = [
  "identity", "dna", "recommender", "knowledge", "vector",
  "marketplace", "prompt", "policy", "plugin", "revenue",
];

function initEngines(): EngineMap {
  return Object.fromEntries(
    ENGINES.map((k) => [k, { status: "idle", progress: 0, lastAt: null, lastOp: null } as EngineState]),
  ) as EngineMap;
}

/**
 * Domain-specific propagation rules. Kept declarative so the OS feels
 * like a system: every action produces the same visible chain every time.
 */
const CHAINS: Record<OsAction, Omit<CausalStep, "id" | "at">[]> = {
  "designer.approve": [
    { action: "designer.approve", label: "als Designer freigegeben", actor: "Governance", tone: "positive", targets: ["marketplace"], effect: "+1 aktiver Designer" },
    { action: "dna.recompute", label: "Customer-DNA rekalibriert für neues Sortiment", actor: "DNA Engine", tone: "neutral", targets: ["dna", "identity"], effect: "284 Identitäten aktualisiert" },
    { action: "recommender.rebuild", label: "Recommendation Graph neu aufgebaut", actor: "Recommender", tone: "neutral", targets: ["recommender", "vector"], effect: "42 Karten neu bewertet" },
    { action: "insight.act", label: "AI Observer: „Neuer Designer erweitert Shadow-Cluster um 6 %"", actor: "AI Observer", tone: "positive", targets: ["revenue"], effect: "Prognose +€4.2K" },
  ],
  "designer.reject": [
    { action: "designer.reject", label: "Application abgelehnt · Feedback gesendet", actor: "Governance", tone: "warn", targets: ["marketplace"] },
    { action: "policy.update", label: "Rejection-Muster aktualisiert", actor: "Policy Engine", tone: "neutral", targets: ["policy"] },
  ],
  "prompt.deploy": [
    { action: "prompt.deploy", label: "Prompt-Version ausgerollt", actor: "AI Control", tone: "positive", targets: ["prompt"], effect: "v18 → v19" },
    { action: "vector.sync", label: "Embeddings synchronisiert", actor: "Vector Search", tone: "neutral", targets: ["vector"], effect: "3.4K Vektoren" },
    { action: "recommender.rebuild", label: "Ranking neu berechnet", actor: "Recommender", tone: "neutral", targets: ["recommender"], effect: "CTR-Modell aktiv" },
  ],
  "prompt.rollback": [
    { action: "prompt.rollback", label: "Rollback auf v17", actor: "AI Control", tone: "warn", targets: ["prompt"] },
    { action: "recommender.rebuild", label: "Ranking zurückgesetzt", actor: "Recommender", tone: "neutral", targets: ["recommender"] },
  ],
  "recommender.rebuild": [
    { action: "recommender.rebuild", label: "Recommendation Graph vollständig neu berechnet", actor: "Recommender", tone: "neutral", targets: ["recommender", "vector"], effect: "42 Karten" },
  ],
  "knowledge.reindex": [
    { action: "knowledge.reindex", label: "Knowledge Graph indexiert", actor: "Knowledge Engine", tone: "neutral", targets: ["knowledge", "vector"], effect: "1.2K Dokumente" },
  ],
  "dna.recompute": [
    { action: "dna.recompute", label: "DNA Engine läuft", actor: "DNA Engine", tone: "neutral", targets: ["dna", "identity"], effect: "284 Identitäten" },
    { action: "recommender.rebuild", label: "Downstream: Ranking neu berechnet", actor: "Recommender", tone: "neutral", targets: ["recommender"] },
  ],
  "vector.sync": [
    { action: "vector.sync", label: "Vektor-Index synchronisiert", actor: "Vector Search", tone: "neutral", targets: ["vector"], effect: "3.4K Vektoren" },
  ],
  "plugin.enable": [
    { action: "plugin.enable", label: "Plugin aktiviert", actor: "Plugin Runtime", tone: "positive", targets: ["plugin"] },
  ],
  "policy.update": [
    { action: "policy.update", label: "Policy-Version publiziert", actor: "Policy Engine", tone: "neutral", targets: ["policy"] },
  ],
  "broadcast.send": [
    { action: "broadcast.send", label: "Broadcast an 8.412 Empfänger gestartet", actor: "Marketing", tone: "positive", targets: ["marketplace", "revenue"], effect: "Erwarteter CVR +2.1 %" },
  ],
  "insight.act": [
    { action: "insight.act", label: "Insight-Aktion ausgeführt", actor: "AI Observer", tone: "positive", targets: ["revenue"] },
  ],
};

interface OsBusValue {
  feed: CausalStep[];
  engines: EngineMap;
  pulse: number;
  fire: (action: OsAction, opts?: { label?: string; actor?: string }) => void;
}

const Ctx = createContext<OsBusValue | null>(null);

export function OsBusProvider({ children }: { children: ReactNode }) {
  const [feed, setFeed] = useState<CausalStep[]>([]);
  const [engines, setEngines] = useState<EngineMap>(initEngines);
  const [pulse, setPulse] = useState(0);
  const seq = useRef(0);
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
  }, []);

  const runEngine = useCallback((keys: EngineKey[], op: string, durationMs: number) => {
    const startedAt = Date.now();
    setEngines((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = { status: "computing", progress: 0.05, lastAt: startedAt, lastOp: op };
      });
      return next;
    });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = window.setTimeout(() => {
        setEngines((prev) => {
          const next = { ...prev };
          keys.forEach((k) => {
            const done = i === steps;
            next[k] = {
              status: done ? "idle" : "computing",
              progress: done ? 0 : i / steps,
              lastAt: Date.now(),
              lastOp: op,
            };
          });
          return next;
        });
        timers.current.delete(t);
      }, (durationMs / steps) * i);
      timers.current.add(t);
    }
  }, []);

  const fire = useCallback<OsBusValue["fire"]>((action, opts) => {
    const chain = CHAINS[action] ?? [];
    setPulse((v) => v + 1);
    chain.forEach((step, i) => {
      const t = window.setTimeout(() => {
        seq.current += 1;
        const entry: CausalStep = {
          ...step,
          id: `s-${Date.now()}-${seq.current}`,
          at: Date.now(),
          label: i === 0 && opts?.label ? opts.label : step.label,
          actor: i === 0 && opts?.actor ? opts.actor : step.actor,
        };
        setFeed((prev) => [entry, ...prev].slice(0, 40));
        // engine work durations scale with number of targets
        const duration = 1200 + step.targets.length * 500;
        runEngine(step.targets, step.action, duration);
        setPulse((v) => v + 1);
        timers.current.delete(t);
      }, i * 900);
      timers.current.add(t);
    });
  }, [runEngine]);

  const value = useMemo<OsBusValue>(() => ({ feed, engines, pulse, fire }), [feed, engines, pulse, fire]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOsBus(): OsBusValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOsBus must be used inside OsBusProvider");
  return v;
}
