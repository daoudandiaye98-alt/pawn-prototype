import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FulfillmentStatus = "new" | "in_progress" | "packed" | "shipped" | "delivered";

export interface DesignerOrderLine {
  order_id: string;
  order_created_at: string;
  order_status: string;
  fulfillment_status: FulfillmentStatus;
  tracking_number: string | null;
  carrier: string | null;
  customer_email: string | null;
  customer_country: string | null;
  customer_first_name: string | null;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  invoice_number: string | null;
  last_email_error: string | null;
  /** Wie viel bereits erstattet wurde (in Cent) — 0 bedeutet: nichts erstattet. */
  refunded_amount_cents: number;
  /** Zahlungsstreit bei Stripe, falls vorhanden. */
  dispute_status: string | null;
  product_id: string;
  product_name: string;
  product_slug: string;
  qty: number;
  unit_price: number; // EUR
  size: string | null;
  variant: Record<string, string> | null;
  /** Versandgewicht je Stück in Gramm — Grundlage fürs Versandetikett. */
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
}

interface RawOrder {
  id: string;
  created_at: string;
  status: string;
  fulfillment_status: FulfillmentStatus | null;
  tracking_number: string | null;
  carrier: string | null;
  customer_email: string | null;
  amount_total: number;
  items: unknown;
  user_id: string | null;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  invoice_number: string | null;
  last_email_error: string | null;
  refunded_amount_cents: number | null;
  dispute_status: string | null;
}
interface RawProduct {
  id: string; slug: string; name: string; designer_id: string; price: number;
  weight_grams: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null;
}


/**
 * Loads all orders that contain products of the given designer.
 * Since orders.items is stored as JSON with slugs, we filter server-side by
 * fetching designer products first, then requesting orders and filtering client-side.
 */
export function useDesignerOrders(designerId: string | undefined) {
  const [lines, setLines] = useState<DesignerOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!designerId) { setLines([]); setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: prods } = await supabase.from("products")
        .select("id, slug, name, designer_id, price, weight_grams, length_cm, width_cm, height_cm")
        .eq("designer_id", designerId);
      const myProds = ((prods ?? []) as RawProduct[]);
      const slugSet = new Set(myProds.map((p) => p.slug));
      if (slugSet.size === 0) { if (alive) { setLines([]); setLoading(false); } return; }

      const { data: ords } = await supabase.from("orders")
        .select(`id, created_at, status, fulfillment_status, tracking_number, carrier, customer_email, amount_total, items, user_id,
          shipping_name, shipping_address_line1, shipping_address_line2, shipping_postal_code, shipping_city, shipping_country,
          invoice_number, last_email_error, refunded_amount_cents, dispute_status`)
        .order("created_at", { ascending: false })
        .limit(500);
      const rows = ((ords ?? []) as RawOrder[]);

      // Collect profile display names (Vorname) for user_ids
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles")
          .select("id, display_name").in("id", userIds);
        for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
          if (p.display_name) profileMap.set(p.id, p.display_name.split(" ")[0]);
        }
      }

      const out: DesignerOrderLine[] = [];
      for (const o of rows) {
        const items = Array.isArray(o.items) ? o.items as Array<Record<string, unknown>> : [];
        for (const it of items) {
          const slug = String(it.slug ?? "");
          if (!slug || !slugSet.has(slug)) continue;
          const prod = myProds.find((p) => p.slug === slug);
          if (!prod) continue;
          const qty = Number(it.qty ?? 1);
          const unit = it.unit_amount != null ? Number(it.unit_amount) / 100 : Number(it.price ?? prod.price);
          const firstName = (o.user_id ? profileMap.get(o.user_id) : undefined) ?? (o.customer_email?.split("@")[0] ?? null);
          out.push({
            order_id: o.id,
            order_created_at: o.created_at,
            order_status: o.status,
            fulfillment_status: (o.fulfillment_status ?? "new") as FulfillmentStatus,
            tracking_number: o.tracking_number ?? null,
            carrier: o.carrier ?? null,
            customer_email: o.customer_email,
            customer_country: (it.country as string | undefined) ?? o.shipping_country ?? null,
            customer_first_name: firstName,
            shipping_name: o.shipping_name ?? null,
            shipping_address_line1: o.shipping_address_line1 ?? null,
            shipping_address_line2: o.shipping_address_line2 ?? null,
            shipping_postal_code: o.shipping_postal_code ?? null,
            shipping_city: o.shipping_city ?? null,
            shipping_country: o.shipping_country ?? null,
            invoice_number: o.invoice_number ?? null,
            last_email_error: o.last_email_error ?? null,
            product_id: prod.id,
            product_name: prod.name,
            product_slug: prod.slug,
            qty,
            unit_price: unit,
            size: (it.size as string | undefined) ?? null,
            variant: (it.variant as Record<string, string> | undefined) ?? null,
            weight_grams: prod.weight_grams ?? null,
            length_cm: prod.length_cm ?? null,
            width_cm: prod.width_cm ?? null,
            height_cm: prod.height_cm ?? null,
          });
        }
      }
      if (alive) { setLines(out); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [designerId, refreshKey]);

  return { lines, loading, refresh: () => setRefreshKey((k) => k + 1) };
}
