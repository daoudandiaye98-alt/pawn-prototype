import { NavLink, Link } from "react-router-dom";
import { ReactNode } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function PortalSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <Link to="/" className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="font-serif text-xl tracking-[0.35em] text-sidebar-primary-foreground">PAWN</span>
        <span className="ml-3 text-[0.65rem] uppercase tracking-[0.28em] text-sidebar-foreground/60">Portal</span>
      </Link>
      <nav className="flex-1 py-4">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-6 py-2.5 text-[0.78rem] uppercase tracking-[0.18em] transition-colors",
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
    </aside>
  );
}

export function PortalShell({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      <PortalSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6 md:px-10">
          <div>
            {eyebrow && <p className="editorial-eyebrow">{eyebrow}</p>}
            <h1 className="font-serif text-2xl leading-none">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden md:inline text-muted-foreground">Y/PROJECT · Designer</span>
            <span className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-foreground">Y</span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
