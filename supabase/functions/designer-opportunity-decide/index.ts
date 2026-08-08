/**
 * Teil 34a — Offene Türen: eine Entscheidung eines Hauses (Interessiert mich / Verwerfen /
 * Text geändert) über einen von pawn-jarvis gefundenen Türen-Eintrag. Der Status-/Text-Wechsel
 * selbst könnte auch direkt vom Client kommen (RLS erlaubt es), aber das Partie-Buch
 * (partie_zuege) hat bewusst keine Insert-Policy für eingeloggte Nutzer (Teil 28c) — deshalb
 * läuft die ganze Entscheidung hier, mit Service-Role, damit beides in einem Zug passiert.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { schreibePartieZug } from "../_shared/partieZug.ts";

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

const DECISIONS = ["interessiert", "verworfen"] as const;
type Decision = (typeof DECISIONS)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as {
      opportunity_id?: string; decision?: string; message_draft?: string;
    };
    const opportunityId = body.opportunity_id;
    if (!opportunityId) return json({ ok: false, error: "opportunity_id fehlt" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });

    const { data: designer } = await admin.from("designers").select("id").eq("user_id", user_id).maybeSingle();
    if (!designer) return json({ ok: false, error: "Kein Studio-Zugang gefunden." });

    const { data: door } = await admin.from("designer_opportunities" as never)
      .select("id, designer_id, title, status").eq("id", opportunityId).maybeSingle();
    const doorRow = door as unknown as { id: string; designer_id: string; title: string; status: string } | null;
    if (!doorRow || doorRow.designer_id !== (designer as { id: string }).id) {
      return json({ ok: false, error: "Diese Tür gehört nicht zu deinem Haus." });
    }

    const patch: Record<string, unknown> = {};
    let zugText: string | null = null;

    if (body.decision && DECISIONS.includes(body.decision as Decision)) {
      const decision = body.decision as Decision;
      patch.status = decision;
      zugText = decision === "interessiert"
        ? `Interesse an einer Tür bekundet: ${doorRow.title}.`
        : `Eine Tür verworfen: ${doorRow.title}.`;
    }
    if (typeof body.message_draft === "string") {
      patch.message_draft = body.message_draft.slice(0, 2000);
      if (!zugText) zugText = `Anschreiben zu einer Tür angepasst: ${doorRow.title}.`;
    }
    if (Object.keys(patch).length === 0) return json({ ok: false, error: "Nichts zu ändern." });

    const { error } = await admin.from("designer_opportunities" as never).update(patch as never).eq("id", opportunityId);
    if (error) return json({ ok: false, error: error.message });

    if (zugText) await schreibePartieZug(admin, (designer as { id: string }).id, zugText, "haus", "tueren_finden");

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
