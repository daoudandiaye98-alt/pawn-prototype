import { Link, useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  mode: "Mode",
  interior: "Interior",
  kunst: "Kunst",
  neu: "Neu",
  style: "Style",
  dna: "Deine DNA",
  designers: "Designer",
  designer: "Designer",
  all: "Alle",
  apply: "Für Designer",
  form: "Bewerbung",
  shop: "Shop",
  product: "Produkt",
  cart: "Warenkorb",
  checkout: "Kasse",
  order: "Bestellung",
  success: "Bestätigung",
  account: "Konto",
  auth: "Anmelden",
  kontakt: "Kontakt",
  datenschutz: "Datenschutz",
  impressum: "Impressum",
  versand: "Versand",
  agb: "AGB",
};

/**
 * Breadcrumbs — cell-style, hairline separators, hover invert.
 * Renders under the palace nav on every non-home page.
 */
export function Breadcrumbs({ trail }: { trail?: { label: string; to?: string }[] } = {}) {
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  const items = trail ?? autoTrail(pathname);
  if (!items.length) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className="border-b-[1.5px] border-black bg-white"
    >
      <ol className="mx-auto flex max-w-[1600px] items-stretch overflow-x-auto px-6 md:px-14">
        <li className="flex">
          <Link
            to="/"
            className="flex items-center border-r border-black/20 px-3 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-black hover-invert"
          >
            Start
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex">
            {item.to ? (
              <Link
                to={item.to}
                className="flex items-center border-r border-black/20 px-3 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-black hover-invert"
              >
                {item.label}
              </Link>
            ) : (
              <span className="flex items-center border-r border-black/20 px-3 py-2 text-[0.6rem] uppercase tracking-[0.3em] text-black/60">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function autoTrail(pathname: string): { label: string; to?: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  const acc: { label: string; to?: string }[] = [];
  let path = "";
  parts.forEach((seg, i) => {
    path += "/" + seg;
    const isLast = i === parts.length - 1;
    const decoded = decodeURIComponent(seg);
    const label = LABELS[decoded.toLowerCase()] ?? prettify(decoded);
    acc.push({ label, to: isLast ? undefined : path });
  });
  return acc;
}

function prettify(s: string) {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
