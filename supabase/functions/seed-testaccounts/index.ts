// deno-lint-ignore-file
// Idempotent: creates test customer + test designer (with published products).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CUSTOMER = { email: "test-kunde@pawn.test", password: "Pawn!Test1", name: "Testine Kundin" };
const DESIGNER = { email: "test-designer@pawn.test", password: "Pawn!Test1", name: "Tobi Testhaus", brand: "Testhaus" };
const PLACEHOLDER = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=60";
const PLACEHOLDER_2 = "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=1200&q=60";

async function ensureUser(admin: ReturnType<typeof createClient>, email: string, password: string, name: string) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const existing = list?.users?.find((u: { email?: string }) => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { display_name: name } });
    return existing.id;
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: name },
  });
  if (error || !created.user) throw error ?? new Error("create failed");
  return created.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // --- customer ---
    const custId = await ensureUser(admin, CUSTOMER.email, CUSTOMER.password, CUSTOMER.name);
    await admin.from("profiles").upsert({ user_id: custId, display_name: CUSTOMER.name }, { onConflict: "user_id" });
    await admin.from("user_roles").upsert({ user_id: custId, role: "customer" }, { onConflict: "user_id,role" });

    // --- designer user ---
    const desUserId = await ensureUser(admin, DESIGNER.email, DESIGNER.password, DESIGNER.name);
    await admin.from("profiles").upsert({ user_id: desUserId, display_name: DESIGNER.name }, { onConflict: "user_id" });
    await admin.from("user_roles").upsert({ user_id: desUserId, role: "designer" }, { onConflict: "user_id,role" });

    // approved application
    const { data: appExisting } = await admin.from("designer_applications").select("id").eq("user_id", desUserId).maybeSingle();
    let appId = appExisting?.id as string | undefined;
    if (!appId) {
      const { data: appIns, error: appErr } = await admin.from("designer_applications").insert({
        user_id: desUserId,
        brand_name: DESIGNER.brand,
        legal_name: DESIGNER.name,
        location: "Berlin",
        country: "DE",
        story: "Testhaus — automatisch erstelltes Test-Atelier zur QA.",
        status: "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      }).select("id").single();
      if (appErr) throw appErr;
      appId = appIns.id;
    } else {
      await admin.from("designer_applications").update({ status: "approved" }).eq("id", appId);
    }

    // designer row
    const { data: dExisting } = await admin.from("designers").select("id, house_number").eq("user_id", desUserId).maybeSingle();
    let designerId: string;
    let houseNo = dExisting?.house_number as number | null | undefined;
    if (dExisting) {
      designerId = dExisting.id;
    } else {
      // pick next house_number
      const { data: last } = await admin.from("designers").select("house_number").order("house_number", { ascending: false }).limit(1).maybeSingle();
      houseNo = ((last?.house_number as number | null) ?? 0) + 1;
      const { data: dIns, error: dErr } = await admin.from("designers").insert({
        user_id: desUserId,
        slug: "testhaus",
        brand_name: DESIGNER.brand,
        location: "Berlin",
        country: "DE",
        story: "Handwerk, Textur, Ruhe.",
        tags: ["skulptural", "minimal"],
        published: true,
        application_id: appId,
        status: "active",
        revenue_share_pct: 70,
        is_featured: false,
        house_number: houseNo,
      }).select("id").single();
      if (dErr) throw dErr;
      designerId = dIns.id;
    }

    // products
    const products = [
      { name: "Mantel · Studie 01", slug: "testhaus-mantel-01", world: "mode", price: 890, tags: ["skulptural", "wolle"], status: "published", image_url: PLACEHOLDER },
      { name: "Spiegelobjekt · Studie", slug: "testhaus-spiegel", world: "interior", price: 1450, tags: ["skulptural", "objekt"], status: "published", image_url: PLACEHOLDER_2 },
      { name: "Prototyp (Entwurf)", slug: "testhaus-prototyp", world: "mode", price: 0, tags: ["prototyp"], status: "draft", image_url: null as string | null },
    ];
    for (const p of products) {
      const { data: exists } = await admin.from("products").select("id").eq("slug", p.slug).maybeSingle();
      if (exists) {
        await admin.from("products").update({ ...p, designer_id: designerId }).eq("id", exists.id);
      } else {
        await admin.from("products").insert({ ...p, designer_id: designerId });
      }
    }

    // --- applicant placeholder (test-applicant@pawn.test unused here; created on demand by real form) ---

    return new Response(JSON.stringify({
      ok: true,
      customer: { email: CUSTOMER.email, id: custId },
      designer: { email: DESIGNER.email, id: desUserId, designer_id: designerId, house_number: houseNo },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
