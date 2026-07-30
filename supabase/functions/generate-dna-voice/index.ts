/**
 * Teil 20: Die DNA bekommt eine Stimme. Statt Balken/Prozentringe schreibt PAWN in Prosa,
 * was aus echtem Verhalten hervorgeht — für den Kunden ("Stilberater") und den Designer
 * ("Außenauge"). Jede Behauptung bekommt einen Beleg aus konkretem Verhalten; unter der
 * belastbaren Datenmenge (Frühzustand) wird gar nicht erst mit Claude gerechnet — lieber
 * schweigen als falsch liegen. Gilt: ai_config.house_style_law + ai_config.voice_law
 * (Sprachgesetz) in jedem Prompt.
 *
 * Body: { mode: "kunde" } | { mode: "designer", designer_id?: string }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";
const KUNDE_SCHWELLE = { blicke: 20, kaeufe: 3 };
const DESIGNER_SCHWELLE_STUECKE = 3;

const DEFAULT_HOUSE_STYLE_LAW = "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel.";
const DEFAULT_VOICE_LAW = "Schreibe für Menschen, die unsicher sind und Angst haben, etwas falsch zu verstehen. Kein wertendes Wort ohne sofortige Auflösung im selben Satz. Konkret schlägt abstrakt. Kurze Sätze. Kein Fachjargon, keine Prozentzahlen im Fließtext. Jede Behauptung bekommt eine Zeile woran ich das sehe. Scharf zur Sache, nie zur Person. Autorität kommt aus Konkretheit, nicht aus Ton. Über den Körper spricht PAWN nur über Kleidung: Proportion, Passform, Schwerpunkt, Wirkung von Schnitten — nie über den Körper selbst als Mangel. Ungefragt fällt kein Wort zu Figur, Größe oder Gewicht. Fragt jemand ausdrücklich nach Passform, antwortet PAWN sachlich über Schnitte und ihre Wirkung — nie mit dem Wort „kaschieren“ als Prämisse. Keine Aussagen zu Abnehmen, Diät oder Idealmaßen, auch nicht auf Nachfrage.";

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
function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}
async function loadConfigText(admin: SupabaseClient, key: string, fallback: string): Promise<string> {
  const { data } = await admin.from("ai_config").select("value").eq("key", key).maybeSingle();
  const v = data?.value as { text?: string } | string | null;
  const text = typeof v === "string" ? v : v?.text;
  return typeof text === "string" && text.trim() ? text.trim() : fallback;
}

async function callClaude(apiKey: string, system: string, userPrompt: string, maxTokens: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    return extractJson(text) as Record<string, unknown> | null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({})) as { mode?: string; designer_id?: string };
    const houseStyleLaw = await loadConfigText(admin, "house_style_law", DEFAULT_HOUSE_STYLE_LAW);
    const voiceLaw = await loadConfigText(admin, "voice_law", DEFAULT_VOICE_LAW);
    const OUTPUT_SHAPE_KUNDE = `Antworte NUR mit JSON, kein weiterer Text:
{"urteil": "zwei kurze Sätze, gesetzt wie eine Schlagzeile", "einordnung": "ein Absatz, der das Muster im Alltag erklärt, plus eine sanfte Brücke zu einem bekannten System als Verortung nicht Diagnose", "stilname": "ein kurzer, eigener Name für den Stil", "belege": [{"text": "Beobachtung 1", "beleg": "konkrete Zahl/Verhalten dahinter"}, {"text": "Beobachtung 2", "beleg": "..."}, {"text": "Beobachtung 3", "beleg": "..."}], "blinder_fleck": {"text": "das Muster hinter dem Muster", "beleg": "konkretes Verhalten"}, "naechster_schritt": {"text": "ein Vorschlag aus der Komfortzone, nie fordernd, immer als Einladung"}}`;
    const OUTPUT_SHAPE_DESIGNER = `Antworte NUR mit JSON, kein weiterer Text:
{"urteil": "zwei kurze Sätze — wie die Arbeit von außen ankommt, im Vergleich zur Selbstbeschreibung, gesetzt wie eine Schlagzeile", "belege": [{"text": "Beobachtung 1 aus echtem Verhalten", "beleg": "konkrete Zahl dahinter"}, {"text": "Beobachtung 2", "beleg": "..."}, {"text": "Beobachtung 3", "beleg": "..."}], "blinder_fleck": {"text": "was das Haus unterschätzt", "beleg": "konkretes Verhalten"}, "naechster_schritt": {"text": "ein Vorschlag aus der Komfortzone", "begruendung": "warum — aus Kaufverhalten und/oder naher Kulturströmung"}}`;
    const OUTPUT_SHAPE_WEG = `Antworte NUR mit JSON, kein weiterer Text:
{"schritte": [{"text": "ein Satz, was als Nächstes zu tun ist", "produkt_slug": "genau ein slug aus der Liste", "begruendung": "warum genau das — aus Ziel und Verhalten, nie fordernd"}, {"text": "...", "produkt_slug": "...", "begruendung": "..."}, {"text": "...", "produkt_slug": "...", "begruendung": "..."}], "fortschritt": "ein bis zwei Sätze, was sich seit dem letzten Mal in Richtung Ziel bewegt hat, aus echtem Verhalten — oder null, wenn seither nichts Neues war"}`;
    const OUTPUT_SHAPE_PASST = `Antworte NUR mit JSON, kein weiterer Text:
{"passt": true, "urteil": "ein bis zwei Sätze, klare Einschätzung mit Begründung aus der eigenen DNA/dem Ziel dieser Person", "alternative_slug": "slug aus der Liste, nur wenn passt=false und eine bessere Alternative existiert, sonst null", "alternative_grund": "warum die Alternative besser passt, oder null"}`;

    if (body.mode === "kunde") {
      const [{ data: memRow }, { count: visitCount }, { data: paidOrders }, { data: wishlistEvents }, { data: recentSignals }] = await Promise.all([
        admin.from("user_memory" as never).select("preferences").eq("user_id", user_id).maybeSingle(),
        admin.from("page_visits" as never).select("id", { count: "exact", head: true }).eq("user_id", user_id),
        admin.from("orders").select("id, items, created_at").eq("user_id", user_id).eq("status", "paid"),
        admin.from("domain_events").select("payload").eq("type", "wishlist.added").eq("actor", user_id).limit(20),
        admin.from("domain_events").select("payload").eq("type", "ai.taste_signal").contains("payload", { user_id }).order("at", { ascending: false }).limit(60),
      ]);

      const aktuell = (visitCount ?? 0) + (paidOrders?.length ?? 0) * 3;
      const ziel = KUNDE_SCHWELLE.blicke;
      const erreicht = (visitCount ?? 0) >= KUNDE_SCHWELLE.blicke || (paidOrders?.length ?? 0) >= KUNDE_SCHWELLE.kaeufe;
      if (!erreicht) {
        return json({ ok: true, fruehzustand: { erreicht: false, aktuell: Math.min(aktuell, ziel), ziel } });
      }
      if (!apiKey) return json({ ok: false, error: "not_configured", message: "Der Stilberater ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

      const prefs = (memRow as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
      const tags: string[] = [];
      for (const [k, v] of Object.entries(prefs)) if (k.startsWith("mag:") && typeof v === "string") tags.push(v);
      const signalPayloads = (recentSignals ?? []).map((r) => (r as { payload?: Record<string, unknown> }).payload ?? {});
      const messages = signalPayloads.map((p) => (typeof p.message === "string" ? p.message : null)).filter(Boolean).slice(0, 10);
      const orderCount = paidOrders?.length ?? 0;
      const wishlistCount = wishlistEvents?.length ?? 0;

      const material = [
        `Gemerkte Vorlieben: ${tags.join(", ") || "keine benannt"}`,
        `Fragmente aus Gesprächen: ${messages.join(" · ") || "keine"}`,
        `Seitenaufrufe insgesamt (eingeloggt): ${visitCount ?? 0}`,
        `Bezahlte Bestellungen: ${orderCount}`,
        `Auf die Merkliste gesetzt: ${wishlistCount} Stück`,
      ].join("\n");

      const system = `Du bist PAWNs Stilberater — du beschreibst einer Kundin/einem Kunden ihr/sein eigenes Muster, warm und konkret, wie eine gute Stil-Strecke in einer Modezeitschrift: man wird beschrieben, erkennt sich wieder, bekommt einen Rat. Niemals technisch, niemals belehrend.\n\n${houseStyleLaw}\n\n${voiceLaw}\n\n${OUTPUT_SHAPE_KUNDE}`;
      const out = await callClaude(apiKey, system, `Material über diese Person:\n${material}`, 900);
      if (!out) return json({ ok: false, error: "generation_failed", message: "Aus dem vorhandenen Material ließ sich noch keine Einschätzung schreiben." }, 200);

      const result = { ok: true, fruehzustand: { erreicht: true, aktuell, ziel }, ...out, generated_at: new Date().toISOString() };
      await admin.from("user_memory" as never).upsert({ user_id, preferences: { ...prefs, stilberater: result } } as never);
      return json(result);
    }

    if (body.mode === "designer") {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });
      let designerRow: { id: string; brand_name: string; brand_dna: { worlds?: Record<string, number>; signals?: string[] } | null } | null = null;
      if (isAdmin && body.designer_id) {
        const { data } = await admin.from("designers").select("id, brand_name, brand_dna").eq("id", body.designer_id).maybeSingle();
        designerRow = data as typeof designerRow;
      } else {
        const { data } = await admin.from("designers").select("id, brand_name, brand_dna").eq("user_id", user_id).maybeSingle();
        designerRow = data as typeof designerRow;
      }
      if (!designerRow) return json({ error: "not_found", message: "Kein Studio-Zugang gefunden." }, 200);

      const { count: productCount } = await admin.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designerRow.id).eq("status", "published");
      const { data: engagement } = await admin.rpc("designer_product_engagement", { p_designer_id: designerRow.id });
      const rows = (engagement ?? []) as Array<{ product_id: string; total_visits: number; unique_visitors: number; avg_dwell_seconds: number | null; returning_visitors: number }>;
      const totalVisits = rows.reduce((s, r) => s + Number(r.total_visits ?? 0), 0);
      const erreicht = (productCount ?? 0) >= DESIGNER_SCHWELLE_STUECKE && totalVisits > 0;
      if (!erreicht) {
        return json({ ok: true, fruehzustand: { erreicht: false, stuecke: productCount ?? 0, ziel_stuecke: DESIGNER_SCHWELLE_STUECKE, hat_aufrufe: totalVisits > 0 } });
      }
      if (!apiKey) return json({ ok: false, error: "not_configured", message: "Das Außenauge ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

      const { data: productNames } = await admin.from("products").select("id, name").eq("designer_id", designerRow.id).in("id", rows.map((r) => r.product_id));
      const nameById = new Map((productNames ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const worlds = Object.keys(designerRow.brand_dna?.worlds ?? {});
      const signals = (designerRow.brand_dna?.signals ?? []).slice(0, 8);
      let currentsText = "";
      if (worlds.length > 0) {
        const { data: cc } = await admin.from("cultural_currents" as never).select("name").overlaps("worlds", worlds).limit(3);
        const names = ((cc ?? []) as { name: string }[]).map((c) => c.name);
        if (names.length) currentsText = `Nahe Kulturströmungen: ${names.join(", ")}`;
      }
      const sorted = [...rows].sort((a, b) => Number(b.total_visits) - Number(a.total_visits));
      const engagementText = sorted.slice(0, 6).map((r) => {
        const name = nameById.get(r.product_id) ?? "Ein Stück";
        return `${name}: ${r.total_visits} Aufrufe, ${r.unique_visitors} verschiedene Besucher, ${r.returning_visitors} kamen mehrfach zurück${r.avg_dwell_seconds ? `, im Schnitt ${Math.round(r.avg_dwell_seconds)}s angesehen` : ""}`;
      }).join("\n");

      const material = [
        `Haus: ${designerRow.brand_name}`,
        `Selbstbeschreibung (Welten/Signale): ${worlds.join(", ") || "unbekannt"} — ${signals.join(", ") || "keine Signale"}`,
        currentsText,
        `Wie die Stücke tatsächlich ankommen:\n${engagementText || "noch keine Aufrufe"}`,
      ].filter(Boolean).join("\n");

      const system = `Du bist PAWNs Außenauge für Designer:innen — du sagst, wie ihre Arbeit von außen ankommt, im Vergleich zu ihrer eigenen Beschreibung. Direkt, aber nie über den Geschmack der Person urteilend, nur über Stücke, Reihenfolgen, Gewohnheiten.\n\n${houseStyleLaw}\n\n${voiceLaw}\n\n${OUTPUT_SHAPE_DESIGNER}`;
      const out = await callClaude(apiKey, system, `Material über dieses Haus:\n${material}`, 900);
      if (!out) return json({ ok: false, error: "generation_failed", message: "Aus dem vorhandenen Material ließ sich noch keine Einschätzung schreiben." }, 200);

      const result = { ok: true, fruehzustand: { erreicht: true, stuecke: productCount ?? 0, ziel_stuecke: DESIGNER_SCHWELLE_STUECKE, hat_aufrufe: true }, ...out, generated_at: new Date().toISOString() };
      await admin.from("designers").update({ aussenauge: result } as never).eq("id", designerRow.id);
      return json(result);
    }

    // Teil 21b: der berechnete Weg — aus Ziel + Ist-Zustand drei nächste, echte Schritte.
    // "Ein Teil ersetzt, nicht der ganze Schrank." Ohne Ziel gibt es nichts zu berechnen —
    // lieber schweigen als raten.
    if (body.mode === "weg") {
      const [{ data: memRow }, { count: visitCount }, { data: paidOrders }, { count: bilderCount }] = await Promise.all([
        admin.from("user_memory" as never).select("preferences").eq("user_id", user_id).maybeSingle(),
        admin.from("page_visits" as never).select("id", { count: "exact", head: true }).eq("user_id", user_id),
        admin.from("orders").select("id, items").eq("user_id", user_id).eq("status", "paid"),
        admin.from("style_references" as never).select("id", { count: "exact", head: true }).eq("user_id", user_id),
      ]);
      const prefs = (memRow as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
      const ziel = typeof prefs.ziel === "string" ? prefs.ziel : null;
      if (!ziel) return json({ ok: true, fruehzustand: { erreicht: false, grund: "kein_ziel" } });
      if (!apiKey) return json({ ok: false, error: "not_configured", message: "Der Weg ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

      const visits = visitCount ?? 0;
      const orders = paidOrders?.length ?? 0;
      const bilder = bilderCount ?? 0;
      const snapshot = (prefs.weg_snapshot ?? {}) as { visits?: number; orders?: number; bilder?: number };
      const deltaVisits = Math.max(0, visits - (snapshot.visits ?? 0));
      const deltaOrders = Math.max(0, orders - (snapshot.orders ?? 0));
      const deltaBilder = Math.max(0, bilder - (snapshot.bilder ?? 0));
      const deltaText = [
        deltaVisits > 0 && `${deltaVisits} neue Seitenaufrufe`,
        deltaOrders > 0 && `${deltaOrders} neue Bestellung(en)`,
        deltaBilder > 0 && `${deltaBilder} neue Stil-Referenz(en)`,
      ].filter(Boolean).join(", ") || "nichts Neues seit dem letzten Mal";

      const { data: candidates } = await admin
        .from("products")
        .select("name, slug, world, price")
        .eq("status", "published")
        .limit(40);
      const candidateRows = (candidates ?? []) as { name: string; slug: string; world: string | null; price: number | null }[];
      const candidateList = candidateRows.map((p) => `${p.slug} — ${p.name} (${p.world ?? "?"}, €${p.price ?? "?"})`).join("\n");
      const candidateSlugs = new Set(candidateRows.map((p) => p.slug));

      const material = [
        `Ziel, in eigenen Worten: ${ziel}`,
        `Ist-Zustand: ${visits} Seitenaufrufe, ${orders} bezahlte Bestellungen, ${bilder} hochgeladene Stil-Referenzen.`,
        `Seit dem letzten Mal: ${deltaText}.`,
        `Echte Stücke bei PAWN (nur diese Slugs verwenden):\n${candidateList || "noch keine veröffentlichten Stücke"}`,
      ].join("\n");

      const system = `Du bist PAWNs Wegweiser — aus dem Ziel einer Person und ihrem echten Verhalten leitest du drei konkrete nächste Schritte ab, jeder an ein echtes Stück bei PAWN geknüpft. Kein Umsturz: ein Teil ersetzt, nicht der ganze Schrank.\n\n${houseStyleLaw}\n\n${voiceLaw}\n\n${OUTPUT_SHAPE_WEG}`;
      const out = await callClaude(apiKey, system, `Material:\n${material}`, 900) as { schritte?: { text: string; produkt_slug?: string; begruendung: string }[]; fortschritt?: string | null } | null;
      if (!out) return json({ ok: false, error: "generation_failed", message: "Aus dem vorhandenen Material ließ sich noch kein Weg schreiben." }, 200);

      const schritte = (out.schritte ?? []).slice(0, 3).map((s) => ({
        ...s,
        produkt_slug: s.produkt_slug && candidateSlugs.has(s.produkt_slug) ? s.produkt_slug : null,
      }));
      const result = { ok: true, fruehzustand: { erreicht: true }, ziel, schritte, fortschritt: out.fortschritt ?? null, generated_at: new Date().toISOString() };
      await admin.from("user_memory" as never).upsert({
        user_id,
        preferences: { ...prefs, weg: result, weg_snapshot: { visits, orders, bilder } },
      } as never);
      return json(result);
    }

    // Teil 21c: "Steht mir das?" — zu einem echten Stück fragen, ob es zum
    // eigenen Stil/Ziel passt. Ohne genug DNA lieber einladen als raten.
    if (body.mode === "passt") {
      const produktSlug = typeof (body as { produkt_slug?: string }).produkt_slug === "string"
        ? (body as { produkt_slug: string }).produkt_slug : "";
      if (!produktSlug) return json({ error: "missing_produkt_slug" }, 400);

      const [{ data: memRow }, { count: visitCount }, { data: paidOrders }] = await Promise.all([
        admin.from("user_memory" as never).select("preferences").eq("user_id", user_id).maybeSingle(),
        admin.from("page_visits" as never).select("id", { count: "exact", head: true }).eq("user_id", user_id),
        admin.from("orders").select("id").eq("user_id", user_id).eq("status", "paid"),
      ]);
      const prefs = (memRow as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
      const ziel = typeof prefs.ziel === "string" ? prefs.ziel : null;
      const stilberater = prefs.stilberater as { urteil?: string; stilname?: string } | undefined;
      const erreicht = !!ziel || !!stilberater?.urteil || (visitCount ?? 0) >= KUNDE_SCHWELLE.blicke || (paidOrders?.length ?? 0) >= KUNDE_SCHWELLE.kaeufe;
      if (!erreicht) {
        return json({ ok: true, fruehzustand: { erreicht: false } });
      }
      if (!apiKey) return json({ ok: false, error: "not_configured", message: "„Steht mir das?“ ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt)." }, 200);

      const { data: productRow } = await admin
        .from("products").select("name, slug, world, price, product_dna, tags")
        .eq("slug", produktSlug).eq("status", "published").maybeSingle();
      if (!productRow) return json({ ok: false, error: "not_found", message: "Dieses Stück wurde nicht gefunden." }, 200);
      const product = productRow as { name: string; slug: string; world: string | null; price: number | null; product_dna: Record<string, string[]> | null; tags: string[] | null };
      const dna = product.product_dna ?? {};
      const dnaBits = ["materials", "silhouette", "colors", "mood"]
        .map((k) => Array.isArray(dna[k]) && dna[k].length ? `${k}: ${dna[k].join(", ")}` : null)
        .filter(Boolean).join(" · ");

      const { data: alternatives } = await admin
        .from("products").select("name, slug, world, price")
        .eq("status", "published").neq("slug", produktSlug)
        .eq("world", product.world ?? "Mode").limit(20);
      const altRows = (alternatives ?? []) as { name: string; slug: string; world: string | null; price: number | null }[];
      const altList = altRows.map((p) => `${p.slug} — ${p.name} (${p.world ?? "?"}, €${p.price ?? "?"})`).join("\n");
      const altSlugs = new Set(altRows.map((p) => p.slug));

      const tags: string[] = [];
      for (const [k, v] of Object.entries(prefs)) if (k.startsWith("mag:") && typeof v === "string") tags.push(v);

      const material = [
        `Stück, das geprüft wird: "${product.name}" (${product.world ?? "?"}, €${product.price ?? "?"}).`,
        dnaBits && `DNA des Stücks: ${dnaBits}.`,
        product.tags?.length && `Tags des Stücks: ${product.tags.slice(0, 8).join(", ")}.`,
        ziel && `Ziel dieser Person, in eigenen Worten: ${ziel}`,
        stilberater?.urteil && `Bisheriges Urteil über diese Person: ${stilberater.urteil}${stilberater.stilname ? ` (Stilname: ${stilberater.stilname})` : ""}`,
        tags.length && `Gemerkte Vorlieben: ${tags.join(", ")}`,
        `Andere echte Stücke bei PAWN als mögliche Alternative (nur diese Slugs verwenden):\n${altList || "keine Alternativen verfügbar"}`,
      ].filter(Boolean).join("\n");

      const system = `Du bist PAWNs Stilberater — du sagst klar und konkret, ob ein Stück zu einer Person passt, mit Begründung aus ihrer eigenen DNA oder ihrem Ziel. Passt es nicht, schlägst du eine echte Alternative vor, nie nur Ablehnung.\n\n${houseStyleLaw}\n\n${voiceLaw}\n\n${OUTPUT_SHAPE_PASST}`;
      const out = await callClaude(apiKey, system, `Material:\n${material}`, 500) as { passt?: boolean; urteil?: string; alternative_slug?: string | null; alternative_grund?: string | null } | null;
      if (!out) return json({ ok: false, error: "generation_failed", message: "Dazu ließ sich noch keine Einschätzung schreiben." }, 200);

      const alternative_slug = out.alternative_slug && altSlugs.has(out.alternative_slug) ? out.alternative_slug : null;
      return json({
        ok: true, fruehzustand: { erreicht: true },
        passt: !!out.passt, urteil: out.urteil ?? "", alternative_slug,
        alternative_grund: alternative_slug ? (out.alternative_grund ?? null) : null,
        generated_at: new Date().toISOString(),
      });
    }

    return json({ error: "unknown_mode" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
