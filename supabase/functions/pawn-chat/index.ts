// PAWN chat — persona-driven, session-aware, product-recommending, navigation-capable.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { schreibePartieZug } from "../_shared/partieZug.ts";
import { schreibeSignal } from "../_shared/pawnSignal.ts";

type Msg = { role: "user" | "assistant" | "system"; content: string };
type World = "Mode" | "Interior" | "Kunst";
type Mood = "ruhig" | "kante";

/** Teil 37/AP1 (36a): strukturierter Deskriptor eines hochgeladenen Bildes — überlebt über
 * Turns hinweg in ai_sessions.extracted, das Rohbild wird nie erneut mitgeschickt. */
interface ImageDescriptor {
  kleidungstyp?: string[];
  farben?: string[];
  materialien?: string[];
  silhouette?: string[];
  stil_tags?: string[];
  aktualisiert_am?: string;
}
interface Extracted { world?: World; mood?: Mood; occasion?: string; browsing?: boolean; bild_deskriptor?: ImageDescriptor }
interface Card { kind: "product" | "designer"; title: string; subtitle?: string; href: string; reason?: string }
interface Action { type: "navigate"; path: string; label: string }

const DEFAULT_SYSTEM = `Du bist PAWN, eine leise, warme und kuratierende Stimme.
Antworte auf Deutsch, in maximal 2 kurzen Sätzen.
Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?).
Erkläre nie Technik. Wenn der Nutzer nur stöbern will, respektiere das.
Wenn du empfehlen kannst, nenne 2-3 konkrete Namen aus dem Kontext, den du bekommst.`;

// Haus-Stilgesetz (Standard, überschreibbar via ai_config.house_style_law): gilt für jeden textschreibenden KI-Schritt.
const DEFAULT_HOUSE_STYLE_LAW = "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel.";

// Ehrlichkeitsgesetz (Teil 37/AP1, 36c): nie erfundene Empfehlungen. Gilt unabhängig vom Kontext für jede Antwort.
const CATALOG_HONESTY_LAW = "Empfiehl niemals ein Produkt, eine Marke oder ein Stück, das nicht wörtlich in deinem Kontext oben genannt wurde — auch nicht als vages Beispiel. Ohne echte Katalog-Grundlage: keine generische Umschreibung, sondern in einem Satz ehrlich sagen, dass es dafür aktuell nichts Passendes gibt, und einen konkreten nächsten Schritt anbieten (Wunschliste, /designers entdecken, oder — im Studio-Kontext eines Hauses — Offene Türen).";
// Sprachgesetz (Teil 20/21, überschreibbar via ai_config.voice_law): gilt zusätzlich, wenn PAWN über die Person selbst spricht (DNA-Gespräch).
const DEFAULT_VOICE_LAW = "Schreibe für Menschen, die unsicher sind und Angst haben, etwas falsch zu verstehen. Kein wertendes Wort ohne sofortige Auflösung im selben Satz. Konkret schlägt abstrakt. Kurze Sätze. Kein Fachjargon, keine Prozentzahlen im Fließtext. Jede Behauptung bekommt eine Zeile woran ich das sehe. Scharf zur Sache, nie zur Person. Autorität kommt aus Konkretheit, nicht aus Ton. Über den Körper spricht PAWN nur über Kleidung: Proportion, Passform, Schwerpunkt, Wirkung von Schnitten — nie über den Körper selbst als Mangel. Ungefragt fällt kein Wort zu Figur, Größe oder Gewicht. Fragt jemand ausdrücklich nach Passform, antwortet PAWN sachlich über Schnitte und ihre Wirkung — nie mit dem Wort „kaschieren“ als Prämisse. Keine Aussagen zu Abnehmen, Diät oder Idealmaßen, auch nicht auf Nachfrage.";

function detectWorld(t: string): World | null {
  const s = t.toLowerCase();
  if (/mode|kleid|jacke|mantel|hose|anzieh|outfit|tragen/.test(s)) return "Mode";
  if (/interior|raum|wohn|möbel|moebel|lampe|leuchte|vase|spiegel|zuhause/.test(s)) return "Interior";
  if (/kunst|bild|wand|malerei|skulptur|tapisserie|edition|werk/.test(s)) return "Kunst";
  return null;
}
function detectMood(t: string): Mood | null {
  const s = t.toLowerCase();
  if (/ruhig|weich|leise|zurückhalt|still|minimal/.test(s)) return "ruhig";
  if (/spannung|kante|hart|edge|dunkel|scharf|statement|kraftvoll|skulptural/.test(s)) return "kante";
  return null;
}
function detectBrowsing(t: string): boolean {
  return /nur (schauen|stöbern|gucken|bummeln)|schau mich um|inspir|umsehen/.test(t.toLowerCase());
}
function extractOccasion(t: string): string | undefined {
  const m = t.match(/für ([\wäöüß\s]{3,40})/i);
  return m ? m[1].trim().slice(0, 60) : undefined;
}
function detectNavIntent(t: string): boolean {
  return /(zeig(e)? mir|bring mich|öffne|oeffne|zur kollektion|zur seite|geh zu|navigier|führ mich|fuehr mich|show me|open|go to)/i.test(t);
}
function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9äöüß ]/g, "").trim(); }
function fuzzyIncludes(hay: string, needle: string) {
  const h = normalize(hay), n = normalize(needle);
  return n.length >= 3 && (h.includes(n) || n.includes(h));
}

interface DBDesigner { brand_name: string; slug: string; story?: string | null; tags?: string[] | null }
interface DBProduct {
  name: string; slug: string; description?: string | null; world?: string | null; designer_id?: string | null;
  tags?: string[] | null; product_dna?: Record<string, string[]> | null;
}

type PersonaRole = "customer" | "designer" | "admin";

async function loadPersonaForRole(admin: SupabaseClient, role: PersonaRole): Promise<string> {
  const keys: Record<PersonaRole, string> = {
    customer: "persona_customer",
    designer: "persona_designer",
    admin: "persona_admin",
  };
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", keys[role]).maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    if (v?.system_prompt?.trim()) return v.system_prompt.trim();
  } catch { /* ignore */ }
  // Fallback to legacy key for customer role
  if (role === "customer") {
    try {
      const { data } = await admin.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle();
      const v = data?.value as { system_prompt?: string } | undefined;
      if (v?.system_prompt?.trim()) return v.system_prompt.trim();
    } catch { /* ignore */ }
  }
  return DEFAULT_SYSTEM;
}

async function loadDirectives(admin: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "directives").maybeSingle();
    const v = data?.value as { items?: string[] } | undefined;
    return Array.isArray(v?.items) ? v!.items.filter((x) => typeof x === "string" && x.trim().length > 0) : [];
  } catch { return []; }
}

/** Haus-Stilgesetz: sagt, was ist — nie, was etwas nicht ist. Gilt für alle textschreibenden KI-Schritte. */
async function loadHouseStyleLaw(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "house_style_law").maybeSingle();
    const v = data?.value as { text?: string } | string | null;
    const text = typeof v === "string" ? v : v?.text;
    return typeof text === "string" && text.trim() ? text.trim() : DEFAULT_HOUSE_STYLE_LAW;
  } catch { return DEFAULT_HOUSE_STYLE_LAW; }
}

/**
 * Teil 28c — Ton je Haus: eine leise Orientierung aus Marken-DNA/Außenauge/erster Partie,
 * niemals eine eigene Regel. Das Sprachgesetz (voiceLaw) steht in der Prompt-Reihenfolge davor
 * und bleibt die Obergrenze — dieser Absatz kann nur innerhalb ihrer Grenzen färben, nie sie
 * aufweichen.
 */
