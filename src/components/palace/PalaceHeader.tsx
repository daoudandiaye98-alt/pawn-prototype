import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SearchOverlay } from "./SearchOverlay";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ChatDrawer } from "./ChatDrawer";

export function PalaceHeader() {
  const { user, roles, signOut } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const NAV = [
    { label: t("nav.mode"), to: "/mode" },
    { label: t("nav.interior"), to: "/interior" },
    { label: t("nav.kunst"), to: "/kunst" },
    { label: t("nav.designer"), to: "/designers" },
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

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-700 ${
          scrolled
            ? "border-b border-[rgba(12,12,14,.13)] bg-[#F1EEE7]/85 backdrop-blur-md"
            : "border-b border-transparent bg-gradient-to-b from-[#F1EEE7]/70 to-transparent backdrop-blur-[2px]"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(.22,1,.36,1)" }}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5 md:px-14 md:py-6">
          <Link
            to="/"
            aria-label="PAWN"
            className="font-serif text-[0.9rem] font-light uppercase tracking-[0.42em] text-[#0C0C0E]"
          >
            P A W N
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `text-[0.7rem] uppercase tracking-[0.32em] transition-colors duration-300 ${
                    isActive ? "text-[#0C0C0E]" : "text-[#7C7972] hover:text-[#0C0C0E]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4 md:gap-6">
            <button
              type="button"
              aria-label="Suche"
              onClick={() => setSearchOpen(true)}
              className="hidden text-[#7C7972] hover:text-[#0C0C0E] md:inline-flex"
            >
              <Search className="h-4 w-4" strokeWidth={1.2} />
            </button>

            <button
              onClick={() => setChatOpen(true)}
              className="hidden items-center gap-2 border border-[rgba(12,12,14,.28)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.36em] text-[#0C0C0E] transition-colors duration-300 hover:bg-[#0C0C0E] hover:text-[#F1EEE7] md:flex"
            >
              <span className="h-[6px] w-[6px] rounded-full bg-[#0C0C0E]" />
              {t("nav.frag")}
            </button>


            <button
              type="button"
              onClick={() => setLocale(locale === "de" ? "en" : "de")}
              className="hidden text-[0.6rem] uppercase tracking-[0.32em] text-[#7C7972] hover:text-[#0C0C0E] md:inline"
              aria-label="Sprache wechseln"
            >
              {locale.toUpperCase()} · {locale === "de" ? "EN" : "DE"}
            </button>

            {user ? (
              <div ref={accountRef} className="relative hidden md:block">
                <button
                  type="button"
                  aria-label="Konto"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="text-[#7C7972] hover:text-[#0C0C0E]"
                >
                  <User className="h-4 w-4" strokeWidth={1.2} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full mt-3 w-64 border border-[rgba(12,12,14,.13)] bg-[#F1EEE7] shadow-[0_20px_60px_-30px_rgba(12,12,14,0.4)]">
                    <div className="border-b border-[rgba(12,12,14,.09)] px-5 py-4">
                      <p className="text-[0.55rem] uppercase tracking-[0.42em] text-[#7C7972]">Zutritt</p>
                      <p className="mt-1 font-serif text-[0.95rem] italic text-[#0C0C0E]">
                        {isAdmin ? "Kurator:in" : isDesigner ? "Atelier" : "Sammlung"}
                      </p>
                    </div>
                    <MenuItem to="/account" onClick={() => setAccountOpen(false)}>Mein Konto</MenuItem>
                    {isDesigner && <MenuItem to="/studio" onClick={() => setAccountOpen(false)}>Mein Studio</MenuItem>}
                    {isAdmin && <MenuItem to="/admin" onClick={() => setAccountOpen(false)}>Admin-Cockpit</MenuItem>}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full border-t border-[rgba(12,12,14,.09)] px-5 py-3 text-left text-[0.68rem] uppercase tracking-[0.32em] text-[#7C7972] hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
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
                className="hidden text-[#7C7972] hover:text-[#0C0C0E] md:inline-flex"
              >
                <User className="h-4 w-4" strokeWidth={1.2} />
              </Link>
            )}

            <button
              type="button"
              aria-label="Menü öffnen"
              onClick={() => setMenuOpen(true)}
              className="md:hidden text-[#0C0C0E]"
            >
              <Menu className="h-5 w-5" strokeWidth={1.2} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile fullscreen menu */}
      <div
        className={`fixed inset-0 z-[90] flex flex-col bg-[#F1EEE7] transition-opacity duration-500 md:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <span className="font-serif text-[0.9rem] uppercase tracking-[0.42em] text-[#0C0C0E]">P A W N</span>
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setMenuOpen(false)}
            className="text-[#0C0C0E]"
          >
            <X className="h-5 w-5" strokeWidth={1.2} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col justify-center gap-6 px-8">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="font-serif text-[2.6rem] font-light leading-[0.98] text-[#0C0C0E]"
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setChatOpen(true); }}
            className="mt-6 text-left font-serif italic text-[1.4rem] leading-tight text-[#0C0C0E]/80"
          >
            Frag PAWN →
          </button>
        </nav>
        <div className="space-y-2 border-t border-[rgba(12,12,14,.13)] px-8 py-6">
          {user ? (
            <>
              <Link to="/account" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#0C0C0E]">Mein Konto</Link>
              {isDesigner && <Link to="/studio" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#0C0C0E]">Mein Studio</Link>}
              {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#0C0C0E]">Admin-Cockpit</Link>}
              <button type="button" onClick={() => { setMenuOpen(false); void handleSignOut(); }} className="block text-[0.7rem] uppercase tracking-[0.32em] text-[#7C7972]">Abmelden</button>
            </>
          ) : (
            <Link to="/auth" onClick={() => setMenuOpen(false)} className="text-[0.7rem] uppercase tracking-[0.32em] text-[#0C0C0E]">Anmelden</Link>
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
      className="block px-5 py-3 text-[0.68rem] uppercase tracking-[0.32em] text-[#0C0C0E] hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
    >
      {children}
    </Link>
  );
}
