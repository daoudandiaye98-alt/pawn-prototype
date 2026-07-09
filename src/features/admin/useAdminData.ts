import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrderRow {
  id: string;
  short: string;
  customer: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface AdminTopDesigner {
  id: string;
  name: string;
  revenue: number;
  orders: number;
}

export interface AdminSystemStats {
  eventsLast24h: number;
  aiRequestsLast24h: number;
  ordersLast24h: number;
  paidOrdersLast24h: number;
  designerCount: number;
  loading: boolean;
}

export interface AdminPlatformKpis {
  loading: boolean;
  revenue30d: number;        // EUR (integer)
  revenue30dDelta: number;   // % vs previous 30d (rounded)
  orders30d: number;
  ordersDelta: number;       // absolute diff vs previous 30d
  aov30d: number;            // EUR
  aovDelta: number;          // % vs previous 30d
  newUsers30d: number;
  newUsersDelta: number;     // % vs previous 30d
  activeDesigners: number;
  pendingApplications: number;
  dnaCoverage: number;       // % of active designers with brand_dna.product_count > 0
  dnaCoverageDelta: number;  // pt vs 30d ago snapshot proxy (0 when unknown)
  eventsLast24h: number;
  revenueSeries: number[];   // last 30 daily buckets in EUR
  orderSeries: number[];     // last 30 daily counts
  dayLabels: string[];       // short DE labels for the last 30 days
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "Gast";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, 2);
  return `${shown}${local.length > 2 ? "…" : ""}@${domain}`;
}

/** Loads the last N orders (admins see all via RLS). */
export function useAdminRecentOrders(limit = 6) {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, amount_total, status, customer_email, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setRows(
        (data ?? []).map((o) => ({
          id: o.id as string,
          short: (o.id as string).slice(0, 8),
          customer: maskEmail(o.customer_email as string | null),
          status: o.status as string,
          total: Math.round(((o.amount_total as number) ?? 0) / 100),
          createdAt: o.created_at as string,
        })),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return { rows, loading };
}

/** Aggregates paid-order revenue per designer in the last 30 days. */
export function useAdminTopDesigners(limit = 5) {
  const [rows, setRows] = useState<AdminTopDesigner[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [{ data: orders }, { data: products }, { data: designers }] = await Promise.all([
        supabase
          .from("orders")
          .select("items, status, created_at")
          .eq("status", "paid")
          .gte("created_at", since),
        supabase.from("products").select("id, designer_id"),
        supabase.from("designers").select("id, brand_name"),
      ]);
      if (cancelled) return;
      const productToDesigner = new Map<string, string>();
      for (const p of products ?? []) productToDesigner.set(p.id as string, p.designer_id as string);
      const designerName = new Map<string, string>();
      for (const d of designers ?? []) designerName.set(d.id as string, d.brand_name as string);
      const agg = new Map<string, { revenue: number; orders: number }>();
      for (const o of orders ?? []) {
        const items = (o.items ?? []) as Array<{ product_id?: string; price?: number; qty?: number; quantity?: number }>;
        for (const it of items) {
          const pid = it.product_id;
          if (!pid) continue;
          const did = productToDesigner.get(pid);
          if (!did) continue;
          const qty = (it.qty ?? it.quantity ?? 1);
          const line = (it.price ?? 0) * qty;
          const cur = agg.get(did) ?? { revenue: 0, orders: 0 };
          cur.revenue += line;
          cur.orders += 1;
          agg.set(did, cur);
        }
      }
      const list: AdminTopDesigner[] = Array.from(agg.entries())
        .map(([id, v]) => ({ id, name: designerName.get(id) ?? "—", revenue: v.revenue, orders: v.orders }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
      setRows(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return { rows, loading };
}

/** Real 24h operational counters from domain_events / ai_logs / orders. */
export function useAdminSystemStats(): AdminSystemStats {
  const [stats, setStats] = useState<AdminSystemStats>({
    eventsLast24h: 0, aiRequestsLast24h: 0, ordersLast24h: 0, paidOrdersLast24h: 0, designerCount: 0, loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [ev, ai, ord, paid, dcount] = await Promise.all([
        supabase.from("domain_events").select("*", { count: "exact", head: true }).gte("at", since),
        supabase.from("ai_logs").select("*", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since).eq("status", "paid"),
        supabase.from("designers").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      if (cancelled) return;
      setStats({
        eventsLast24h: ev.count ?? 0,
        aiRequestsLast24h: ai.count ?? 0,
        ordersLast24h: ord.count ?? 0,
        paidOrdersLast24h: paid.count ?? 0,
        designerCount: dcount.count ?? 0,
        loading: false,
      });
    })();
  }, []);
  return stats;
}

/** Writes an admin.action_requested domain event. */
export async function requestAdminAction(action: string, note?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id ?? null;
  await supabase.from("domain_events").insert({
    type: "admin.action_requested",
    actor: uid ?? "system",
    identity_scope: uid,
    payload: { action, note: note ?? null, requested_at: new Date().toISOString() },
  } as never);
}

