// PAWN chat — persona: warm, concise, curious. One short question per reply.
// Writes an 'ai.taste_signal' domain event via service-role for each user turn.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SYSTEM = `Du bist PAWN, eine leise, warme und kuratierende Stimme.
Antworte auf Deutsch, in maximal 2 kurzen Sätzen.
Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?).
Erkläre nie Technik oder wie du funktionierst. Keine Floskeln. Nie aufdringlich.
Wenn du genug weißt, empfiehl 2-3 Stücke oder Designer aus dem Kontext mit kurzer Begründung.`;

type Msg = { role: "user" | "assistant" | "system"; content: string };

function detectWorld(t: string): "Mode" | "Interior" | "Kunst" | null {
  const s = t.toLowerCase();
  if (/mode|kleid|jacke|anzieh|outfit|hose|mantel/.test(s)) return "Mode";
  if (/interior|raum|wohn|möbel|moebel|lampe|leuchte|vase|spiegel/.test(s)) return "Interior";
  if (/kunst|bild|wand|malerei|skulptur|tapisserie|edition/.test(s)) return "Kunst";
  return null;
}

function detectMood(t: string): "ruhig" | "kante" | null {
  const s = t.toLowerCase();
  if (/ruhig|weich|leise|zurückhalt|zurueckhalt|still/.test(s)) return "ruhig";
  if (/spannung|kante|hart|edge|dunkel|scharf/.test(s)) return "kante";
  return null;
}

function fallback(messages: Msg[]): string {
  const turns = messages.filter((m) => m.role !== "system").length;
  const last = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  if (turns <= 1) return "Schön, dass du hier bist. Suchst du gerade eher etwas für dich zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?";
  const world = detectWorld(last);
  if (!world) return "Verstanden. Klingt das eher nach etwas Ruhigem und Weichem, oder darf es Spannung und Kante haben?";
  const mood = detectMood(last);
  if (mood === "ruhig") return `Dann würde ich dir in ${world} Lemaire und Toteme zeigen — beide arbeiten mit stiller Präzision. Magst du eher warme Naturtöne oder Grau in Grau?`;
  if (mood === "kante") return `Für ${world} mit Kante lohnen Rick Owens und 1017 ALYX 9SM. Beide sind kompromisslos. Soll es zum Tragen sofort sein oder ein Statement für einen Anlass?`;
  return `Alles klar, ${world}. Erzähl mir kurz: wofür, und wann?`;
}

async function callGateway(messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM }, ...messages],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function writeTasteSignal(payload: Record<string, unknown>) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key, { auth: { persistSession: false } });
    await admin.from("domain_events").insert({
      id: crypto.randomUUID(),
      type: "ai.taste_signal",
      actor: "anon",
      payload,
      schema_version: 1,
    });
  } catch { /* silent — never break chat */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json() as { messages: Msg[]; session_id?: string };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const session_id = body.session_id ?? null;
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Optional: extract user_id from JWT (Authorization header) without hard dependency.
    let user_id: string | null = null;
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (jwt) {
      try {
        const parts = jwt.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (typeof payload?.sub === "string" && payload.sub.length > 8) user_id = payload.sub;
        }
      } catch { /* ignore */ }
    }

    if (lastUser) {
      await writeTasteSignal({
        raw: lastUser,
        session_id,
        world: detectWorld(lastUser),
        mood: detectMood(lastUser),
        ...(user_id ? { user_id } : {}),
      });
    }

    const reply = (await callGateway(messages)) ?? fallback(messages);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir gern noch einmal, wonach dir ist." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
