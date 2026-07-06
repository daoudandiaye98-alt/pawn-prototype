// PAWN chat — persona: warm, concise, curious. One short question per reply.
// Uses Lovable AI Gateway when LOVABLE_API_KEY is set, otherwise falls back
// to a small rule-based conversation tree. Never explains its own tech.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `Du bist PAWN, eine leise, warme und kuratierende Stimme. 
Antworte auf Deutsch, in maximal 2 kurzen Sätzen.
Stelle EINE konkrete, warme Frage pro Antwort (Anlass? Raum? eher ruhig oder Spannung? Mode, Interior oder Kunst?).
Erkläre nie Technik oder wie du funktionierst. Keine Floskeln. Nie aufdringlich.
Wenn du genug weißt, empfiehl 2-3 Stücke oder Designer aus dem Kontext mit kurzer Begründung.`;

type Msg = { role: "user" | "assistant" | "system"; content: string };

function fallback(messages: Msg[]): string {
  const turns = messages.filter((m) => m.role !== "system").length;
  const last = messages.filter((m) => m.role === "user").pop()?.content?.toLowerCase() ?? "";
  if (turns <= 1) {
    return "Schön, dass du hier bist. Suchst du gerade eher etwas für dich zum Anziehen, für einen Raum, oder eine Arbeit für die Wand?";
  }
  const world = /mode|kleid|jacke|anzieh|outfit/.test(last)
    ? "Mode"
    : /interior|raum|wohn|möbel|lampe/.test(last)
      ? "Interior"
      : /kunst|bild|wand|malerei|skulptur/.test(last)
        ? "Kunst"
        : null;
  if (!world) {
    return "Verstanden. Klingt das eher nach etwas Ruhigem und Weichem, oder darf es Spannung und Kante haben?";
  }
  if (/ruhig|weich|leise|zurückhalt/.test(last)) {
    return `Dann würde ich dir in ${world} Lemaire und Toteme zeigen — beide arbeiten mit stiller Präzision. Magst du eher warme Naturtöne oder Grau in Grau?`;
  }
  if (/spannung|kante|hart|edge|dunkel/.test(last)) {
    return `Für ${world} mit Kante lohnen Rick Owens und 1017 ALYX 9SM. Beide sind kompromisslos. Soll es zum Tragen sofort sein oder ein Statement für einen Anlass?`;
  }
  return `Alles klar, ${world}. Erzähl mir kurz: wofür, und wann?`;
}

async function callGateway(messages: Msg[]): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM }, ...messages],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { messages } = (await req.json()) as { messages: Msg[] };
    const safeMessages = Array.isArray(messages) ? messages.slice(-20) : [];
    const reply = (await callGateway(safeMessages)) ?? fallback(safeMessages);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ reply: "Kurz, ich sammle einen Gedanken. Sag mir gern noch einmal, wonach dir ist." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
