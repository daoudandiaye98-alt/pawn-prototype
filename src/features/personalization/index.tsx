/**
 * PAWN Personalization
 * ---------------------
 * Reads taste signals (ai.taste_signal domain events) for the current user,
 * aggregates them into a lightweight "DNA" profile, applies CSS variables
 * to <html> so the palace adapts (grid gaps, reveal duration, image contrast),
 * and exposes helpers to sort products by preferred world/tags.
 *
 * Rein clientseitig, mit sanftem Fallback wenn keine Signale existieren.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Mood = "ruhig" | "spannung" | "neutral";
export type World = "Mode" | "Interior" | "Kunst";

export interface Signal {
  id: string;
  at: string;
  kind: string;               // "world" | "mood" | "tag" | "designer" | "message"
  value: string;
  weight: number;
  raw?: unknown;
}

export interface PersonalizationProfile {
  hasSignals: boolean;
  world: World | null;
  worldDistribution: Record<string, number>;
  mood: Mood;
  preferredTags: string[];
  preferredDesigners: string[];
  signals: Signal[];
  correctedIds: Set<string>;
}

const EMPTY: PersonalizationProfile = {
  hasSignals: false,
  world: null,
  worldDistribution: {},
  mood: "neutral",
  preferredTags: [],
  preferredDesigners: [],
  signals: [],
  correctedIds: new Set(),
};

interface Ctx extends PersonalizationProfile {
  refresh: () => Promise<void>;
  correct: (signalId: string) => Promise<void>;
  loading: boolean;
}

const PersonalizationContext = createContext<Ctx | null>(null);

const CORRECTED_KEY = "pawn.corrected.signals";
const CACHE_KEY = "pawn.personalization.cache.v1";

function loadCorrected(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(CORRECTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function persistCorrected(set: Set<string>) {
  try { localStorage.setItem(CORRECTED_KEY, JSON.stringify(Array.from(set))); } catch { /* noop */ }
}

function parseSignal(row: { id: string; at: string; payload: unknown }): Signal | null {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const message = typeof p.message === "string" ? p.message.toLowerCase() : "";
  const verdict = typeof p.verdict === "string" ? p.verdict : "";
  const world =
    typeof p.world === "string" ? p.world :
    /interior|einrichtung|möbel|lampe|sofa|tisch/.test(message) ? "Interior" :
    /kunst|art|skulptur|malerei/.test(message) ? "Kunst" :
    /mode|kleid|jacke|mantel|hemd|hose/.test(message) ? "Mode" : "";
  const mood =
    typeof p.mood === "string" ? p.mood :
    /ruhig|leise|zurückhaltend|minimal/.test(message) ? "ruhig" :
    /spannung|dramatisch|laut|kontrast/.test(message) ? "spannung" : "";
  const tag = typeof p.tag === "string" ? p.tag : "";
  // Swipe signals from /style get twice the weight for likes, discount skips.
  const w = verdict === "like" ? 2 : verdict === "skip" ? 0 : 1;
  if (verdict === "skip") return null;
  if (world) return { id: row.id, at: row.at, kind: "world", value: world, weight: w || 1, raw: p };
  if (mood) return { id: row.id, at: row.at, kind: "mood", value: mood, weight: w || 1, raw: p };
  if (tag) return { id: row.id, at: row.at, kind: "tag", value: tag, weight: w || 1, raw: p };
  if (message) return { id: row.id, at: row.at, kind: "message", value: message.slice(0, 80), weight: 0.4, raw: p };
  return null;
}

function aggregate(signals: Signal[]): PersonalizationProfile {
  if (signals.length === 0) return EMPTY;
  const worldCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  const designerCount: Record<string, number> = {};
  const moodCount: Record<string, number> = {};
  for (const s of signals) {
    if (s.kind === "world") worldCount[s.value] = (worldCount[s.value] ?? 0) + s.weight;
    if (s.kind === "tag") tagCount[s.value] = (tagCount[s.value] ?? 0) + s.weight;
    if (s.kind === "designer") designerCount[s.value] = (designerCount[s.value] ?? 0) + s.weight;
    if (s.kind === "mood") moodCount[s.value] = (moodCount[s.value] ?? 0) + s.weight;
  }
  const topWorld = Object.entries(worldCount).sort((a, b) => b[1] - a[1])[0]?.[0] as World | undefined;
  const topMood = (Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]?.[0] as Mood | undefined) ?? "neutral";
  return {
    hasSignals: true,
    world: topWorld ?? null,
    worldDistribution: worldCount,
    mood: topMood,
    preferredTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k),
    preferredDesigners: Object.entries(designerCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k),
    signals: signals.slice(0, 40),
    correctedIds: new Set(),
  };
}

