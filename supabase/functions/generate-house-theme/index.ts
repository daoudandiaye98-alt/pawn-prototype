/**
 * Teil 15a: Vibecoding statt Baukasten. Der Designer beschreibt seine Welt in eigenen Worten
 * ("ein verlassenes Hallenbad bei Neonlicht") — PAWN übersetzt das zusammen mit Brand-DNA und
 * Kulturströmungen in ein vollständiges Haus-Thema, statt über Regler. Jede Fassung wird als
 * neue Version gespeichert (speicherbar, vergleichbar, zurücknehmbar über action:'revert').
 *
 * Technische Leitplanken (nicht ästhetisch): Mindestkontrast wird automatisch geprüft und,
 * wenn nötig, sanft korrigiert (nur die Helligkeit der Vordergrund-/Akzentfarbe wird
 * verschoben, nie Ton/Farbwahl selbst) — mit sichtbarem Hinweis in guardrail_notes.
 *
 * Body: { designer_id?: string, action?: 'generate'|'revert'|'manual', prompt?: string,
 *         manual?: Partial<ThemeFields>, revert_to_version?: number }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";

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
function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

const TYPOGRAFIE = ["editorial", "zart", "archiv", "warm"] as const;
const FLAECHENRHYTHMUS = ["eng", "ruhig", "luftig", "episch"] as const;
const KANTENHAERTE = ["hart", "weich", "rund"] as const;
const BEWEGUNGSCHARAKTER = ["ruhig", "gestaffelt", "ausdrucksstark"] as const;
const TEXTUR = ["keine", "papier", "leinen", "rauschen"] as const;
const UEBERGANGSART = ["fade", "iris", "schnitt", "wisch"] as const;
const ZUVERSICHT = ["niedrig", "mittel", "hoch"] as const;

interface Farbwelt { bg: string; fg: string; accent: string; muted: string }
interface ThemeFields {
  name?: string;
  farbwelt: Farbwelt;
  typografie: string;
  flaechenrhythmus: string;
  kantenhaerte: string;
  bewegungscharakter: string;
  hintergrundtextur: { typ: string; media_asset_id?: string | null };
  uebergangsart: string;
  zuversicht: string;
}

const DEFAULT_FARBWELT: Farbwelt = { bg: "#FFFFFF", fg: "#000000", accent: "#000000", muted: "#F2F2F2" };

function pick<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
  return typeof val === "string" && (allowed as readonly string[]).includes(val) ? (val as T) : fallback;
}
function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}
function cleanFarbwelt(v: unknown): Farbwelt {
  const f = (v ?? {}) as Partial<Farbwelt>;
  return {
    bg: isHex(f.bg) ? f.bg! : DEFAULT_FARBWELT.bg,
    fg: isHex(f.fg) ? f.fg! : DEFAULT_FARBWELT.fg,
    accent: isHex(f.accent) ? f.accent! : DEFAULT_FARBWELT.accent,
    muted: isHex(f.muted) ? f.muted! : DEFAULT_FARBWELT.muted,
  };
}
function cleanFields(raw: Record<string, unknown>): ThemeFields {
  return {
    name: typeof raw.name === "string" ? raw.name.slice(0, 60) : undefined,
    farbwelt: cleanFarbwelt(raw.farbwelt),
    typografie: pick(raw.typografie, TYPOGRAFIE, "editorial"),
    flaechenrhythmus: pick(raw.flaechenrhythmus, FLAECHENRHYTHMUS, "ruhig"),
    kantenhaerte: pick(raw.kantenhaerte, KANTENHAERTE, "hart"),
    bewegungscharakter: pick(raw.bewegungscharakter, BEWEGUNGSCHARAKTER, "ruhig"),
    hintergrundtextur: { typ: pick((raw.hintergrundtextur as { typ?: unknown } | undefined)?.typ, TEXTUR, "keine") },
    uebergangsart: pick(raw.uebergangsart, UEBERGANGSART, "fade"),
    zuversicht: pick(raw.zuversicht, ZUVERSICHT, "mittel"),
  };
}

// --- WCAG-Kontrast: nur die Helligkeit wird sanft verschoben, nie Farbton/Sättigung. ---
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(hexA: string, hexB: string): number {
  const la = relLuminance(hexToRgb(hexA)), lb = relLuminance(hexToRgb(hexB));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3) * 255, hue2rgb(h) * 255, hue2rgb(h - 1 / 3) * 255];
}
/** Verschiebt nur die Helligkeit von `hex` (Richtung, die den Kontrast zu `against` erhöht), bis minRatio erreicht ist. */
function ensureContrast(against: string, hex: string, minRatio: number): { hex: string; changed: boolean } {
  let ratio = contrastRatio(against, hex);
  if (ratio >= minRatio) return { hex, changed: false };
  const hsl = rgbToHsl(hexToRgb(hex));
  const bgIsLight = relLuminance(hexToRgb(against)) > 0.5;
  const dir = bgIsLight ? -1 : 1; // gegen helle Fläche dunkler machen, gegen dunkle heller
  let l = hsl[2];
  for (let i = 0; i < 40 && ratio < minRatio; i++) {
    l = Math.max(0, Math.min(1, l + dir * 0.025));
    const candidate = rgbToHex(hslToRgb([hsl[0], hsl[1], l]));
    ratio = contrastRatio(against, candidate);
    hex = candidate;
    if (l <= 0 || l >= 1) break;
  }
  return { hex, changed: true };
}

