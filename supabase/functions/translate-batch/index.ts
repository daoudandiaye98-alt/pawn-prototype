// translate-batch — übersetzt deutsche Sätze einmalig ins Englische und merkt sie sich.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MODEL = "openai/gpt-5.6-sol";

function textHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  let h2 = 52711;
  for (let i = input.length - 1; i >= 0; i--) h2 = ((h2 << 5) + h2 + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

const SYSTEM = `Du übersetzt Oberflächentexte eines kuratierten Mode-Marktplatzes (PAWN) vom Deutschen ins Englische.
Regeln:
- Ton: editorial, knapp, ruhig — wie ein Modehaus, nicht wie Werbung.
- Länge möglichst ähnlich zum Original (UI-Platz).
- Eigennamen, Marken, "PAWN", Zahlen, Preise, E-Mails, URLs unverändert lassen.
- Keine Erklärungen, keine Zusätze, keine Anführungszeichen hinzufügen.
- Interpunktion und Sonderzeichen (·, —, …) beibehalten.
Antworte ausschließlich als JSON-Objekt der Form {"0":"…","1":"…"} mit denselben Indizes wie die Eingabe.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.texts) ? body.texts : [];
    const texts: string[] = Array.from(
      new Set(raw.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 1 && t.length <= 600).map((t: string) => t.replace(/\s+/g, " ").trim())),
    ).slice(0, 60);
    if (texts.length === 0) return json({ translations: {} });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // 1) Gedächtnis zuerst
    const hashes = texts.map(textHash);
    const { data: known } = await supabase.from("ui_translations").select("hash, en").in("hash", hashes);
    const translations: Record<string, string> = {};
    const byHash = new Map((known ?? []).map((r: { hash: string; en: string }) => [r.hash, r.en]));
    const missing: string[] = [];
    texts.forEach((t, i) => {
      const hit = byHash.get(hashes[i]);
      if (hit) translations[t] = hit;
      else missing.push(t);
    });
    if (missing.length === 0) return json({ translations });

    // 2) Lücken übersetzen
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ translations, error: "LOVABLE_API_KEY fehlt" });

    const payload = Object.fromEntries(missing.map((t, i) => [String(i), t]));
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });

    if (res.status === 429) return json({ translations, error: "rate_limit" }, 200);
    if (res.status === 402) return json({ translations, error: "credits_exhausted" }, 200);
    if (!res.ok) return json({ translations, error: `gateway_${res.status}` }, 200);

    const out = await res.json();
    const content: string = out?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, string> = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const rows: Array<{ hash: string; de: string; en: string }> = [];
    missing.forEach((de, i) => {
      const en = parsed[String(i)];
      if (typeof en === "string" && en.trim()) {
        translations[de] = en.trim();
        rows.push({ hash: textHash(de), de, en: en.trim() });
      }
    });
    if (rows.length > 0) await supabase.from("ui_translations").upsert(rows, { onConflict: "hash" });

    return json({ translations });
  } catch (e) {
    return json({ translations: {}, error: String(e) }, 200);
  }
});
