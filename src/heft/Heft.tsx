/**
 * Teil X2 — die eine Hülle.
 *
 * PAWN ist ein Magazin. Eine Hülle, eine Route, jede Sektion eine Doppelseite,
 * Vollbild, weißes Papier auf grauem Tisch. Diese Datei ist die Hülle.
 *
 * **Eine Route, viele Adressen.** „Eine Route" heißt: ein Gerüst, nicht eine
 * Adresse. Der Router bildet Adresse → Doppelseiten-Index ab (`doppelseiten.ts`),
 * statt Adresse → Seitenkomponente. Wer `/verzeichnis/3` aufruft, sieht sofort
 * die dritte Katalog-Doppelseite — ohne Eröffnung, ohne Animation. Blättern
 * schreibt die Adresse per `replaceState` fort, der Zurück-Knopf blättert zurück.
 *
 * **Warum Adressen nicht verhandelbar sind.** Ohne sie kann niemand ein Werk
 * teilen, keine Suchmaschine etwas finden, kein Prüfstand etwas messen und kein
 * Zurück-Knopf arbeiten.
 *
 * **Kein Scroll-Diebstahl.** Die Bühne steht fest, die Scrollhöhe liefert ein
 * leerer Streifen darunter. Rollbalken, Leertaste, Bild-ab und Impuls-Scrollen
 * bleiben unangetastet — sie bewegen den Wendel, nicht die Seite.
 *
 * **Bewegungsgesetz.** Animiert werden ausschließlich `transform` und `opacity`.
 * Kein Canvas, kein WebGL, keine virtualisierte Seitenliste, keine neue
 * Abhängigkeit. Jede Seite steht mit ihren Überschriften und Wegen im DOM.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FENSTER, WEG, blattStand, scrollHoehe, seitenNummer, standFuerSeite,
} from "./wendel";
import {
  type Doppelseite, blaetterAus, nummerFuerPfad, pfadFuerNummer,
} from "./doppelseiten";
import { Register } from "./register";
import "./heft.css";

export interface HeftProps {
  /** Alle Doppelseiten in Leserichtung. Die einzige Quelle. */
  seiten: Doppelseite[];
  /** Für die Vorlesehilfe. */
  titel: string;
}

const magReduziert = () =>
  typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function Heft({ seiten, titel }: HeftProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [reduziert, setReduziert] = useState(magReduziert);

  // Beide Wege sind vollwertig, also wird auch im laufenden Betrieb gewechselt.
  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoer = () => setReduziert(mm.matches);
    mm.addEventListener("change", hoer);
    return () => mm.removeEventListener("change", hoer);
  }, []);

  /**
   * Die Doppelseite, mit der geöffnet wird — einmal beim Betreten festgehalten.
   *
   * Absichtlich `useState` mit Initialwert und nicht ein Wert, der bei jedem
   * `pathname` neu gelesen wird: sonst würde das eigene `replaceState` beim
   * Blättern zurückschlagen und das Heft auf die Startseite zwingen.
   */
  const [startSeite] = useState(() => nummerFuerPfad(seiten, pathname));

  /** Die Adresse nachführen — nur wenn sich die Doppelseite wirklich ändert. */
  const letzte = useRef(0);
  const [aktuell, setAktuell] = useState(startSeite);
  const adresseSetzen = useCallback((n: number) => {
    if (n === letzte.current) return;
    letzte.current = n;
    setAktuell(n);
    const ziel = pfadFuerNummer(seiten, n);
    if (window.location.pathname !== ziel) {
      window.history.replaceState(window.history.state, "", ziel + window.location.search);
    }
  }, [seiten]);

  /**
   * Ein Reiter im Griffregister springt.
   *
   * Im Wendel ist „springen" ein Scrollbefehl — die Adresse führt der Wendel
   * selbst nach, sobald er dort steht. Im zweiten Weg gibt es keinen Wendel,
   * dort führt `navigate` die Adresse und der Beobachter zieht nach.
   */
  const sprung = useCallback((n: number) => {
    if (reduziert) {
      navigate(pfadFuerNummer(seiten, n));
      return;
    }
    window.scrollTo({ top: standFuerSeite(n), behavior: "instant" as ScrollBehavior });
  }, [reduziert, navigate, seiten]);

  const aufbau = useMemo(() => blaetterAus(seiten), [seiten]);

  return (
    <div className="hx-wurzel">
      {reduziert ? (
        <HeftFolge seiten={seiten} titel={titel} startSeite={startSeite} adresseSetzen={adresseSetzen} />
      ) : (
        <HeftGewendet
          seiten={seiten} aufbau={aufbau} titel={titel}
          startSeite={startSeite} adresseSetzen={adresseSetzen}
        />
      )}
      <Register seiten={seiten} aktuell={aktuell} aufSprung={sprung} />
    </div>
  );
}

