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

/** Loads the last N orders (admins see all via RLS). Refetches whenever refreshKey changes. */
export function useAdminRecentOrders(limit = 6, refreshKey: number | string = 0) {
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
  }, [limit, refreshKey]);
  return { rows, loading };
}

/** Aggregates paid-order revenue per designer in the last 30 days. Refetches whenever refreshKey changes. */
export function useAdminTopDesigners(limit = 5, refreshKey: number | string = 0) {
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
  }, [limit, refreshKey]);
  return { rows, loading };
}

/** Real 24h operational counters from domain_events / ai_logs / orders. Refetches whenever refreshKey changes. */
export function useAdminSystemStats(refreshKey: number | string = 0): AdminSystemStats {
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
    return () => { cancelled = true; };
  }, [refreshKey]);
  return stats;
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

export function useAdminPlatformKpis(refreshKey: number | string = 0): AdminPlatformKpis {
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
  }, [refreshKey]);

  return state;
}

/* ---------- Akquise-Puls: Pipeline + Tagesaufgaben aus acquisition_leads ---------- */

export interface AcquisitionPulse {
  loading: boolean;
  stageCounts: Record<"neu" | "angewaermt" | "kontaktiert" | "antwort" | "registriert" | "aktiviert", number>;
  worldCounts: Record<"Mode" | "Kunst" | "Interior", number>;
  toWarmUp: number;
  toContact: number;
  followupDue: number;
}

const ACQUISITION_STAGES = ["neu", "angewaermt", "kontaktiert", "antwort", "registriert", "aktiviert"] as const;

function daysSinceIso(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function useAcquisitionPulse(refreshKey: number | string = 0): AcquisitionPulse {
  const [state, setState] = useState<AcquisitionPulse>({
    loading: true,
    stageCounts: { neu: 0, angewaermt: 0, kontaktiert: 0, antwort: 0, registriert: 0, aktiviert: 0 },
    worldCounts: { Mode: 0, Kunst: 0, Interior: 0 },
    toWarmUp: 0, toContact: 0, followupDue: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("acquisition_leads")
        .select("status, world, warmed_at, contacted_at, followup_at")
        .limit(5000);
      if (cancelled) return;
      const rows = data ?? [];
      const stageCounts = { neu: 0, angewaermt: 0, kontaktiert: 0, antwort: 0, registriert: 0, aktiviert: 0 };
      const worldCounts = { Mode: 0, Kunst: 0, Interior: 0 };
      let toWarmUp = 0, toContact = 0, followupDue = 0;
      for (const r of rows) {
        const status = r.status as string;
        if (status in stageCounts) stageCounts[status as keyof typeof stageCounts] += 1;
        if (r.world === "Mode" || r.world === "Kunst" || r.world === "Interior") worldCounts[r.world] += 1;
        if (status === "neu") toWarmUp += 1;
        if (status === "angewaermt" && (daysSinceIso(r.warmed_at) ?? 0) >= 2) toContact += 1;
        if (status === "kontaktiert" && !r.followup_at && (daysSinceIso(r.contacted_at) ?? 0) >= 5) followupDue += 1;
      }
      setState({ loading: false, stageCounts, worldCounts, toWarmUp, toContact, followupDue });
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return state;
}

/* ---------- Ereignis-Ticker: letzte domain_events, real ---------- */

export interface DomainEventRow {
  id: string;
  type: string;
  at: string;
}

export function useDomainEventsTicker(limit = 15, refreshKey: number | string = 0) {
  const [rows, setRows] = useState<DomainEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("domain_events")
        .select("id, type, at")
        .order("at", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setRows((data ?? []) as DomainEventRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [limit, refreshKey]);
  return { rows, loading };
}

/* ---------- System-Herzschlag: Secrets + Trend-Frische ---------- */

export interface SystemHeartbeat {
  loading: boolean;
  payments: boolean;
  ai: boolean;
  imageGen: boolean;
  social: boolean;
  trendsFresh: boolean;
  trendAgeDays: number | null;
  secretsAvailable: boolean;
}

export function useSystemHeartbeat(refreshKey: number | string = 0): SystemHeartbeat {
  const [state, setState] = useState<SystemHeartbeat>({
    loading: true, payments: false, ai: false, imageGen: false, social: false,
    trendsFresh: false, trendAgeDays: null, secretsAvailable: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [secretsRes, trendRes] = await Promise.all([
        supabase.functions.invoke("check-secrets", { body: {} }).catch(() => ({ data: null, error: true })),
        supabase.from("trend_snapshots").select("day").order("day", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      const present = (secretsRes as { data?: { present?: Record<string, boolean> } } | null)?.data?.present;
      const lastDay = (trendRes.data as { day?: string }[] | null)?.[0]?.day ?? null;
      const trendAgeDays = lastDay ? Math.floor((Date.now() - new Date(lastDay).getTime()) / 86_400_000) : null;
      setState({
        loading: false,
        secretsAvailable: !!present,
        payments: !!present?.STRIPE_SECRET_KEY,
        ai: !!(present?.OPENAI_API_KEY || present?.ANTHROPIC_API_KEY),
        imageGen: !!present?.FAL_KEY,
        social: !!(present?.META_ACCESS_TOKEN || present?.TIKTOK_CLIENT_KEY),
        trendsFresh: trendAgeDays !== null && trendAgeDays <= 1,
        trendAgeDays,
      });
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return state;
}

