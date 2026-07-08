// Shared ontology loader — cached in memory across the app for tag autocomplete.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OntologyKind = "category" | "silhouette" | "material" | "color" | "attribute" | "style";
export interface OntologyTerm {
  term: string;
  kind: OntologyKind;
  world: string[];
  synonyms: string[];
  parent_term: string | null;
}

let CACHE: OntologyTerm[] | null = null;
let LOADING: Promise<OntologyTerm[]> | null = null;
const LISTENERS = new Set<(t: OntologyTerm[]) => void>();

async function loadOntology(): Promise<OntologyTerm[]> {
  if (CACHE) return CACHE;
  if (LOADING) return LOADING;
  LOADING = (async () => {
    const { data } = await supabase
      .from("fashion_ontology" as never)
      .select("term, kind, world, synonyms, parent_term")
      .order("term");
    const rows = ((data as unknown) as OntologyTerm[]) ?? [];
    CACHE = rows;
    LOADING = null;
    LISTENERS.forEach((cb) => cb(rows));
    return rows;
  })();
  return LOADING;
}

/** Force reload — e.g. after admin edits. */
export function invalidateOntology() {
  CACHE = null;
  LOADING = null;
  void loadOntology();
}

export function useOntology(world?: string) {
  const [terms, setTerms] = useState<OntologyTerm[]>(CACHE ?? []);
  useEffect(() => {
    let alive = true;
    if (CACHE) setTerms(CACHE);
    void loadOntology().then((t) => { if (alive) setTerms(t); });
    const cb = (t: OntologyTerm[]) => { if (alive) setTerms(t); };
    LISTENERS.add(cb);
    return () => { alive = false; LISTENERS.delete(cb); };
  }, []);
  const filtered = world ? terms.filter((t) => t.world.includes(world)) : terms;
  return { terms: filtered, all: terms };
}

function normStr(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Match a raw user input to an ontology term via synonym/term substring. */
export function normalizeTag(raw: string, terms: OntologyTerm[]): OntologyTerm | null {
  const n = normStr(raw);
  if (!n) return null;
  // exact term
  for (const t of terms) if (normStr(t.term) === n) return t;
  // exact synonym
  for (const t of terms) for (const s of t.synonyms) if (normStr(s) === n) return t;
  // substring (only if input is at least 4 chars)
  if (n.length >= 4) {
    for (const t of terms) if (normStr(t.term).includes(n) || n.includes(normStr(t.term))) return t;
  }
  return null;
}

/** Autocomplete: return up to N ontology terms matching the query prefix or synonym. */
export function suggestTerms(query: string, terms: OntologyTerm[], limit = 8): OntologyTerm[] {
  const q = normStr(query);
  if (!q) return [];
  const scored: { t: OntologyTerm; score: number }[] = [];
  for (const t of terms) {
    const tn = normStr(t.term);
    let score = 0;
    if (tn === q) score = 100;
    else if (tn.startsWith(q)) score = 60;
    else if (tn.includes(q)) score = 40;
    else {
      for (const s of t.synonyms) {
        const sn = normStr(s);
        if (sn === q) { score = 90; break; }
        if (sn.startsWith(q)) { score = 50; break; }
        if (sn.includes(q)) { score = 25; break; }
      }
    }
    if (score > 0) scored.push({ t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.t);
}
