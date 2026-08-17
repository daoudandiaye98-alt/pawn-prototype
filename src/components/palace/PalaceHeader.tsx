import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SearchOverlay } from "./SearchOverlay";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ChatDrawer } from "./ChatDrawer";
import { useCart } from "@/store/cart";
import { PawnBagIcon, PawnCloseIcon, PawnMenuIcon, PawnProfileIcon, PawnSearchIcon } from "@/components/pawn/icons/PawnIcons";
import {
  IkoneStart, IkoneBoutique, IkoneVision, IkoneDeineBoutique, IkoneMode,
  IkoneInterior, IkoneKunst, IkoneHaeuser, IkoneDna, IkoneFuerDesigner, IkoneFragPawn,
} from "@/components/pawn/icons/MenueIcons";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/**
 * Palace header.
 * - Logo is a single non-wrapping wordmark (fixed width).
 * - Nav collapses into the burger menu below the `lg` breakpoint (1024px)
 *   so we never quetsch items on iPad and 13" laptops.
 * - All nav items and utility buttons use whitespace-nowrap.
 */
export function PalaceHeader({ variant = "solid" }: { variant?: "solid" | "transparent-on-hero" }) {
  const { user, roles, signOut } = useAuth();
  const { count: cartCount } = useCart();
  const { locale, setLocale, t } = useI18n();
  /**
   * Teil Q — eine Hauptnavigation, überall dieselbe: Start · Boutique · Vision.
   * Gleiche Reihenfolge, gleiche Stelle, aktiver Zustand markiert. Die Welten
   * erreicht man jetzt über die Boutique (mit vorgewählter Welt), deshalb steht
   * hier nicht mehr jede Welt einzeln. Verloren geht nichts: alles Weitere liegt
   * im Menü, das dafür auf JEDER Breite sichtbar ist (vorher nur auf Touch).
   */
  const NAV_HAUPT = [
    { label: t("nav.start"), to: "/", end: true, Ikone: IkoneStart },
    { label: t("nav.boutique"), to: "/shop", Ikone: IkoneBoutique },
    { label: t("nav.vision"), to: "/vision", Ikone: IkoneVision },
  ];
  /**
   * Teil S — Ebene 2 in fester Reihenfolge. "Deine Boutique" steht vorn: die
   * kuratierte Fläche ist der persönlichste Weg ins Haus. "Unsere Häuser"
   * ersetzt "Designer" — der Begriff schloss Künstlerinnen und Interior-
   * Gestalter aus. "Für Designer" bleibt: das ist der Einstieg für Neue, also
   * die Rolle, nicht die Bezeichnung der Bestehenden.
   */
  const NAV_MEHR = [
    { label: t("nav.deineBoutique"), to: "/boutique", Ikone: IkoneDeineBoutique },
    { label: t("nav.mode"), to: "/mode", Ikone: IkoneMode },
    { label: t("nav.interior"), to: "/interior", Ikone: IkoneInterior },
    { label: t("nav.kunst"), to: "/kunst", Ikone: IkoneKunst },
    { label: t("nav.haeuser"), to: "/designers", Ikone: IkoneHaeuser },
    { label: t("nav.dna"), to: "/dna", Ikone: IkoneDna },
    { label: t("nav.forDesigners"), to: "/apply", Ikone: IkoneFuerDesigner },
  ];

  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const openChat = () => setChatOpen(true);
    window.addEventListener("palace:open-chat", openChat as EventListener);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("palace:open-chat", openChat as EventListener);
    };
  }, []);

  useEffect(() => {
    if (menuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Esc schließt das Menü — Teil T: es ist vollständig mit der Tastatur bedienbar.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  const handleSignOut = async () => {
    setAccountOpen(false);
    await signOut();
    navigate("/");
  };

  const isAdmin = roles.includes("admin");
  const isDesigner = roles.includes("designer");
  const isApplicant = roles.includes("designer_applicant" as never);

  /**
   * Teil K3 — die Kopfzeile bekommt einen eigenen Grund.
   *
   * Gemessen stand sie nackt auf dem Titelfoto: „Suche" 1,11–1,96:1, die
   * Wortmarke 1,67–2,52:1, „Boutique" und „Vision" um 1,8–2,1:1. 1,11:1 ist
   * kein schwacher Kontrast, das ist unsichtbarer Text — weiß auf hellem Beton.
   *
   * Kein Verlauf: ein Verlauf ist an jeder Stelle unterschiedlich stark, also
   * ist auch der Kontrast an jeder Stelle ein anderer, und messen lässt sich
   * nichts. Stattdessen eine massive Fläche mit harter Kante — dieselbe Lösung
   * wie beim Textblock im Helden. Weiß auf #000 sind 21:1, unabhängig davon,
   * wie hell das Foto dahinter gerade ist.
   *
   * Der Unterschied zwischen Cover und Rest bleibt: dort schwarzer Grund mit
   * weißer Schrift, danach weißer Grund mit schwarzer Schrift.
   */
  const solid = variant !== "transparent-on-hero" || scrolled;
  const border = solid ? "border-black" : "border-white/30";
  const borderSoft = solid ? "border-[rgba(0,0,0,.18)]" : "border-white/20";
  const text = solid ? "text-black" : "text-white";

  return (
    <>
      {/*
        Die ganze Leiste kippt SOFORT — Grund, Linien und Schrift zugleich,
        ohne jede Überblendung.

        Gemessen an der Landing bei 844 quer: während der Überblendung stand
        die weiße Wortmarke auf hellgrauem Grund — live 1,92 : 1, Kontrolle 3.3
        verlangt 4,5 : 1. Der Grund war nicht Nachlässigkeit, sondern die
        Überblendung selbst: Grund und Schrift tauschen die Plätze, also
        kreuzen sie sich in der Mitte — und in der Mitte sind beide grau.

        Nachgemessen im Container (844 × 390, Rollen auf 1200):
          vorher   ruhend #000/#fff → +120 ms rgb(31,31,31)/rgb(198,198,198)
          Zwischenschritt (nur der Grund ohne Übergang):
                   +120 ms Grund #fff, Marke noch #fff — 1 : 1, unsichtbar
          jetzt    ein einziger Schnitt, kein Zwischenbild

        Der Zwischenschritt ist der Grund, warum hier keine
        `transition-colors`-Klasse mehr steht und die Wortmarke
        `hover-invert-schnitt` trägt statt `hover-invert`: es genügt nicht, den
        Grund hart zu schalten, solange die Schrift noch überblendet. Eine
        Invertierung braucht ohnehin keinen Übergang — sie ist ein Schnitt
        (Designgesetz: „Hover = Invertierung, nie Opacity").
      */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b-[1.5px] ${border} ${solid ? "bg-white" : "bg-black"}`}
      >
        <div className="mx-auto flex h-14 max-w-[1600px] items-stretch">
          {/* Logo cell */}
          <Link
            to="/"
            aria-label="PAWN"
            className={`flex items-center whitespace-nowrap border-r-[1.5px] px-5 md:px-7 hover-invert-schnitt ${border} ${text}`}
          >
            <PawnWordmark className="text-[1.35rem] md:text-[1.5rem]" />
          </Link>

          {/* Nav cells */}
          <nav className="hidden min-w-0 items-stretch md:flex">
            {NAV_HAUPT.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center whitespace-nowrap border-r px-5 text-[0.66rem] uppercase tracking-[0.3em] hover:bg-black hover:text-white ${borderSoft} ${
                    isActive ? "bg-black text-white" : text
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/*
            Teil R4 — die Fläche zwischen Wortmarke und den rechten Zeichen war
            eine leere Zelle mit Rahmen: links die 1.5px-Linie der Wortmarke,
            rechts die des Warenkorbs, dazwischen nichts. Sie ist jetzt die
            Suche — kein Rahmen ohne Inhalt und kein Inhalt ohne Rahmen.
            Keine eigene linke Linie: die Zelle davor bringt sie mit.
          */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={`flex min-w-0 flex-1 items-center gap-3 px-4 text-left hover:bg-black hover:text-white md:px-5 ${text}`}
          >
            <PawnSearchIcon className="h-5 w-5 shrink-0" />
            <span className="truncate text-[0.62rem] uppercase tracking-[0.3em] opacity-70">{t("nav.suche")}</span>
          </button>

          <div className="flex items-stretch">
            {/* Frag PAWN — solid black cell with blinking dot */}
            <button
              onClick={() => setChatOpen(true)}
              className={`hidden items-center gap-2 whitespace-nowrap border-l-[1.5px] bg-black px-4 text-[0.62rem] uppercase tracking-[0.32em] text-white hover:bg-white hover:text-black xl:flex xl:px-5 ${border}`}
            >
              <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-current" />
              {t("nav.frag")}
            </button>

            {/* Locale cell */}
            <button
              type="button"
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              className={`hidden items-center whitespace-nowrap border-l px-3 text-[0.6rem] uppercase tracking-[0.28em] hover:bg-black hover:text-white xl:inline-flex ${borderSoft} ${text}`}
              aria-label="Sprache wechseln"
            >
              {locale.toUpperCase()}
            </button>

            {/* Account cell */}
            {user ? (
              <div ref={accountRef} className={`relative hidden border-l-[1.5px] xl:block ${border}`}>
                <button
                  type="button"
                  aria-label="Konto"
                  onClick={() => setAccountOpen((v) => !v)}
                  className={`flex h-full items-center px-4 hover:bg-black hover:text-white ${text}`}
                >
                  <PawnProfileIcon className="h-5 w-5" />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full w-64 border-[1.5px] border-black bg-white shadow-[6px_6px_0_#000]">
                    <div className="border-b-[1.5px] border-black px-5 py-4">
                      <p className="text-[0.55rem] uppercase tracking-[0.42em] text-black/70">Zutritt</p>
                      <p className="mt-1 font-serif italic text-[0.95rem] text-[#000000]" style={{ fontWeight: 500 }}>
                        {isAdmin ? "Kurator:in" : isDesigner ? "Atelier" : isApplicant ? "Bewerbung" : "Sammlung"}
                      </p>
                    </div>
                    <MenuItem to="/account" onClick={() => setAccountOpen(false)}>{t("nav.account")}</MenuItem>
                    <MenuItem to="/dna" onClick={() => setAccountOpen(false)}>{t("nav.dna")}</MenuItem>
                    {isDesigner && <MenuItem to="/studio" onClick={() => setAccountOpen(false)}>{t("nav.myStudio")}</MenuItem>}
                    {!isDesigner && isApplicant && <MenuItem to="/apply" onClick={() => setAccountOpen(false)}>{t("nav.applicationStatus")}</MenuItem>}
                    {isAdmin && <MenuItem to="/admin" onClick={() => setAccountOpen(false)}>{t("nav.adminCockpit")}</MenuItem>}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full border-t-[1.5px] border-black px-5 py-3 text-left text-[0.68rem] uppercase tracking-[0.32em] text-black/70 hover:bg-black hover:text-white"
                    >
                      {t("nav.logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                aria-label="Anmelden"
                className={`hidden items-center border-l-[1.5px] px-4 hover:bg-black hover:text-white xl:inline-flex ${border} ${text}`}
              >
                <PawnProfileIcon className="h-5 w-5" />
              </Link>
            )}

            {/* Cart cell */}
            <Link
              to="/cart"
              aria-label={`Warenkorb${cartCount > 0 ? ` (${cartCount})` : ""}`}
              className={`flex items-center border-l-[1.5px] px-4 hover:bg-black hover:text-white ${border} ${text}`}
            >
              <PawnBagIcon count={cartCount} className="h-5 w-5" />
            </Link>

            {/* Burger */}
            <button
              type="button"
              aria-label="Menü öffnen"
              onClick={() => setMenuOpen(true)}
              className={`flex items-center border-l-[1.5px] px-4 hover:bg-black hover:text-white ${border} ${text}`}
            >
              <PawnMenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>



      {/*
        Mobile / tablet fullscreen menu.

        `data-offen` schaltet über `.menue-schicht` (index.css) die Sichtbarkeit.
        Vorher stand das geschlossene Menü nur auf `opacity: 0` — es war
        unsichtbar, aber vorhanden: die Tastatur wanderte durch elf Menüpunkte,
        die niemand sehen konnte. Die Regel setzt `visibility: hidden` erst nach
        Ablauf der Blende, das Ausblenden bleibt also erhalten.
      */}
      <div
        className={`menue-schicht fixed inset-0 z-[90] flex flex-col bg-white transition-opacity duration-500 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        data-offen={menuOpen ? "true" : "false"}
      >
        <div className="flex items-center justify-between border-b-[1.5px] border-black px-6 py-4">
          <PawnWordmark className="text-[1.6rem] text-black" />
          {/* Prüfstand 3.5 — das Kreuz war 20 × 20 px. Das Zeichen bleibt 20 px,
              der greifbare Kasten darum wird 44 px. */}
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMenuOpen(false)}
            className="trefferflaeche justify-center text-[#000000]"
          >
            <PawnCloseIcon className="h-5 w-5" />
          </button>
        </div>
        {/*
          Teil T — eine einzige Liste in einheitlicher Größe. Die frühere
          Zweiteilung (große Serifen-Punkte oben, kleine Versalien unten) ist
          aufgehoben: Start, Boutique und Vision stehen in derselben Größe wie
          alles Übrige. Jede Zeile trägt links ein Zeichen in einer Spalte
          fester Breite — deshalb beginnen alle Beschriftungen exakt auf einer
          Fluchtlinie, egal wie breit das Zeichen zeichnet.
        */}
        {/*
          Elf Zeilen à 44 px plus 18 px Abstand ergeben mehr, als auf ein
          Telefon passt — deshalb ist die Liste rollbar und das Polster knapp:
          die letzte Zeile schaut hervor und zeigt, dass es weitergeht.
        */}
        <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-8 py-4">
          {NAV_HAUPT.map((item) => (
            <MenueZeile
              key={item.label}
              to={item.to}
              end={item.end}
              Ikone={item.Ikone}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </MenueZeile>
          ))}
          {/* Eine Haarlinie trennt den festen Dreiklang vom Rest. Mehr Gliederung gibt es nicht. */}
          <span aria-hidden="true" className="block border-t border-[rgba(0,0,0,.18)]" />
          {NAV_MEHR.map((item) => (
            <MenueZeile
              key={item.label}
              to={item.to}
              Ikone={item.Ikone}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </MenueZeile>
          ))}
          <MenueZeile
            Ikone={IkoneFragPawn}
            onClick={() => { setMenuOpen(false); setChatOpen(true); }}
          >
            {t("nav.frag")} →
          </MenueZeile>
        </nav>
        {/* Prüfstand 3.5 — dieser Fuß trug die kleinsten Ziele der ganzen Seite
            („ANMELDEN" 91 × 14 px). Alle sechs Zeilen tragen jetzt dieselbe
            Trefferfläche; `space-y-2` fällt weg, weil die 44 px den Abstand
            mitbringen. */}
        <div className="border-t border-[rgba(0,0,0,.18)] px-8 py-3">
          {user ? (
            <>
              <Link to="/account" onClick={() => setMenuOpen(false)} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">{t("nav.account")}</Link>
              {isDesigner && <Link to="/studio" onClick={() => setMenuOpen(false)} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">{t("nav.myStudio")}</Link>}
              {!isDesigner && isApplicant && <Link to="/apply" onClick={() => setMenuOpen(false)} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">{t("nav.applicationStatus")}</Link>}
              {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">{t("nav.adminCockpit")}</Link>}
              <button type="button" onClick={() => { setMenuOpen(false); void handleSignOut(); }} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-black/70">{t("nav.logout")}</button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="trefferflaeche w-full text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">{t("nav.login")}</Link>
          )}
          <button
            type="button"
            onClick={() => setLocale(locale === "de" ? "en" : "de")}
            className="mt-2 flex min-h-[44px] items-center border-t border-[rgba(0,0,0,.18)] pt-3 text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]"
            aria-label={t("nav.language")}
          >
            {locale === "de" ? "DE → EN" : "EN → DE"}
          </button>
        </div>
      </div>


      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}


/**
 * Eine Zeile des aufgeklappten Menüs (Teil T).
 *
 * Alle Zeilen sind gleich gebaut: Zeichen links in einer Spalte fester Breite,
 * dann die Beschriftung. Weil die Spalte immer 22 px breit ist — unabhängig
 * davon, wie breit das einzelne Zeichen tatsächlich zeichnet — beginnen alle
 * Beschriftungen auf derselben Fluchtlinie.
 *
 * Der aktive Punkt ist ganz schwarz, die übrigen leicht zurückgenommen. Kein
 * Kasten, kein Balken: nur die Farbe unterscheidet. Zeichen und Schrift teilen
 * sich dieselbe Farbe (`currentColor`), also dunkeln sie beim Überfahren
 * gemeinsam nach.
 *
 * Ohne `to` wird daraus ein Knopf — für „Frag PAWN", das keine Seite ist.
 */
function MenueZeile({
  to, end, Ikone, onClick, children,
}: {
  to?: string;
  end?: boolean;
  Ikone: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const zeile = "flex min-h-[44px] w-full items-center gap-4 text-left font-serif text-[1.15rem] leading-tight transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current sm:text-[1.3rem]";
  const inhalt = (
    <>
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
        <Ikone className="h-[22px] w-[22px]" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </>
  );

  if (!to) {
    return (
      <button type="button" onClick={onClick} className={`${zeile} text-[#000000]/55 hover:text-[#000000]`} style={{ fontWeight: 500 }}>
        {inhalt}
      </button>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `${zeile} ${isActive ? "text-[#000000]" : "text-[#000000]/55 hover:text-[#000000]"}`}
      style={{ fontWeight: 500 }}
    >
      {inhalt}
    </NavLink>
  );
}

function MenuItem({ to, onClick, children }: { to: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-5 py-3 text-[0.68rem] uppercase tracking-[0.32em] text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"
    >
      {children}
    </Link>
  );
}
