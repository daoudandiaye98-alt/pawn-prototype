// Teil 37/AP3 — "Beweis": Sichtbarkeit in Zahlen. page_visits und wishlists sind
// besucher-scoped per RLS (jede:r Nutzer:in sieht nur eigene Zeilen) — ein Haus kann
// also nicht direkt sehen, wie oft andere seine Seite/Produkte aufgerufen oder gemerkt
// haben. Diese Funktion aggregiert beides serverseitig mit dem Service-Key, streng
// begrenzt auf die Produkte/Seite des rufenden Hauses (nie über eine vom Client
// mitgeschickte ID). Bestellungen/Umsatz, Türen und Medien bleiben client-seitig
// abrufbar (eigene RLS-Policies erlauben das bereits) und werden hier nicht dupliziert.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return ok({ error: "forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as { days?: number };
    const days = body.days === 30 ? 30 : 7;
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    const { data: designer } = await admin.from("designers").select("id").eq("user_id", user_id).maybeSingle();
    if (!designer) return ok({ error: "kein_haus" }, 404);
    const designerId = designer.id as string;

    const { data: prods } = await admin.from("products").select("id").eq("designer_id", designerId);
    const productIds = (prods ?? []).map((p) => p.id as string);

    // page_visits: eine Zeile je Besucher:in seit dem ersten Aufruf, visit_count läuft
    // seitdem hoch. "Aufrufe im Zeitraum" heißt hier: Zeilen mit Aktivität seit cutoff —
    // ehrliche Näherung, keine Event-Zeitreihe, die diese Tabelle nicht führt.
    let besucheGesamt = 0, besucheZeitraum = 0;
    const targets = [{ type: "designer", ids: [designerId] }, { type: "product", ids: productIds }];
    for (const t of targets) {
      if (!t.ids.length) continue;
      const [{ count: gesamt }, { count: zeitraum }] = await Promise.all([
        admin.from("page_visits").select("id", { count: "exact", head: true }).eq("target_type", t.type).in("target_id", t.ids),
        admin.from("page_visits").select("id", { count: "exact", head: true }).eq("target_type", t.type).in("target_id", t.ids).gte("last_seen_at", cutoff),
      ]);
      besucheGesamt += gesamt ?? 0;
      besucheZeitraum += zeitraum ?? 0;
    }

    let wunschlistenGesamt = 0, wunschlistenZeitraum = 0;
    if (productIds.length) {
      const [{ count: gesamt }, { count: zeitraum }] = await Promise.all([
        admin.from("wishlists").select("id", { count: "exact", head: true }).in("product_id", productIds),
        admin.from("wishlists").select("id", { count: "exact", head: true }).in("product_id", productIds).gte("created_at", cutoff),
      ]);
      wunschlistenGesamt = gesamt ?? 0;
      wunschlistenZeitraum = zeitraum ?? 0;
    }

    return ok({
      ok: true,
      days,
      besuche: { gesamt: besucheGesamt, zeitraum: besucheZeitraum },
      wunschlisten: { gesamt: wunschlistenGesamt, zeitraum: wunschlistenZeitraum },
    });
  } catch (e) {
    return ok({ error: "unbekannter_fehler", message: (e as Error).message }, 200);
  }
});
