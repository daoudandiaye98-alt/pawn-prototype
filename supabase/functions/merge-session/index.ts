// merge-session: attaches anonymous taste signals + chat session to a logged-in user.
// Called by the client immediately after successful login/signup.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supa = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimErr } = await supa.auth.getClaims(auth.slice(7));
    if (claimErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json().catch(() => ({}))) as { session_id?: string };
    const sessionId = typeof body.session_id === "string" ? body.session_id : null;
    if (!sessionId) {
      return new Response(JSON.stringify({ merged: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("merge_anon_session", {
      _session_id: sessionId, _user_id: userId,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ merged: data ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
