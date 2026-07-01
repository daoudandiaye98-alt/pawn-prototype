import { supabase } from "@/integrations/supabase/client";
import type { DomainEvent } from "../types/events";
import type { PersistenceAdapter } from "./PersistenceAdapter";

/**
 * Supabase-backed persistence adapter for the domain event log.
 *
 * Loads all events belonging to `identity_scope = userId` (RLS enforced) and
 * appends new durable events for that identity. The adapter is created *after*
 * a user has authenticated — the userId is captured at construction time.
 *
 * Non-durable events (views, dwell, ephemeral signals) should still be filtered
 * by the caller via the `includes` predicate before reaching this adapter.
 */
export function createSupabaseAdapter(
  userId: string,
  includes: (e: DomainEvent) => boolean,
): PersistenceAdapter {
  let cache: DomainEvent[] | null = null;

  const load = async (): Promise<DomainEvent[]> => {
    if (cache) return cache;
    const { data, error } = await supabase
      .from("domain_events")
      .select("id, at, actor, type, cause, payload")
      .eq("identity_scope", userId)
      .order("at", { ascending: true });
    if (error) {
      console.warn("[supabase adapter] load failed", error.message);
      cache = [];
      return cache;
    }
    cache = (data ?? []).map((row) => ({
      id: row.id,
      at: row.at,
      actor: row.actor,
      type: row.type,
      cause: row.cause ?? undefined,
      payload: row.payload,
    })) as DomainEvent[];
    return cache;
  };

  const append = async (batch: DomainEvent[]) => {
    const persistable = batch.filter(includes);
    if (persistable.length === 0) return;
    const rows = persistable.map((e) => ({
      id: e.id as string,
      at: e.at,
      actor: e.actor as string,
      type: e.type as string,
      cause: (e.cause ?? undefined) as string | undefined,
      payload: (e as unknown as { payload: unknown }).payload as never,
      identity_scope: userId,
    }));
    const { error } = await supabase.from("domain_events").insert(rows);
    if (error) {
      console.warn("[supabase adapter] append failed", error.message);
      return;
    }
    if (cache) cache = [...cache, ...persistable];
  };

  const clear = async () => {
    const { error } = await supabase.from("domain_events").delete().eq("identity_scope", userId);
    if (!error) cache = [];
  };

  return { load, append, clear };
}
