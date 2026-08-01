import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { LogOut, Menu, Bell, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { useCopilot } from "./CopilotDrawer";
import { useDesignerLevel } from "@/features/studio/useDesignerLevel";
import { LevelUpOverlay } from "@/features/studio/LevelUpOverlay";
import { ContractV2Banner } from "@/features/studio/ContractV2Banner";
import { usePlanQuota, formatQuota, type Plan } from "@/features/campaign/quota";
import { Begleiter } from "./Begleiter";

import { useDisplayName } from "@/lib/displayName";

/* Hairline inline icons (stroke 1.25) — quiet, monogram-like */
const IStage = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M3 15h14M5 15V8l5-4 5 4v7M9 15v-4h2v4" /></svg>
);
const ICollection = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="3" width="6" height="6" /><rect x="11" y="3" width="6" height="6" /><rect x="3" y="11" width="6" height="6" /><rect x="11" y="11" width="6" height="6" /></svg>
);
const IOrders = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M4 4h12l-1 12H5L4 4zM7 8h6M7 11h6" /></svg>
);
const ICampaigns = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M4 8l10-4v12L4 12V8zM4 8v4M14 6v10" /></svg>
);
const IMessages = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M3 5h14v9H8l-5 3V5z" /></svg>
);
const IRetro = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M10 3l3 5 5 .8-3.6 3.6.9 5L10 15l-5.2 2.4.9-5L2 8.8 7 8l3-5z" /></svg>
);
const IPayout = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="6" width="14" height="10" /><path d="M3 9h14M7 13h3" /></svg>
);
const ISettings = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><circle cx="10" cy="10" r="2.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></svg>
);
const IVideothek = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="5" width="14" height="10" /><path d="M8.5 8l4 2-4 2V8z" /></svg>
);
const IMediathek = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="4" width="14" height="12" /><circle cx="7.5" cy="9" r="1.5" /><path d="M5 14l3.5-3.5L11 13l2-2 2 2.5" /></svg>
);
const IHausseite = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="2.5" y="3" width="15" height="14" /><path d="M10 3v14M5 7h2M5 11h2M13 7h2M13 11h2" /></svg>
);
const IContentBegleiter = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M4 4h9l3 3v9H4z" /><path d="M13 4v3h3" /><path d="M7 10h6M7 13h4" /></svg>
);
const IReferral = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><circle cx="5" cy="6" r="2" /><circle cx="15" cy="6" r="2" /><circle cx="10" cy="15" r="2" /><path d="M6.6 7.5L9 13.5M13.4 7.5L11 13.5" /></svg>
);
const IWerkbuch = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M4 3c3 1.5 3 12 0 14M16 3c-3 1.5-3 12 0 14M4 6c4 2 8 2 12 0M4 14c4-2 8-2 12 0" /></svg>
);

type NavItem = { to: string; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; end?: boolean; badge?: number };

function useStudioBadges(designerId?: string) {
  const [badges, setBadges] = useState({ orders: 0, campaigns: 0, messages: 0 });
  useEffect(() => {
    if (!designerId) return;
    (async () => {
      const [ords, camps, msgs] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "proposed"),
        supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "open"),
      ]);
      setBadges({ orders: ords.count ?? 0, campaigns: camps.count ?? 0, messages: msgs.count ?? 0 });
    })();
  }, [designerId]);
  return badges;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (parts.map((p) => p[0]).join("") || "P").toUpperCase();
}

function firstNameOf(u: { displayName?: string | null }, brand?: string | null, email?: string | null) {
  const src = (u.displayName || "").trim();
  if (src) return src.split(/\s+/)[0];
  if (brand) return brand;
  if (email) return email.split("@")[0];
  return "Designer";
}

export { firstNameOf };

