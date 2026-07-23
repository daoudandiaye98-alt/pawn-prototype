import { NavLink, Link } from "react-router-dom";
import { ReactNode, useState } from "react";
import {
  LayoutGrid,
  Package,
  Layers,
  ShoppingBag,
  Wallet,
  Landmark,
  BarChart3,
  UserCircle2,
  LifeBuoy,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDisplayName } from "@/lib/displayName";

const ITEMS = [
  { to: "/portal", label: "Übersicht", icon: LayoutGrid, end: true },
  { to: "/portal/products", label: "Produkte", icon: Package },
  { to: "/portal/collections", label: "Kollektionen", icon: Layers },
  { to: "/portal/sales", label: "Verkäufe", icon: ShoppingBag },
  { to: "/portal/payouts", label: "Auszahlungen", icon: Wallet },
  { to: "/portal/bank", label: "Bankdaten", icon: Landmark },
  { to: "/portal/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/portal/editor", label: "Profil", icon: UserCircle2 },
  { to: "/portal/support", label: "Support", icon: LifeBuoy },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (parts.map((p) => p[0]).join("") || "P").toUpperCase();
}

export function PortalSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Link to="/" onClick={onNavigate} className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="font-serif text-xl tracking-[0.35em] text-sidebar-primary-foreground">PAWN</span>
        <span className="ml-3 text-[0.65rem] uppercase tracking-[0.28em] text-sidebar-foreground/60">Portal</span>
      </Link>
      <nav className="flex-1 overflow-y-auto py-4">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex min-h-[44px] items-center gap-3 px-6 py-2.5 text-[0.78rem] uppercase tracking-[0.18em] transition-colors",
                isActive
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Link
        to="/"
        onClick={onNavigate}
        className="mx-6 mb-4 flex min-h-[44px] items-center justify-center border border-sidebar-border px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.3em] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-foreground hover:text-sidebar"
      >
        Zur Ausstellung →
      </Link>
    </aside>
  );
}

export function PortalShell({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { designer } = useMyDesigner();
  const { displayName } = useDisplayName();
  const brand = designer?.brand_name ?? displayName ?? "Designer";
  const initials = initialsOf(brand);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <PortalSidebar />
      </div>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 z-50 h-full lg:hidden">
            <PortalSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-white px-4 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Menü"
              className="flex h-9 w-9 items-center justify-center lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="font-serif text-sm text-muted-foreground">Portal</span>
          </div>
          <Link
            to="/"
            className="flex min-h-[36px] items-center border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.24em] transition-colors hover:bg-foreground hover:text-background"
          >
            Zur Ausstellung →
          </Link>
        </div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:h-16 md:px-10 md:py-0">
          <div>
            {eyebrow && <p className="editorial-eyebrow">{eyebrow}</p>}
            <h1 className="font-serif text-2xl leading-none">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden truncate md:inline text-muted-foreground">{brand} · Designer</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-secondary text-foreground">{initials}</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-10">{children}</main>
      </div>
    </div>
  );
}
