// Ontology-aware tag input for the studio product editor.
// Free typing allowed, but suggestions come from the fashion ontology.
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { suggestTerms, normalizeTag, useOntology, type OntologyTerm } from "./useOntology";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  world?: string;
  placeholder?: string;
}

const KIND_LABEL: Record<OntologyTerm["kind"], string> = {
  category: "Kategorie",
  silhouette: "Silhouette",
  material: "Material",
  color: "Farbe",
  attribute: "Merkmal",
  style: "Stil",
};

export function TagInput({ value, onChange, world, placeholder }: Props) {
  const { terms } = useOntology(world);
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => suggestTerms(input, terms).filter((t) => !value.includes(t.term)).slice(0, 8),
    [input, terms, value],
  );

  const addTag = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    const norm = normalizeTag(clean, terms);
    const tag = norm?.term ?? clean;
    if (!value.includes(tag)) onChange([...value, tag]);
    setInput("");
    setHighlight(0);
  };

  const removeTag = (t: string) => onChange(value.filter((x) => x !== t));

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 border border-border bg-white p-2 focus-within:border-foreground"
      >
        {value.map((t) => {
          const known = terms.find((o) => o.term === t);
          return (
            <span key={t} className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[0.72rem] ${known ? "border-foreground bg-foreground text-background" : "border-border bg-muted text-foreground"}`}>
              {t}
              {known && <span className="text-[0.55rem] opacity-70">· {KIND_LABEL[known.kind]}</span>}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(t); }} aria-label={`Tag ${t} entfernen`} className="ml-0.5 opacity-70 hover:opacity-100">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHighlight(0); }}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (suggestions[highlight]) addTag(suggestions[highlight].term);
              else if (input) addTag(input);
            } else if (e.key === "Backspace" && !input && value.length) {
              removeTag(value[value.length - 1]);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            }
          }}
          placeholder={value.length === 0 ? (placeholder ?? "Tippe ein Merkmal — z. B. „Kaschmir\" oder „skulptural\"") : ""}
          className="min-w-[10ch] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>

      {focus && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border border-border bg-white shadow-hard">
          {suggestions.map((s, i) => (
            <li
              key={s.term}
              onMouseDown={(e) => { e.preventDefault(); addTag(s.term); }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex items-baseline justify-between gap-3 px-3 py-2 text-sm ${i === highlight ? "bg-foreground text-background" : "hover:bg-muted"}`}
            >
              <span>{s.term}</span>
              <span className={`text-[0.6rem] uppercase tracking-[0.22em] ${i === highlight ? "opacity-80" : "text-muted-foreground"}`}>{KIND_LABEL[s.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