function LevelPlaque({ designerId }: { designerId?: string }) {
  const { level } = useDesignerLevel(designerId);
  if (!designerId) return null;
  const pct = Math.max(0, Math.min(1, level.progress));
  return (
    <div className="mx-6 mb-6 border-[1.5px] border-white/25 p-4">
      <div className="flex items-center gap-3">
        <span className="font-serif text-2xl leading-none">{level.glyph}</span>
        <div className="min-w-0">
          <p className="font-serif text-sm leading-none">{level.label}</p>
          <p className="mt-1 text-[0.58rem] uppercase tracking-[0.22em] text-white/45">
            {level.level === "dame" ? "Höchster Rang" : `Nächster Rang · ${level.next}`}
          </p>
        </div>
      </div>
      {level.level !== "dame" && (
        <div className="mt-3 h-[3px] w-full bg-white/10">
          <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { designer } = useMyDesigner();
  const badges = useStudioBadges(designer?.id);
  const { pathname } = useLocation();

  const brand = designer?.brand_name ?? "Studio";
  const initials = initialsOf(brand);

  const items: NavItem[] = [
    { to: "/studio", label: "Übersicht", icon: IStage, end: true },
    { to: "/studio/mediathek", label: "Mediathek", icon: IMediathek },
    { to: "/studio/content-begleiter", label: "Content-Begleiter", icon: IContentBegleiter },
    { to: "/studio/produkte", label: "Kollektion", icon: ICollection },
    { to: "/studio/bestellungen", label: "Bestellungen", icon: IOrders, badge: badges.orders },
    { to: "/studio/versand", label: "Versand", icon: IOrders },
    { to: "/studio/kampagnen", label: "Kampagnen", icon: ICampaigns, badge: badges.campaigns },
    { to: "/studio/videothek", label: "Videothek", icon: IVideothek },
    { to: "/studio/nachrichten", label: "Nachrichten", icon: IMessages, badge: badges.messages },
    { to: "/studio/hausseite", label: "Hausseite", icon: IHausseite },
    { to: "/studio/empfehlungen", label: "Empfehlungen", icon: IReferral },
    { to: "/studio/dna", label: "Außenauge", icon: IWerkbuch },
    { to: "/studio/brand", label: "Retrospektive", icon: IRetro },
    { to: "/studio/plan", label: "Plan", icon: IPayout },
    { to: "/studio/auszahlung", label: "Auszahlung", icon: IPayout },
    { to: "/studio/einstellungen", label: "Einstellungen", icon: ISettings },
  ];

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col bg-foreground text-white/85">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-white/25 font-serif text-xs tracking-wider">{initials}</span>
          <div className="min-w-0">
            <p className="truncate font-serif text-[1.05rem] font-medium leading-none">{brand}</p>
            <p className="mt-1 text-[0.6rem] uppercase tracking-[0.24em] text-white/45">Studio · Retrospektive</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-3">
        {items.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 px-6 py-2.5 text-[0.78rem] tracking-[0.06em] transition-colors",
                active ? "bg-white/[0.06] text-white" : "text-white/60 hover:text-white/90",
              )}>
              {active && <span className="absolute left-0 top-0 h-full w-px bg-white" />}
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[0.62rem] font-medium text-foreground">{item.badge}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <Link
        to="/"
        onClick={onNavigate}
        className="mx-6 mb-4 border border-white/25 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.3em] text-white/80 transition-colors hover:bg-white hover:text-black"
      >
        Zur Ausstellung →
      </Link>

      {designer && <LevelPlaque designerId={designer.id} />}
    </aside>
  );
}

/** Kontingent dauerhaft sichtbar, egal auf welcher Studio-Seite — Details liegen auf /studio/plan. */
function CreditsPill({ designerId, plan }: { designerId: string; plan: Plan }) {
  const quota = usePlanQuota(designerId, plan);
  if (quota.loading) return null;
  return (
    <Link to="/studio/plan" title="Dein Monat"
      className="hidden items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-[0.68rem] tabular-nums tracking-wide hover:border-foreground sm:inline-flex">
      {formatQuota(quota.used.videos, quota.unlimited ? -1 : quota.limits.videos, "Videos")}
    </Link>
  );
}

function Topbar({ title, section }: { title: string; section?: string }) {
  const { user, signOut } = useAuth();
  const { designer } = useMyDesigner();
  const { firstName } = useDisplayName();
  const nav = useNavigate();
  const copilot = useCopilot();
  const [unread, setUnread] = useState(0);
  const plusActive = designer?.plan === "atelier" || designer?.plan === "maison";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
      setUnread(count ?? 0);
    })();
  }, [user]);


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/85 px-6 backdrop-blur-md">
      <div className="min-w-0">
        <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">Studio · {section ?? title}</p>
        <p className="mt-0.5 truncate font-serif text-lg leading-none">{title}</p>
      </div>

      <div className="flex items-center gap-3">
        {designer && <CreditsPill designerId={designer.id} plan={((designer as unknown as { plan?: Plan }).plan) ?? "haus"} />}
        {designer && (
          <Link to={`/designer/${designer.slug}`} target="_blank" rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-[0.68rem] tracking-wide hover:bg-muted">
            Meine Retrospektive ansehen <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        <LanguageToggle className="h-9" />
        <button aria-label="Benachrichtigungen" onClick={() => nav("/account")} className="relative flex h-9 w-9 items-center justify-center border border-border bg-white hover:bg-muted">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />}
        </button>
        <button onClick={copilot.toggle} className="relative flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[0.7rem] tracking-wider text-white hover:bg-foreground/90">
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <Sparkles className="h-3.5 w-3.5" />
          Copilot
          {plusActive && (
            <span
              title="Stärkeres Denkmodell aktiv"
              className="ml-1 rounded-full border border-white/50 px-1.5 py-0.5 text-[0.55rem] font-medium uppercase tracking-[0.16em] text-white/90"
            >
              PAWN+
            </span>
          )}
        </button>
        <span className="hidden md:inline-flex h-9 w-9 items-center justify-center border border-border bg-white text-xs">
          {(firstName[0] ?? "?").toUpperCase()}
        </span>
        <button onClick={() => { void signOut(); nav("/"); }} aria-label="Abmelden" className="flex h-9 w-9 items-center justify-center border border-border bg-white hover:bg-muted">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

interface Props { children: ReactNode; title: string; eyebrow?: string; begleiterStep?: string }

function Inner({ children, title, eyebrow, begleiterStep }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { designer } = useMyDesigner();
  const { pathname } = useLocation();
  const plan = ((designer as unknown as { plan?: Plan })?.plan) ?? "haus";
  const quota = usePlanQuota(designer?.id, plan);
  return (
    <div className="flex min-h-screen bg-background">
      <LevelUpOverlay designerId={designer?.id} />
      {designer && <Begleiter pathname={pathname} step={begleiterStep} plan={plan} quota={quota} />}
      {/* Desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 z-50 h-full lg:hidden">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden flex h-12 items-center border-b border-border bg-white px-4">
          <button onClick={() => setMobileOpen(true)} aria-label="Menü"><Menu className="h-4 w-4" /></button>
          <p className="ml-3 font-serif">Studio</p>
        </div>
        <Topbar title={title} section={eyebrow ?? title} />
        {designer && <ContractV2Banner />}
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}


export function StudioShell(props: Props) {
  return <Inner {...props} />;
}

