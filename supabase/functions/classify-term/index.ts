// PAWN classify-term — turn unknown tags into ontology terms, with dedup via synonyms.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface Req { term: string; world?: string }
interface Classification { canonical: string; kind: string; world: string[]; synonyms: string[]; duplicate_of?: string }

async function classifyWithOpenAI(term: string, world: string, existingTerms: string[]): Promise<Classification | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const sample = existingTerms.slice(0, 200).join(", ");
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Du klassifizierst Mode-Ontologie-Terme. Antworte NUR mit JSON: {canonical, kind (material|silhouette|color|mood|era|attribute), world (Array aus Mode/Interior/Kunst), synonyms (2-3), duplicate_of?}. Wenn der Term semantisch identisch mit einem existierenden Term ist, setze duplicate_of. Deutsch." },
          { role: "user", content: `Term: "${term}"\nKontext-Welt: ${world}\nExistierende Terme (Auszug): ${sample}` },
        ],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const raw = d.choices?.[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as Classification;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Req;
    const term = String(body.term ?? "").toLowerCase().trim();
    const world = String(body.world ?? "Mode");
    if (!term || term.length < 2) return new Response(JSON.stringify({ skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // Already known (as term or synonym)?
    const { data: existing } = await admin.from("fashion_ontology").select("term, synonyms").or(`term.eq.${term}`);
    if (existing && existing.length) {
      return new Response(JSON.stringify({ known: true, term }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: bySyn } = await admin.from("fashion_ontology").select("term, synonyms").contains("synonyms", [term]);
    if (bySyn && bySyn.length) {
      return new Response(JSON.stringify({ known: true, term: (bySyn[0] as { term: string }).term }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: all } = await admin.from("fashion_ontology").select("term").limit(400);
    const existingTerms = ((all ?? []) as { term: string }[]).map((r) => r.term);
    const classification = await classifyWithOpenAI(term, world, existingTerms) ??
      { canonical: term, kind: "attribute", world: [world], synonyms: [] };

    // Duplicate detected → add as synonym instead
    if (classification.duplicate_of && existingTerms.includes(classification.duplicate_of)) {
      const { data: parent } = await admin.from("fashion_ontology").select("synonyms").eq("term", classification.duplicate_of).maybeSingle();
      const syns = Array.from(new Set([...(parent?.synonyms ?? []), term]));
      await admin.from("fashion_ontology").update({ synonyms: syns }).eq("term", classification.duplicate_of);
      await admin.from("ai_actions_log").insert({
        source: "auto_ontology", action: "upsert_ontology_term",
        params: { term, duplicate_of: classification.duplicate_of },
        before: parent ?? null, after: { synonym_of: classification.duplicate_of },
        status: "done",
      });
      return new Response(JSON.stringify({ merged_into: classification.duplicate_of }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const row = {
      term: classification.canonical || term,
      kind: classification.kind || "attribute",
      world: classification.world?.length ? classification.world : [world],
      synonyms: classification.synonyms ?? [],
      learned: true,
    };
    await admin.from("fashion_ontology").insert(row);
    await admin.from("ai_actions_log").insert({
      source: "auto_ontology", action: "upsert_ontology_term",
      params: { term }, before: null, after: row, status: "done",
    });
    return new Response(JSON.stringify({ inserted: row }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
