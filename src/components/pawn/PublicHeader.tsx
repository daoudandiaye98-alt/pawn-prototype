import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/store/cart";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";

const NAV = [
  { label: "Women", to: "/shop?gender=women" },
  { label: "Men", to: "/shop?gender=men" },
  { label: "Unisex", to: "/shop?gender=unisex" },
  { label: "Designers", to: "/designers" },
  { label: "DNA", to: "/dna" },
  { label: "Clothing", to: "/shop?cat=clothing" },
  { label: "Accessories", to: "/shop?cat=accessories" },
];

export function PublicHeader() {
  const { count } = useCart();
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
      {/* Editorial utility bar */}
      <div className="border-b border-foreground/10 bg-foreground text-background">
        <div className="editorial-container flex h-7 items-center justify-between text-[0.6rem] uppercase tracking-[0.3em]">
          <span className="opacity-70">Worldwide shipping · Curated by PAWN</span>
          <span className="hidden sm:inline opacity-70">EN / EUR</span>
        </div>
      </div>

      <div className="border-b border-foreground/10">
        <div className="editorial-container flex h-20 items-center justify-between gap-6">
          <Link to="/" aria-label="PAWN — Home" className="flex items-center">
            <Logo className="h-7 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `text-[0.68rem] uppercase tracking-[0.26em] transition-colors hover:text-foreground ${
                    isActive || pathname === item.to.split("?")[0]
                      ? "text-foreground"
                      : "text-foreground/55"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-5 text-foreground/70">
            <button className="hidden hover:text-foreground sm:block" aria-label="Search">
              <Search className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
            </button>
            <Link to={user ? "/account" : "/auth"} className="hover:text-foreground" aria-label={user ? "Account" : "Sign in"}>
              <User className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
            </Link>
            <Link to="/account" className="hidden hover:text-foreground sm:block" aria-label="Wishlist">
              <Heart className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
            </Link>
            <Link to="/cart" className="relative hover:text-foreground" aria-label="Bag">
              <ShoppingBag className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.4} />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-accent px-1 text-[0.55rem] font-medium text-accent-foreground">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
