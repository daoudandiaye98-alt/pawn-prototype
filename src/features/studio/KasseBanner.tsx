import { Link, useLocation } from "react-router-dom";
import { useVerkaufsbereitschaft } from "./useVerkaufsbereitschaft";

/**
 * PART 45 — der Geldweg wird sichtbar.
 * Solange ein Haus nicht verkaufen kann, sagt das Studio ruhig und ohne Drama,
 * was genau noch fehlt. Kein Alarm, kein Blockieren — eine offene Tür.
 */
export function KasseBanner() {
  const { loading, checks, bereit, offen } = useVerkaufsbereitschaft();
  const { pathname } = useLocation();

  if (loading || bereit) return null;
  // Auf der Auszahlungsseite steht die Checkliste ausführlich — dort kein zweites Mal.
  if (pathname.startsWith("/studio/auszahlung")) return null;

  return (
    <div className="border-b-[1.5px] border-black bg-black px-6 py-4 text-white md:px-10">
      <p className="editorial-eyebrow">Dein Haus kann noch kein Geld empfangen</p>
      <p className="mt-2 max-w-2xl text-sm">
        Deine Stücke sind sichtbar, aber der Kaufknopf bleibt ruhig, bis diese drei Dinge stehen.
      </p>
      <ul className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-6">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="inline-block w-4 text-center">{c.done ? "×" : "○"}</span>
            <span className={c.done ? "line-through opacity-50" : ""}>{c.label}</span>
          </li>
        ))}
      </ul>
      <Link
        to={offen[0]?.to ?? "/studio/auszahlung"}
        className="mt-4 inline-block border-[1.5px] border-white px-5 py-2 text-[0.7rem] uppercase tracking-[0.24em] transition-colors hover:bg-white hover:text-black"
      >
        Jetzt abschließen
      </Link>
    </div>
  );
}
