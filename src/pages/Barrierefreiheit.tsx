import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useLegalText } from "@/lib/legalText";

/**
 * Teil L1/L2 — Erklärung zur Barrierefreiheit (BFSG).
 * Beschreibt, was die Seite technisch tut; die faktischen Angaben (Prüfdatum,
 * Kontaktweg, Durchsetzungsverfahren) sind Platzhalter und von Daouda zu füllen.
 */
export default function Barrierefreiheit() {
  const L = useLegalText();
  const h = "palace-serif mt-12 text-[1.4rem] font-light text-[#000000]";
  const p = "mt-4 text-[0.95rem] leading-[1.7] text-[#000000]/80";
  return (
    <PalaceLayout
      transparentHeader={false}
      title={L("PAWN — Barrierefreiheit", "PAWN — Accessibility")}
      description={L("Erklärung zur Barrierefreiheit von pawn.vision.", "Accessibility statement for pawn.vision.")}
    >
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{L("Rechtliches", "Legal")}</p>
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {L("Barrierefreiheit.", "Accessibility.")}
          </h1>

          <p className={p}>
            {L(
              "PAWN (pawn.vision) soll für alle Menschen bedienbar sein — unabhängig davon, wie sie lesen, sehen, hören oder navigieren. Diese Erklärung beschreibt den Stand der Barrierefreiheit dieser Website nach dem Barrierefreiheitsstärkungsgesetz (BFSG).",
              "PAWN (pawn.vision) is meant to be usable by everyone — regardless of how they read, see, hear or navigate. This statement describes the accessibility status of this website under the German Accessibility Strengthening Act (BFSG).",
            )}
          </p>

          <h2 className={h}>{L("Was die Seite tut", "What the site does")}</h2>
          <ul className={`${p} list-disc space-y-2 pl-5`}>
            <li>{L("Sichtbare Fokusrahmen auf allen interaktiven Elementen; die Seite ist vollständig mit der Tastatur bedienbar, Dialoge und die Bild-Vollansicht schließen mit Escape.", "Visible focus outlines on all interactive elements; the site is fully keyboard-operable, dialogs and the full-screen image view close with Escape.")}</li>
            <li>{L("Ein Sprunglink führt direkt zum Inhalt; Seiten sind mit Landmarken und einer logischen Überschriften-Struktur aufgebaut.", "A skip link leads straight to the content; pages use landmarks and a logical heading structure.")}</li>
            <li>{L("Die Gestaltung arbeitet mit Schwarz auf Weiß und hält für Text die Kontrastanforderungen der WCAG 2.1 AA ein.", "The design works in black on white and meets the WCAG 2.1 AA contrast requirements for text.")}</li>
            <li>{L("Werkbilder tragen beschreibende Alternativtexte aus Titel, Technik und Haus; rein dekorative Flächen sind für Vorleseprogramme ausgeblendet.", "Work images carry descriptive alternative text built from title, technique and house; purely decorative surfaces are hidden from screen readers.")}</li>
            <li>{L("Bewegte Elemente respektieren die Systemeinstellung für reduzierte Bewegung.", "Animated elements respect the system setting for reduced motion.")}</li>
          </ul>

          <h2 className={h}>{L("Bekannte Grenzen", "Known limitations")}</h2>
          <p className={p}>
            {L(
              "Von Häusern hochgeladene Bilder und Videos können Alternativtexte oder Untertitel vermissen lassen, wenn das Haus keine hinterlegt hat. Wir arbeiten daran, diese Lücken zu schließen.",
              "Images and videos uploaded by houses may lack alternative text or captions if the house has not provided any. We are working to close these gaps.",
            )}
          </p>

          <h2 className={h}>{L("Stand dieser Erklärung", "Status of this statement")}</h2>
          <p className={p}>
            [VON DAOUDA/ANWALT ZU FÜLLEN: Datum der Erstellung/letzten Prüfung dieser Erklärung; ob eine
            Selbstbewertung oder eine externe Prüfung zugrunde liegt.]
          </p>

          <h2 className={h}>{L("Barriere melden", "Report a barrier")}</h2>
          <p className={p}>
            {L(
              "Du bist auf eine Barriere gestoßen? Schreib uns — wir bessern nach:",
              "Encountered a barrier? Write to us — we will fix it:",
            )}{" "}
            [VON DAOUDA ZU FÜLLEN: E-Mail-Adresse für Barriere-Meldungen, z. B. pawnstudio.co@gmail.com]
          </p>

          <h2 className={h}>{L("Durchsetzungsverfahren", "Enforcement procedure")}</h2>
          <p className={p}>
            [VON DAOUDA/ANWALT ZU FÜLLEN: zuständige Marktüberwachungsbehörde bzw. Schlichtungsstelle
            nach BFSG mit Kontaktdaten.]
          </p>
        </Reveal>
      </section>
    </PalaceLayout>
  );
}
