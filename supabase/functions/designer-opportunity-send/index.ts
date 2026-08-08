/**
 * Teil 34b — Offene Türen: Versand. Senden ist immer ein Mensch — dieser Endpunkt wird nur
 * durch einen expliziten Klick auf "Absenden" im Studio aufgerufen, niemals automatisch von
 * pawn-jarvis. Erstkontakt braucht Status "interessiert"; danach höchstens EIN Nachfassen
 * nach mindestens 7 Tagen, nie wieder (max_touches-Prinzip) — beides wird hier hart geprüft,
 * nicht nur im UI.
 *
 * Absender: "Haus {Name} via PAWN <haus-{slug}@post.pawn.vision>" — die Subdomain
 * post.pawn.vision muss einmalig bei Resend verifiziert werden (DNS-Einträge siehe PR-Text).
 * Reply-To ist die echte Login-Mail des Hauses, damit Antworten direkt dort ankommen.
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

const MIN_FOLLOWUP_DAYS = 7;
const FOOTER = (impressumUrl: string) =>
  `\n\n—\nVermittelt über PAWN (pawn.vision). Impressum: ${impressumUrl}\nFalls du dazu nichts weiter hören möchtest, sag einfach kurz Bescheid — wir schreiben dann nicht mehr.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as {
      opportunity_id?: string; message?: string; is_followup?: boolean;
    };
    const opportunityId = body.opportunity_id;
    const message = (body.message ?? "").trim();
    if (!opportunityId || !message) return json({ ok: false, error: "opportunity_id und message sind Pflicht." });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, error: "Kein RESEND_API_KEY hinterlegt — Versand noch nicht eingerichtet." });

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });

    const { data: designer } = await admin.from("designers")
      .select("id, brand_name, slug").eq("user_id", user_id).maybeSingle();
    if (!designer) return json({ ok: false, error: "Kein Studio-Zugang gefunden." });
    const d = designer as { id: string; brand_name: string; slug: string };

    const { data: door } = await admin.from("designer_opportunities" as never)
      .select("id, designer_id, title, status, contact_email, sent_at, followup_sent_at")
      .eq("id", opportunityId).maybeSingle();
    const doorRow = door as unknown as {
      id: string; designer_id: string; title: string; status: string; contact_email: string | null;
      sent_at: string | null; followup_sent_at: string | null;
    } | null;
    if (!doorRow || doorRow.designer_id !== d.id) return json({ ok: false, error: "Diese Tür gehört nicht zu deinem Haus." });
    if (!doorRow.contact_email) return json({ ok: false, error: "Für diese Tür wurde keine Kontakt-Adresse gefunden — Text kopieren und selbst versenden." });

    const isFollowup = body.is_followup === true;
    if (isFollowup) {
      if (!doorRow.sent_at) return json({ ok: false, error: "Diese Tür wurde noch nicht angeschrieben." });
      if (doorRow.followup_sent_at) return json({ ok: false, error: "Es wurde bereits einmal nachgefasst — mehr ist nicht vorgesehen." });
      const daysSince = (Date.now() - new Date(doorRow.sent_at).getTime()) / 86_400_000;
      if (daysSince < MIN_FOLLOWUP_DAYS) return json({ ok: false, error: `Nachfassen erst ab ${MIN_FOLLOWUP_DAYS} Tagen nach dem Erstkontakt.` });
    } else {
      if (doorRow.status !== "interessiert" && doorRow.status !== "kontaktiert") {
        return json({ ok: false, error: "Erst 'Interessiert mich' auswählen, bevor du sendest." });
      }
      if (doorRow.sent_at) return json({ ok: false, error: "Diese Tür wurde bereits angeschrieben — nutze das Nachfassen." });
    }

    let replyTo = "";
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(user_id);
      replyTo = userRes?.user?.email ?? "";
    } catch { /* best effort */ }
    if (!replyTo) return json({ ok: false, error: "Konnte deine Login-Mail nicht ermitteln." });

    const fromAddress = `Haus ${d.brand_name} via PAWN <haus-${d.slug}@post.pawn.vision>`;
    const finalText = `${message}${FOOTER("https://pawn.vision/impressum")}`;
    const subject = isFollowup ? `Nachfrage: ${doorRow.title}` : doorRow.title;

    let resendMessageId: string | null = null;
    let deliveryStatus: "versendet" | "fehler" = "versendet";
    let deliveryError: string | null = null;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: fromAddress, to: [doorRow.contact_email], reply_to: replyTo, subject, text: finalText }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        deliveryStatus = "fehler";
        deliveryError = `Resend ${res.status}: ${t.slice(0, 300)}`;
      } else {
        const resJson = await res.json().catch(() => ({}));
        resendMessageId = (resJson as { id?: string }).id ?? null;
      }
    } catch (e) {
      deliveryStatus = "fehler";
      deliveryError = (e as Error).message;
    }

    const patch: Record<string, unknown> = { delivery_status: deliveryStatus, delivery_error: deliveryError, resend_message_id: resendMessageId };
    if (deliveryStatus === "versendet") {
      if (isFollowup) patch.followup_sent_at = new Date().toISOString();
      else { patch.sent_at = new Date().toISOString(); patch.status = "kontaktiert"; }
    }
    await admin.from("designer_opportunities" as never).update(patch as never).eq("id", opportunityId);

    if (deliveryStatus === "versendet") {
      await schreibePartieZug(
        admin, d.id,
        isFollowup ? `Bei einer Tür nachgefasst: ${doorRow.title}.` : `Anschreiben zu einer Tür verschickt: ${doorRow.title}.`,
        "haus", "tueren_finden",
      );
    }

    return json({ ok: deliveryStatus === "versendet", delivery_status: deliveryStatus, error: deliveryError ?? undefined });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 200);
  }
});
