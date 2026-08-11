import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { verkaufsChecks, type BillingProfileLike, type VerkaufsCheck } from "@/features/commerce/verkaufsbereit";

interface Result {
  loading: boolean;
  checks: VerkaufsCheck[];
  bereit: boolean;
  offen: VerkaufsCheck[];
}

/** Ein Ort, an dem das Studio erfährt, ob das Haus verkaufen kann. */
export function useVerkaufsbereitschaft(): Result {
  const { designer } = useMyDesigner();
  const [billing, setBilling] = useState<BillingProfileLike | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!designer?.id) return;
    let active = true;
    setLoading(true);
    void supabase
      .from("designer_billing_profiles")
      .select("legal_name, address_line1, postal_code, city, country, tax_id, kleinunternehmer")
      .eq("designer_id", designer.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setBilling((data as BillingProfileLike) ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [designer?.id]);

  const checks = verkaufsChecks({
    chargesEnabled: Boolean(designer?.stripe_charges_enabled),
    billing,
    shippingRates: (designer?.shipping_rates ?? null) as Record<string, unknown> | null,
  });
  const offen = checks.filter((c) => !c.done);

  return { loading: loading || !designer, checks, bereit: offen.length === 0, offen };
}
