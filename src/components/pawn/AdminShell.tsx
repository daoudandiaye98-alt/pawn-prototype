import { NavLink } from "react-router-dom";
import { ReactNode } from "react";
import {
  LayoutGrid,
  Activity,
  Package,
  ClipboardList,
  Users,
  FileSignature,
  UserCircle2,
  Newspaper,
  Megaphone,
  BarChart3,
  Bot,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const ITEMS = [
  { to: "/admin", label: "Kontrollhub", icon: LayoutGrid, end: true },
  { to: "/admin/dna", label: "Global DNA", icon: Activity },
  { to: "/admin/products", label: "Produkte", icon: Package },
  { to: "/admin/orders", label: "Bestellungen", icon: ClipboardList },
  { to: "/admin/designers", label: "Bewerbungen", icon: FileSignature },
  { to: "/admin/customers", label: "Kunden", icon: UserCircle2 },
  { to: "/admin/content", label: "Inhalte", icon: Newspaper },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/ai", label: "AI Center", icon: Bot },
  { to: "/admin/settings", label: "Einstellungen", icon: Settings },
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <Link to="/" className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="font-serif text-xl tracking-[0.35em] text-sidebar-primary-foreground">PAWN</span>
        <span className="ml-3 text-[0.65rem] uppercase tracking-[0.28em] text-sidebar-foreground/60">Admin</span>
      </Link>
      <nav className="flex-1 overflow-y-auto py-4">
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
                  : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/50">
        v0.1 · Prototype
      </div>
    </aside>
  );
}

export function AdminShell({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow?: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6 md:px-10">
          <div>
            {eyebrow && <p className="editorial-eyebrow">{eyebrow}</p>}
            <h1 className="font-serif text-2xl leading-none">{title}</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="hidden md:inline">Heute, {new Date().toLocaleDateString("de-DE")}</span>
            <span className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-foreground">A</span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
