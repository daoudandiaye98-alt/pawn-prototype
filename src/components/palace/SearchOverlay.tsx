import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, marketplaceSelectors } from "@/core";

interface Hit { kind: "product" | "designer"; slug: string; title: string; subtitle?: string }

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [dbHits, setDbHits] = useState<Hit[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seedProducts = useStore(marketplaceSelectors.getAllProducts);
  const seedDesigners = useStore(marketplaceSelectors.getAllDesigners);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 40); document.body.style.overflow = "hidden"; }
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) { setDbHits([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const [{ data: prods }, { data: dsn }] = await Promise.all([
        supabase.from("products").select("slug,name,world,designers(brand_name)").eq("status","published").ilike("name", `%${query}%`).limit(8),
        supabase.from("designers").select("slug,brand_name,location").eq("status","active").ilike("brand_name", `%${query}%`).limit(6),
      ]);
      if (!alive) return;
      setDbHits([
        ...(prods ?? []).map((p) => ({ kind: "product" as const, slug: p.slug, title: p.name, subtitle: `${p.world}${(p as { designers?: { brand_name?: string } | null }).designers?.brand_name ? " · " + (p as { designers?: { brand_name?: string } | null }).designers?.brand_name : ""}` })),
        ...(dsn ?? []).map((d) => ({ kind: "designer" as const, slug: d.slug, title: d.brand_name, subtitle: d.location ?? undefined })),
      ]);
    }, 180);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open]);

  const seedHits: Hit[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    const p = seedProducts.filter((x) => x.name.toLowerCase().includes(query)).slice(0, 6).map((x) => ({ kind: "product" as const, slug: x.slug, title: x.name, subtitle: x.world }));
    const d = seedDesigners.filter((x) => x.name.toLowerCase().includes(query)).slice(0, 4).map((x) => ({ kind: "designer" as const, slug: x.slug, title: x.name, subtitle: x.location }));
    return [...p, ...d];
  }, [q, seedProducts, seedDesigners]);

  const seen = new Set<string>();
  const hits = [...dbHits, ...seedHits].filter((h) => {
    const k = `${h.kind}:${h.slug}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#F1EEE7]">
      <div className="flex items-center justify-between border-b border-[rgba(12,12,14,.13)] px-6 py-5 md:px-14">
        <span className="palace-eyebrow">Suche</span>
        <button aria-label="Schließen" onClick={onClose} className="text-[#0C0C0E]"><X className="h-5 w-5" strokeWidth={1.2} /></button>
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-16 md:px-0">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Stücke, Ateliers, Welten …"
          className="w-full border-0 border-b border-[rgba(12,12,14,.28)] bg-transparent pb-4 palace-serif text-[clamp(1.8rem,4vw,3rem)] font-light text-[#0C0C0E] placeholder:text-[#7C7972] focus:outline-none"
        />
        <div className="mt-10 space-y-2">
          {q.trim().length < 2 && (
            <p className="palace-eyebrow text-[#7C7972]">Tippe mindestens zwei Zeichen.</p>
          )}
          {hits.map((h) => (
            <Link
              key={`${h.kind}:${h.slug}`}
              to={h.kind === "product" ? `/product/${h.slug}` : `/designer/${h.slug}`}
              onClick={onClose}
              className="flex items-baseline justify-between border-b border-[rgba(12,12,14,.09)] py-4 hover:bg-[#0C0C0E]/[.03]"
            >
              <div>
                <p className="font-serif text-[1.4rem] text-[#0C0C0E]">{h.title}</p>
                {h.subtitle && <p className="palace-eyebrow mt-1 text-[#7C7972]">{h.subtitle}</p>}
              </div>
              <span className="palace-eyebrow text-[#7C7972]">{h.kind === "product" ? "Stück" : "Atelier"} →</span>
            </Link>
          ))}
          {q.trim().length >= 2 && hits.length === 0 && (
            <p className="palace-eyebrow text-[#7C7972]">Nichts gefunden. Versuch einen anderen Begriff.</p>
          )}
        </div>
      </div>
    </div>
  );
}
