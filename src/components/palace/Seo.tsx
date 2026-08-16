import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const SITE_URL = "https://pawn.vision";

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

/**
 * Teil 22a — SEO/Sprache pro Seite: Titel + Beschreibung je Sprache, hreflang
 * für beide Sprachen (+ x-default), lang-Attribut auf <html> hält I18nProvider
 * bereits synchron. Rendert nichts sichtbar, wirkt nur auf <head>.
 */
export function Seo({ title, description, noindex = false }: {
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
}) {
  const { pathname } = useLocation();
  const { locale } = useI18n();

  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);

    const url = `${SITE_URL}${pathname}`;
    upsertLink("canonical", null, url);
    upsertLink("alternate", "de", url);
    upsertLink("alternate", "en", url);
    upsertLink("alternate", "x-default", url);
  }, [title, description, noindex, pathname, locale]);

  return null;
}
