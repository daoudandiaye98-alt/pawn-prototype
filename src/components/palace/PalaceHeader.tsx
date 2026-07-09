import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { SearchOverlay } from "./SearchOverlay";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ChatDrawer } from "./ChatDrawer";
import { useCart } from "@/store/cart";
import { PawnBagIcon, PawnCloseIcon, PawnMenuIcon, PawnProfileIcon, PawnSearchIcon } from "@/components/pawn/icons/PawnIcons";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/**
 * Palace header.
 * - Logo is a single non-wrapping wordmark (fixed width).
 * - Nav collapses into the burger menu below the `lg` breakpoint (1024px)
 *   so we never quetsch items on iPad and 13" laptops.
 * - All nav items and utility buttons use whitespace-nowrap.
 */
export function PalaceHeader() {
  const { user, roles, signOut } = useAuth();
  const { count: cartCount } = useCart();
  const { locale, setLocale, t } = useI18n();
  const NAV = [
    { label: t("nav.mode"), to: "/mode" },
    { label: t("nav.interior"), to: "/interior" },
    { label: t("nav.kunst"), to: "/kunst" },
    { label: t("nav.designer"), to: "/designers" },
    { label: "Style", to: "/style" },
    { label: "Deine DNA", to: "/dna" },
    { label: t("nav.forDesigners"), to: "/apply" },
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

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 border-b-[1.5px] border-black bg-white"
        style={{ transitionTimingFunction: "cubic-bezier(.76,0,.18,1)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1600px] items-stretch">
          {/* Logo cell */}
          <Link
            to="/"
            aria-label="PAWN"
            className="flex items-center whitespace-nowrap border-r-[1.5px] border-black px-5 text-black md:px-7 hover-invert"
          >
            <PawnWordmark className="text-[1.35rem] md:text-[1.5rem]" />
          </Link>

          {/* Nav cells */}
          <nav className="hidden min-w-0 flex-1 items-stretch xl:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center whitespace-nowrap border-r border-[rgba(0,0,0,.18)] px-5 text-[0.66rem] uppercase tracking-[0.3em] transition-colors duration-200 hover:bg-black hover:text-white ${
                    isActive ? "bg-black text-white" : "text-[#111]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-stretch xl:ml-0">
            {/* Frag PAWN — solid black cell with blinking dot */}
            <button
              onClick={() => setChatOpen(true)}
              className="hidden items-center gap-2 whitespace-nowrap border-l-[1.5px] border-black bg-black px-4 text-[0.62rem] uppercase tracking-[0.32em] text-white transition-colors duration-200 hover:bg-white hover:text-black xl:flex xl:px-5"
            >
              <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-current" />
              {t("nav.frag")}
            </button>

            {/* Search cell */}
            <button
              type="button"
              aria-label="Suche"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center border-l-[1.5px] border-black px-4 text-[#111] hover:bg-black hover:text-white md:inline-flex"
            >
              <PawnSearchIcon className="h-5 w-5" />
            </button>

            {/* Locale cell */}
            <button
              type="button"
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              className="hidden items-center whitespace-nowrap border-l border-[rgba(0,0,0,.18)] px-3 text-[0.6rem] uppercase tracking-[0.28em] text-[#111] hover:bg-black hover:text-white xl:inline-flex"
              aria-label="Sprache wechseln"
            >
              {locale.toUpperCase()}
            </button>

            {/* Account cell */}
            {user ? (
              <div ref={accountRef} className="relative hidden border-l-[1.5px] border-black xl:block">
                <button
                  type="button"
                  aria-label="Konto"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex h-full items-center px-4 text-[#111] hover:bg-black hover:text-white"
                >
                  <PawnProfileIcon className="h-5 w-5" />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full w-64 border-[1.5px] border-black bg-white shadow-[6px_6px_0_#000]">
                    <div className="border-b-[1.5px] border-black px-5 py-4">
                      <p className="text-[0.55rem] uppercase tracking-[0.42em] text-[#55534E]">Zutritt</p>
                      <p className="mt-1 font-serif italic text-[0.95rem] text-[#000000]" style={{ fontWeight: 500 }}>
                        {isAdmin ? "Kurator:in" : isDesigner ? "Atelier" : isApplicant ? "Bewerbung" : "Sammlung"}
                      </p>
                    </div>
                    <MenuItem to="/account" onClick={() => setAccountOpen(false)}>Mein Konto</MenuItem>
                    <MenuItem to="/dna" onClick={() => setAccountOpen(false)}>Deine DNA</MenuItem>
                    {isDesigner && <MenuItem to="/studio" onClick={() => setAccountOpen(false)}>Mein Studio</MenuItem>}
                    {!isDesigner && isApplicant && <MenuItem to="/apply" onClick={() => setAccountOpen(false)}>Bewerbungsstatus</MenuItem>}
                    {isAdmin && <MenuItem to="/admin" onClick={() => setAccountOpen(false)}>Admin-Cockpit</MenuItem>}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full border-t-[1.5px] border-black px-5 py-3 text-left text-[0.68rem] uppercase tracking-[0.32em] text-[#55534E] hover:bg-black hover:text-white"
                    >
                      Abmelden
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                aria-label="Anmelden"
                className="hidden items-center border-l-[1.5px] border-black px-4 text-[#111] hover:bg-black hover:text-white xl:inline-flex"
              >
                <PawnProfileIcon className="h-5 w-5" />
              </Link>
            )}

            {/* Cart cell */}
            <Link
              to="/cart"
              aria-label={`Warenkorb${cartCount > 0 ? ` (${cartCount})` : ""}`}
              className="flex items-center border-l-[1.5px] border-black px-4 text-[#111] hover:bg-black hover:text-white"
            >
              <PawnBagIcon count={cartCount} className="h-5 w-5" />
            </Link>

            {/* Burger */}
            <button
              type="button"
              aria-label="Menü öffnen"
              onClick={() => setMenuOpen(true)}
              className="flex items-center border-l-[1.5px] border-black px-4 text-[#000000] hover:bg-black hover:text-white xl:hidden"
            >
              <PawnMenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>



      {/* Mobile / tablet fullscreen menu */}
      <div
        className={`fixed inset-0 z-[90] flex flex-col bg-white transition-opacity duration-500 xl:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b-[1.5px] border-black px-6 py-4">
          <PawnWordmark className="text-[1.6rem] text-black" />
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMenuOpen(false)}
            className="text-[#000000]"
          >
            <PawnCloseIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col justify-center gap-6 px-8">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="whitespace-nowrap font-serif text-[2.4rem] leading-[0.98] text-[#000000]"
              style={{ fontWeight: 500 }}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setChatOpen(true); }}
            className="mt-6 text-left font-serif italic text-[1.4rem] leading-tight text-[#000000]/80"
            style={{ fontWeight: 500 }}
          >
            Frag PAWN →
          </button>
        </nav>
        <div className="space-y-2 border-t border-[rgba(0,0,0,.18)] px-8 py-6">
          {user ? (
            <>
              <Link to="/account" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">Mein Konto</Link>
              {isDesigner && <Link to="/studio" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">Mein Studio</Link>}
              {!isDesigner && isApplicant && <Link to="/apply" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">Bewerbungsstatus</Link>}
              {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">Admin-Cockpit</Link>}
              <button type="button" onClick={() => { setMenuOpen(false); void handleSignOut(); }} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#55534E]">Abmelden</button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="text-[0.7rem] uppercase tracking-[0.32em] text-[#000000]">Anmelden</Link>
          )}
        </div>
      </div>


      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
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
