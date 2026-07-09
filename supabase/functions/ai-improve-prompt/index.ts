// PAWN Meta: Prompt-Verbesserungs-Vorschlag.
// Admin schreibt eine Anweisung, wir kombinieren aktuellen Prompt + letzte 20 Antwort-Logs
// und lassen den Provider einen verbesserten Persona-Prompt entwerfen.
// Fallback (ohne Provider): strukturierte Merge-Vorlage.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")))?.sub ?? null;
  } catch { return null; }
}

async function callProvider(system: string, user: string): Promise<string | null> {
  const openai = Deno.env.get("OPENAI_API_KEY");
  if (openai) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openai}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (r.ok) { const d = await r.json(); return d.choices?.[0]?.message?.content ?? null; }
    } catch { /* ignore */ }
  }
  const lov = Deno.env.get("LOVABLE_API_KEY");
  if (lov) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": lov },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (r.ok) { const d = await r.json(); return d.choices?.[0]?.message?.content ?? null; }
    } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Admin check
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user_id);
    const isAdmin = ((roleRows ?? []) as { role: string }[]).some((r) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

    const body = await req.json() as { persona_key: string; current: string; instruction: string };
    if (!body.persona_key || !body.instruction) {
      return new Response(JSON.stringify({ error: "persona_key + instruction required" }), { status: 400, headers: corsHeaders });
    }

    const { data: logs } = await admin
      .from("domain_events")
      .select("payload")
      .eq("type", "ai.response_logged")
      .order("at", { ascending: false })
      .limit(20);
    const sampleReplies = ((logs ?? []) as { payload: { reply?: string } }[])
      .map((l) => l.payload?.reply)
      .filter(Boolean)
      .slice(0, 20)
      .join("\n---\n");

    const system = `Du bist Meta-Prompt-Editor für PAWN. Deine Aufgabe: einen deutschen System-Prompt so umformulieren, dass er präziser wird — bewahre den Ton, verändere nur was nötig ist. Antworte NUR mit dem neuen Prompt-Text, ohne Kommentar, ohne Markdown-Codeblock.`;
    const userPrompt = `AKTUELLER PROMPT (${body.persona_key}):
"""
${body.current || "(leer)"}
"""

ANWEISUNG DES ADMINS:
"""
${body.instruction}
"""

LETZTE ANTWORTEN AUS DEM LOG (als Anhaltspunkt für den bisherigen Ton):
${sampleReplies || "(keine)"}

Gib jetzt den neuen System-Prompt zurück.`;

    let suggestion = await callProvider(system, userPrompt);
    if (!suggestion) {
      suggestion = [
        body.current?.trim() || "Du bist PAWN.",
        "",
        `Anpassung (${new Date().toISOString().slice(0, 10)}): ${body.instruction.trim()}`,
      ].join("\n");
    }

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