interface GuardrailNote { feld: string; von: string; zu: string; grund: string }
function applyGuardrails(fields: ThemeFields): { fields: ThemeFields; notes: GuardrailNote[] } {
  const notes: GuardrailNote[] = [];
  const bg = fields.farbwelt.bg;
  const fgFix = ensureContrast(bg, fields.farbwelt.fg, 4.5);
  if (fgFix.changed) {
    notes.push({ feld: "farbwelt.fg", von: fields.farbwelt.fg, zu: fgFix.hex, grund: "Mindestkontrast für Lesbarkeit (WCAG AA, 4.5:1) zum Hintergrund gewahrt." });
  }
  const accentFix = ensureContrast(bg, fields.farbwelt.accent, 3);
  if (accentFix.changed) {
    notes.push({ feld: "farbwelt.accent", von: fields.farbwelt.accent, zu: accentFix.hex, grund: "Mindestkontrast für Bedienelemente (WCAG AA, 3:1) zum Hintergrund gewahrt." });
  }
  if (fields.bewegungscharakter === "ausdrucksstark") {
    notes.push({ feld: "bewegungscharakter", von: "ausdrucksstark", zu: "ausdrucksstark", grund: "Wird bei reduzierter-Bewegung-Einstellung des Betrachters automatisch ruhig dargestellt." });
  }
  return { fields: { ...fields, farbwelt: { ...fields.farbwelt, fg: fgFix.hex, accent: accentFix.hex } }, notes };
}

