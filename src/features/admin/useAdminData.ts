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

/** ---------- Platform KPIs: real 30d numbers + daily buckets for the chart ---------- */

const DAY_MS = 24 * 3600 * 1000;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function useAdminPlatformKpis(): AdminPlatformKpis {
  const [state, setState] = useState<AdminPlatformKpis>({
    loading: true,
    revenue30d: 0, revenue30dDelta: 0,
    orders30d: 0, ordersDelta: 0,
    aov30d: 0, aovDelta: 0,
    newUsers30d: 0, newUsersDelta: 0,
    activeDesigners: 0, pendingApplications: 0,
    dnaCoverage: 0, dnaCoverageDelta: 0,
    eventsLast24h: 0,
    revenueSeries: new Array(30).fill(0),
    orderSeries: new Array(30).fill(0),
    dayLabels: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const today = startOfDay(now);
      const since30 = new Date(today.getTime() - 29 * DAY_MS).toISOString(); // includes today (30 buckets)
      const sincePrev = new Date(today.getTime() - 59 * DAY_MS).toISOString();
      const since24h = new Date(now.getTime() - DAY_MS).toISOString();

      const [
        curOrders, prevOrders,
        curProfiles, prevProfiles,
        activeDes, pending,
        designersDna,
        events24h,
      ] = await Promise.all([
        supabase.from("orders").select("amount_total, created_at, status").gte("created_at", since30),
        supabase.from("orders").select("amount_total, status, created_at").gte("created_at", sincePrev).lt("created_at", since30),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since30),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sincePrev).lt("created_at", since30),
        supabase.from("designers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("designer_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review"]),
        supabase.from("designers").select("brand_dna").eq("status", "active"),
        supabase.from("domain_events").select("id", { count: "exact", head: true }).gte("at", since24h),
      ]);
      if (cancelled) return;

      // Daily buckets: revenue (EUR) + order count for last 30 days (paid orders only for revenue).
      const revenueSeries = new Array(30).fill(0) as number[];
      const orderSeries = new Array(30).fill(0) as number[];
      let curRevenue = 0;
      let curOrdersPaid = 0;
      for (const o of (curOrders.data ?? [])) {
        const created = new Date(o.created_at as string);
        const idx = Math.floor((startOfDay(created).getTime() - startOfDay(new Date(since30)).getTime()) / DAY_MS);
        if (idx < 0 || idx >= 30) continue;
        orderSeries[idx] += 1;
        if (o.status === "paid") {
          const eur = Math.round(((o.amount_total as number) ?? 0) / 100);
          revenueSeries[idx] += eur;
          curRevenue += eur;
          curOrdersPaid += 1;
        }
      }

      let prevRevenue = 0;
      let prevOrdersPaid = 0;
      for (const o of (prevOrders.data ?? [])) {
        if (o.status !== "paid") continue;
        prevRevenue += Math.round(((o.amount_total as number) ?? 0) / 100);
        prevOrdersPaid += 1;
      }

      const dayLabels: string[] = [];
      const fmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
      for (let i = 0; i < 30; i++) {
        dayLabels.push(fmt.format(new Date(today.getTime() - (29 - i) * DAY_MS)));
      }

      const curAov = curOrdersPaid > 0 ? Math.round(curRevenue / curOrdersPaid) : 0;
      const prevAov = prevOrdersPaid > 0 ? Math.round(prevRevenue / prevOrdersPaid) : 0;

      const designerRows = (designersDna.data ?? []) as Array<{ brand_dna: { product_count?: number } | null }>;
      const withDna = designerRows.filter((d) => (d.brand_dna?.product_count ?? 0) > 0).length;
      const active = activeDes.count ?? 0;
      const dnaCoverage = active > 0 ? Math.round((withDna / active) * 100) : 0;

      setState({
        loading: false,
        revenue30d: curRevenue,
        revenue30dDelta: pctDelta(curRevenue, prevRevenue),
        orders30d: curOrdersPaid,
        ordersDelta: curOrdersPaid - prevOrdersPaid,
        aov30d: curAov,
        aovDelta: pctDelta(curAov, prevAov),
        newUsers30d: curProfiles.count ?? 0,
        newUsersDelta: pctDelta(curProfiles.count ?? 0, prevProfiles.count ?? 0),
        activeDesigners: active,
        pendingApplications: pending.count ?? 0,
        dnaCoverage,
        dnaCoverageDelta: 0,
        eventsLast24h: events24h.count ?? 0,
        revenueSeries,
        orderSeries,
        dayLabels,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}