function buildHouseTone(d: { brand_dna?: unknown; aussenauge?: unknown; onboarding_state?: unknown } | null | undefined): string {
  if (!d) return "";
  const bits: string[] = [];
  const dna = d.brand_dna as { signals?: string[] } | null;
  if (Array.isArray(dna?.signals) && dna.signals.length) bits.push(dna.signals.slice(0, 4).join(", "));
  const aa = d.aussenauge as { urteil?: string } | null;
  if (aa?.urteil) bits.push(aa.urteil);
  const ob = d.onboarding_state as { reife_einschaetzung?: string } | null;
  if (!bits.length && ob?.reife_einschaetzung) bits.push(ob.reife_einschaetzung);
  if (!bits.length) return "";
  return `Ton-Profil dieses Hauses (Orientierung, das Sprachgesetz bleibt die Obergrenze): ${bits.join(" — ")}.`;
}

/**
 * Teil 32 — Die Nutzungs-Schleife, Rückfluss an Mini-PAWN: welche Räume dieses Haus
 * tatsächlich nutzt oder meidet, direkt aus den echten Fachtabellen (keine neue Tabelle,
 * kein Zugriff auf den anonymen Signalstrom — der bleibt für das Cockpit-Aggregat).
 * Wer einen Raum nie betreten hat, bekommt ihn einfacher erklärt und öfter angeboten;
 * wer einen Raum schon nutzt, darf Fortgeschrittenes hören.
 */
async function buildNutzungsprofil(admin: SupabaseClient, designerId: string): Promise<string> {
  try {
    const [camps, media, automations, signatures, designerRow] = await Promise.all([
      admin.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designerId),
      admin.from("media_assets" as never).select("id", { count: "exact", head: true }).eq("designer_id", designerId),
      admin.from("designer_automations" as never).select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("enabled", true),
      admin.from("house_signatures" as never).select("id", { count: "exact", head: true }).eq("designer_id", designerId),
      admin.from("designers").select("page_published_at").eq("id", designerId).maybeSingle(),
    ]);
    const raeume: Array<{ label: string; genutzt: boolean }> = [
      { label: "Inszenieren (Kampagnen)", genutzt: (camps.count ?? 0) > 0 },
      { label: "Mediathek", genutzt: (media.count ?? 0) > 0 },
      { label: "Automatik", genutzt: (automations.count ?? 0) > 0 },
      { label: "Hausseite", genutzt: !!(designerRow.data as { page_published_at?: string | null } | null)?.page_published_at },
      { label: "Werkbuch/Signaturen", genutzt: (signatures.count ?? 0) > 0 },
    ];
    const genutzt = raeume.filter((r) => r.genutzt).map((r) => r.label);
    const gemieden = raeume.filter((r) => !r.genutzt).map((r) => r.label);
    if (gemieden.length === 0) {
      return `Nutzungsprofil dieses Hauses: nutzt bereits alle Kernbereiche (${genutzt.join(", ")}) — biete ruhig Fortgeschrittenes an, statt Grundlagen zu wiederholen.`;
    }
    return `Nutzungsprofil dieses Hauses: nutzt bereits ${genutzt.length ? genutzt.join(", ") : "noch kaum etwas"}; hat ${gemieden.join(", ")} noch nie benutzt. Erkläre gemiedene Bereiche einfacher, in kleineren Schritten, und biete sie öfter an — dräng nicht, lade ein.`;
  } catch {
    return "";
  }
}

/**
 * Teil 33 — Die zweite Kartei: Markenbauen. Aktive, freigegebene Bausteine aus `brand_knowledge`
 * (gespeist vom pawn-jarvis-Modus wissen_markenaufbau) fließen als leise Orientierung in Beratung
 * und Zug-Begründungen im Studio-Gespräch — nie als Zitat, nur als Hintergrundwissen, das PAWN
 * einweben darf, wenn es zur Frage passt.
 */
async function buildMarkenKarteiHint(admin: SupabaseClient, worldKey: string): Promise<string> {
  try {
    const { data } = await admin.from("brand_knowledge")
      .select("headline, body, world")
      .eq("approved", true).eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = ((data ?? []) as { headline: string; body: string; world: string | null }[])
      .filter((r) => !r.world || r.world === worldKey)
      .slice(0, 5);
    if (!rows.length) return "";
    const bausteine = rows.map((r) => `- ${r.headline}: ${r.body}`).join("\n");
    return `Aktuelle Markenaufbau-Kartei (gerade gültige Lagen, praxisrelevant — nur einweben, wenn es zur Frage passt, nie als Liste vorlesen):\n${bausteine}`;
  } catch {
    return "";
  }
}

const ORGAN_FRIENDLY_NAMES: Record<string, string> = {
  sichtbarkeitszug: "Sichtbarkeits-Zug (wöchentlicher Presse-Entwurf + Warteschlangen-Nachtrag)",
  presse: "Presse-Entwurf allein",
  verstaerker_haus: "Verstärker für dein Haus (zusätzliche Beitrags-Vorschläge)",
};

/**
 * Teil 38 AP6 — damit PAWN im Studio-Gespräch die eigenen, gerade aktiven Organe eines Hauses
 * korrekt beim Namen nennen kann (statt zu raten oder allgemein zu antworten), fließt hier ein,
 * welche der Teil-38-AP6-Automatiken für dieses Haus an sind. Nur relevant für Maison-Häuser —
 * andere Pläne haben keine Zeilen in designer_automations für diese Schlüssel.
 */
async function buildOrganeHint(admin: SupabaseClient, designerId: string): Promise<string> {
  try {
    const { data } = await admin.from("designer_automations" as never)
      .select("automation_key, enabled")
      .eq("designer_id", designerId)
      .in("automation_key", Object.keys(ORGAN_FRIENDLY_NAMES));
    const rows = (data as { automation_key: string; enabled: boolean }[] | null) ?? [];
    // sichtbarkeitszug fehlt row = an (Rückwärtskompatibilität, siehe pawn-jarvis runMaisonSichtbarkeitszug).
    const aktiv = ["sichtbarkeitszug", "presse", "verstaerker_haus"].filter((key) => {
      const row = rows.find((r) => r.automation_key === key);
      return row ? row.enabled : key === "sichtbarkeitszug";
    });
    if (!aktiv.length) return "Aktive PAWN-Organe dieses Hauses: derzeit keine der zusätzlichen Sichtbarkeits-Organe (Sichtbarkeits-Zug, Presse-Entwurf, Verstärker) eingeschaltet — nenne sie nur, wenn danach gefragt wird, und verweise dann auf \"Automatik\" im Studio.";
    return `Aktive PAWN-Organe dieses Hauses: ${aktiv.map((k) => ORGAN_FRIENDLY_NAMES[k]).join("; ")}. Nenne sie korrekt beim Namen, wenn danach gefragt wird.`;
  } catch {
    return "";
  }
}

/** Teil 37/AP1 (36a) — Bildgedächtnis: der Deskriptor eines früher hochgeladenen Bildes wird in
 * jedem Folgeturn als Text-Hinweis eingewoben, das Rohbild selbst nie erneut gesendet. */
function buildBildDeskriptorHint(d?: ImageDescriptor): string {
  if (!d) return "";
  const bits = [
    d.kleidungstyp?.length && `Kleidungstyp: ${d.kleidungstyp.join(", ")}`,
    d.farben?.length && `Farben: ${d.farben.join(", ")}`,
    d.materialien?.length && `Materialien: ${d.materialien.join(", ")}`,
    d.silhouette?.length && `Silhouette: ${d.silhouette.join(", ")}`,
    d.stil_tags?.length && `Stil: ${d.stil_tags.join(", ")}`,
  ].filter(Boolean).join(" · ");
  return bits ? `Bild-Gedächtnis (aus einem zuvor hochgeladenen Bild — das Rohbild liegt dir nicht mehr vor, referenziere nur diese Beobachtungen, wenn es zur Frage passt): ${bits}.` : "";
}

