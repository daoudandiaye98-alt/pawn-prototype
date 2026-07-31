import { useEffect, useState } from "react";

/**
 * MoveLadder — the chess metaphor made FUNCTIONAL and SELF-EXPLANATORY.
 *
 * The coordinate marks across the page (A1, B2, C3 …) are the moves of one
 * game; this fixed rail is the game's record. To make the connection obvious
 * at a glance it uses progressive disclosure:
 *   • a persistent header — "PARTIE 03/08" — names it as an ordered index,
 *   • the active move always shows its plain-language label,
 *   • hovering the rail expands the WHOLE list into a labelled menu, so it
 *     reads unmistakably as a table of contents you can jump through.
 *
 * Functions it gives the visitor:
 *   1. see the whole "game" (every section) at a glance,
 *   2. know which move they are on (scroll-spy),
 *   3. jump to any move instantly (like replaying a recorded game).
 */

export type Move = { coord: string; id: string; label: string };

export function MoveLadder({ moves }: { moves: Move[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = moves
      .map((m) => document.getElementById(m.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = moves.findIndex((m) => m.id === visible[0].target.id);
          if (idx !== -1) setActive(idx);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [moves]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Inhalt — die Seite als Partie, Zug für Zug"
      className="pointer-events-none fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      {/* The whole rail is one hover group: resting = thin spine, hover =
          full labelled menu. This teaches the metaphor without a manual. */}
      <div className="group pointer-events-auto flex flex-col items-end">
        {/* Header — states plainly that this is an ordered index (a game). */}
        <div className="flex w-full items-center justify-between gap-3 border-b-[1.5px] border-l-[1.5px] border-black bg-black px-3 py-2">
          <span className="nav-mono text-[0.5rem] tracking-[0.24em] text-white">Partie</span>
          <span className="nav-mono text-[0.5rem] tabular-nums tracking-[0.1em] text-white">
            {String(active + 1).padStart(2, "0")}<span className="text-white/50">/{String(moves.length).padStart(2, "0")}</span>
          </span>
        </div>

        <ul className="flex w-full flex-col items-stretch">
          {moves.map((m, i) => {
            const isActive = i === active;
            const isPast = i < active;
            return (
              <li key={m.id} className="flex items-stretch justify-end">
                {/* Label — always visible for the active move; the full set
                    slides in when the rail is hovered, revealing the menu. */}
                <span
                  className={`nav-mono flex items-center justify-end whitespace-nowrap border-b-[1.5px] border-black bg-white px-3 text-[0.54rem] tracking-[0.18em] text-black transition-all duration-300 ${
                    isActive
                      ? "max-w-[180px] px-3 opacity-100"
                      : "max-w-0 overflow-hidden px-0 opacity-0 group-hover:max-w-[180px] group-hover:px-3 group-hover:opacity-100"
                  }`}
                >
                  {m.label}
                </span>
                <button
                  type="button"
                  onClick={() => go(m.id)}
                  aria-label={`Zug ${m.coord}: ${m.label}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`nav-mono flex h-9 w-9 flex-none items-center justify-center border-b-[1.5px] border-l-[1.5px] border-black text-[0.56rem] tracking-[0.04em] transition-colors duration-200 ${
                    isActive
                      ? "bg-black text-white"
                      : isPast
                        ? "bg-black/[0.06] text-black hover:bg-black hover:text-white"
                        : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                >
                  {m.coord}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer hint — the one-line instruction, shown while resting so a
            first-time visitor learns it is navigable. */}
        <div className="flex w-full items-center justify-end border-l-[1.5px] border-black bg-white px-3 py-1.5">
          <span className="nav-mono text-[0.46rem] tracking-[0.2em] text-black/55">Klick = Springen</span>
        </div>
      </div>
    </nav>
  );
}
