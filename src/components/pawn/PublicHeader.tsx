import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/store/cart";

const NAV = [
  { label: "Women", to: "/shop?gender=women" },
  { label: "Men", to: "/shop?gender=men" },
  { label: "Unisex", to: "/shop?gender=unisex" },
  { label: "Designers", to: "/designers" },
  { label: "Stories", to: "/dna" },
  { label: "Clothing", to: "/shop?cat=clothing" },
  { label: "Accessories", to: "/shop?cat=accessories" },
  { label: "AI Stylist", to: "/dna" },
];

export function PublicHeader() {
  const { count } = useCart();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="editorial-container flex h-16 items-center justify-between gap-6">
        <Link to="/" className="font-serif text-2xl tracking-[0.35em]">
          PAWN
        </Link>
        <nav className="hidden items-center gap-5 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `text-[0.72rem] uppercase tracking-[0.22em] transition-colors hover:text-foreground ${
                  isActive || pathname === item.to.split("?")[0]
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button className="hidden text-muted-foreground hover:text-foreground sm:block" aria-label="Search">
            <Search className="h-4 w-4" />
          </button>
          <Link to="/account" className="text-muted-foreground hover:text-foreground" aria-label="Account">
            <User className="h-4 w-4" />
          </Link>
          <Link to="/account" className="hidden text-muted-foreground hover:text-foreground sm:block" aria-label="Wishlist">
            <Heart className="h-4 w-4" />
          </Link>
          <Link to="/cart" className="relative text-muted-foreground hover:text-foreground" aria-label="Bag">
            <ShoppingBag className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-accent px-1 text-[0.55rem] font-medium text-accent-foreground">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