/** Sprachgesetz: gilt zusätzlich, sobald PAWN im Gespräch über die Person selbst urteilt (DNA-Seite). */
async function loadVoiceLaw(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "voice_law").maybeSingle();
    const v = data?.value as { text?: string } | string | null;
    const text = typeof v === "string" ? v : v?.text;
    return typeof text === "string" && text.trim() ? text.trim() : DEFAULT_VOICE_LAW;
  } catch { return DEFAULT_VOICE_LAW; }
}

async function resolveRole(admin: SupabaseClient, user_id: string | null): Promise<PersonaRole> {
  if (!user_id) return "customer";
  try {
    const { data } = await admin.from("user_roles").select("role").eq("user_id", user_id);
    const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("designer")) return "designer";
  } catch { /* ignore */ }
  return "customer";
}

async function loadCandidates(admin: SupabaseClient, world: World | undefined) {
  const [prod, des] = await Promise.all([
    admin.from("products").select("name, slug, description, world, designer_id, tags, product_dna").eq("status", "published").limit(40),
    admin.from("designers").select("brand_name, slug, story, tags").eq("status", "active").limit(40),
  ]);
  const products = (prod.data ?? []) as DBProduct[];
  const designers = (des.data ?? []) as DBDesigner[];
  const fp = products.filter((p) => !world || p.world === world);
  const fd = designers.filter((d) => {
    if (!world) return true;
    return (d.tags ?? []).includes(world);
  });
  return { products: fp, designers: fd, allProducts: products, allDesigners: designers };
}
/**
 * Teil 37/AP1 (36b) — Katalogblindheit beheben: statt der ersten N Einträge blind zu zeigen,
 * wird jedes Produkt gegen die Begriffe aus Nutzerfrage/Bild-Deskriptor gescored. Nachvollziehbar:
 * ein Punkt je überlappendem Begriff (tags + product_dna-Werte) + ein Punkt für Kategorie-Match
 * (Welt). Unter CATALOG_MATCH_THRESHOLD gilt der Treffer nicht als Grundlage (36c greift dann).
 */
const CATALOG_MATCH_THRESHOLD = 2;
function scoreProduct(p: DBProduct, terms: string[], world: World | undefined): { score: number; matched: string[] } {
  const hay = new Set<string>();
  for (const t of p.tags ?? []) hay.add(t.toLowerCase());
  for (const arr of Object.values(p.product_dna ?? {})) {
    if (Array.isArray(arr)) for (const v of arr) hay.add(String(v).toLowerCase());
  }
  const matched: string[] = [];
  for (const term of terms) {
    const t = term.toLowerCase().trim();
    if (t.length >= 3 && hay.has(t)) matched.push(term);
  }
  let score = matched.length;
  if (world && p.world === world) score += 1;
  return { score, matched };
}
function detectCatalogIntent(t: string): boolean {
  const s = t.toLowerCase();
  return /\b(passt (das|es|die|der)?( zu (mir|meinem stil))?|katalog|empfiehl|empfehlung|vorschlag|welche(s)? stück|welches produkt|was gibt(’|'|)s? es|was habt ihr|zu meinem stil)\b/.test(s);
}
function detectNavAction(text: string, all: { designers: DBDesigner[]; products: DBProduct[] }): Action | null {
  const t = text.toLowerCase();
  // Explicit intents
  if (/\b(dna|geschmack|profil)\b/.test(t)) return { type: "navigate", path: "/dna", label: "Zu deiner DNA" };
  if (/\b(warenkorb|bag|cart|tasche)\b/.test(t)) return { type: "navigate", path: "/cart", label: "Zum Warenkorb" };
  if (/\b(neu|neuheit|newest|latest)\b/.test(t)) return { type: "navigate", path: "/neu", label: "Was neu ist" };
  if (detectNavIntent(text)) {
    if (/\bmode\b|kleidung/.test(t)) return { type: "navigate", path: "/mode", label: "Zur Welt Mode" };
    if (/\binterior\b|raum|wohn/.test(t)) return { type: "navigate", path: "/interior", label: "Zur Welt Interior" };
    if (/\bkunst\b|wand/.test(t)) return { type: "navigate", path: "/kunst", label: "Zur Welt Kunst" };
    if (/designer(:innen)?( übersicht| overview)?/.test(t)) return { type: "navigate", path: "/designers", label: "Zur Designer-Übersicht" };
  }
  // Fuzzy designer match
  for (const d of all.designers) {
    if (d.brand_name && fuzzyIncludes(t, d.brand_name)) {
      return { type: "navigate", path: `/designer/${d.slug}`, label: `Zur Kollektion von ${d.brand_name}` };
    }
  }
  // Fuzzy product match (needs nav intent to avoid false positives)
  if (detectNavIntent(text)) {
    for (const p of all.products) {
      if (p.name && fuzzyIncludes(t, p.name)) {
        return { type: "navigate", path: `/product/${p.slug}`, label: `Zu „${p.name}"` };
      }
    }
  }
  return null;
}

function fallbackReply(ex: Extracted, cards: Card[], turns: number, action: Action | null): string {
  if (action) return `Gerne — ich bringe dich hin.`;
  if (turns <= 1) return "Schön, dass du hier bist. Suchst du eher etwas zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?";
  if (ex.browsing) return "Alles klar, schau dich in Ruhe um. Sag Bescheid, wenn ich helfen soll.";
  if (!ex.world) return "Verstanden. Klingt das eher nach Mode, Interior oder Kunst?";
  if (!ex.mood) return `Und in ${ex.world} — eher ruhig, oder darf es Spannung haben?`;
  if (cards.length) return `Dann würde ich dir ${cards.map((c) => c.title).join(", ")} zeigen. Möchtest du eines näher sehen?`;
  return `Alles klar, ${ex.world} mit ${ex.mood === "ruhig" ? "ruhiger" : "kantiger"} Handschrift. Wofür?`;
}

async function callOpenAI(system: string, messages: Msg[], contextHint: string, imageUrls?: string[], model = "gpt-4o-mini"): Promise<string | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const wire: unknown[] = [
      { role: "system", content: system },
      ...(contextHint ? [{ role: "system", content: contextHint }] : []),
      ...messages,
    ];
    if (imageUrls?.length) {
      const prompt = imageUrls.length > 1
        ? "Beschreibe Stil, Farbpalette, Silhouetten und Stimmung dieser Bilder als 4-8 kurze Ontologie-Terme, kommagetrennt — achte auf wiederkehrende Muster über die Bilder hinweg. Danach ein warmer, empathischer Satz auf Deutsch."
        : "Beschreibe Stil, Farbpalette, Silhouetten und Stimmung dieses Bildes als 4-8 kurze Ontologie-Terme, kommagetrennt. Danach ein warmer, empathischer Satz auf Deutsch.";
      wire.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      });
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.7, messages: wire }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function callGateway(system: string, messages: Msg[], contextHint: string, model = "google/gemini-3-flash-preview"): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...(contextHint ? [{ role: "system", content: contextHint }] : []),
          ...messages,
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function callAnthropic(system: string, messages: Msg[], contextHint: string): Promise<string | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  try {
    const sys = [system, contextHint].filter(Boolean).join("\n\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: sys,
        messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text ?? null;
  } catch { return null; }
}

