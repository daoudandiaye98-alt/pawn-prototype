import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "./LanguageToggle";
import { useAuth } from "@/lib/auth";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { LevelUpOverlay } from "@/features/studio/LevelUpOverlay";
import { BauerAbend } from "./BauerAbend";
import { BauerGespraech } from "./BauerGespraech";
import { useZugScheduler } from "@/features/studio/zugScheduler";
import { markRoomUsedOncePerSession, roomKeyForPath } from "@/lib/pawnSignal";
import type { Plan } from "@/lib/planGate";

import { useDisplayName } from "@/lib/displayName";
import { useI18n } from "@/lib/i18n";

/**
 * Teil N — DAS ABENDLICHT-SYSTEM: der Rahmen des gesamten Designer-Studios.
 * Nacht-Verlauf mit warmem Lichtpool, ein schwebendes Räume-Dock (unten auf
 * Touch, links auf Desktop) mit sechs beschrifteten Räumen, der Bauer klein
 * unten links auf jeder Fläche. Harte Regel: KEINE Badges, keine Zähler-Punkte,
 * keine Banner — erlaubt ist höchstens EIN warmer Lichtpunkt im Dock am Raum
 * der aktuellen einen Sache. Der Bauer kommuniziert, was wichtig ist.
 */

type RaumKey = "zuhause" | "wand" | "auftritt" | "clips" | "postfach" | "geschaeft";

const RAEUME: { key: RaumKey; to: string; end?: boolean }[] = [
  { key: "zuhause", to: "/studio", end: true },
  { key: "wand", to: "/studio/werke" },
  { key: "auftritt", to: "/studio/doppelseite" },
  { key: "clips", to: "/studio/clips" },
  { key: "postfach", to: "/studio/postfach" },
  { key: "geschaeft", to: "/studio/geschaeft" },
];

/* Zarte Glyphen (1.5px-Strich) — immer zusammen mit dem Wort, nie allein. */
function Glyphe({ raum }: { raum: RaumKey }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {raum === "zuhause" && (<g {...c}><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></g>)}
      {raum === "wand" && (<g {...c}><rect x="4" y="5" width="7" height="9" /><rect x="14" y="5" width="6" height="6" /><rect x="14" y="14" width="6" height="5" /><path d="M4 17h7" opacity=".6" /></g>)}
      {raum === "auftritt" && (<g {...c}><rect x="4" y="4" width="16" height="16" /><path d="M12 4v16" /><path d="M6.5 9h3M6.5 12h3M14.5 9h3" opacity=".6" /></g>)}
      {raum === "clips" && (<g {...c}><rect x="4" y="6" width="16" height="12" rx="2" /><path d="M10 10l5 2-5 2z" fill="currentColor" stroke="none" /></g>)}
      {raum === "postfach" && (<g {...c}><path d="M4 13h4l1.5 2.5h5L16 13h4" /><path d="M4 13v6h16v-6" /><path d="M6 9l6-4 6 4" opacity=".6" /></g>)}
      {raum === "geschaeft" && (<g {...c}><path d="M5 19V9l7-5 7 5v10" /><path d="M9.5 19v-5h5v5" /><path d="M4 19h16" /></g>)}
    </svg>
  );
}

/** Der Raum, in dem die aktuelle eine Sache wohnt — für den einen Lichtpunkt. */
function raumFuerZiel(to: string): RaumKey {
  if (to.startsWith("/studio/vertraege") || to.startsWith("/studio/auszahlung") || to.startsWith("/studio/versand") || to.startsWith("/studio/plan") || to.startsWith("/studio/automatik") || to.startsWith("/studio/empfehlungen")) return "geschaeft";
  if (to.startsWith("/studio/clips")) return "clips";
  if (to.startsWith("/studio/tueren") || to.startsWith("/studio/bestellungen") || to.startsWith("/studio/nachrichten") || to.startsWith("/studio/postfach")) return "postfach";
  if (to.startsWith("/studio/werke")) return "wand";
  if (to.startsWith("/studio/doppelseite")) return "auftritt";
  return "zuhause";
}

/** Liefert höchstens EINEN Lichtpunkt-Raum: den der aktuellen einen Sache. */
function useLichtpunkt(designerId?: string): RaumKey | null {
  const [wartendeKampagne, setWartendeKampagne] = useState(false);
  const [neueTueren, setNeueTueren] = useState(0);
  useEffect(() => {
    if (!designerId) return;
    (async () => {
      const [camp, doors] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "proposed"),
        supabase.from("designer_opportunities" as never).select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "gefunden"),
      ]);
      setWartendeKampagne((camp.count ?? 0) > 0);
      setNeueTueren(doors.count ?? 0);
    })();
  }, [designerId]);
  const zug = useZugScheduler({ designerId, hatWartendeKampagne: wartendeKampagne, neueTueren });
  if (zug.loading || !zug.aktueller) return null;
  // Der freie Idee-Zug und der wöchentliche Rückblick sind kein Signal wert.
  if (zug.aktueller.key === "idee" || zug.aktueller.key === "rueckblick") return null;
  return raumFuerZiel(zug.aktueller.to);
}

