import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PalaceHeader } from "./PalaceHeader";
import { BuilderBar, BuilderToggle } from "./BuilderMode";
import { Editable, useContentValue } from "./Editable";
import { useSiteContent } from "@/lib/siteContent";
import { Breadcrumbs } from "./Breadcrumbs";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";
import { Seo } from "./Seo";
import { useI18n } from "@/lib/i18n";

const FOOTER_COLUMN_KEYS = ["footer_col_haeuser", "footer_col_fuer_sie", "footer_col_fuer_designer", "footer_col_haus"] as const;

const DEFAULT_SEO = {
  de: { title: "PAWN — kuratierte Ausstellung für unabhängige Designer", description: "PAWN kuratiert Mode, Interior und Kunst unabhängiger Designer — jedes Stück mit Herkunft, jedes Haus mit eigener Handschrift." },
  en: { title: "PAWN — a curated exhibition for independent designers", description: "PAWN curates fashion, interior and art from independent designers — every piece with provenance, every house with its own signature." },
};

/**
 * PalaceLayout — final black/white system.
 */
export function PalaceLayout({ children, transparentHeader = true, showBreadcrumbs = true, title, description }: { children: ReactNode; transparentHeader?: boolean; showBreadcrumbs?: boolean; title?: string; description?: string }) {
  const headerVariant = transparentHeader && !showBreadcrumbs ? "transparent-on-hero" : "solid";
  const { locale } = useI18n();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");
  const colTitleHaeuser = useContentValue(FOOTER_COLUMN_KEYS[0], "Häuser");
  const colTitleFuerSie = useContentValue(FOOTER_COLUMN_KEYS[1], "Für Sie");
  const colTitleFuerDesigner = useContentValue(FOOTER_COLUMN_KEYS[2], "Für Designer");
  const colTitleHaus = useContentValue(FOOTER_COLUMN_KEYS[3], "Haus");
  const resolvedColTitles = [colTitleHaeuser, colTitleFuerSie, colTitleFuerDesigner, colTitleHaus];
  return (
    <div className="palace min-h-screen bg-white text-black">
      <Seo title={title ?? DEFAULT_SEO[locale].title} description={description ?? DEFAULT_SEO[locale].description} />
      <BuilderBar />
      <PalaceHeader variant={headerVariant} />
      {showBreadcrumbs && <div className="pt-[68px] md:pt-[76px]"><Breadcrumbs /></div>}
      <main>{children}</main>
      <footer className="border-t-[1.5px] border-black bg-white">
        <div className="mx-auto max-w-[1600px] px-6 pt-16 md:px-14">
          <PawnWordmark
            className="block w-full text-center leading-none text-black"
            style={{ fontSize: "clamp(6rem, 15vw, 15rem)" }}
          />
        </div>
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-0 border-t-[1.5px] border-black md:grid-cols-4">
          {[
            {
              title: "Häuser",
              links: [
                { label: "Mode", to: "/mode" },
                { label: "Interior", to: "/interior" },
                { label: "Kunst", to: "/kunst" },
                { label: "Designer", to: "/designers" },
              ],
            },
            {
              title: "Für Sie",
              links: [
                { label: "Neu", to: "/neu" },
                { label: "DNA", to: "/dna" },
                { label: "Warenkorb", to: "/cart" },
              ],
            },
            {
              title: "Für Designer",
              links: [
                { label: "Bewerben", to: "/apply" },
                { label: "Pläne", to: "/preise" },
                { label: "Studio", to: "/studio" },
                { label: "Copilot", to: "/studio/copilot" },
                { label: "Kampagnen", to: "/studio/kampagnen" },
              ],
            },
            {
              title: "Haus",
              links: [
                { label: "Vision", to: "/vision" },
                { label: "Kontakt", to: "/kontakt" },
                { label: "Versand", to: "/versand" },
                { label: "AGB", to: "/agb" },
                { label: "Impressum", to: "/impressum" },
              ],
            },
          ].map((col, i) => (
            <div
              key={col.title}
              className={`${i > 0 ? "border-l-[1.5px] border-black" : ""} px-6 py-8`}
            >
              <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">{resolvedColTitles[i]}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="inline-block border-b border-transparent text-[0.85rem] text-black transition-colors hover:border-black"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 border-t-[1.5px] border-black px-6 py-8 text-[0.6rem] uppercase tracking-[0.42em] text-black md:flex-row md:items-center md:justify-between md:px-14">
          <span>
            <Editable contentKey="footer_line_1">PAWN · Kuratierte Ausstellung</Editable> · Ausgabe {ausgabeNummer}
          </span>
          <span>© {new Date().getFullYear()} — Für Designer <a href="/apply" className="uline text-black">bewerben</a></span>
        </div>
      </footer>
      <BuilderToggle />
    </div>
  );
}
