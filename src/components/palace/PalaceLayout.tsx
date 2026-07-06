import { ReactNode } from "react";
import { PalaceHeader } from "./PalaceHeader";

/**
 * PalaceLayout — applies the "lebendiges Magazin" tokens, film grain and header.
 * Wraps every public page. Admin/Portal/Apply keep their own shells.
 */
export function PalaceLayout({ children, transparentHeader = true }: { children: ReactNode; transparentHeader?: boolean }) {
  return (
    <div className="palace min-h-screen bg-[#F1EEE7] text-[#0C0C0E]">
      <PalaceHeader />
      <main className={transparentHeader ? "" : "pt-24"}>{children}</main>
      <footer className="border-t border-[rgba(12,12,14,.13)] px-6 py-14 md:px-14">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 text-[0.6rem] uppercase tracking-[0.42em] text-[#7C7972]">
          <span>PAWN · Kuratierte Ausstellung · Ausgabe 07 · Juli</span>
          <span>Kontakt · Presse · Impressum · Datenschutz</span>
          <span>© {new Date().getFullYear()} — Für Designer <a href="/apply" className="uline text-[#0C0C0E]">bewerben</a></span>
        </div>
      </footer>
      {/* Film grain overlay — global on public. */}
      <div className="palace-grain" aria-hidden />
    </div>
  );
}