function Dock({ lichtpunkt }: { lichtpunkt: RaumKey | null }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <nav aria-label={t("studio.dock.aria")} className="al-dock">
      {RAEUME.map((r) => {
        const active = r.end ? pathname === r.to : pathname.startsWith(r.to);
        return (
          <NavLink
            key={r.key}
            to={r.to}
            end={r.end}
            className={cn("al-dock-raum", active && "al-dock-raum-aktiv")}
          >
            {lichtpunkt === r.key && <span className="al-lichtpunkt" aria-hidden="true" />}
            <Glyphe raum={r.key} />
            <span className="al-dock-wort">{t(`studio.dock.${r.key}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function ProfilMenue() {
  const { signOut } = useAuth();
  const { firstName } = useDisplayName();
  const nav = useNavigate();
  const { t } = useI18n();
  const [offen, setOffen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOffen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [offen]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label={t("studio.profil.menue")}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-sm text-foreground hover:border-white/40"
      >
        {(firstName[0] ?? "?").toUpperCase()}
      </button>
      {offen && (
        <div role="menu" className="al-karte absolute right-0 top-12 z-50 w-56 p-2">
          <Link role="menuitem" to="/studio/einstellungen" onClick={() => setOffen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm hover:bg-white/5">
            {t("studio.profil.einstellungen")}
          </Link>
          <Link role="menuitem" to="/" onClick={() => setOffen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground">
            {t("studio.profil.ausstellung")}
          </Link>
          <div className="px-3 py-2.5"><LanguageToggle className="h-8" /></div>
          <button
            role="menuitem"
            type="button"
            onClick={() => { void signOut(); nav("/"); }}
            className="block w-full rounded-[10px] px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            {t("studio.profil.abmelden")}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props { children: ReactNode; title: string; eyebrow?: string; ohneMiniBauer?: boolean }

function Inner({ children, title, eyebrow, ohneMiniBauer }: Props) {
  const { designer } = useMyDesigner();
  const { pathname } = useLocation();
  const { locale, setLocale, t } = useI18n();
  const [gespraechOffen, setGespraechOffen] = useState(false);
  const lichtpunkt = useLichtpunkt(designer?.id);

  // Teil 25: die im Haus-Profil gespeicherte Sprache gilt im Studio — beim Laden übernehmen …
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

  // Teil 32 — die Nutzungs-Schleife bleibt: welcher Raum genutzt wird, geht als
  // reines Muster nach pawn_signals.
  useEffect(() => {
    if (!designer) return;
    const roomKey = roomKeyForPath(pathname);
    if (roomKey) markRoomUsedOncePerSession(designer.id, roomKey);
  }, [designer, pathname]);

  const brand = designer?.brand_name ?? t("studioShell.studioFallback");

  return (
    <div className="abendlicht flex min-h-screen flex-col">
      <LevelUpOverlay designerId={designer?.id} />

      {/* Kopfzeile: Hausname leise links, „Zur Ausstellung" + Profil-Menü rechts.
          Keine Glocke, keine Zähler. Teil O: der Weg zurück zur öffentlichen
          Seite ist auf JEDER Fläche als Wort sichtbar, öffnet in neuem Tab. */}
      <header className="flex items-center justify-between gap-4 px-5 pb-2 pt-5 md:px-10 lg:pl-[150px]">
        <div className="min-w-0">
          <p className="text-[0.6rem] uppercase tracking-[0.24em]" style={{ color: "var(--al-leise)" }}>{brand}</p>
          <p className="mt-0.5 truncate font-serif text-lg leading-tight">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="text-[0.72rem] tracking-[0.06em] text-muted-foreground hover:text-foreground"
          >
            {t("studio.profil.ausstellung")} →
          </a>
          <ProfilMenue />
        </div>
      </header>

      {/* Das Räume-Dock: links schwebend auf Desktop, unten auf Touch. */}
      <Dock lichtpunkt={lichtpunkt} />

      <main className="flex-1 px-5 pb-32 pt-4 md:px-10 lg:pb-16 lg:pl-[150px]">{children}</main>

      {/* Der Bauer — klein, atmend, auf jeder Fläche (die Ankunft zeigt ihn groß selbst).
          Teil O: nach dem ersten Besuch feiner ~20-s-Puls + Hinweis-Satz als Tooltip. */}
      {designer && !ohneMiniBauer && (
        <>
          <div className="fixed bottom-24 left-4 z-40 lg:bottom-6 lg:left-6">
            <BauerAbend
              size={52}
              onTap={() => setGespraechOffen(true)}
              ariaLabel={t("studio.bauer.mini.aria")}
              className="al-bauer-puls"
              title={t("studio.bauer.hinweis")}
            />
          </div>
          <BauerGespraech open={gespraechOffen} onClose={() => setGespraechOffen(false)} plan={(designer.plan as Plan) ?? "haus"} />
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-4 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground md:px-10 lg:pl-[150px]">
        <Link to="/impressum" className="hover:text-foreground">{t("studioShell.legal.impressum")}</Link>
        <Link to="/datenschutz" className="hover:text-foreground">{t("studioShell.legal.datenschutz")}</Link>
        <Link to="/agb" className="hover:text-foreground">{t("studioShell.legal.agb")}</Link>
        <Link to="/widerruf" className="hover:text-foreground">{t("studioShell.legal.widerruf")}</Link>
        <Link to="/barrierefreiheit" className="hover:text-foreground">{t("studioShell.legal.barrierefreiheit")}</Link>
        <Link to="/vertrag-kuendigen" className="hover:text-foreground">{t("studioShell.legal.kuendigen")}</Link>
      </div>
    </div>
  );
}

export function StudioShell(props: Props) {
  return <Inner {...props} />;
}

export function firstNameOf(u: { displayName?: string | null }, brand?: string | null, email?: string | null) {
  const src = (u.displayName || "").trim();
  if (src) return src.split(/\s+/)[0];
  if (brand) return brand;
  if (email) return email.split("@")[0];
  return "Designer";
}
