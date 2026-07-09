// Delete account — removes user-owned rows across public schema and deletes auth user.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const jwt = auth.slice(7);
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      userId = typeof payload?.sub === "string" ? payload.sub : null;
    } catch { /* ignore */ }
    if (!userId) return json({ error: "invalid_token" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Cascade cleanup (best-effort; CASCADE FKs handle most)
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("ai_sessions").delete().eq("user_id", userId);
    await admin.from("user_memory").delete().eq("user_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("designer_consents").delete().eq("user_id", userId);
    await admin.from("designer_applications").delete().eq("user_id", userId);
    // Anonymize domain events instead of deleting (auditable)
    await admin.from("domain_events").update({ actor: "deleted-user" }).eq("actor", userId);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
