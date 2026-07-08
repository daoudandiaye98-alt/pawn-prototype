// deno-lint-ignore-file
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { name, email, subject, body, user_id } = await req.json();
    if (!name || !email || !body) {
      return new Response(JSON.stringify({ ok: false, error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await admin.from("contact_messages").insert({
      name, email, subject: subject ?? "Allgemein", body, user_id: user_id ?? null,
    }).select("id").single();
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
