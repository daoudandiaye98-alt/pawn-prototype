/**
 * Site content CMS — key/value store, cached in memory.
 * Public read, admin write. Frontend falls back to defaults if a key is missing.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteContentMap {
  ausgabe_nummer: number;
}

export const DEFAULTS: SiteContentMap = {
  ausgabe_nummer: 12,
};

type Cache = { data: Partial<SiteContentMap>; ts: number };
let CACHE: Cache | null = null;
const TTL = 60_000;
const listeners = new Set<() => void>();

async function loadAll(): Promise<Partial<SiteContentMap>> {
  if (CACHE && Date.now() - CACHE.ts < TTL) return CACHE.data;
  const { data } = await supabase.from("site_content").select("key, value");
  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    map[row.key] = row.value;
  }
  CACHE = { data: map as Partial<SiteContentMap>, ts: Date.now() };
  return CACHE.data;
}

export function invalidateSiteContent() {
  CACHE = null;
  listeners.forEach((fn) => fn());
}

/**
 * Read a single site_content key with a compile-time default fallback.
 * Never throws — falls back silently when the DB is unreachable.
 */
export function useSiteContent<K extends keyof SiteContentMap>(key: K): SiteContentMap[K] {
  const [value, setValue] = useState<SiteContentMap[K]>(DEFAULTS[key]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const all = await loadAll();
        const v = all[key];
        if (!cancelled && v !== undefined && v !== null) setValue(v as SiteContentMap[K]);
      } catch { /* keep default */ }
    };
    void load();
    const onInvalidate = () => { void load(); };
    listeners.add(onInvalidate);
    return () => { cancelled = true; listeners.delete(onInvalidate); };
  }, [key]);
  return value;
}

export function useAllSiteContent(): SiteContentMap {
  const [all, setAll] = useState<SiteContentMap>(DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const raw = await loadAll();
      if (cancelled) return;
      setAll({ ...DEFAULTS, ...raw });
    };
    void load();
    const onInvalidate = () => { void load(); };
    listeners.add(onInvalidate);
    return () => { cancelled = true; listeners.delete(onInvalidate); };
  }, []);
  return all;
}
