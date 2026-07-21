// PAWN Jarvis — die interne KI-Instanz. Admin-only. Schreibt jarvis_runs + jarvis_reports.
// Fehler landen nie als 500 — immer 200 mit einer klaren Meldung im Body.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-4-5";
const MAX_TOOL_TURNS = 6;
// Grobe Schätzung, kein Ersatz für die echte Abrechnung.
const PRICE_PER_MTOK_INPUT = 3;
const PRICE_PER_MTOK_OUTPUT = 15;

const PAWN_ACTIONS = new Set([
  "set_content", "set_image", "upsert_ontology_term", "merge_ontology_terms",
  "set_config", "create_campaign_proposal", "send_notification", "recompute_trends", "set_plan",
]);

const DEFAULT_SYSTEM_PROMPT = `Du bist Jarvis, die interne KI-Instanz von PAWN (pawn.vision) — einem kuratierten Marktplatz für unabhängige Designer aus Mode, Interior und Kunst.

PAWN verkauft Sichtbarkeit, nicht KI-Videos. Erwähne Videos oder KI-generierte Clips nie als Produkt oder Verkaufsargument.

Du arbeitest ausschließlich für Daouda, den Gründer. Antworte in klarem, einfachem Deutsch — er ist kein Entwickler. Sei knapp, konkret und ehrlich. Nutze die Werkzeuge, die dir zur Verfügung stehen, um echte Zahlen aus der Plattform zu holen, bevor du Vermutungen anstellst.`;

type Mode = "morgenbericht" | "wochenbericht" | "recherche" | "befehl";

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const [, p] = auth.slice(7).split(".");
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")))?.sub ?? null;
  } catch { return null; }
}
async function requireAdmin(admin: SupabaseClient, user_id: string | null): Promise<boolean> {
  if (!user_id) return false;
  const { data } = await admin.from("user_roles").select("role").eq("user_id", user_id).eq("role", "admin").maybeSingle();
  return !!data;
}

async function loadSystemPrompt(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin.from("ai_config").select("value").eq("key", "persona_jarvis").maybeSingle();
    const v = data?.value as { system_prompt?: string } | undefined;
    if (v?.system_prompt?.trim()) return v.system_prompt.trim();
  } catch { /* ignore, use default */ }
  return DEFAULT_SYSTEM_PROMPT;
}

