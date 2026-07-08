import { ReactNode } from "react";
import { PalaceHeader } from "./PalaceHeader";
import { BuilderBar, BuilderToggle } from "./BuilderMode";
import { Editable } from "./Editable";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/**
 * PalaceLayout — final black/white system.
 * White surface, hairline black borders, monumental footer wordmark.
 */
export function PalaceLayout({ children, transparentHeader = true }: { children: ReactNode; transparentHeader?: boolean }) {
  return (
    <div className="palace min-h-screen bg-white text-black">
      <BuilderBar />
      <PalaceHeader />
      <main className={transparentHeader ? "" : "pt-24"}>{children}</main>
      <footer className="border-t-[1.5px] border-black bg-white">
        <div className="mx-auto max-w-[1600px] px-6 pt-16 md:px-14">
          <PawnWordmark
            className="block w-full text-center leading-none text-black"
            style={{ fontSize: "clamp(6rem, 15vw, 15rem)" }}
          />
        </div>
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-0 border-t-[1.5px] border-black md:grid-cols-4">
          {[
            { title: "Häuser", links: ["Mode", "Interior", "Kunst", "Designer"] },
            { title: "Für Sie", links: ["Neu", "DNA", "Style", "Warenkorb"] },
            { title: "Für Designer", links: ["Bewerben", "Studio", "Copilot", "Kampagnen"] },
            { title: "Haus", links: ["Kontakt", "Versand", "AGB", "Impressum"] },
          ].map((col, i) => (
            <div
              key={col.title}
              className={`${i > 0 ? "border-l-[1.5px] border-black" : ""} px-6 py-8`}
            >
              <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <span className="inline-block cursor-default border-b border-transparent text-[0.85rem] text-black transition-colors hover:border-black">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 border-t-[1.5px] border-black px-6 py-8 text-[0.6rem] uppercase tracking-[0.42em] text-black md:flex-row md:items-center md:justify-between md:px-14">
          <Editable contentKey="footer_line_1">PAWN · Kuratierte Ausstellung · Ausgabe 07 · Juli</Editable>
          <span>© {new Date().getFullYear()} — Für Designer <a href="/apply" className="uline text-black">bewerben</a></span>
        </div>
      </footer>
      <BuilderToggle />
    </div>
  );
}