async function callProvider(system: string, messages: Msg[], contextHint: string, imageUrls?: string[], model?: string, chain?: string[]): Promise<{ text: string | null; provider: string }> {
  const order = chain ?? ["openai", "anthropic", "lovable_gateway", "fallback"];
  for (const p of order) {
    if (p === "openai") { const t = await callOpenAI(system, messages, contextHint, imageUrls, model); if (t) return { text: t, provider: "openai" }; }
    else if (p === "anthropic") { const t = await callAnthropic(system, messages, contextHint); if (t) return { text: t, provider: "anthropic" }; }
    else if (p === "lovable_gateway") { const t = await callGateway(system, messages, contextHint); if (t) return { text: t, provider: "lovable_gateway" }; }
  }
  return { text: null, provider: "fallback" };
}

type Tier = "standard" | "plus" | "max";
const PLAN_TIER: Record<string, Tier> = { haus: "standard", atelier: "plus", maison: "max" };
async function loadModelForTier(admin: SupabaseClient, tier: Tier): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "model_tiers").maybeSingle();
    const v = data?.value as Record<Tier, { model?: string }> | undefined;
    return v?.[tier]?.model ?? (tier === "standard" ? "gpt-4o-mini" : "gpt-4o");
  } catch { return tier === "standard" ? "gpt-4o-mini" : "gpt-4o"; }
}


function extractUserIdFromJWT(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const parts = auth.slice(7).split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" && payload.sub.length > 8 ? payload.sub : null;
  } catch { return null; }
}

// --- Teil 28b: "Die erste Partie" — Onboarding als Gespräch, kein Formular, kein Score im Frontend. ---

interface OnboardingState {
  status?: "nicht_begonnen" | "laeuft" | "abgeschlossen";
  schritt?: "schwerpunkte" | "automatik" | "fertig";
  reife_einschaetzung?: string;
  schwerpunkte_angeboten?: string[];
  schwerpunkte_gewaehlt?: string[];
  automatik_angebot?: string | null;
  /** Zustimmungen aus dem Gespräch — werden erst mit Teil 28c in designer_automations wirksam. */
  automatik_zustimmungen?: string[];
  abgeschlossen_am?: string | null;
  zuletzt_aktiv_am?: string;
}

// Dieselben sechs vorbereitenden Schritte wie in useDesignerJourney (Teil 17c) — ohne "Konto"
// (immer wahr) und "Erster Verkauf" (ein Ergebnis, kein Zug, den man vorschlagen kann).
const PARTIE_SCHRITTE = [
  { key: "haus_benannt", label: "Dein Haus benennen" },
  { key: "erstes_stueck", label: "Ein erstes Stück anlegen" },
  { key: "bild_inszeniert", label: "Ein Bild inszenieren" },
  { key: "auszahlungskonto", label: "Auszahlungskonto einrichten" },
  { key: "seite_veroeffentlicht", label: "Deine Seite veröffentlichen" },
  { key: "erstmals_geteilt", label: "Zum ersten Mal teilen" },
] as const;

// Zone Grün aus Teil 28c — hier nur als Angebot im Gespräch, die Zustimmung wird erst mit der
// Automatik-Matrix (28c) tatsächlich wirksam. Nur zwei der vier Grün-Automatiken passen thematisch
// zu einem der Schwerpunkte oben; die anderen beiden gehören nicht in ein Eröffnungsgespräch.
const PARTIE_AUTOMATIK: Record<string, { key: string; frage: string }> = {
  bild_inszeniert: { key: "inszenieren_bei_upload", frage: "Soll ich neue Fotos künftig automatisch für dich in Szene setzen, sobald du sie hochlädst?" },
  erstmals_geteilt: { key: "sharekit_bei_live", frage: "Soll ich dir automatisch ein fertiges Teil-Paket bereitlegen, sobald ein Stück live geht?" },
};

const SHARE_EVENT_TYPES_PARTIE = ["share.kit_downloaded", "share.package_downloaded", "share.link_copied"];

async function computePartieSignale(
  admin: SupabaseClient, designerId: string, brandName: string | null,
  stripeChargesEnabled: boolean | null, pagePublishedAt: string | null,
): Promise<Record<string, boolean>> {
  const [{ count: productsCount }, { data: staging }, { data: shareEvents }] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designerId),
    admin.from("staging_requests" as never).select("id").eq("designer_id", designerId).eq("status", "done").limit(1),
    admin.from("domain_events").select("id").in("type", SHARE_EVENT_TYPES_PARTIE).eq("payload->>designer_id", designerId).limit(1),
  ]);
  return {
    haus_benannt: !!brandName,
    erstes_stueck: (productsCount ?? 0) > 0,
    bild_inszeniert: (((staging as unknown[]) ?? []).length) > 0,
    auszahlungskonto: stripeChargesEnabled === true,
    seite_veroeffentlicht: !!pagePublishedAt,
    erstmals_geteilt: (((shareEvents as unknown[]) ?? []).length) > 0,
  };
}

/** Reife in Worten, nie als Zahl — die Bänder sind intern, im Text steht nur die Einschätzung. */
function reifeEinschaetzung(doneCount: number, total: number): string {
  if (doneCount <= 1) return "Du stehst ganz am Anfang der Partie — der Zugang steht, der Rest entsteht jetzt, Zug für Zug.";
  if (doneCount <= 3) return "Die Grundlagen stehen. Jetzt geht es darum, sichtbar zu werden.";
  if (doneCount < total) return "Du bist schon mitten in der Partie — nur noch wenige Züge trennen dich vom ersten Verkauf.";
  return "Alles Vorbereitende ist getan. Ab hier zählt, was du zeigst.";
}

