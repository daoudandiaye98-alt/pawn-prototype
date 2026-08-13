import { Link, useLocation } from "react-router-dom";

/**
 * Teil K1 — Erstellen und Verwalten derselben Sache sind EINE Fläche: diese Tab-Zeile
 * sitzt oben in gefalteten Flächen (Werke, Doppelseite, Clips) und wechselt zwischen
 * ihren Unterseiten. Erklärung passiert in der Fläche, nie im Menü.
 */
export function FlaechenTabs({ tabs }: { tabs: { label: string; to: string; end?: boolean }[] }) {
  const { pathname } = useLocation();
  return (
    <div className="mb-8 flex border-b border-border">
      {tabs.map((tab) => {
        const active = tab.end !== false ? pathname === tab.to : pathname.startsWith(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.24em] transition-colors ${
              active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
