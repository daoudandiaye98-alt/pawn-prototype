import { useCallback, useEffect, useState } from "react";
import { useConsent } from "@/lib/consent";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Teil K1 — die Einwilligung ist eine Leiste, kein Fenster über dem Hauptweg.
 *
 * Gemessen war: „Häuser entdecken" im Helden lag auf allen vier Breiten von `/`
 * unter dem Knopf des Einwilligungsfensters, dazu auf `/shop` bei 390, 768 und
 * 1280 (Kontrolle 2.3 — genau ein primärer Weg, und der muss erreichbar sein).
 * Ein zentriertes Fenster über dem ersten Bildschirm blockiert genau das, was
 * der Besucher zuerst tun soll.
 *
 * Deshalb:
 *   · unten angeschlagen, volle Breite, eine harte Kante nach oben
 *   · die Seite bekommt unten Platz in Höhe der Leiste (`--pawn-einwilligung`),
 *     solange sie steht — sie verdeckt also nichts, sie schiebt
 *   · beide Knöpfe sind gleich: gleiche Größe, gleiche Farbe, gleiches Gewicht.
 *     Das ist DSGVO, nicht Geschmack — eine hervorgehobene Zustimmung ist keine
 *     freie Wahl.
 *
 * `role="region"`, nicht `dialog`: die Leiste fängt keinen Fokus und sperrt die
 * Seite nicht. Sie als Dialog auszugeben wäre eine Falschaussage an Vorlesehilfen.
 */
export function ConsentBanner() {
  const { bannerOpen, setConsent, decided, setOpenSettings, value } = useConsent();

  /**
   * Die Höhe steht nicht im Stylesheet, weil sie vom Text und von der Breite
   * abhängt. Sie wird gemessen und als Eigenschaft an die Wurzel geschrieben;
   * `body` und der Held rechnen damit.
   */
  const [leiste, setLeiste] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const wurzel = document.documentElement;
    if (!leiste) {
      wurzel.style.removeProperty("--pawn-einwilligung");
      return;
    }
    const messen = () => {
      wurzel.style.setProperty("--pawn-einwilligung", `${Math.ceil(leiste.getBoundingClientRect().height)}px`);
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(leiste);
    return () => {
      beobachter.disconnect();
      wurzel.style.removeProperty("--pawn-einwilligung");
    };
  }, [leiste]);

  const zustimmen = useCallback(() => setConsent("accepted"), [setConsent]);
  const nurNotwendig = useCallback(() => setConsent("essential"), [setConsent]);

  if (!bannerOpen) return null;

  /** Beide Knöpfe tragen exakt dieselben Klassen. Wer hier eine hervorhebt, bricht die Wahl. */
  const knopf = "min-h-[44px] flex-1 justify-center border-[1.5px] border-black bg-white text-black hover:bg-black hover:text-white md:flex-none md:min-w-[190px]";

  return (
    <div
      ref={setLeiste}
      role="region"
      aria-label="Cookie-Einstellungen"
      className="fixed inset-x-0 bottom-0 z-flyout border-t-[1.5px] border-black bg-white"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-8 md:px-10 md:py-4">
        {/* Kurz genug, dass die Leiste eine Leiste bleibt — vollständig genug,
            dass die Einwilligung informiert ist: Zweck, Widerruf, kein Verkauf,
            keine Werbe-Cookies, Verweis auf die Einzelheiten. */}
        <p className="min-w-0 max-w-[78ch] text-[0.82rem] leading-[1.5] text-black">
          PAWN merkt sich, was dich bewegt — deinem Konto zugeordnet und jederzeit dort löschbar. Keine
          Werbe-Cookies, kein Datenverkauf.{" "}
          <Link to="/datenschutz" className="underline underline-offset-4">Datenschutz</Link>.
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="editorial" size="chip" onClick={zustimmen} className={knopf}>
            {value === "accepted" ? "Weiter merken" : "Einverstanden"}
          </Button>
          <Button type="button" variant="editorial" size="chip" onClick={nurNotwendig} className={knopf}>
            {value === "essential" ? "Bleibt bei notwendig" : "Nur notwendige"}
          </Button>
          {decided && (
            <Button
              type="button"
              variant="editorial"
              size="chip"
              onClick={() => setOpenSettings(false)}
              className="min-h-[44px] shrink-0 justify-center border-[1.5px] border-black bg-white text-black hover:bg-black hover:text-white"
            >
              Schließen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
