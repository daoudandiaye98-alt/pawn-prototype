import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BuilderBar, BuilderToggle } from "./BuilderMode";
import { Editable } from "./Editable";
import { useSiteContent } from "@/lib/siteContent";
import { Breadcrumbs } from "./Breadcrumbs";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";
import { Seo } from "./Seo";
import { JsonLd, organizationLd } from "./JsonLd";
import { useI18n } from "@/lib/i18n";
import { useConsent } from "@/lib/consent";

/** Teil L1 — die Rechtszeile im Footer: auf jeder Seite dieselben sechs Einträge. */
export function FooterLegalRow() {
  const { t } = useI18n();
  const { reopen } = useConsent();
  const links = [
    { label: t("footer.legal.agb"), to: "/agb" },
    { label: t("footer.legal.impressum"), to: "/impressum" },
    { label: t("footer.legal.datenschutz"), to: "/datenschutz" },
    { label: t("footer.legal.widerruf"), to: "/widerruf" },
    { label: t("footer.legal.barrierefreiheit"), to: "/barrierefreiheit" },
  ];
  return (
    /*
     * Prüfstand 3.5 — die sechs Einträge waren 16 px hoch und „AGB" 28 px breit.
     * Jeder trägt jetzt `trefferflaeche` (44 × 44 px Polster); die Schrift bleibt
     * unverändert klein, die Unterstreichung sitzt auf dem inneren <span> und
     * bleibt damit am Wort. Das Polster der Zeile selbst schrumpft von py-5 auf
     * py-1, sonst wäre die Rechtszeile plötzlich 84 px hoch.
     */
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-0 border-t-[1.5px] border-black px-6 py-1 text-[0.6rem] uppercase tracking-[0.28em] text-black md:px-14">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className="trefferflaeche">
          <span className="unterstrich">{l.label}</span>
        </Link>
      ))}
      <button type="button" onClick={reopen} className="trefferflaeche uppercase tracking-[0.28em]">
        <span className="unterstrich">{t("footer.legal.cookies")}</span>
      </button>
    </div>
  );
}

const DEFAULT_SEO = {
  de: { title: "PAWN — kuratierte Ausstellung für unabhängige Designer", description: "PAWN kuratiert Mode, Interior und Kunst unabhängiger Designer — jedes Stück mit Herkunft, jedes Haus mit eigener Handschrift." },
  en: { title: "PAWN — a curated exhibition for independent designers", description: "PAWN curates fashion, interior and art from independent designers — every piece with provenance, every house with its own signature." },
};

/**
 * PalaceLayout — final black/white system.
 */
export function PalaceLayout({
  children, transparentHeader = true, showBreadcrumbs = true, title, description, image, imageAlt, seoType,
}: {
  children: ReactNode;
  transparentHeader?: boolean;
  showBreadcrumbs?: boolean;
  title?: string;
  description?: string;
  /**
   * Teil K5 — das Bild, das beim Teilen erscheint. Seiten mit einem Werk
   * (Produkt, Haus) reichen ihr eigenes durch; ohne Angabe steht das
   * PAWN-Blatt aus `public/og.png`.
   */
  image?: string;
  imageAlt?: string;
  seoType?: "website" | "article" | "product";
}) {
  void transparentHeader;
  const { locale, t } = useI18n();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");
  return (
    <div className="palace min-h-screen bg-white text-black">
      <Seo
        title={title ?? DEFAULT_SEO[locale].title}
        description={description ?? DEFAULT_SEO[locale].description}
        image={image}
        imageAlt={imageAlt}
        type={seoType}
      />
      <JsonLd data={organizationLd()} />
      {/* Teil L2 — Sprunglink: erstes fokussierbares Element, sichtbar nur per Tastatur. */}
      <a href="#inhalt" className="skip-link">{t("a11y.skipToContent")}</a>
      <BuilderBar />
      {/*
        X1 — die Kopfzeile ist gelöscht, nicht versteckt. Die verbliebenen
        Palace-Seiten (Rechtstexte, Konto, Preise, Vision …) tragen dieselbe
        stille Kopfform wie der Beileger: die Wortmarke, ein Weg zurück auf
        den Umschlag, sonst nichts. Die Navigation der Site ist das Heft.
      */}
      <div className="mx-auto w-full max-w-[1600px] px-6 pt-8 md:px-14">
        {/* Dieselbe 44-px-Trefffläche wie in der Kasse (3.5, gemessen). */}
        <Link to="/" className="trefferflaeche inline-flex" aria-label="Zurück auf den Umschlag">
          <PawnWordmark className="h-6 text-black" />
        </Link>
      </div>
      {showBreadcrumbs && <Breadcrumbs />}
      <main id="inhalt">{children}</main>
      <footer className="border-t-[1.5px] border-black bg-white">
        {/*
          X1 — der Spalten-Fuß ist mit der Kopfzeile gegangen. Was bleibt, ist
          das, was bleiben MUSS: die Rechtszeile (Teil L1) — vier Rechtstexte,
          Barrierefreiheit, Cookie-Einstellungen. Sie ist keine Navigation,
          sie ist die Erreichbarkeitspflicht, und sie bleibt auf jeder
          Palace-Seite stehen.
        */}
        <FooterLegalRow />
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-4 text-[0.6rem] uppercase tracking-[0.42em] text-black md:flex-row md:items-center md:justify-between md:px-14">
          <span>
            <Editable contentKey="footer_line_1">PAWN · Kuratierte Ausstellung</Editable> · Ausgabe {ausgabeNummer}
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
      <BuilderToggle />
    </div>
  );
}
