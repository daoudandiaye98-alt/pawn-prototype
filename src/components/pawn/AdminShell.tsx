import { NavLink } from "react-router-dom";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { ReactNode } from "react";
import { useCopilot } from "./CopilotDrawer";
import {
  LayoutGrid,
  Activity,
  Package,
  ClipboardList,
  FileSignature,
  Newspaper,
  Megaphone,
  TrendingUp,
  Bot,
  Sparkles,
  UserPlus,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const ITEMS = [
  { to: "/admin", label: "Kontrollhub", icon: LayoutGrid, end: true },
  { to: "/admin/dna", label: "Global DNA", icon: Activity },
  { to: "/admin/products", label: "Produkte", icon: Package },
  { to: "/admin/zahlungen", label: "Zahlungen", icon: ClipboardList },
  { to: "/admin/nachrichten", label: "Nachrichten", icon: FileSignature },
  { to: "/admin/designers", label: "Bewerbungen", icon: FileSignature },
  { to: "/admin/akquise", label: "Akquise", icon: UserPlus },
  { to: "/admin/inhalte", label: "Inhalte", icon: Newspaper },
  { to: "/admin/werbung", label: "Werbung", icon: Megaphone },
  { to: "/admin/kampagnen", label: "Kampagnen", icon: Megaphone },
  { to: "/admin/posting", label: "Posting", icon: Megaphone },
  { to: "/admin/trends", label: "Trends", icon: TrendingUp },
  { to: "/admin/ki", label: "KI Cockpit", icon: Bot },
  { to: "/admin/jarvis", label: "Jarvis", icon: Brain },
  { to: "/admin/aktionen", label: "Aktionen", icon: Sparkles },
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <Link to="/" className="flex h-16 items-center border-b border-sidebar-border px-6" title="Zur Ausstellung">
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
      <Link
        to="/"
        className="mx-6 mb-4 border border-white/25 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.3em] text-white/80 transition-colors hover:bg-white hover:text-black"
      >
        Zur Ausstellung →
      </Link>
      <div className="border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/50">
        v0.1 · Prototype
      </div>
    </aside>
  );
}

function AdminCopilotPill() {
  const copilot = useCopilot();
  return (
    <button
      onClick={copilot.toggle}
      className="flex items-center gap-2 rounded-full bg-[#0B0B0D] px-4 py-2 text-[0.7rem] tracking-wider text-white hover:bg-black"
      title="Admin-Copilot öffnen"
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <Sparkles className="h-3.5 w-3.5" />
      Copilot
    </button>
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
            <AdminCopilotPill />
            <NotificationBell />
            <span className="hidden md:inline">Heute, {new Date().toLocaleDateString("de-DE")}</span>
            <span className="flex h-8 w-8 items-center justify-center border border-border bg-secondary text-foreground">A</span>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}
