import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { LogOut, Menu, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { LevelUpOverlay } from "@/features/studio/LevelUpOverlay";
import { ContractV2Banner } from "@/features/studio/ContractV2Banner";
import { KasseBanner } from "@/features/studio/KasseBanner";
import { PawnDeck } from "./PawnDeck";
import { markRoomUsedOncePerSession, roomKeyForPath } from "@/lib/pawnSignal";

import { useDisplayName } from "@/lib/displayName";
import { useI18n } from "@/lib/i18n";

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
const IMessages = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M3 5h14v9H8l-5 3V5z" /></svg>
);
const IVideothek = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="3" y="5" width="14" height="10" /><path d="M8.5 8l4 2-4 2V8z" /></svg>
);
const IHausseite = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><rect x="2.5" y="3" width="15" height="14" /><path d="M10 3v14M5 7h2M5 11h2M13 7h2M13 11h2" /></svg>
);
const IDoor = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.25} {...p}><path d="M6 17V3.6L14 3v14" /><path d="M4 17h12" /><circle cx="11.3" cy="10" r="0.8" fill="currentColor" stroke="none" /></svg>
);

type NavItem = { to: string; label: string; hint?: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; end?: boolean; badge?: number };

function useStudioBadges(designerId?: string) {
  const [badges, setBadges] = useState({ orders: 0, campaigns: 0, messages: 0, tueren: 0 });
  useEffect(() => {
    if (!designerId) return;
    (async () => {
      const [ords, camps, msgs, tueren] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "proposed"),
        supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "open"),
        supabase.from("designer_opportunities" as never).select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "gefunden"),
      ]);
      setBadges({ orders: ords.count ?? 0, campaigns: camps.count ?? 0, messages: msgs.count ?? 0, tueren: tueren.count ?? 0 });
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

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { designer } = useMyDesigner();
  const badges = useStudioBadges(designer?.id);
  const { pathname } = useLocation();
  const { t } = useI18n();

  const brand = designer?.brand_name ?? t("studioShell.studioFallback");
  const initials = initialsOf(brand);

  // Teil K1 — Sidebar-Faltung. Kernregel: Menüpunkte tragen KEINE Untertitel; braucht ein
  // Punkt einen Erklärsatz, ist der Name falsch. Zweite Regel: Erstellen und Verwalten
  // derselben Sache sind EINE Fläche (Tabs), nie zwei Menüpunkte. Gefaltet wurde:
  // Kollektion+Bilder → Werke · Markenseite+Markenprofil → Doppelseite (Seite/Stil) ·
  // Videos erstellen+Fertige Videos → Clips (Neu/Fertig). "Marke aufbauen", "Rückblick"
  // und "Ideen-Begleiter" leben als Züge/Karten im Hub, nicht als Orte.
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: t("studioShell.group.zug"),
      items: [
        { to: "/studio", label: t("studioShell.nav.start"), icon: IStage, end: true },
      ],
    },
    {
      title: t("studioShell.group.haus"),
      items: [
        { to: "/studio/werke", label: t("studioShell.nav.werke"), icon: ICollection },
        { to: "/studio/doppelseite", label: t("studioShell.nav.doppelseite"), icon: IHausseite },
        { to: "/studio/clips", label: t("studioShell.nav.clips"), icon: IVideothek, badge: badges.campaigns },
      ],
    },
    {
      title: t("studioShell.group.postfach"),
      items: [
        { to: "/studio/bestellungen", label: t("studioShell.nav.bestellungen"), icon: IOrders, badge: badges.orders },
        { to: "/studio/nachrichten", label: t("studioShell.nav.nachrichten"), icon: IMessages, badge: badges.messages },
        { to: "/studio/tueren", label: t("studioShell.nav.tueren"), icon: IDoor, badge: badges.tueren },
      ],
    },
  ];

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col bg-foreground text-white/85">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-white/25 font-serif text-xs tracking-wider">{initials}</span>
          <div className="min-w-0">
            <p className="truncate font-serif text-[1.05rem] font-medium leading-none">{brand}</p>
            <p className="mt-1 text-[0.6rem] uppercase tracking-[0.24em] text-white/45">{t("studioShell.yourStudio")}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-2">
            <p className="px-6 pb-1 pt-3 text-[0.58rem] uppercase tracking-[0.28em] text-white/35">{group.title}</p>
            {group.items.map((item) => {
              const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate}
                  className={cn(
                    "relative flex items-start gap-3 px-6 py-2 text-[0.78rem] tracking-[0.06em] transition-colors",
                    active ? "bg-white/[0.06] text-white" : "text-white/60 hover:text-white/90",
                  )}>
                  {active && <span className="absolute left-0 top-0 h-full w-px bg-white" />}
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[0.62rem] font-medium text-foreground">{item.badge}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>


      <Link
        to="/"
        onClick={onNavigate}
        className="mx-6 mb-6 border border-white/25 px-3 py-2 text-center text-[0.62rem] uppercase tracking-[0.3em] text-white/80 transition-colors hover:bg-white hover:text-black"
      >
        {t("studioShell.toExhibition")}
      </Link>
    </aside>
  );
}