/** query_pawn — liest zusammengefasste Kennzahlen aus der DB. Nur lesend. */
async function queryPawn(admin: SupabaseClient, input: { topic?: string }): Promise<Record<string, unknown>> {
  const topic = String(input?.topic ?? "all");
  const out: Record<string, unknown> = {};

  if (topic === "all" || topic === "leads") {
    const { data } = await admin.from("acquisition_leads").select("status");
    const counts: Record<string, number> = {};
    for (const r of (data ?? []) as { status: string }[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
    out.leads_by_status = counts;
  }
  if (topic === "all" || topic === "orders") {
    const { count: open } = await admin.from("orders").select("id", { count: "exact", head: true })
      .eq("status", "paid").neq("fulfillment_status", "delivered");
    const { count: paid } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid");
    out.orders = { offen: open ?? 0, bezahlt_gesamt: paid ?? 0 };
  }
  if (topic === "all" || topic === "designers") {
    const { count: active } = await admin.from("designers").select("id", { count: "exact", head: true }).eq("status", "active");
    const { count: pending } = await admin.from("designer_applications").select("id", { count: "exact", head: true })
      .in("status", ["submitted", "in_review"]);
    out.designers = { aktiv: active ?? 0, bewerbungen_offen: pending ?? 0 };
  }
  if (topic === "all" || topic === "products") {
    const { count: published } = await admin.from("products").select("id", { count: "exact", head: true }).eq("status", "published");
    out.products = { veroeffentlicht: published ?? 0 };
  }
  if (topic === "all" || topic === "events") {
    const { data } = await admin.from("domain_events").select("type, at").order("at", { ascending: false }).limit(10);
    out.letzte_events = data ?? [];
  }
  if (topic === "all" || topic === "trends") {
    const { data, error } = await admin.rpc("trend_momentum", { _world: "Mode" });
    out.trend_momentum_mode = error ? null : (data ?? []).slice(0, 5);
  }
  return out;
}

/** pawn_action — ruft die bestehende pawn-actions-Function mit der echten Admin-Session auf. Nur deren Whitelist. */
async function callPawnAction(
  asCaller: SupabaseClient,
  input: { action?: string; params?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const action = String(input?.action ?? "");
  if (!PAWN_ACTIONS.has(action)) {
    return { ok: false, error: `Aktion '${action}' ist nicht in der Whitelist von pawn-actions.` };
  }
  const { data, error } = await asCaller.functions.invoke("pawn-actions", {
    body: { mode: "execute", action, params: input?.params ?? {}, source: "system" },
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "keine Antwort" }) as Record<string, unknown>;
}

const TOOLS = [
  { type: "web_search_20250305", name: "web_search" },
  {
    name: "query_pawn",
    description: "Liest zusammengefasste, echte Kennzahlen aus der PAWN-Datenbank (Leads nach Status, offene Bestellungen, Designer, Produkte, letzte Ereignisse, Trend-Momentum). Nur lesend.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["all", "leads", "orders", "designers", "products", "events", "trends"],
          description: "Welcher Ausschnitt der Kennzahlen. 'all' für alles.",
        },
      },
    },
  },
  {
    name: "pawn_action",
    description: "Führt eine bereits bestehende, whitelisted Admin-Aktion aus (über die pawn-actions-Function). Erlaubte Aktionen: set_content, set_image, upsert_ontology_term, merge_ontology_terms, set_config, create_campaign_proposal, send_notification, recompute_trends, set_plan. Keine neuen Aktionen möglich.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Name der Aktion, muss aus der Whitelist stammen." },
        params: { type: "object", description: "Parameter für die Aktion, je nach action-Typ." },
      },
      required: ["action"],
    },
  },
];

