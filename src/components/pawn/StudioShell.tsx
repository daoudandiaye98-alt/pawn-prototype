import { NavLink, Link, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { LayoutGrid, Package, Megaphone, UserCircle2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";

const ITEMS = [
  { to: "/studio", label: "Übersicht", icon: LayoutGrid, end: true },
  { to: "/studio/produkte", label: "Produkte", icon: Package },
  { to: "/studio/kampagnen", label: "Kampagnen", icon: Megaphone },
  { to: "/studio/brand", label: "Brand-Page", icon: UserCircle2 },
  { to: "/studio/nachrichten", label: "Nachrichten", icon: UserCircle2 },
  { to: "/studio/auszahlung", label: "Auszahlung", icon: UserCircle2 },
];

export function StudioShell({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  const { signOut, user } = useAuth();
  const { designer } = useMyDesigner();
  const navigate = useNavigate();

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <Link to="/" className="flex h-16 items-center border-b border-sidebar-border px-6">
          <span className="font-serif text-xl tracking-[0.35em] text-sidebar-primary-foreground">PAWN</span>
          <span className="ml-3 text-[0.62rem] uppercase tracking-[0.28em] text-sidebar-foreground/60">Studio</span>
        </Link>
        <nav className="flex-1 py-4">
          {ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-6 py-2.5 text-[0.78rem] uppercase tracking-[0.18em] transition-colors",
                isActive
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                  : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60",
              )}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-6 py-4">
          <button onClick={handleSignOut} className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="h-3.5 w-3.5" /> Abmelden
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6 md:px-10">
          <div>
            {eyebrow && <p className="editorial-eyebrow">{eyebrow}</p>}
            <h1 className="font-serif text-2xl leading-none">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <span className="hidden md:inline text-xs text-muted-foreground">
              {designer?.brand_name ?? user?.email ?? "Designer"}
            </span>
            <span className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-foreground text-xs">
              {(designer?.brand_name ?? user?.email ?? "?")[0]?.toUpperCase()}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