function Topbar({ title, section }: { title: string; section?: string }) {
  const { user, signOut } = useAuth();
  const { designer } = useMyDesigner();
  const { firstName } = useDisplayName();
  const nav = useNavigate();
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);

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
        <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studioShell.studio")} · {section ?? title}</p>
        <p className="mt-0.5 truncate font-serif text-lg leading-none">{title}</p>
      </div>

      {/* Teil K1 — Topbar aufgeräumt: das Video-Kontingent lebt jetzt in der Clips-Fläche,
          der Seiten-Link auf dem Hub. Es bleiben Sprachumschalter, Glocke, Profil (+ Abmelden). */}
      <div className="flex items-center gap-3">
        <LanguageToggle className="h-9" />
        <button aria-label={t("studioShell.notifications")} onClick={() => nav("/account")} className="relative flex h-9 w-9 items-center justify-center border border-border bg-white hover:bg-muted">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />}
        </button>
        <Link to="/studio/einstellungen" aria-label={t("studioShell.profil")} title={t("studioShell.profil")}
          className="hidden md:inline-flex h-9 w-9 items-center justify-center border border-border bg-white text-xs hover:bg-muted">
          {(firstName[0] ?? "?").toUpperCase()}
        </Link>
        <button onClick={() => { void signOut(); nav("/"); }} aria-label={t("studioShell.signOut")} className="flex h-9 w-9 items-center justify-center border border-border bg-white hover:bg-muted">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

interface Props { children: ReactNode; title: string; eyebrow?: string }

function Inner({ children, title, eyebrow }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { designer } = useMyDesigner();
  const { pathname } = useLocation();
  const { locale, setLocale, t } = useI18n();

  // Teil 25: die im Haus-Profil gespeicherte Sprache gilt im Studio, unabhängig vom Browser
  // dessen, der zufällig zuerst dieses Gerät benutzt hat — beim Laden übernehmen …
  useEffect(() => {
    if (designer && (designer.preferred_language === "de" || designer.preferred_language === "en") && designer.preferred_language !== locale) {
      setLocale(designer.preferred_language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designer?.id]);
  // … und ändert der Designer die Sprache im Studio, schreiben wir sie ins Profil zurück.
  useEffect(() => {
    if (designer && designer.preferred_language !== locale) {
      void supabase.from("designers").update({ preferred_language: locale }).eq("id", designer.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Teil 31: das PAWN-Deck ist die einzige PAWN-Präsenz unten im Studio — ersetzt Leiste,
  // Begleiter-Knopf und Copilot-Knopf.
  const guideEnabled = designer?.pawn_guide_enabled !== false;

  // Teil 32 — Die Nutzungs-Schleife: welche Räume dieses Haus nutzt, geht als reines Muster
  // (Raumname, kein Inhalt) nach pawn_signals — Grundlage für das Nutzungsprofil in pawn-chat
  // und "meistgenutzt/brachliegend" im Cockpit.
  useEffect(() => {
    if (!designer) return;
    const roomKey = roomKeyForPath(pathname);
    if (roomKey) markRoomUsedOncePerSession(designer.id, roomKey);
  }, [designer, pathname]);

  return (
    <div className="flex min-h-screen bg-background">
      <LevelUpOverlay designerId={designer?.id} />
      {designer && <PawnDeck pathname={pathname} enabled={guideEnabled} />}
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
          <button onClick={() => setMobileOpen(true)} aria-label={t("studioShell.menu")}><Menu className="h-4 w-4" /></button>
          <p className="ml-3 font-serif">{t("studioShell.studio")}</p>
        </div>
        <Topbar title={title} section={eyebrow ?? title} />
        {designer && <KasseBanner />}
        {designer && <ContractV2Banner />}
        <main className="flex-1 p-6 md:p-10">{children}</main>
        <div className="flex flex-wrap items-center gap-4 border-t border-border px-6 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground md:px-10">
          <Link to="/impressum" className="hover:text-foreground">{t("studioShell.legal.impressum")}</Link>
          <Link to="/datenschutz" className="hover:text-foreground">{t("studioShell.legal.datenschutz")}</Link>
          <Link to="/agb" className="hover:text-foreground">{t("studioShell.legal.agb")}</Link>
          <Link to="/widerruf" className="hover:text-foreground">{t("studioShell.legal.widerruf")}</Link>
          <Link to="/barrierefreiheit" className="hover:text-foreground">{t("studioShell.legal.barrierefreiheit")}</Link>
          <Link to="/vertrag-kuendigen" className="hover:text-foreground">{t("studioShell.legal.kuendigen")}</Link>
        </div>
      </div>
    </div>
  );
}


export function StudioShell(props: Props) {
  return <Inner {...props} />;
}

