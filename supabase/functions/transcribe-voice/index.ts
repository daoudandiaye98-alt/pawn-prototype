/**
 * PART 51 Teil B (Zug 1 "Zeigen"): Sprachaufnahme → Text. Nimmt eine kurze Audio-Aufnahme
 * (base64) entgegen, transkribiert sie über OpenAI Whisper und glättet das Ergebnis mit einem
 * kurzen Claude-Durchgang zu 2-3 klaren Sätzen (aus gesprochenen Fragmenten wird lesbarer Text,
 * ohne den Inhalt zu erfinden). Scheitert die Aufnahme oder ist keine KI verfügbar: ok:false mit
 * Klartext, HTTP 200 — das Formular fällt dann auf die drei Antipp-Fragen zurück (nie ein
 * Pflicht-Textfeld, siehe Regel 1 des PART-51-Auftrags).
 *
 * Body: { audio_base64: string, mime_type?: string }
 * Response: { ok, text?, error?, message? }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function cleanUp(raw: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || !raw.trim()) return raw.trim();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 300,
        system: `Du glättest eine kurze gesprochene Selbstvorstellung einer unabhängigen Künstlerin für ihre neue PAWN-Hausseite. Aus gesprochenen Fragmenten, Versprechern und Füllwörtern machst du 2-3 klare, zusammenhängende Sätze auf Deutsch — ihre eigenen Worte, nur lesbar gemacht. Erfinde nichts, was nicht gesagt wurde. Antworte NUR mit dem geglätteten Text, ohne Anführungszeichen oder Kommentar.`,
        messages: [{ role: "user", content: raw }],
      }),
    });
    if (!res.ok) return raw.trim();
    const data = await res.json();
    const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim();
    return text || raw.trim();
  } catch {
    return raw.trim();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user_id = jwtSub(req.headers.get("Authorization"));
    if (!user_id) return json({ ok: false, error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as { audio_base64?: string; mime_type?: string };
    if (!body.audio_base64) return json({ ok: false, error: "audio_required" }, 400);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json({ ok: false, error: "not_configured", message: "Die Aufnahme lässt sich gerade nicht verarbeiten — beantworte stattdessen die kurzen Fragen." }, 200);
    }

    const bytes = base64ToBytes(body.audio_base64);
    const mime = body.mime_type ?? "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : "webm";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mime }), `aufnahme.${ext}`);
    form.append("model", "whisper-1");

    let rawText = "";
    try {
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });
      if (!res.ok) {
        return json({ ok: false, error: "transcribe_failed", message: "Die Aufnahme ließ sich nicht verarbeiten — beantworte stattdessen die kurzen Fragen." }, 200);
      }
      const data = await res.json();
      rawText = typeof data.text === "string" ? data.text : "";
    } catch {
      return json({ ok: false, error: "transcribe_failed", message: "Die Aufnahme ließ sich nicht verarbeiten — beantworte stattdessen die kurzen Fragen." }, 200);
    }

    if (!rawText.trim()) {
      return json({ ok: false, error: "empty", message: "Da war nichts zu hören — versuch es nochmal oder beantworte die kurzen Fragen." }, 200);
    }

    const text = await cleanUp(rawText);
    return json({ ok: true, text }, 200);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
