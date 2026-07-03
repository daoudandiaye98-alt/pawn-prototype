import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function PublicFooter() {
  return (
    <footer className="mt-32 border-t border-border bg-background">
      <div className="editorial-container grid grid-cols-2 gap-10 py-16 md:grid-cols-4">
        <div>
          <Logo className="h-7 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Fashion as identity architecture. A curated marketplace for visionary designers and the customers who collect them.
          </p>
        </div>
        <FooterCol
          title="Shop"
          links={[
            { label: "Women", to: "/shop?gender=women" },
            { label: "Men", to: "/shop?gender=men" },
            { label: "Designers", to: "/designers" },
            { label: "Bag", to: "/cart" },
          ]}
        />
        <FooterCol
          title="Platform"
          links={[
            { label: "Apply as designer", to: "/apply" },
            { label: "Designer portal", to: "/portal" },
            { label: "Style DNA", to: "/dna" },
            { label: "Admin hub", to: "/admin" },
          ]}
        />
        <FooterCol
          title="House"
          links={[
            { label: "Contact", to: "#" },
            { label: "Press", to: "#" },
            { label: "Privacy", to: "#" },
            { label: "Imprint", to: "#" },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="editorial-container flex flex-col items-start justify-between gap-2 py-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} PAWN. Prototype build for review.</span>
          <span className="uppercase tracking-[0.25em]">Curated by PAWN</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <p className="editorial-eyebrow">{title}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-foreground/80 transition-colors hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