function partieResponse(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Schreibt die gewählten Schwerpunkte der ersten Partie als Züge ins Partie-Buch (Teil 28c). */
async function schreibeErstePartieZuege(admin: SupabaseClient, designerId: string, schwerpunkte: string[]): Promise<void> {
  const byKey = new Map(PARTIE_SCHRITTE.map((s) => [s.key, s.label] as const));
  for (const key of schwerpunkte) {
    const label = byKey.get(key as (typeof PARTIE_SCHRITTE)[number]["key"]);
    if (label) await schreibePartieZug(admin, designerId, `Nächster Schritt vereinbart: ${label}.`, "pawn", "erste_partie");
  }
}

/**
 * Führt die erste Partie einen Zug weiter. Steuerung (Zustand, Übergänge, Schreibzugriffe) hängt
 * nie vom Denkmodell ab — nur der Ton einer einzelnen Zeile wird, wenn ein Anbieter verfügbar ist,
 * warm umformuliert (callProvider → warm()). Ist kein KI-Guthaben/kein Schlüssel verfügbar, liefert
 * callProvider text:null und die feste, immer korrekte Zeile bleibt stehen — der Ablauf funktioniert
 * unverändert, nur ohne die persönliche Formulierung.
 */
async function handleErstePartie(
  admin: SupabaseClient | null, user_id: string | null,
  body: { partie_aktion?: string; schwerpunkte_gewaehlt?: string[]; automatik_zustimmung?: boolean },
): Promise<Response> {
  if (!admin || !user_id) return partieResponse({ ok: false, error: "Dafür musst du als Haus angemeldet sein." });

  const { data: d } = await admin.from("designers")
    .select("id, brand_name, stripe_charges_enabled, page_published_at, onboarding_state")
    .eq("user_id", user_id).maybeSingle();
  if (!d) return partieResponse({ ok: false, error: "Kein Haus zu diesem Konto gefunden." });
  const designer = d as {
    id: string; brand_name: string | null; stripe_charges_enabled: boolean | null;
    page_published_at: string | null; onboarding_state: OnboardingState | null;
  };
  const state: OnboardingState = designer.onboarding_state ?? {};
  const aktion = String(body.partie_aktion ?? "start");
  const now = new Date().toISOString();

  if (state.status === "abgeschlossen") {
    return partieResponse({ ok: true, schritt: "fertig", reply: "Die Eröffnung steht.", celebrate: false, onboarding_state: state });
  }

  const houseStyleLaw = await loadHouseStyleLaw(admin);
  async function warm(fixedLine: string): Promise<string> {
    const sys = `Du bist PAWN, mitten in einem kurzen, warmen Eröffnungsgespräch mit einer Designerin/einem Designer ("Die erste Partie"). ${houseStyleLaw}\nFormuliere den folgenden Satz in genau einem warmen, kurzen Satz auf Deutsch neu — erfinde nichts hinzu, ändere keine Fakten und keine Zahlen: "${fixedLine}"`;
    const r = await callProvider(sys, [], "", undefined, undefined);
    return r.text?.trim() || fixedLine;
  }

  if (aktion === "schwerpunkte_bestaetigen") {
    const angeboten = state.schwerpunkte_angeboten ?? [];
    const gewaehlt = Array.isArray(body.schwerpunkte_gewaehlt) && body.schwerpunkte_gewaehlt.length
      ? body.schwerpunkte_gewaehlt.filter((k) => angeboten.includes(k))
      : angeboten;
    const automatikKandidat = gewaehlt.map((k) => PARTIE_AUTOMATIK[k]).find(Boolean) ?? null;
    const nextState: OnboardingState = {
      ...state, status: "laeuft", schritt: automatikKandidat ? "automatik" : "fertig",
      schwerpunkte_gewaehlt: gewaehlt, automatik_angebot: automatikKandidat?.key ?? null,
      ...(automatikKandidat ? {} : { abgeschlossen_am: now }),
      zuletzt_aktiv_am: now,
    };
    await admin.from("designers").update({ onboarding_state: nextState as never }).eq("id", designer.id);
    if (automatikKandidat) {
      return partieResponse({ ok: true, schritt: "automatik", reply: await warm(automatikKandidat.frage), automatik_angebot: automatikKandidat, onboarding_state: nextState });
    }
    if (admin) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "onboarding.erste_partie_abgeschlossen", actor: "user",
        payload: { user_id, designer_id: designer.id, schwerpunkte: gewaehlt }, schema_version: 1,
      });
    }
    await schreibeErstePartieZuege(admin, designer.id, gewaehlt);
    await schreibeSignal(admin, "pawn-chat", "erste_partie_abgeschlossen", { schwerpunkte: gewaehlt, anzahl: gewaehlt.length });
    return partieResponse({ ok: true, schritt: "fertig", reply: await warm("Die Eröffnung steht."), celebrate: true, onboarding_state: nextState });
  }

  if (aktion === "automatik_antworten") {
    const zustimmung = body.automatik_zustimmung === true;
    const key = state.automatik_angebot;
    const zustimmungen = zustimmung && key
      ? Array.from(new Set([...(state.automatik_zustimmungen ?? []), key]))
      : (state.automatik_zustimmungen ?? []);
    const nextState: OnboardingState = {
      ...state, status: "abgeschlossen", schritt: "fertig",
      automatik_zustimmungen: zustimmungen, abgeschlossen_am: now, zuletzt_aktiv_am: now,
    };
    await admin.from("designers").update({ onboarding_state: nextState as never }).eq("id", designer.id);
    await admin.from("domain_events").insert({
      id: crypto.randomUUID(), type: "onboarding.erste_partie_abgeschlossen", actor: "user",
      payload: { user_id, designer_id: designer.id, schwerpunkte: state.schwerpunkte_gewaehlt ?? [], automatik_zugestimmt: zustimmung ? key : null }, schema_version: 1,
    });
    await schreibeErstePartieZuege(admin, designer.id, state.schwerpunkte_gewaehlt ?? []);
    await schreibeSignal(admin, "pawn-chat", "erste_partie_abgeschlossen", { schwerpunkte: state.schwerpunkte_gewaehlt ?? [], automatik_zugestimmt: zustimmung ? key : null });
    if (zustimmung && key) {
      await schreibePartieZug(admin, designer.id, "Eine Automatik aus der Eröffnung eingeschaltet.", "haus", key);
    }
    return partieResponse({ ok: true, schritt: "fertig", reply: await warm("Die Eröffnung steht."), celebrate: true, onboarding_state: nextState });
  }

  // aktion === "start" (Default): Bestandsaufnahme aus echten Signalen, Reife-Einschätzung in
  // Worten, bis zu drei Schwerpunkte zur Auswahl anbieten.
  const done = await computePartieSignale(admin, designer.id, designer.brand_name, designer.stripe_charges_enabled, designer.page_published_at);
  const offene = PARTIE_SCHRITTE.filter((s) => !done[s.key]).slice(0, 3);
  const doneCount = PARTIE_SCHRITTE.filter((s) => done[s.key]).length;
  const einschaetzung = reifeEinschaetzung(doneCount, PARTIE_SCHRITTE.length);

  if (offene.length === 0) {
    const nextState: OnboardingState = { ...state, status: "abgeschlossen", schritt: "fertig", reife_einschaetzung: einschaetzung, abgeschlossen_am: now, zuletzt_aktiv_am: now };
    await admin.from("designers").update({ onboarding_state: nextState as never }).eq("id", designer.id);
    return partieResponse({ ok: true, schritt: "fertig", reply: await warm(`${einschaetzung} Die Eröffnung steht.`), celebrate: true, onboarding_state: nextState });
  }

  const nextState: OnboardingState = {
    ...state, status: "laeuft", schritt: "schwerpunkte",
    reife_einschaetzung: einschaetzung, schwerpunkte_angeboten: offene.map((s) => s.key),
    zuletzt_aktiv_am: now,
  };
  await admin.from("designers").update({ onboarding_state: nextState as never }).eq("id", designer.id);
  const opener = `${designer.brand_name ? `${designer.brand_name}, schön dich zu sehen.` : "Schön, dich zu sehen."} ${einschaetzung}`;
  return partieResponse({
    ok: true, schritt: "schwerpunkte", reply: await warm(opener),
    optionen: offene.map((s) => ({ key: s.key, label: s.label })),
    onboarding_state: nextState,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as {
      messages: Msg[]; session_id?: string; probe?: boolean;
      image_url?: string; image_urls?: string[]; image_paths?: string[];
      persist_thread?: boolean;
      page_context?: { route?: string; product_slug?: string };
      mode?: "erste_partie";
      partie_aktion?: string; schwerpunkte_gewaehlt?: string[]; automatik_zustimmung?: boolean;
    };

    // Provider probe (used by /admin/ki status badge) — no side effects.
    if (body.probe) {
      const providers = {
        openai: !!Deno.env.get("OPENAI_API_KEY"),
        anthropic: !!Deno.env.get("ANTHROPIC_API_KEY"),
        lovable_gateway: !!Deno.env.get("LOVABLE_API_KEY"),
      };
      const chain = ["openai","anthropic","lovable_gateway"].filter((p) => providers[p as keyof typeof providers]);
      const provider = chain[0] ?? "fallback";
      return new Response(JSON.stringify({ provider, providers, chain }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const imageUrls = [...(body.image_urls ?? []), ...(body.image_url ? [body.image_url] : [])].filter(Boolean).slice(0, 6);
    const session_id = body.session_id ?? crypto.randomUUID();
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const user_id = extractUserIdFromJWT(req.headers.get("Authorization"));


    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

    // Teil 28b: "Die erste Partie" ist ein eigener, in sich geschlossener Ablauf (eigene Fragen,
    // eigener Zustand in designers.onboarding_state) — läuft komplett getrennt vom freien Gespräch.
    if (body.mode === "erste_partie") {
      return await handleErstePartie(admin, user_id, body);
    }

    let extracted: Extracted = {};
    let turns = 0;
    if (admin && session_id) {
      // Teil 28a Sicherheits-Check: ein Session-Verlauf gehört seinem Konto. Ist der Nutzer
      // eingeloggt, darf ein fremder/geratener session_id keine andere Person auslesen.
      let sessionQuery = admin.from("ai_sessions").select("extracted, turns").eq("session_id", session_id);
      if (user_id) sessionQuery = sessionQuery.eq("user_id", user_id);
      const { data } = await sessionQuery.maybeSingle();
      if (data) { extracted = (data.extracted as Extracted) ?? {}; turns = data.turns ?? 0; }
    }
    if (lastUser) {
      const w = detectWorld(lastUser); const m = detectMood(lastUser);
      const o = extractOccasion(lastUser); const b = detectBrowsing(lastUser);
      if (w) extracted.world = w; if (m) extracted.mood = m;
      if (o) extracted.occasion = o; if (b) extracted.browsing = true;
    }
    turns += 1;

    // --- Ontology-aware term extraction from user message -----------------
    let ontologyTerms: { term: string; kind: string }[] = [];
    if (admin && lastUser) {
      const { data: ont } = await admin
        .from("fashion_ontology")
        .select("term, kind, synonyms")
        .limit(400);
      const rows = (ont ?? []) as { term: string; kind: string; synonyms: string[] | null }[];
      const t = lastUser.toLowerCase();
      const seen = new Set<string>();
      for (const r of rows) {
        const tokens = [r.term, ...(r.synonyms ?? [])].filter(Boolean).map((s) => s.toLowerCase());
        for (const tok of tokens) {
          if (tok.length >= 3 && t.includes(tok) && !seen.has(r.term)) {
            seen.add(r.term);
            ontologyTerms.push({ term: r.term, kind: r.kind });
            break;
          }
        }
        if (ontologyTerms.length >= 8) break;
      }
    }

    // --- Load user_memory for signed-in users -----------------------------
    interface UserMemory { preferences: Record<string, unknown>; facts: string[] }
    let memory: UserMemory = { preferences: {}, facts: [] };
    if (admin && user_id) {
      const { data: mem } = await admin.from("user_memory").select("preferences, facts").eq("user_id", user_id).maybeSingle();
      if (mem) {
        memory = {
          preferences: (mem.preferences as Record<string, unknown>) ?? {},
          facts: Array.isArray(mem.facts) ? (mem.facts as string[]) : [],
        };
      }
    }

    if (admin && lastUser) {
      await admin.from("ai_sessions").upsert({ session_id, user_id, extracted: extracted as unknown as Record<string, unknown>, turns });
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: {
          raw: lastUser,
          session_id,
          world: extracted.world ?? null,
          mood: extracted.mood ?? null,
          occasion: extracted.occasion ?? null,
          terms: ontologyTerms,
          ...(user_id ? { user_id } : {}),
        },
        schema_version: 1,
      });
    }

    // Load candidates always (needed for nav-fuzzy)
    let action: Action | null = null;
    const cards: Card[] = [];
    let contextHint = "";
    let trendCards: Card[] = [];
    let trendReplyPrefix = "";
    if (admin) {
      const cand = await loadCandidates(admin, extracted.world);
      action = detectNavAction(lastUser, { designers: cand.allDesigners, products: cand.allProducts });

      // Trend intent: "was ist im trend / trends / momentum"
      const trendIntent = /\b(trend|trends|im trend|momentum|angesagt|gerade beliebt)\b/i.test(lastUser);
      if (trendIntent) {
        const worldForTrends = extracted.world ?? "Mode";
        const { data: mo } = await admin.rpc("trend_momentum" as never, { _world: worldForTrends } as never);
        const top3 = (((mo as unknown) as { term: string; momentum: string; latest_score: number }[] | null) ?? [])
          .filter((r) => r.momentum === "steigend")
          .slice(0, 3);
        if (top3.length) {
          // Grab 2 products whose tags overlap with any of these terms
          const wantedTerms = new Set(top3.map((r) => r.term.toLowerCase()));
          const matches = cand.products.filter((p) => (p as unknown as { tags?: string[] }).tags?.some((tag) => wantedTerms.has(tag.toLowerCase()))).slice(0, 2);
          for (const p of matches) {
            trendCards.push({ kind: "product", title: p.name, subtitle: p.world ?? undefined, href: `/product/${p.slug}`, reason: "Gerade im Aufwärtstrend." });
          }
          trendReplyPrefix = `Aktuell im Aufwärtstrend in ${worldForTrends}: ${top3.map((r) => r.term).join(", ")}.`;
        }
      }

      if (!action && user_id && /\b(mein store|studio|copilot|kollektion|meine produkte|umsatz|verkäufe|kampagne)\b/i.test(lastUser)) {
        const { data: d } = await admin.from("designers").select("id").eq("user_id", user_id).maybeSingle();
        if (d) action = { type: "navigate", path: "/studio/copilot", label: "Zum Copilot im Studio" };
      }
      // Teil 37/AP1 (36b/36c): Katalog-Retrieval nur bei erkennbarem Produkt-/Stil-Intent — entweder
      // explizit gefragt, oder Welt+Stimmung stehen schon fest und der Kunde stöbert nicht nur.
      const catalogIntent = detectCatalogIntent(lastUser);
      if (!action && (catalogIntent || (extracted.world && extracted.mood && !extracted.browsing))) {
        const queryTerms = [
          ...ontologyTerms.map((t) => t.term),
          ...(extracted.bild_deskriptor?.stil_tags ?? []),
          ...(extracted.bild_deskriptor?.materialien ?? []),
          ...(extracted.bild_deskriptor?.farben ?? []),
          ...(extracted.bild_deskriptor?.silhouette ?? []),
        ];
        const scored = cand.allProducts
          .map((p) => ({ p, ...scoreProduct(p, queryTerms, extracted.world) }))
          .filter((x) => x.score >= CATALOG_MATCH_THRESHOLD)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        if (scored.length) {
          for (const { p, matched } of scored) {
            cards.push({
              kind: "product", title: p.name, subtitle: p.world ?? undefined,
              href: `/product/${p.slug}`,
              reason: matched.length ? `Trifft auf ${matched.slice(0, 3).join(", ")}.` : "Passt zur Welt.",
            });
          }
          const names = scored.map(({ p }) => p.name).join(", ");
          contextHint = `Echte Katalog-Treffer mit Begründung (nutze NUR diese Namen, erfinde keine weiteren): ${names}.`;
        } else if (catalogIntent || queryTerms.length) {
          contextHint = "KEIN AUSREICHENDER KATALOG-TREFFER: Sag in einem Satz ehrlich, dass es dafür aktuell nichts ausreichend Passendes gibt, und biete konkret einen nächsten Schritt an (Wunschliste, /designers entdecken). Erfinde kein Produkt und keine Marke.";
        }
      }
    }
    if (action) contextHint = `Der Nutzer hat gerade nach Navigation gefragt: ${action.label}. Antworte in EINEM kurzen warmen Satz, bestätige dass du ihn hinbringst. Keine Fragen.`;

    // Weave memory into the system prompt
    let memoryHint = "";
    if (memory.facts.length || Object.keys(memory.preferences).length) {
      const factList = memory.facts.slice(-4).join(" · ");
      const prefList = Object.entries(memory.preferences).slice(0, 6).map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
      memoryHint = `Was PAWN sich über diese Person merkt${factList ? ` · Notizen: ${factList}` : ""}${prefList ? ` · Präferenzen: ${prefList}` : ""}. Verbinde deine Antwort dezent damit, ohne es explizit vorzulesen.`;
    }
    if (trendReplyPrefix) contextHint = `${trendReplyPrefix} ${contextHint}`.trim();

    const role = admin ? await resolveRole(admin, user_id) : "customer";
    const persona = admin ? await loadPersonaForRole(admin, role) : DEFAULT_SYSTEM;
    const directives = admin ? await loadDirectives(admin) : [];
    const directiveBlock = directives.length ? `Direktiven (immer beachten):\n- ${directives.join("\n- ")}` : "";
    const houseStyleLaw = admin ? await loadHouseStyleLaw(admin) : DEFAULT_HOUSE_STYLE_LAW;

    // --- Page context: if user is on a product page, load rich detail so
    // PAWN can answer concrete questions about the piece in front of them.
    let pageContextHint = "";
    let houseTone = "";
    const pc = body.page_context;
    if (admin && pc?.product_slug) {
      try {
        const { data: pr } = await admin
          .from("products")
          .select("name, world, description, designer_note, product_dna, tags, price, made_in, care_instructions, edition_info, lead_time_days, inventory_mode, length_cm, width_cm, height_cm, designers ( brand_name, brand_dna, aussenauge, onboarding_state )")
          .eq("slug", pc.product_slug)
          .maybeSingle();
        if (pr) {
          const p = pr as unknown as {
            name: string; world: string | null; description: string | null; designer_note: string | null;
            product_dna: Record<string, string[]> | null; tags: string[] | null; price: number | null;
            made_in: string | null; care_instructions: string | null; edition_info: string | null; lead_time_days: number | null;
            inventory_mode: string | null;
            length_cm: number | null; width_cm: number | null; height_cm: number | null;
            designers: { brand_name: string; brand_dna: { signals?: string[] } | null; aussenauge: { urteil?: string } | null; onboarding_state: { reife_einschaetzung?: string } | null } | null;
          };
          houseTone = buildHouseTone(p.designers);
          const dna = p.product_dna ?? {};
          const dnaBits = ["materials","silhouette","colors","mood"]
            .map((k) => Array.isArray(dna[k]) && dna[k].length ? `${k}: ${dna[k].join(", ")}` : null)
            .filter(Boolean).join(" · ");
          const dims = [p.length_cm && `L ${p.length_cm}cm`, p.width_cm && `B ${p.width_cm}cm`, p.height_cm && `H ${p.height_cm}cm`].filter(Boolean).join(" × ");
          pageContextHint = [
            `AKTUELLE SEITE: Produktdetail von "${p.name}"${p.designers?.brand_name ? ` von ${p.designers.brand_name}` : ""}.`,
            p.world && `Welt: ${p.world}.`,
            p.price != null && `Preis: €${p.price}.`,
            p.description && `Beschreibung: ${p.description}`,
            p.designer_note && `Gedanke der Designer:in: ${p.designer_note}`,
            dnaBits && `DNA: ${dnaBits}.`,
            p.tags?.length && `Tags: ${p.tags.slice(0,8).join(", ")}.`,
            dims && `Maße: ${dims}.`,
            p.made_in && `Gefertigt in: ${p.made_in}.`,
            p.care_instructions && `Pflege: ${p.care_instructions}`,
            p.edition_info && `Edition: ${p.edition_info}.`,
            p.lead_time_days && `Lieferzeit Anfertigung: ~${p.lead_time_days} Tage.`,
            `Versand: ${p.inventory_mode === "made_to_order" ? `wird für dich gefertigt${p.lead_time_days ? `, ca. ${p.lead_time_days} Tage` : ""}` : "versandfertig aus dem Atelier"}, versichert, weltweit, direkt aus der Werkstatt. 14 Tage Widerrufsrecht (Anfertigungen nach Maß ausgenommen).`,
            `Antworte konkret auf Fragen zu genau diesem Stück — nutze diese Fakten, spekuliere nicht.`,
          ].filter(Boolean).join(" ");
        }
      } catch { /* soft */ }
    }
    // DNA-Seite: das Ziel wird beiläufig herauskitzeln, nie abgefragt (Teil 21b).
    if (pc?.route === "/dna") {
      const zielHint = typeof (memory.preferences as { ziel?: unknown }).ziel === "string"
        ? `Ihr Ziel, in eigenen Worten: "${(memory.preferences as { ziel: string }).ziel}". Beziehe dich darauf, wenn es passt.`
        : "Ihr Ziel ist noch nicht bekannt. Stelle beiläufig EINE der Fragen, die zählen (wohin will sie/er, was möchte sie/er ausstrahlen, wo fühlt sie/er sich unwohl, was trägt sie/er zu wichtigen Anlässen) — nie als Formular, höchstens eine Frage pro Antwort, immer als Teil eines echten Gesprächs.";
      pageContextHint = [pageContextHint, zielHint].filter(Boolean).join(" ");
    }

    // Sprachgesetz gilt zusätzlich, sobald PAWN im Gespräch über die Person selbst urteilt (DNA-Seite).
    const voiceLaw = admin && pc?.route === "/dna" ? await loadVoiceLaw(admin) : "";

    // Teil 32 — Rückfluss der Nutzungs-Schleife an Mini-PAWN: im Studio-Gespräch des Hauses
    // selbst (nicht beim Kunden auf der Produktseite) fließt ein, welche Räume das Haus
    // schon nutzt oder noch meidet.
    let nutzungsprofil = "";
    let markenKartei = "";
    let organeHint = "";
    if (admin && user_id && role === "designer" && pc?.route?.startsWith("/studio")) {
      const { data: ownDesigner } = await admin.from("designers").select("id, tags, plan").eq("user_id", user_id).maybeSingle();
      if (ownDesigner?.id) {
        nutzungsprofil = await buildNutzungsprofil(admin, ownDesigner.id);
        const worldKey = ((ownDesigner as { tags?: string[] | null }).tags ?? []).find((t) => ["Mode", "Interior", "Kunst"].includes(t)) ?? "Mode";
        markenKartei = await buildMarkenKarteiHint(admin, worldKey);
        if ((ownDesigner as { plan?: string }).plan === "maison") {
          organeHint = await buildOrganeHint(admin, ownDesigner.id);
        }
      }
    }

    const system = [persona, houseStyleLaw, CATALOG_HONESTY_LAW, voiceLaw, houseTone, nutzungsprofil, markenKartei, organeHint, directiveBlock].filter(Boolean).join("\n\n");
    const bildDeskriptorHint = buildBildDeskriptorHint(extracted.bild_deskriptor);
    const fullContextHint = [pageContextHint, memoryHint, bildDeskriptorHint, contextHint].filter(Boolean).join("\n\n");

    // Model tier je nach Rolle/Plan
    let tier: Tier = "standard";
    if (admin && user_id && role === "designer") {
      try {
        const { data: d } = await admin.from("designers").select("plan").eq("user_id", user_id).maybeSingle();
        const p = (d as { plan?: string } | null)?.plan;
        if (p && PLAN_TIER[p]) tier = PLAN_TIER[p];
      } catch { /* soft */ }
    }
    const model = admin ? await loadModelForTier(admin, tier) : "gpt-4o-mini";


    // Teil 37/AP1 (36a/36d) — Bild-Turns nutzen immer gpt-4o, unabhängig vom Tier; Folgeturns ohne
    // Bild bleiben beim Tier-Modell. Statt einer Ad-hoc-Kommaliste wird ein strukturierter
    // Deskriptor erfragt und in extracted.bild_deskriptor über Turns hinweg zusammengeführt
    // (nie überschrieben) — das Bildgedächtnis, das vorher nach dem ersten Turn verschwand.
    const imageTurn = imageUrls.length > 0;
    const effectiveModel = imageTurn ? "gpt-4o" : model;
    let imageTerms: string[] = [];
    if (imageTurn && Deno.env.get("OPENAI_API_KEY")) {
      const visionRaw = await callOpenAI(
        "Du bist PAWN. Analysiere Modebilder/Moodboards und antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Markdown und ohne Erklärtext, mit genau diesen Feldern: kleidungstyp, farben, materialien, silhouette, stil_tags — je ein Array aus 2-5 kurzen deutschen Begriffen (Kleinschreibung). Immer als Beobachtung, nie als Bewertung.",
        [], "", imageUrls, "gpt-4o"
      );
      let descriptor: ImageDescriptor | null = null;
      if (visionRaw) {
        try {
          const jsonMatch = visionRaw.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          const pickList = (k: string): string[] =>
            Array.isArray(parsed?.[k])
              ? (parsed[k] as unknown[]).map((s) => String(s).trim().toLowerCase()).filter((s) => s.length >= 2 && s.length <= 40).slice(0, 6)
              : [];
          if (parsed && typeof parsed === "object") {
            descriptor = {
              kleidungstyp: pickList("kleidungstyp"), farben: pickList("farben"),
              materialien: pickList("materialien"), silhouette: pickList("silhouette"),
              stil_tags: pickList("stil_tags"), aktualisiert_am: new Date().toISOString(),
            };
          }
        } catch { /* fällt unten auf Roh-Terme zurück */ }
      }
      if (descriptor) {
        imageTerms = [
          ...(descriptor.kleidungstyp ?? []), ...(descriptor.farben ?? []), ...(descriptor.materialien ?? []),
          ...(descriptor.silhouette ?? []), ...(descriptor.stil_tags ?? []),
        ].slice(0, 8);
        const prev = extracted.bild_deskriptor;
        const merge = (a?: string[], b?: string[]) => Array.from(new Set([...(a ?? []), ...(b ?? [])])).slice(0, 8);
        extracted.bild_deskriptor = {
          kleidungstyp: merge(prev?.kleidungstyp, descriptor.kleidungstyp),
          farben: merge(prev?.farben, descriptor.farben),
          materialien: merge(prev?.materialien, descriptor.materialien),
          silhouette: merge(prev?.silhouette, descriptor.silhouette),
          stil_tags: merge(prev?.stil_tags, descriptor.stil_tags),
          aktualisiert_am: descriptor.aktualisiert_am,
        };
        if (admin) {
          await admin.from("ai_sessions").upsert({ session_id, user_id, extracted: extracted as unknown as Record<string, unknown>, turns });
        }
      } else if (visionRaw) {
        const line = visionRaw.split(/[\n.]/)[0] ?? "";
        imageTerms = line.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3 && s.length <= 40).slice(0, 8);
      }
    }
    if (admin && imageUrls.length) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.taste_signal",
        actor: user_id ? "user" : "anon",
        payload: { source: "image", session_id, user_id: user_id ?? null, image_urls: imageUrls, terms: imageTerms },
        schema_version: 1,
      });
    }
    // Stil-Referenzen: dauerhafte, einzeln löschbare Ablage je Nutzer (Teil 21a).
    if (admin && user_id && imageUrls.length) {
      const beschreibung = imageTerms.length ? imageTerms.join(", ") : null;
      const rows = imageUrls.map((url, i) => ({
        user_id, url, path: body.image_paths?.[i] ?? "", beschreibung, herkunft: "bild",
      }));
      await admin.from("style_references" as never).insert(rows as never);
    }

    // Load provider chain from ai_config (default: openai → anthropic → lovable → fallback)
    let chain: string[] | undefined;
    if (admin) {
      try {
        const { data } = await admin.from("ai_config").select("value").eq("key", "provider_priority").maybeSingle();
        const c = (data?.value as { chain?: string[] } | undefined)?.chain;
        if (Array.isArray(c) && c.length) chain = c;
      } catch { /* soft */ }
    }
    const providerResult = await callProvider(system, messages, fullContextHint, imageUrls, effectiveModel, chain);
    const rawReply = providerResult.text ?? fallbackReply(extracted, cards, turns, action);
    const reply = trendReplyPrefix && !rawReply.toLowerCase().includes("trend") ? `${trendReplyPrefix} ${rawReply}` : rawReply;

    // --- Upsert user_memory: extract simple facts / preferences -----------
    if (admin && user_id && (lastUser || body.persist_thread)) {
      const nextPrefs: Record<string, unknown> = { ...memory.preferences };
      if (extracted.world) nextPrefs.welt = extracted.world;
      if (extracted.mood) nextPrefs.stimmung = extracted.mood;
      if (extracted.occasion) nextPrefs.anlass = extracted.occasion;
      for (const t of ontologyTerms.slice(0, 3)) {
        const key = `mag:${t.kind}`;
        nextPrefs[key] = t.term;
      }
      // Simple fact extraction: "ich bin/heiße/arbeite/wohne … " sentences
      const newFacts: string[] = [];
      const factRegex = /(ich (?:bin|heiße|arbeite als|wohne in|mag|liebe|hasse|trage|suche)[^.!?\n]{3,80})/gi;
      let m;
      while ((m = factRegex.exec(lastUser)) !== null && newFacts.length < 2) {
        newFacts.push(m[1].trim().slice(0, 120));
      }
      const mergedFacts = [...memory.facts, ...newFacts].slice(-20);

      // Ziel herauskitzeln: auf der DNA-Seite, wenn ein zielartiger Satz fällt,
      // in den eigenen Worten der Person festhalten (Teil 21b). Überschreibt nur
      // bei neuem Treffer — eine manuelle Änderung bleibt sonst bestehen.
      if (pc?.route === "/dna" && lastUser) {
        const zielMatch = lastUser.match(/(ich (?:will|möchte|würde gerne|wünsche mir)[^.!?\n]{3,100})/i);
        if (zielMatch) nextPrefs.ziel = zielMatch[1].trim().slice(0, 160);
      }

      // Gesprächsverlauf: nur auf der DNA-Seite persistiert, damit das Gespräch
      // beim nächsten Besuch dort steht, wo man es verlassen hat (Teil 21a).
      if (body.persist_thread) {
        const existing = Array.isArray((memory.preferences as { dna_chat_verlauf?: unknown }).dna_chat_verlauf)
          ? (memory.preferences as { dna_chat_verlauf: { id: string; role: string; text: string; at: string }[] }).dna_chat_verlauf
          : [];
        const now = new Date().toISOString();
        const turn: { id: string; role: string; text: string; at: string }[] = [];
        if (lastUser) turn.push({ id: crypto.randomUUID(), role: "user", text: lastUser, at: now });
        turn.push({ id: crypto.randomUUID(), role: "assistant", text: reply, at: now });
        nextPrefs.dna_chat_verlauf = [...existing, ...turn].slice(-40);
      }

      await admin.from("user_memory").upsert({
        user_id,
        preferences: nextPrefs,
        facts: mergedFacts,
        updated_at: new Date().toISOString(),
      });
    }

    const provider = providerResult.provider;
    if (admin) {
      await admin.from("domain_events").insert({
        id: crypto.randomUUID(), type: "ai.response_logged",
        actor: user_id ? "user" : "anon",
        payload: { mode: "chat", provider, session_id, prompt: lastUser.slice(0, 400), reply: reply.slice(0, 800), ...(action ? { action: action.path } : {}) },
        schema_version: 1,
      });
    }
    const allCards = [...cards, ...trendCards].slice(0, 4);
    return new Response(JSON.stringify({ reply, cards: allCards, action, session_id, provider, tier, image_terms: imageTerms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir noch einmal, wonach dir ist.", cards: [], action: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