const SYSTEM_PROMPT = `Du übersetzt die in eigenen Worten beschriebene Welt eines unabhängigen Designers bei PAWN in ein strukturiertes Haus-Thema für dessen eigene Hausseite (nicht für die restliche, streng schwarz-weiße Plattform).

Antworte NUR mit einem JSON-Objekt, kein weiterer Text, exakt in dieser Form:
{
  "name": "Kurzer Name des Themas (2-5 Wörter, Deutsch)",
  "farbwelt": {"bg": "#RRGGBB", "fg": "#RRGGBB", "accent": "#RRGGBB", "muted": "#RRGGBB"},
  "typografie": "editorial" | "zart" | "archiv" | "warm",
  "flaechenrhythmus": "eng" | "ruhig" | "luftig" | "episch",
  "kantenhaerte": "hart" | "weich" | "rund",
  "bewegungscharakter": "ruhig" | "gestaffelt" | "ausdrucksstark",
  "hintergrundtextur": {"typ": "keine" | "papier" | "leinen" | "rauschen"},
  "uebergangsart": "fade" | "iris" | "schnitt" | "wisch",
  "zuversicht": "niedrig" | "mittel" | "hoch"
}

Bedeutung der Felder: typografie ist eine Paarung (editorial=Playfair Display/Inter, zart=Cormorant Garamond/Inter, archiv=Mono/Inter, warm=Cormorant Garamond/Georgia). flaechenrhythmus ist der Abstands-/Weißraum-Charakter zwischen Abschnitten. kantenhaerte ist die Rundung von Bildern/Karten (hart=keine Rundung, weich=leichte Rundung, rund=deutliche Rundung). bewegungscharakter ist, wie ruhig/inszeniert sich Übergänge beim Scrollen anfühlen. hintergrundtextur ist eine sehr dezente, rein CSS-erzeugte Fläche hinter dem Inhalt. uebergangsart ist der Charakter des kurzen Übergangs, wenn man von der Halle in dieses Haus wechselt. zuversicht ist deine eigene Einschätzung, wie sicher dieses Thema zur Beschreibung passt.

Farbwahl ist völlig frei (auch kräftige Farben, auch Nicht-Schwarz-Weiß) — das ist ausdrücklich gewünscht, dies ist der persönliche Raum des Designers. Wähle bg/fg mit ausreichendem Kontrast zueinander (du musst nicht exakt rechnen, ein grober sinnvoller Unterschied genügt, technische Prüfung erfolgt danach automatisch).`;

