/**
 * Kleine Belohnungen — schwarz-weiß, kurz, ohne Konfetti.
 * Ein Schritt gilt als gefeiert, sobald er einmal gezeigt wurde; gemerkt wird das
 * geräteübergreifend in user_memory.preferences.rewards, lokal als schneller Puffer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Reward {
  key: string;
  title: string;
  line: string;
}

const LOCAL_PREFIX = "pawn.rewards.";

function localKey(uid: string, ns: string) { return `${LOCAL_PREFIX}${ns}.${uid}`; }

function readLocal(uid: string, ns: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(localKey(uid, ns)) ?? "[]") as string[]; } catch { return []; }
}

function writeLocal(uid: string, ns: string, keys: string[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(localKey(uid, ns), JSON.stringify(keys)); } catch { /* egal */ }
}

async function persist(userId: string, ns: string, keys: string[]) {
  const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", userId).maybeSingle();
  const prefs = ((data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {}) as Record<string, unknown>;
  const rewards = (prefs.rewards ?? {}) as Record<string, string[]>;
  rewards[ns] = Array.from(new Set([...(rewards[ns] ?? []), ...keys]));
  await supabase.from("user_memory" as never).upsert({ user_id: userId, preferences: { ...prefs, rewards } } as never, { onConflict: "user_id" } as never);
}

/**
 * Vergleicht die aktuell erledigten Schlüssel mit den bereits gefeierten und
 * gibt den nächsten ungefeierten als Belohnung zurück.
 */
export function useStepRewards(namespace: string, done: { key: string; title: string; line: string }[]) {
  const { user } = useAuth();
  const [seen, setSeen] = useState<string[] | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
      if (!alive) return;
      const prefs = ((data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {}) as Record<string, unknown>;
      const remote = ((prefs.rewards ?? {}) as Record<string, string[]>)[namespace] ?? [];
      setSeen(Array.from(new Set([...remote, ...readLocal(user.id, namespace)])));
    })();
    return () => { alive = false; };
  }, [user?.id, namespace]);

  useEffect(() => {
    if (!user || seen === null || done.length === 0) return;
    const fresh = done.filter((d) => !seen.includes(d.key));
    if (fresh.length === 0) return;

    // Erster Besuch: stillen Grundstand setzen, keine Nachfeier für alles Alte.
    if (!seeded.current && seen.length === 0) {
      seeded.current = true;
      const keys = done.map((d) => d.key);
      setSeen(keys);
      writeLocal(user.id, namespace, keys);
      void persist(user.id, namespace, keys);
      return;
    }
    seeded.current = true;

    const next = fresh[0];
    setReward({ key: next.key, title: next.title, line: next.line });
    const keys = [...seen, next.key];
    setSeen(keys);
    writeLocal(user.id, namespace, keys);
    void persist(user.id, namespace, next.key ? [next.key] : []);
  }, [user?.id, namespace, seen, done.map((d) => d.key).join("|")]);

  const dismiss = useCallback(() => setReward(null), []);
  return { reward, dismiss };
}

/** Kurze Einblendung unten mittig. Verschwindet nach vier Sekunden. */
export function RewardToast({ reward, onDone }: { reward: Reward | null; onDone: () => void }) {
  useEffect(() => {
    if (!reward) return;
    const t = window.setTimeout(onDone, 4000);
    return () => window.clearTimeout(t);
  }, [reward, onDone]);

  if (!reward) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[90] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 animate-fade-in"
    >
      <div className="border-[1.5px] border-foreground bg-foreground px-5 py-4 text-background shadow-[6px_6px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-start gap-3">
          <span className="font-serif text-xl leading-none">♟</span>
          <div>
            <p className="font-serif text-base italic leading-snug">{reward.title}</p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-background/70">{reward.line}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
