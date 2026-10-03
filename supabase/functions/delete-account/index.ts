/**
 * Konto löschen — vollständig, oder gar nicht.
 *
 * E1 (DSGVO): Hier liegen Gesichts- und Körperfotos. Der Eimer `kunden-bilder`
 * und alles, was daran hängt (Anproben, Gedächtnis, Archetyp, Stil), muss mit
 * dem Konto verschwinden. Jeder Schritt, der fehlschlägt, beendet den Lauf mit
 * einem Fehler — ein halb gelöschtes Konto ist schlimmer als ein sichtbarer
 * Fehlschlag, weil es niemand merkt.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const FOTO_EIMER = "kunden-bilder";
const SHOT_EIMER = "product-shots";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/** Alle Objektpfade unter einem Präfix — rekursiv, inkl. avatar/ und raeume/. */
async function alleObjekte(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const gefunden: string[] = [];
  const offen: string[] = [prefix];
  while (offen.length) {
    const ordner = offen.pop() as string;
    let offset = 0;
    // Seitenweise, damit auch ein großes Konto vollständig erfasst wird.
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(ordner, { limit: 100, offset });
      if (error) throw new Error(`storage_list_failed:${bucket}/${ordner}:${error.message}`);
      const eintraege = data ?? [];
      for (const e of eintraege) {
        const pfad = ordner ? `${ordner}/${e.name}` : e.name;
        // Ein Eintrag ohne id ist ein Ordner, kein Objekt.
        if (e.id) gefunden.push(pfad);
        else offen.push(pfad);
      }
      if (eintraege.length < 100) break;
      offset += 100;
    }
  }
  return gefunden;
}

async function loesche(admin: SupabaseClient, bucket: string, pfade: string[]) {
  if (!pfade.length) return;
  for (let i = 0; i < pfade.length; i += 100) {
    const teil = pfade.slice(i, i + 100);
    const { error } = await admin.storage.from(bucket).remove(teil);
    if (error) throw new Error(`storage_remove_failed:${bucket}:${error.message}`);
  }
}

async function zeilenWeg(admin: SupabaseClient, tabelle: string, spalte: string, wert: string) {
  const { error } = await admin.from(tabelle).delete().eq(spalte, wert);
  if (error) throw new Error(`delete_failed:${tabelle}:${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Signaturgeprüfte Identität — nicht der dekodierte sub.
    const alsNutzer = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await alsNutzer.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (!userId) return json({ error: "invalid_token" }, 401);

    const admin: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

    // 1. Ergebnisbilder der Anproben — sie liegen je nach Art in zwei Eimern.
    const { data: anprobenRows, error: anprobenLeseFehler } = await admin
      .from("anproben").select("result_path").eq("user_id", userId);
    if (anprobenLeseFehler) throw new Error(`select_failed:anproben:${anprobenLeseFehler.message}`);
    const ergebnisse = (anprobenRows ?? [])
      .map((r) => (r as { result_path: string | null }).result_path)
      .filter((p): p is string => !!p);
    await loesche(admin, FOTO_EIMER, ergebnisse);
    await loesche(admin, SHOT_EIMER, ergebnisse);

    // 2. Der ganze Ordner des Menschen im privaten Eimer — rekursiv.
    const objekte = await alleObjekte(admin, FOTO_EIMER, userId);
    await loesche(admin, FOTO_EIMER, objekte);
    const rest = await alleObjekte(admin, FOTO_EIMER, userId);
    if (rest.length) throw new Error(`storage_rest:${rest.length}`);

    // 3. Die Zeilen. Reihenfolge: erst was auf Bilder zeigt, dann die Bilder.
    for (const [tabelle, spalte] of [
      ["anproben", "user_id"],
      ["kunden_bilder", "user_id"],
      ["begleiter_gedaechtnis", "user_id"],
      ["begleiter_ereignisse", "user_id"],
      ["kunden_archetyp", "user_id"],
      ["kunden_stil", "user_id"],
      ["customer_measurements", "user_id"],
      ["notifications", "user_id"],
      ["ai_sessions", "user_id"],
      ["user_memory", "user_id"],
      ["user_roles", "user_id"],
      ["designer_consents", "user_id"],
      ["designer_applications", "user_id"],
    ] as const) {
      await zeilenWeg(admin, tabelle, spalte, userId);
    }

    // Ereignisse im Prüfpfad bleiben, aber ohne Person.
    const { error: anonFehler } = await admin.from("domain_events")
      .update({ actor: "deleted-user" }).eq("actor", userId);
    if (anonFehler) throw new Error(`update_failed:domain_events:${anonFehler.message}`);

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`auth_delete_failed:${error.message}`);

    return json({ ok: true, objekte_geloescht: objekte.length + ergebnisse.length });
  } catch (e) {
    // Laut scheitern: der Aufrufer sieht, welcher Schritt gerissen ist.
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
