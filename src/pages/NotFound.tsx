/**
 * K7 — die Seite, die es nicht gibt.
 *
 * Zwei Dinge müssen hier stimmen, und beide sind unsichtbar:
 *
 * 1. **`noindex`.** Diese Anwendung liegt hinter einer SPA-Umschreibung
 *    (`vercel.json`): JEDE erfundene Adresse bekommt vom Server eine 200 und
 *    diese Seite. Für eine Suchmaschine ist damit jeder Tippfehler eine gültige
 *    Seite — beliebig viele Adressen mit identischem Inhalt. Das `noindex`
 *    schneidet das ab. Der Statuscode selbst bleibt 200, solange die
 *    Umschreibung so steht; das ist eine Server-Entscheidung, keine
 *    Code-Entscheidung, und sie steht noch aus.
 *
 * 2. **Ein Weg zurück.** Eine Sackgasse ohne Tür ist kein Fehlerzustand,
 *    sondern ein Verlust.
 */
import { Link, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Seo } from "@/components/palace/Seo";

/*
 * Der Bauer wird erst geladen, wenn jemand wirklich hier landet.
 *
 * Gemessener Grund: `three` ist die einzige schwere Abhängigkeit im Haus und
 * hatte genau EINEN lebenden Benutzer — diese Seite. Weil sie fest importiert
 * war, lud jeder Besuch der Startseite die ganze 3D-Bibliothek mit, für eine
 * Figur, die er nie zu sehen bekommt. Prüfstand 4.7 (Seitengewicht) zählt das
 * mit.
 *
 * `Suspense` ohne Ersatzinhalt: die Figur ist Schmuck, ihr Platz bleibt leer,
 * bis sie da ist. Ein Ladezeichen für ein Ornament wäre lauter als das Ornament.
 */
const BauerSpaet = lazy(() => import("./NotFoundBauer.tsx").then((m) => ({ default: m.LonelyPawn })));

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error("404: Route nicht gefunden:", location.pathname);
  }, [location.pathname]);

  return (
    <PalaceLayout transparentHeader={false}>
      <Seo
        title="404 — PAWN"
        description="Diese Adresse gibt es nicht."
        noindex
      />
      <section className="mx-auto flex min-h-[80vh] max-w-[900px] flex-col items-center justify-center px-6 py-32 text-center">
        <Suspense fallback={<div className="mx-auto h-[280px] w-[280px]" aria-hidden />}>
          <BauerSpaet />
        </Suspense>
        <p className="palace-eyebrow mt-2">404</p>
        <h1
          className="palace-serif mt-6 text-[#000000]"
          style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
        >
          Dieser Raum <span className="italic">existiert nicht.</span>
        </h1>
        <p className="mt-8 max-w-md font-serif italic text-[1.05rem] text-[#000000]/75">
          Vielleicht wurde er verschoben, umbenannt, oder du bist einer alten Adresse gefolgt.
        </p>
        <Link
          to="/"
          className="mt-12 inline-flex border border-[#000000] px-8 py-3 text-[0.65rem] uppercase tracking-[0.42em] text-[#000000] transition-colors hover:bg-[#000000] hover:text-[#FFFFFF]"
        >
          Zurück zur Ausstellung
        </Link>
      </section>
    </PalaceLayout>
  );
};

export default NotFound;