function applyCssVars(profile: PersonalizationProfile) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (profile.mood === "ruhig") {
    root.style.setProperty("--palace-gap", "2rem");
    root.style.setProperty("--palace-gap-md", "3rem");
    root.style.setProperty("--palace-reveal-dur", reduced ? "0.01s" : "1.4s");
    root.style.setProperty("--palace-image-contrast", "1.02");
  } else if (profile.mood === "spannung") {
    root.style.setProperty("--palace-gap", "1rem");
    root.style.setProperty("--palace-gap-md", "1.25rem");
    root.style.setProperty("--palace-reveal-dur", reduced ? "0.01s" : "0.7s");
    root.style.setProperty("--palace-image-contrast", "1.12");
  } else {
    root.style.setProperty("--palace-gap", "1.5rem");
    root.style.setProperty("--palace-gap-md", "2rem");
    root.style.setProperty("--palace-reveal-dur", reduced ? "0.01s" : "1s");
    root.style.setProperty("--palace-image-contrast", "1.06");
  }
}

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PersonalizationProfile>(() => {
    if (typeof window === "undefined") return EMPTY;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as PersonalizationProfile;
        return { ...cached, correctedIds: loadCorrected() };
      }
    } catch { /* noop */ }
    return { ...EMPTY, correctedIds: loadCorrected() };
  });
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setProfile({ ...EMPTY, correctedIds: loadCorrected() }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("domain_events")
        .select("id, at, payload")
        .eq("type", "ai.taste_signal")
        .contains("payload", { user_id: user.id })
        .order("at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const corrected = loadCorrected();
      const signals = (data ?? [])
        .map((r) => parseSignal(r as { id: string; at: string; payload: unknown }))
        .filter((s): s is Signal => s !== null)
        .filter((s) => !corrected.has(s.id));
      const agg = aggregate(signals);
      const next = { ...agg, correctedIds: corrected };
      setProfile(next);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...agg, correctedIds: [] })); } catch { /* noop */ }
    } catch (err) {
      console.warn("[personalization] refresh failed", err);
    } finally { setLoading(false); }
  };

  const correct = async (signalId: string) => {
    const next = new Set(profile.correctedIds);
    next.add(signalId);
    persistCorrected(next);
    setProfile((p) => ({ ...p, signals: p.signals.filter((s) => s.id !== signalId), correctedIds: next }));
    try {
      await supabase.from("domain_events").insert({
        type: "ai.signal_corrected",
        actor: user?.id ?? "system",
        payload: { signal_id: signalId, user_id: user?.id },
      } as never);
    } catch { /* best-effort */ }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);
  useEffect(() => { applyCssVars(profile); }, [profile]);

  const value = useMemo<Ctx>(() => ({ ...profile, refresh, correct, loading }), [profile, loading]);
  return <PersonalizationContext.Provider value={value}>{children}</PersonalizationContext.Provider>;
}

export function usePersonalization(): Ctx {
  const ctx = useContext(PersonalizationContext);
  if (!ctx) {
    // Provider not mounted (e.g. admin/portal). Return a stable no-op.
    return { ...EMPTY, refresh: async () => {}, correct: async () => {}, loading: false };
  }
  return ctx;
}

/** Sort products so preferred world/tags come first — stable, non-destructive. */
export function sortByPersonalization<T extends { world?: string; category?: string; tags?: string[] }>(
  items: T[],
  profile: Pick<PersonalizationProfile, "world" | "preferredTags" | "hasSignals">,
): T[] {
  if (!profile.hasSignals) return items;
  const score = (p: T) => {
    let s = 0;
    if (profile.world && p.world === profile.world) s += 10;
    if (profile.preferredTags.length && p.category && profile.preferredTags.includes(p.category)) s += 3;
    if (profile.preferredTags.length && p.tags?.some((t) => profile.preferredTags.includes(t))) s += 2;
    return s;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}
