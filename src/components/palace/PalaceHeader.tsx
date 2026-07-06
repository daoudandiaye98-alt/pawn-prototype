import { Link, NavLink } from "react-router-dom";
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ChatDrawer } from "./ChatDrawer";

const NAV = [
  { label: "Mode", to: "/mode" },
  { label: "Interior", to: "/interior" },
  { label: "Kunst", to: "/kunst" },
  { label: "Designer", to: "/designers" },
];

export function PalaceHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

          <div className="flex items-center gap-6">
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 border border-[rgba(12,12,14,.28)] px-4 py-2 text-[0.62rem] uppercase tracking-[0.36em] text-[#0C0C0E] transition-colors duration-300 hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
            >
              <span className="h-[6px] w-[6px] rounded-full bg-[#0C0C0E]" />
              Frag PAWN
            </button>
            <Link
              to={user ? "/account" : "/auth"}
              aria-label={user ? "Konto" : "Anmelden"}
              className="text-[#7C7972] hover:text-[#0C0C0E]"
            >
              <User className="h-4 w-4" strokeWidth={1.2} />
            </Link>
          </div>
        </div>
      </header>
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