/* ————————————————— Der Wendel ————————————————— */

interface GewendetProps {
  seiten: Doppelseite[];
  aufbau: ReturnType<typeof blaetterAus>;
  titel: string;
  startSeite: number;
  adresseSetzen: (n: number) => void;
}

function HeftGewendet({ seiten, aufbau, titel, startSeite, adresseSetzen }: GewendetProps) {
  const { blaetter, grundLinks, grundRechts } = aufbau;
  const anzahl = blaetter.length;

  const blattRefs = useRef<(HTMLDivElement | null)[]>([]);
  const knickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const vornRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rueckRefs = useRef<(HTMLDivElement | null)[]>([]);
  const grundLinksRef = useRef<HTMLDivElement | null>(null);
  const grundRechtsRef = useRef<HTMLDivElement | null>(null);
  const [hoehe, setHoehe] = useState(() =>
    scrollHoehe(anzahl, typeof window === "undefined" ? 800 : window.innerHeight));

  /** Ein Blatt in einen Zustand schreiben. Nur transform, opacity und z-index. */
  const schreibe = useCallback((i: number, y: number, fern: boolean) => {
    const blatt = blattRefs.current[i];
    if (!blatt) return;
    const s = blattStand(y, i);
    blatt.style.transform = `rotateY(${s.winkel}deg)`;
    blatt.style.zIndex = String(s.ebene);
    blatt.classList.toggle("fern", fern);
    const knick = knickRefs.current[i];
    if (knick) knick.style.opacity = String(s.knick);
  }, []);

  /**
   * Was gerade aufgeschlagen ist, darf angefasst werden — der Rest nicht.
   *
   * Ein Heft stapelt alle Seiten übereinander. Ohne diese Sperre führt die
   * Tabulatortaste in Seiten, die körperlich hinter dem obersten Blatt liegen:
   * der Fokusring sitzt dann auf etwas Unsichtbarem (Kontrolle 3.4). `inert`
   * nimmt die verdeckten Seiten aus der Tabulatorfolge und aus dem Vorlesebaum,
   * bis sie aufgeschlagen sind.
   */
  const lesbar = useRef<[number, number]>([-2, -2]);
  const lesbarkeitSetzen = useCallback((y: number) => {
    let letztesGewendete = -1;
    for (let i = 0; i < anzahl; i++) {
      if (blattStand(y, i).e < 0.5) break;
      letztesGewendete = i;
    }
    const erstesOffene = letztesGewendete + 1;
    const [altL, altR] = lesbar.current;
    if (altL === letztesGewendete && altR === erstesOffene) return;
    lesbar.current = [letztesGewendete, erstesOffene];

    for (let i = 0; i < anzahl; i++) {
      const vorn = vornRefs.current[i];
      const rueck = rueckRefs.current[i];
      if (vorn) vorn.inert = i !== erstesOffene;
      if (rueck) rueck.inert = i !== letztesGewendete;
    }
    if (grundLinksRef.current) grundLinksRef.current.inert = letztesGewendete !== -1;
    if (grundRechtsRef.current) grundRechtsRef.current.inert = erstesOffene !== anzahl;
  }, [anzahl]);

  /** Ein Bild je Scroll-Ereignis, mit Sperre. */
  const angefordert = useRef(false);
  const fenster = useRef<[number, number]>([-1, -1]);

  const zeichne = useCallback(() => {
    const y = window.scrollY;
    const aktiv = Math.floor(y / WEG);
    const von = Math.max(0, aktiv - FENSTER);
    const bis = Math.min(anzahl - 1, aktiv + FENSTER);

    // Blätter, die das Fenster verlassen haben, einmal in ihren Endzustand
    // setzen — danach werden sie nicht mehr angefasst (X11: Gewicht).
    const [altVon, altBis] = fenster.current;
    if (altVon !== von || altBis !== bis) {
      for (let i = 0; i < anzahl; i++) {
        if (i >= von && i <= bis) continue;
        schreibe(i, i < von ? (i + 1) * WEG : 0, true);
      }
      fenster.current = [von, bis];
    }
    for (let i = von; i <= bis; i++) schreibe(i, y, false);

    lesbarkeitSetzen(y);
    adresseSetzen(seitenNummer(y, anzahl));
  }, [anzahl, schreibe, lesbarkeitSetzen, adresseSetzen]);

  useEffect(() => {
    const beiScroll = () => {
      if (angefordert.current) return;
      angefordert.current = true;
      requestAnimationFrame(() => {
        angefordert.current = false;
        zeichne();
      });
    };
    const beiGroesse = () => {
      setHoehe(scrollHoehe(anzahl, window.innerHeight));
      beiScroll();
    };
    window.addEventListener("scroll", beiScroll, { passive: true });
    window.addEventListener("resize", beiGroesse);
    return () => {
      window.removeEventListener("scroll", beiScroll);
      window.removeEventListener("resize", beiGroesse);
    };
  }, [anzahl, zeichne]);

  // Beim Aufrufen einer Adresse: sofort auf den passenden Stand, ohne Bewegung.
  // X2 verlangt genau das — „ohne Eröffnung, ohne Animation".
  useLayoutEffect(() => {
    setHoehe(scrollHoehe(anzahl, window.innerHeight));
    window.scrollTo({
      top: standFuerSeite(startSeite),
      behavior: "instant" as ScrollBehavior,
    });
    fenster.current = [-1, -1];
    zeichne();
    // Nur beim ersten Aufbau — danach führt der Scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="hx-tisch">
        <div className="hx-korn" aria-hidden />
        <div className="hx-buehne">
          <div className="hx-heft" role="group" aria-label={titel}>
            {/* Die Reihenfolge im DOM ist die Lesereihenfolge. Gestapelt wird
                über z-index, nicht über die Reihenfolge — so liest eine
                Vorlesehilfe das Heft von vorn nach hinten. */}
            <div className="hx-flaeche grund links" data-ton={seiten[0]?.ton} ref={grundLinksRef}>
              {grundLinks}
            </div>
            {blaetter.map((b, i) => (
              <div
                key={b.schluessel}
                className="hx-blatt"
                ref={(el) => { blattRefs.current[i] = el; }}
                style={{ zIndex: 40 - i }}
              >
                <div
                  className="hx-flaeche vorn"
                  data-ton={seiten[i]?.ton}
                  ref={(el) => { vornRefs.current[i] = el; }}
                >
                  {b.vorn}
                </div>
                <div
                  className="hx-flaeche rueck"
                  data-ton={seiten[i + 1]?.ton}
                  ref={(el) => { rueckRefs.current[i] = el; }}
                >
                  {b.rueck}
                </div>
                <div className="hx-knick" ref={(el) => { knickRefs.current[i] = el; }} aria-hidden />
              </div>
            ))}
            <div
              className="hx-flaeche grund rechts"
              data-ton={seiten[seiten.length - 1]?.ton}
              ref={grundRechtsRef}
            >
              {grundRechts}
            </div>
          </div>
        </div>
      </div>
      {/* Die Scrollhöhe. Ein leerer Streifen — er stiehlt nichts, er trägt den
          Rollbalken. */}
      <div className="hx-weg" style={{ height: hoehe }} aria-hidden />
    </>
  );
}

/* ————————————————— Der zweite Weg ————————————————— */

/**
 * Bei „Bewegung reduzieren": dieselben Doppelseiten senkrecht untereinander,
 * normales Rollen, gleiche Inhalte, **gleiche Adressen**, kein 3D. Ein
 * vollwertiger zweiter Weg, keine Notversion.
 */
function HeftFolge({
  seiten, titel, startSeite, adresseSetzen,
}: { seiten: Doppelseite[]; titel: string; startSeite: number; adresseSetzen: (n: number) => void }) {
  const wurzel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const knoten = wurzel.current?.querySelectorAll<HTMLElement>("[data-seite]");
    if (!knoten || knoten.length === 0) return;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const sichtbar = eintraege
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (sichtbar) adresseSetzen(Number((sichtbar.target as HTMLElement).dataset.seite));
      },
      { threshold: [0.3, 0.6] },
    );
    knoten.forEach((k) => beobachter.observe(k));
    return () => beobachter.disconnect();
  }, [adresseSetzen]);

  useLayoutEffect(() => {
    if (startSeite <= 1) return;
    wurzel.current
      ?.querySelector<HTMLElement>(`[data-seite="${startSeite}"]`)
      ?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hx-folge" ref={wurzel} role="group" aria-label={titel}>
      {seiten.map((s, i) => (
        <section key={s.schluessel} className="hx-folge-seite" data-seite={i + 1} data-ton={s.ton}>
          <div className="hx-folge-paar">
            {s.links}
            {s.rechts}
          </div>
        </section>
      ))}
    </div>
  );
}
