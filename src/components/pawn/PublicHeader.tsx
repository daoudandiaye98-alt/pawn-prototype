import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";
import { useAuth } from "@/lib/auth";

const NAV = [
  { label: "Women", to: "/shop?gender=women" },
  { label: "Men", to: "/shop?gender=men" },
  { label: "Unisex", to: "/shop?gender=unisex" },
  { label: "Designers", to: "/designers" },
  { label: "DNA", to: "/dna" },
  { label: "Clothing", to: "/shop?cat=clothing" },
  { label: "Accessories", to: "/shop?cat=accessories" },
];

/**
 * Fixed monumental nav — one door, always open.
 * On the home marble hero it floats transparent; once the user descends
 * into any darker room the marble bar fades back in for legibility.
 */
export function PublicHeader() {
  const { count } = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const veil = !isHome || scrolled;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-700 ${
        veil
          ? "bg-background/80 backdrop-blur-md border-b border-foreground/10"
          : "bg-transparent border-b border-transparent"
      }`}
      style={{ transitionTimingFunction: "var(--ease-pawn)" }}
    >
      <div
        className="mx-auto flex max-w-[1600px] items-end justify-between px-6 py-5 md:px-14 md:py-7"
        style={{ mixBlendMode: veil ? "normal" : "difference", color: veil ? undefined : "white" }}
      >
        <Link to="/" aria-label="PAWN" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold uppercase tracking-[-0.02em] md:text-3xl">
            Pawn
          </span>
          <span className="hidden text-[10px] font-light uppercase tracking-[0.28em] opacity-60 md:inline">
            Est. Archiv
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `text-[11px] uppercase tracking-[0.3em] transition-colors duration-500 hover:opacity-100 ${
                  isActive || pathname === item.to.split("?")[0] ? "opacity-100" : "opacity-60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <button className="hidden opacity-70 hover:opacity-100 sm:block" aria-label="Search">
            <Search className="h-4 w-4" strokeWidth={1.3} />
          </button>
          <Link to={user ? "/account" : "/auth"} className="opacity-70 hover:opacity-100" aria-label={user ? "Account" : "Sign in"}>
            <User className="h-4 w-4" strokeWidth={1.3} />
          </Link>
          <Link to="/account" className="hidden opacity-70 hover:opacity-100 sm:block" aria-label="Wishlist">
            <Heart className="h-4 w-4" strokeWidth={1.3} />
          </Link>
          <Link to="/cart" className="relative opacity-80 hover:opacity-100" aria-label="Bag">
            <ShoppingBag className="h-4 w-4" strokeWidth={1.3} />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-foreground px-1 text-[0.55rem] font-medium text-background">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