interface AnthropicResponse {
  content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function callClaude(
  apiKey: string, system: string, messages: unknown[],
): Promise<{ data: AnthropicResponse | null; error: string | null }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system, tools: TOOLS, messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { data: null, error: `Anthropic ${res.status}: ${body.slice(0, 300)}` };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

async function runAgentLoop(
  apiKey: string, admin: SupabaseClient, asCaller: SupabaseClient, system: string, userMessage: string,
): Promise<{ text: string; tokensUsed: number; error: string | null }> {
  const messages: unknown[] = [{ role: "user", content: userMessage }];
  let tokensUsed = 0;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const { data, error } = await callClaude(apiKey, system, messages);
    if (error || !data) return { text: "", tokensUsed, error: error ?? "keine Antwort von Claude" };
    tokensUsed += (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    if (data.stop_reason !== "tool_use") {
      const text = data.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
      return { text, tokensUsed, error: null };
    }

    messages.push({ role: "assistant", content: data.content });
    const toolResults: Array<{ type: string; tool_use_id: string; content: string; is_error?: boolean }> = [];
    for (const block of data.content) {
      if (block.type !== "tool_use" || !block.id || !block.name) continue;
      try {
        let result: unknown;
        if (block.name === "query_pawn") result = await queryPawn(admin, block.input ?? {});
        else if (block.name === "pawn_action") result = await callPawnAction(asCaller, block.input ?? {});
        else result = { error: `unbekanntes Werkzeug: ${block.name}` };
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (e) {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: (e as Error).message, is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }
  return { text: "", tokensUsed, error: "Maximale Anzahl an Werkzeug-Aufrufen erreicht." };
}

function promptForMode(mode: Mode, prompt?: string): { userMessage: string; reportKind: string; title: string } {
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  if (mode === "morgenbericht") {
    return {
      userMessage: `Heute ist ${today}. Erstelle einen kurzen Morgenbericht für Daouda: Nutze query_pawn, um dir ein Bild vom aktuellen Stand zu machen (Leads, Bestellungen, Designer, Produkte, letzte Ereignisse, Trends). Fasse in einfachem Deutsch zusammen, was seit gestern wichtig ist und was heute die naheliegendste nächste Handlung wäre. Maximal 200 Wörter.`,
      reportKind: "morgen", title: `Morgenbericht · ${today}`,
    };
  }
  if (mode === "wochenbericht") {
    return {
      userMessage: `Heute ist ${today}. Erstelle einen Wochenbericht für Daouda: Nutze query_pawn für den aktuellen Stand über alle Bereiche. Fasse zusammen, wo PAWN diese Woche steht, was sich verändert hat, und gib eine ehrliche Einschätzung, worauf sich Daouda in der kommenden Woche konzentrieren sollte. Maximal 350 Wörter.`,
      reportKind: "woche", title: `Wochenbericht · ${today}`,
    };
  }
  if (mode === "recherche") {
    const topic = (prompt ?? "").trim() || "aktuelle Trends für unabhängige Designer";
    return {
      userMessage: `Recherchiere mit web_search zu folgendem Thema für PAWN (kuratierter Marktplatz für unabhängige Designer aus Mode, Interior, Kunst): "${topic}". Fasse die wichtigsten, verlässlichen Erkenntnisse in einfachem Deutsch zusammen und ordne sie kurz ein, was das für PAWN bedeuten könnte.`,
      reportKind: "recherche", title: `Recherche · ${topic.slice(0, 80)}`,
    };
  }
  const cmd = (prompt ?? "").trim();
  return {
    userMessage: cmd || "Was soll ich tun? Schau dir mit query_pawn den aktuellen Stand an und schlage den nächsten sinnvollen Schritt vor.",
    reportKind: "antwort", title: cmd ? cmd.slice(0, 80) : "Antwort",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let runId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    const user_id = jwtSub(authHeader);
    if (!(await requireAdmin(admin, user_id))) return ok({ ok: false, error: "forbidden" });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return ok({ ok: false, error: "ANTHROPIC_API_KEY fehlt. Bitte in den Projekt-Secrets hinterlegen." });

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? "") as Mode;
    if (!["morgenbericht", "wochenbericht", "recherche", "befehl"].includes(mode)) {
      return ok({ ok: false, error: "mode muss morgenbericht, wochenbericht, recherche oder befehl sein." });
    }
    const trigger = body.trigger === "cron" ? "cron" : "manual";
    const prompt = typeof body.prompt === "string" ? body.prompt : undefined;

    const { data: runRow } = await admin.from("jarvis_runs").insert({ trigger, status: "running" }).select("id").single();
    runId = (runRow as { id: string } | null)?.id ?? null;

    const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader! } } });
    const system = await loadSystemPrompt(admin);
    const { userMessage, reportKind, title } = promptForMode(mode, prompt);

    const { text, tokensUsed, error } = await runAgentLoop(apiKey, admin, asCaller, system, userMessage);
    const costEstimate = (tokensUsed / 1_000_000) * ((PRICE_PER_MTOK_INPUT + PRICE_PER_MTOK_OUTPUT) / 2);

    if (error) {
      if (runId) await admin.from("jarvis_runs").update({
        finished_at: new Date().toISOString(), status: "failed", error, tokens_used: tokensUsed, cost_estimate: costEstimate,
      }).eq("id", runId);
      return ok({ ok: false, error, run_id: runId });
    }

    const { data: reportRow } = await admin.from("jarvis_reports").insert({
      kind: reportKind, title, body: text || "Keine Antwort erhalten.", data: { mode, prompt: prompt ?? null },
    }).select("id, kind, title, body, created_at").single();

    if (runId) await admin.from("jarvis_runs").update({
      finished_at: new Date().toISOString(), status: "done",
      summary: title, tokens_used: tokensUsed, cost_estimate: costEstimate,
    }).eq("id", runId);

    return ok({ ok: true, run_id: runId, report: reportRow });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    if (runId) {
      await admin.from("jarvis_runs").update({
        finished_at: new Date().toISOString(), status: "failed", error: message,
      }).eq("id", runId).catch(() => {});
    }
    return ok({ ok: false, error: message, run_id: runId });
  }
});
