import { useCallback, useEffect, useState } from "react";
import { useConsent } from "@/lib/consent";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { istHeftAdresse } from "@/heft/doppelseiten";

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
  const { pathname } = useLocation();

  /*
   * Im Heft steht sie NUR auf dem Umschlag.
   *
   * Eine Leiste, die mitten im Heft aufschlägt, unterbricht das Lesen an einer
   * Stelle, an der niemand mit ihr gerechnet hat. Der Umschlag ist der Eingang;
   * dort gehört sie hin. Außerhalb des Hefts (Studio, Verwaltung, Rechtstexte)
   * bleibt sie unverändert überall.
   *
   * Was das kostet, sei gesagt: wer über einen tiefen Verweis mitten ins Heft
   * kommt, sieht sie dort nicht. Verloren geht dabei nichts — ohne Einwilligung
   * bleibt Google Consent Mode auf `denied`, es wird also nichts gesetzt, was
   * einer Einwilligung bedürfte.
   */
  const imHeftAberNichtAufDemUmschlag = istHeftAdresse(pathname) && pathname !== "/";

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

  if (!bannerOpen || imHeftAberNichtAufDemUmschlag) return null;

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
        {/* Auf einem niedrigen Fenster (Telefon quer) bleibt EINE Zeile stehen:
            `line-clamp-1` unter 600 px Höhe, darüber der ganze Satz. Sonst wächst
            die Leiste dort auf drei Zeilen und deckt das halbe Blatt zu.

            Der Verweis auf den Datenschutz steht deshalb NICHT mehr in diesem
            Absatz, sondern bei den Knöpfen: gemessen (Prüfstand 3.4, 844 quer)
            wurde er von der Deckelung abgeschnitten und blieb trotzdem mit der
            Tabulatortaste erreichbar — ein Bedienelement, das man nicht sieht
            und trotzdem trifft. Bei den Knöpfen ist er immer sichtbar, und der
            Satz darf sich kürzen. */}
        <p className="min-w-0 max-w-[78ch] text-[0.82rem] leading-[1.5] text-black [@media(max-height:599px)]:line-clamp-1">
          PAWN merkt sich, was dich bewegt — deinem Konto zugeordnet und jederzeit dort löschbar. Keine
          Werbe-Cookies, kein Datenverkauf.
        </p>

        {/* `flex-wrap`: mit dem Datenschutz-Verweis sind es drei Dinge in der
            Reihe, und auf 390 px ragte der letzte Knopf 74 px aus dem Bild
            (Prüfstand 3.8). Sie brechen jetzt um, statt hinauszulaufen. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            to="/datenschutz"
            className="flex min-h-[44px] shrink-0 items-center text-[0.82rem] text-black underline underline-offset-4"
          >
            Datenschutz
          </Link>
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
