import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Teil 30 — Datenlage für die Bühne im Cockpit. Alles hier ist regelbasiert und
 * kostenlos (keine KI-Aufrufe) — nur Aggregate aus bereits vorhandenen Tabellen.
 */

export interface NachtZeile { muster: string; funktion?: string; n: number; at: string }
export interface HouseRow {
  id: string;
  name: string;
  welt: string;
  rangLabel: string;
  rangGlyph: string;
  kernzustand: string;
  stripeStatus: string;
}

export interface CockpitBuhneData {
  loading: boolean;
  newLeads24h: number;
  verdichtung: NachtZeile[];
  houses: HouseRow[];
  sendeStapelCount: number;
  dailyCap: number;
  zahlen: { leads: number; qualifiziert: number; kontaktiert: number; bestellungen: number };
}

const EMPTY: CockpitBuhneData = {
  loading: true, newLeads24h: 0, verdichtung: [], houses: [], sendeStapelCount: 0, dailyCap: 20,
  zahlen: { leads: 0, qualifiziert: 0, kontaktiert: 0, bestellungen: 0 },
};

function isManualChannel(channel: string | null): boolean {
  return channel === "dm" || channel === "instagram";
}

export function useCockpitBuhne(refreshKey: number | string = 0): CockpitBuhneData {
  const [data, setData] = useState<CockpitBuhneData>(EMPTY);

  useEffect(() => {
    let alive = true;
    (async () => {
      const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [
        newLeadsRes, verdichtungRes, designersRes, productsRes, ordersRes, leadsRes, cfgRes,
      ] = await Promise.all([
        supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("pawn_signals").select("kind, pattern, created_at").eq("kind", "verdichtung").order("created_at", { ascending: false }).limit(3),
        supabase.from("designers").select("id, brand_name, house_number, published, status, brand_dna, stripe_charges_enabled")
          .or("status.eq.active,published.eq.true").order("house_number", { ascending: true }).limit(20),
        supabase.from("products").select("id, designer_id"),
        supabase.from("orders").select("items, status, created_at").eq("status", "paid").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
        supabase.from("acquisition_leads").select("id, status, channel, opt_out, admin_decision, followup_at, next_touch_at"),
        supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      ]);
      if (!alive) return;

      const verdichtung = ((verdichtungRes.data ?? []) as unknown as { pattern: { muster?: string; funktion?: string; n?: number }; created_at: string }[])
        .map((r) => ({ muster: r.pattern?.muster ?? "unbekannt", funktion: r.pattern?.funktion, n: r.pattern?.n ?? 0, at: r.created_at }));

      const productToDesigner = new Map<string, string>();
      for (const p of (productsRes.data ?? []) as { id: string; designer_id: string }[]) productToDesigner.set(p.id, p.designer_id);
      const soldByDesigner = new Set<string>();
      for (const o of (ordersRes.data ?? []) as { items: unknown }[]) {
        const items = Array.isArray(o.items) ? (o.items as { product_id?: string }[]) : [];
        for (const it of items) {
          const did = it.product_id ? productToDesigner.get(it.product_id) : undefined;
          if (did) soldByDesigner.add(did);
        }
      }

      const designerRows = (designersRes.data ?? []) as {
        id: string; brand_name: string; house_number: number | null; published: boolean; status: string;
        brand_dna: { worlds?: Record<string, number> } | null; stripe_charges_enabled: boolean;
      }[];

      const levels = await Promise.all(designerRows.map(async (d) => {
        try {
          const r = await supabase.rpc("designer_level" as never, { _designer_id: d.id } as never);
          return r.data as unknown as { label?: string; glyph?: string } | null;
        } catch {
          return null;
        }
      }));

      const houses: HouseRow[] = designerRows.map((d, i) => {
        const worlds = d.brand_dna?.worlds ?? {};
        const topWorld = Object.entries(worlds).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        const kernzustand = d.status !== "active" ? "Pausiert"
          : !d.published ? "Baut auf"
          : soldByDesigner.has(d.id) ? "Verkauft aktiv"
          : "Wartet auf ersten Kauf";
        return {
          id: d.id,
          name: d.house_number != null ? `${d.brand_name} · №${d.house_number}` : d.brand_name,
          welt: topWorld,
          rangLabel: levels[i]?.label ?? "Bauer",
          rangGlyph: levels[i]?.glyph ?? "♟",
          kernzustand,
          stripeStatus: d.stripe_charges_enabled ? "Verbunden" : "Nicht verbunden",
        };
      });

      const leadRows = (leadsRes.data ?? []) as {
        id: string; status: string; channel: string | null; opt_out: boolean;
        admin_decision: string | null; followup_at: string | null; next_touch_at: string | null;
      }[];
      const now = Date.now();
      const sendeStapelCount = leadRows.filter((r) => {
        if (!isManualChannel(r.channel) || r.opt_out) return false;
        if (r.status === "qualifiziert" && r.admin_decision === "ja") return true;
        if (r.status === "kontaktiert" && !r.followup_at && r.next_touch_at && new Date(r.next_touch_at).getTime() <= now) return true;
        return false;
      }).length;
      const dailyCap = ((cfgRes.data?.value ?? {}) as { dm_daily_cap?: number }).dm_daily_cap ?? 20;

      setData({
        loading: false,
        newLeads24h: newLeadsRes.count ?? 0,
        verdichtung,
        houses,
        sendeStapelCount,
        dailyCap,
        zahlen: {
          leads: leadRows.length,
          qualifiziert: leadRows.filter((r) => r.status === "qualifiziert").length,
          kontaktiert: leadRows.filter((r) => r.status === "kontaktiert").length,
          bestellungen: (ordersRes.data ?? []).length,
        },
      });
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  return data;
}