async function claudeTheme(apiKey: string, userPrompt: string): Promise<{ fields: Record<string, unknown> | null; tokens: number }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) return { fields: null, tokens: 0 };
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n");
    const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { fields: extractJson(text), tokens };
  } catch {
    return { fields: null, tokens: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ error: "auth_required" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin: SupabaseClient = createClient(url, svc, { auth: { persistSession: false } });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user_id, _role: "admin" });

    const body = await req.json().catch(() => ({})) as {
      designer_id?: string; action?: "generate" | "revert" | "manual";
      prompt?: string; manual?: Record<string, unknown>; revert_to_version?: number;
    };
    const action = body.action ?? "generate";

    let designerRow: { id: string; user_id: string; brand_name: string; brand_dna: Record<string, unknown> | null } | null = null;
    if (isAdmin && body.designer_id) {
      const { data } = await admin.from("designers").select("id, user_id, brand_name, brand_dna").eq("id", body.designer_id).maybeSingle();
      designerRow = data as typeof designerRow;
    } else {
      const { data } = await admin.from("designers").select("id, user_id, brand_name, brand_dna").eq("user_id", user_id).maybeSingle();
      designerRow = data as typeof designerRow;
    }
    if (!designerRow) return json({ error: "not_found", message: "Kein Designer-Profil gefunden." }, 200);
    if (!isAdmin && designerRow.user_id !== user_id) return json({ error: "forbidden" }, 403);

    const { data: current } = await admin.from("house_themes" as never).select("*").eq("designer_id", designerRow.id).eq("is_current", true).maybeSingle();
    const currentTheme = current as (ThemeFields & { version: number }) | null;

    if (action === "revert") {
      const targetVersion = body.revert_to_version;
      if (!targetVersion) return json({ error: "revert_to_version_required" }, 400);
      const { data: target } = await admin.from("house_themes" as never).select("id").eq("designer_id", designerRow.id).eq("version", targetVersion).maybeSingle();
      if (!target) return json({ error: "version_not_found", message: "Diese Fassung existiert nicht." }, 200);
      await admin.from("house_themes" as never).update({ is_current: false } as never).eq("designer_id", designerRow.id).eq("is_current", true);
      await admin.from("house_themes" as never).update({ is_current: true } as never).eq("id", (target as { id: string }).id);
      const { data: theme } = await admin.from("house_themes" as never).select("*").eq("id", (target as { id: string }).id).maybeSingle();
      return json({ ok: true, theme });
    }

    const { data: maxRow } = await admin.from("house_themes" as never).select("version").eq("designer_id", designerRow.id).order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = ((maxRow as { version?: number } | null)?.version ?? 0) + 1;

    let fields: ThemeFields;
    let quelle: string;
    let tokens = 0;
    let inputPrompt: string | null = null;

    if (action === "manual") {
      const base = currentTheme ?? cleanFields({});
      fields = cleanFields({ ...base, ...(body.manual ?? {}), farbwelt: { ...base.farbwelt, ...(body.manual?.farbwelt as Record<string, unknown> ?? {}) } });
      quelle = "manuell_verfeinert";
    } else {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) return json({ error: "not_configured", message: "Das Vibecoding ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt) — probier es später erneut, oder stelle das Thema manuell zusammen." }, 200);

      const worlds = Object.keys((designerRow.brand_dna as { worlds?: Record<string, number> } | null)?.worlds ?? {});
      const signals = ((designerRow.brand_dna as { signals?: string[] } | null)?.signals ?? []).slice(0, 8);
      let currents: { name: string; visuelle_merkmale: unknown }[] = [];
      if (worlds.length > 0) {
        const { data: cc } = await admin.from("cultural_currents" as never).select("name, visuelle_merkmale").overlaps("worlds", worlds).limit(3);
        currents = (cc ?? []) as typeof currents;
      }
      const currentsText = currents.length > 0
        ? `\nNahe Kulturströmungen: ${currents.map((c) => `${c.name} (${JSON.stringify(c.visuelle_merkmale)})`).join("; ")}`
        : "";
      const dnaText = `Haus: ${designerRow.brand_name}\nWelten: ${worlds.join(", ") || "unbekannt"}\nStil-Signale: ${signals.join(", ") || "unbekannt"}${currentsText}`;

      let userPrompt: string;
      const promptText = String(body.prompt ?? "").trim();
      if (promptText) {
        inputPrompt = promptText;
        quelle = "designer_beschrieben";
        userPrompt = currentTheme
          ? `${dnaText}\n\nBisheriges Thema: ${JSON.stringify(currentTheme)}\n\nDer Designer möchte diese Richtung: "${promptText}". Verfeinere das bisherige Thema entsprechend — übernimm, was nicht widerspricht, ändere gezielt, was die Beschreibung verlangt.`
          : `${dnaText}\n\nDer Designer beschreibt seine Welt so: "${promptText}". Entwirf ein vollständiges Thema danach.`;
      } else {
        quelle = "dna_destilliert";
        userPrompt = `${dnaText}\n\nNoch keine eigene Beschreibung vorhanden. Schlage aus der Brand-DNA und den Kulturströmungen ein passendes, stimmiges Thema vor.`;
      }

      const { fields: raw, tokens: t } = await claudeTheme(apiKey, userPrompt);
      tokens = t;
      if (!raw) return json({ error: "generation_failed", message: "Das Thema konnte gerade nicht erzeugt werden — versuch es gleich noch einmal." }, 200);
      fields = cleanFields(raw);
    }

    const { fields: guarded, notes } = applyGuardrails(fields);

    await admin.from("house_themes" as never).update({ is_current: false } as never).eq("designer_id", designerRow.id).eq("is_current", true);
    const { data: inserted, error: insErr } = await admin.from("house_themes" as never).insert({
      designer_id: designerRow.id,
      version: nextVersion,
      is_current: true,
      name: guarded.name ?? null,
      input_prompt: inputPrompt,
      farbwelt: guarded.farbwelt,
      typografie: guarded.typografie,
      flaechenrhythmus: guarded.flaechenrhythmus,
      kantenhaerte: guarded.kantenhaerte,
      bewegungscharakter: guarded.bewegungscharakter,
      hintergrundtextur: guarded.hintergrundtextur,
      uebergangsart: guarded.uebergangsart,
      zuversicht: guarded.zuversicht,
      quelle,
      guardrail_notes: notes,
    } as never).select("*").maybeSingle();
    if (insErr) return json({ error: "save_failed", message: insErr.message }, 200);

    return json({ ok: true, theme: inserted, guardrail_notes: notes, tokens });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
