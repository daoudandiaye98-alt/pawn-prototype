// One-shot admin seeding. Idempotent: safe to call multiple times.
// Creates a confirmed auth user + assigns admin role. Disable by unsetting SEED_ADMIN_ENABLED after use.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL = "dodondiaye99@gmail.com";
const PASSWORD = "123456";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Find existing user by email
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === EMAIL);
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: EMAIL, password: PASSWORD, email_confirm: true,
        user_metadata: { display_name: "PAWN Admin" },
      });
      if (error || !created.user) throw error ?? new Error("create failed");
      userId = created.user.id;
    }

    // Assign admin role (idempotent)
    await admin.from("user_roles").upsert({ user_id: userId!, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ ok: true, user_id: userId, email: EMAIL }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
