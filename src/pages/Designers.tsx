import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { usePublicDesigners } from "@/lib/publicData";
import { useStore, marketplaceSelectors } from "@/core";

const WORLDS = ["Alle", "Mode", "Interior", "Kunst"] as const;
type WorldFilter = typeof WORLDS[number];
const NEW_WINDOW_DAYS = 60;

export default function Designers() {
  const { designers } = usePublicDesigners();
  const products = useStore(marketplaceSelectors.getAllProductViews);

  const worldBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (!map.has(p.designerSlug)) map.set(p.designerSlug, p.world);
    return map;
  }, [products]);

  const [worldFilter, setWorldFilter] = useState<WorldFilter>("Alle");
  const [countryFilter, setCountryFilter] = useState<string>("Alle");
  const [newOnly, setNewOnly] = useState(false);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const d of designers) if (d.country) set.add(d.country);
    return ["Alle", ...Array.from(set).sort()];
  }, [designers]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const d of designers) if (d.location) set.add(d.location);
    return Array.from(set);
  }, [designers]);

  const isNew = (d: typeof designers[number]) => {
    if (!d.created_at) return false;
    return Date.now() - new Date(d.created_at).getTime() < NEW_WINDOW_DAYS * 24 * 3600 * 1000;
  };

  const filtered = useMemo(() => designers.filter((d) => {
    const world = (d.tags?.[0]) || worldBySlug.get(d.slug) || "Atelier";
    if (worldFilter !== "Alle" && world !== worldFilter) return false;
    if (countryFilter !== "Alle" && d.country !== countryFilter) return false;
    if (newOnly && !isNew(d)) return false;
    return true;
  }), [designers, worldBySlug, worldFilter, countryFilter, newOnly]);

  const [hover, setHover] = useState<{ src?: string; brand: string } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wallRef = useRef<HTMLElement | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const rect = wallRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1400px] text-center">
          <Reveal>
            <p className="palace-eyebrow">Atelier · Verzeichnis</p>
            <h1 className="palace-serif mt-10 text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.2rem)", lineHeight: 0.96, letterSpacing: "-0.02em", fontWeight: 500 }}>
              Wer diesen Raum <span className="italic">füllt.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-xl font-serif italic text-[1.05rem] leading-relaxed text-[#0C0C0E]/75">
              {designers.length} unabhängige Studios · Häuser aus {cities.length} {cities.length === 1 ? "Stadt" : "Städten"}
              {cities.length > 0 && <span className="block mt-2 text-[0.72rem] not-italic uppercase tracking-[0.3em] text-[#0C0C0E]/50">{cities.slice(0, 12).join(" · ")}</span>}
            </p>
          </Reveal>

          <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-2 text-[0.62rem] uppercase tracking-[0.28em]">
            {WORLDS.map((w) => (
              <button key={w} onClick={() => setWorldFilter(w)}
                className={`border px-3 py-1.5 transition ${worldFilter === w ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]" : "border-[rgba(12,12,14,.2)] text-[#0C0C0E]/70 hover:border-[#0C0C0E]"}`}>
                {w}
              </button>
            ))}
            <span className="mx-2 text-[#0C0C0E]/30">·</span>
            <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
              className="border border-[rgba(12,12,14,.2)] bg-transparent px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em]">
              {countries.map((c) => <option key={c} value={c}>{c === "Alle" ? "Land · Alle" : c}</option>)}
            </select>
            <button onClick={() => setNewOnly((v) => !v)}
              className={`border px-3 py-1.5 transition ${newOnly ? "border-[#0C0C0E] bg-[#0C0C0E] text-[#F1EEE7]" : "border-[rgba(12,12,14,.2)] text-[#0C0C0E]/70 hover:border-[#0C0C0E]"}`}>
              Neu im Haus
            </button>
          </div>
        </div>
      </section>

      <section ref={wallRef} className="relative px-6 py-24 md:px-14 md:py-32" onMouseMove={onMove}>
        {hover && (
          <div className="pointer-events-none absolute z-30 hidden overflow-hidden border border-[rgba(12,12,14,.28)] bg-[#F1EEE7] shadow-[0_20px_60px_-30px_rgba(12,12,14,0.5)] transition-opacity duration-300 md:block"
            style={{ left: pos.x + 20, top: pos.y - 90, width: 200, height: 260, opacity: hover.src ? 1 : 0.5 }}>
            {hover.src ? (
              <img src={hover.src} alt="" loading="lazy" className="h-full w-full object-cover"
                style={{ filter: "grayscale(1) contrast(var(--palace-image-contrast, 1.06))" }} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#EFEDE8] palace-serif italic text-[#8F8B82]">{hover.brand}</div>
            )}
          </div>
        )}

        <ul className="mx-auto max-w-[1400px] divide-y divide-[rgba(12,12,14,.13)]">
          {filtered.map((d, i) => {
            const world = (d.tags?.[0]) || worldBySlug.get(d.slug) || "Atelier";
            const preview = d.hero_image_url ?? d.banner_url;
            const fresh = isNew(d);
            return (
              <Reveal key={d.id} delay={Math.min(400, i * 40)}>
                <li onMouseEnter={() => setHover({ src: preview ?? undefined, brand: d.brand_name })} onMouseLeave={() => setHover(null)}>
                  <Link to={`/designer/${d.slug}`} className="group flex flex-col items-center gap-3 py-10 text-center transition-colors duration-500 md:py-14">
                    <span className="palace-eyebrow text-[#8F8B82] group-hover:text-[#0C0C0E]">
                      № {String(i + 1).padStart(3, "0")}
                      {fresh && <span className="ml-3 border border-[#0C0C0E]/40 px-1.5 py-0.5 text-[0.55rem]">Neu</span>}
                    </span>
                    <span className="palace-serif text-[#0C0C0E]/85 transition-colors duration-500 group-hover:text-[#0C0C0E]"
                      style={{ fontSize: "clamp(2.4rem, 7.4vw, 6.6rem)", lineHeight: 1, letterSpacing: "-0.025em", fontWeight: 500 }}>
                      {d.brand_name}
                    </span>
                    <span className="palace-eyebrow text-[#6B6862] group-hover:text-[#0C0C0E]">
                      {world} · {d.location ?? "—"}
                    </span>
                  </Link>
                </li>
              </Reveal>
            );
          })}
          {filtered.length === 0 && <li className="py-24 text-center text-sm text-[#0C0C0E]/60">Keine Häuser passend zum Filter.</li>}
        </ul>
      </section>

      <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-20 md:px-14">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-6 md:flex-row">
          <p className="palace-serif italic text-[1.3rem] text-[#0C0C0E]">Ist dein Atelier hier noch nicht?</p>
          <Link to="/apply" className="palace-btn">Als Designer bewerben →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
