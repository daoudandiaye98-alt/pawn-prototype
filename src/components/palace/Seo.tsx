import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const SITE_URL = "https://pawn.vision";

/**
 * Das Bild, das erscheint, wenn jemand einen PAWN-Link in einen Chat oder ein
 * Netzwerk stellt. Liegt als Datei in `public/` (1200 × 630, das Maß, das
 * Facebook, LinkedIn, WhatsApp und X gleichermaßen erwarten). Schwarz auf
 * Weiß, harte Kante — dasselbe Gesetz wie die Seite.
 *
 * Seiten mit eigenem Werk (Produkt, Haus) reichen ihr eigenes Bild durch die
 * `image`-Eigenschaft herein; dieses hier ist der Grundfall.
 */
const DEFAULT_IMAGE = `${SITE_URL}/og.png`;
const DEFAULT_IMAGE_ALT = "PAWN — Mode, Interior und Kunst";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, hreflang: string | null, href: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Relative Pfade zu vollen Adressen machen — Netzwerke lesen nur absolute. */
function absolut(quelle: string): string {
  if (/^https?:\/\//i.test(quelle)) return quelle;
  return `${SITE_URL}${quelle.startsWith("/") ? "" : "/"}${quelle}`;
}

/**
 * Teil 22a — SEO/Sprache pro Seite: Titel + Beschreibung je Sprache, hreflang
 * für beide Sprachen (+ x-default), lang-Attribut auf <html> hält I18nProvider
 * bereits synchron. Rendert nichts sichtbar, wirkt nur auf <head>.
 *
 * Teil K5 — das Teilbild. Gemessen war: auf allen Seiten fehlte `og:image`
 * vollständig, und `og:url` stand statisch in `index.html` auf der Startseite,
 * also auf JEDER Unterseite falsch. Ein geteilter Link zeigte damit weder ein
 * Bild noch die richtige Adresse.
 *
 * Die Regel dahinter, und der Grund, warum hier so viel geschrieben wird: der
 * <head> gehört in einer Einzelseiten-Anwendung ALLEN Routen zugleich. Was eine
 * Seite setzt und die nächste nicht überschreibt, bleibt stehen. Deshalb wird
 * jedes Feld bei jedem Routenwechsel geschrieben — nie nur „gesetzt, wenn
 * vorhanden". Ein weggelassenes Feld ist kein leeres Feld, sondern das Feld der
 * vorigen Seite.
 */
export function Seo({
  title, description, noindex = false, image, imageAlt, type = "website",
}: {
  title: string;
  description: string;
  /**
   * Teil M: einzelne Routen aus dem Index nehmen, solange sie im Bau sind
   * (Kontrolle 2.7 — kein Entwurfsinhalt in der Suche).
   *
   * ACHTUNG: der <head> ist in einer SPA für alle Routen derselbe. Deshalb wird
   * `robots` IMMER gesetzt — auf „noindex" hier, sonst ausdrücklich zurück auf
   * „index". Würde die Marke nur gesetzt und nie zurückgenommen, nähme ein
   * Klick von der gesperrten Seite auf die Startseite die ganze Site mit.
   */
  noindex?: boolean;
  /** Eigenes Teilbild dieser Seite. Relativ oder voll — beides wird absolut gemacht. */
  image?: string;
  /** Was auf dem Teilbild zu sehen ist. Fällt auf den Grundfall zurück. */
  imageAlt?: string;
  /** `website` für alles Normale, `article` fürs Heft, `product` für ein Stück. */
  type?: "website" | "article" | "product";
}) {
  const { pathname } = useLocation();
  const { locale } = useI18n();

  useEffect(() => {
    const url = `${SITE_URL}${pathname}`;
    const bild = absolut(image || DEFAULT_IMAGE);
    const bildText = imageAlt || DEFAULT_IMAGE_ALT;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // Open Graph — Facebook, LinkedIn, WhatsApp, Signal, Slack.
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:site_name", "PAWN");
    upsertMeta("property", "og:locale", locale === "en" ? "en_US" : "de_DE");
    upsertMeta("property", "og:image", bild);
    upsertMeta("property", "og:image:alt", bildText);

    // X/Twitter liest eigene Felder und fällt nur teilweise auf og:* zurück.
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", bild);
    upsertMeta("name", "twitter:image:alt", bildText);

    upsertLink("canonical", null, url);
    upsertLink("alternate", "de", url);
    upsertLink("alternate", "en", url);
    upsertLink("alternate", "x-default", url);
  }, [title, description, noindex, image, imageAlt, type, pathname, locale]);

  return null;
}
