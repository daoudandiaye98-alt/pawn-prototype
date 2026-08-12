/**
 * PART 51 Teil C — Anfragen zu Auftragsarbeit/Live-Porträt (und individuelle Anfragen generell)
 * landen immer im Studio-Postfach (message_threads/messages, bereits per DB-Trigger benachrichtigt).
 * Diese Funktion schickt zusätzlich eine kurze E-Mail — best effort: schlägt der Versand fehl
 * (z. B. weil die post.pawn.vision-Subdomain bei Resend noch nicht verifiziert ist), wird das
 * still übersprungen. Die In-App-Benachrichtigung ist der verlässliche Kanal, diese E-Mail nur
 * ein Zusatz.
 *
 * Body: { thread_id: string }
 * Response: { ok: true } immer, unabhängig vom E-Mail-Erfolg.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as { thread_id?: string };
    if (!body.thread_id) return json({ ok: true });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: true });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: thread } = await admin.from("message_threads")
      .select("id, subject, designer_id, created_by").eq("id", body.thread_id).maybeSingle();
    if (!thread) return json({ ok: true });
    const t = thread as { id: string; subject: string; designer_id: string; created_by: string };
    if (t.created_by !== user_id) return json({ ok: true });

    const { data: designer } = await admin.from("designers").select("user_id, brand_name, slug").eq("id", t.designer_id).maybeSingle();
    const d = designer as { user_id: string; brand_name: string; slug: string } | null;
    if (!d) return json({ ok: true });

    let designerEmail = "";
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(d.user_id);
      designerEmail = userRes?.user?.email ?? "";
    } catch { /* best effort */ }
    if (!designerEmail) return json({ ok: true });

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: `PAWN <no-reply@post.pawn.vision>`,
          to: [designerEmail],
          subject: `Neue Anfrage: ${t.subject}`,
          text: `Jemand hat sich für eine deiner Arbeiten interessiert.\n\nAntworten kannst du direkt im Studio: https://pawn.vision/studio/nachrichten?t=${t.id}`,
        }),
      });
    } catch { /* still überspringen — die In-App-Benachrichtigung ist bereits geschrieben */ }

    return json({ ok: true });
  } catch {
    return json({ ok: true });
  }
});
