/**
 * Teil M1 — das Blatt.
 *
 * Ein Heft aus echtem HTML. Jede Seite steht mit ihren Überschriften und Wegen im
 * DOM und wird nur in 3D gedreht — kein Canvas, kein WebGL, keine virtualisierte
 * Seitenliste, keine neue Abhängigkeit.
 *
 * Der Aufbau folgt dem Papier:
 *
 *   Grundseite links · Grundseite rechts        die unterste Lage
 *   Blatt i mit Vorder- und Rückseite           dreht um die linke Kante
 *
 * Daraus ergibt sich die Leserichtung:
 *   Doppelseite 1 = Grund links + Blatt 0 vorn
 *   Doppelseite 2 = Blatt 0 rück + Blatt 1 vorn
 *   …
 *   Doppelseite N+1 = Blatt N-1 rück + Grund rechts
 *
 * Kein Scroll-Diebstahl: die Bühne steht fest, die Höhe liefert ein leerer Streifen.
 * Rollbalken, Leertaste, Bild-ab und Impuls-Scrollen bleiben unangetastet.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  FENSTER, WEG, blattStand, scrollHoehe, seitenNummer, standFuerSeite,
} from "@/features/heft/wendel";
import "@/features/heft/heft.css";

export interface HeftBlatt {
  schluessel: string;
  vorn: React.ReactNode;
  rueck: React.ReactNode;
}

export interface HeftProps {
  /** Die Blätter in Leserichtung. */
  blaetter: HeftBlatt[];
  /** Die unterste Lage links (liegt unter dem zuletzt gewendeten Blatt). */
  grundLinks: React.ReactNode;
  /** Die unterste Lage rechts — die letzte Seite des Hefts. */
  grundRechts: React.ReactNode;
  /** Adressstamm, z. B. „/ausgabe/001". Doppelseite 1 hängt nichts an. */
  adresse: string;
  /** Doppelseite, auf der geöffnet wird (aus der Adresse). 1 = Titel. */
  startSeite?: number;
  /** Für die Vorlesehilfe und den Seitentitel. */
  titel: string;
}

const magReduziert = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function Heft({ blaetter, grundLinks, grundRechts, adresse, startSeite = 1, titel }: HeftProps) {
  const [reduziert, setReduziert] = useState(magReduziert);
  const anzahl = blaetter.length;

  // Der Nutzer kann die Einstellung im laufenden Betrieb umlegen — beide Wege sind
  // vollwertig, also wird auch live gewechselt.
  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoer = () => setReduziert(mm.matches);
    mm.addEventListener("change", hoer);
    return () => mm.removeEventListener("change", hoer);
  }, []);

  /** Die Adresse nachführen — nur wenn sich die Doppelseite wirklich ändert. */
  const letzteSeite = useRef(0);
  const adresseSetzen = useCallback((n: number) => {
    if (n === letzteSeite.current) return;
    letzteSeite.current = n;
    const ziel = n > 1 ? `${adresse}/${n}` : adresse;
    if (window.location.pathname !== ziel) {
      window.history.replaceState(window.history.state, "", ziel + window.location.search);
    }
  }, [adresse]);

  if (reduziert) {
    return (
      <HeftFolge
        blaetter={blaetter} grundLinks={grundLinks} grundRechts={grundRechts}
        titel={titel} startSeite={startSeite} adresseSetzen={adresseSetzen}
      />
    );
  }
  return (
    <HeftGewendet
      blaetter={blaetter} grundLinks={grundLinks} grundRechts={grundRechts}
      titel={titel} anzahl={anzahl} startSeite={startSeite} adresseSetzen={adresseSetzen}
    />
  );
}

/* ————————————————— Der Wendel ————————————————— */

interface InnenProps extends Omit<HeftProps, "adresse" | "startSeite"> {
  anzahl: number;
  startSeite: number;
  adresseSetzen: (n: number) => void;
}

function HeftGewendet({
  blaetter, grundLinks, grundRechts, titel, anzahl, startSeite, adresseSetzen,
}: InnenProps) {
  const blattRefs = useRef<(HTMLDivElement | null)[]>([]);
  const knickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoehe, setHoehe] = useState(() =>
    scrollHoehe(anzahl, typeof window === "undefined" ? 800 : window.innerHeight));

  /** Ein Blatt in einen Zustand schreiben. Nur transform, opacity und z-index. */
  const schreibe = useCallback((i: number, y: number, fern: boolean) => {
    const blatt = blattRefs.current[i];
    const knick = knickRefs.current[i];
    if (!blatt) return;
    const s = blattStand(y, i);
    blatt.style.transform = `rotateY(${s.winkel}deg)`;
    blatt.style.zIndex = String(s.ebene);
    blatt.classList.toggle("fern", fern);
    if (knick) knick.style.opacity = String(s.knick);
  }, []);

  /** Ein Bild je Scroll-Ereignis, mit Sperre. */
  const angefordert = useRef(false);
  const fenster = useRef<[number, number]>([-1, -1]);

  const zeichne = useCallback(() => {
    const y = window.scrollY;
    const aktiv = Math.floor(y / WEG);
    const von = Math.max(0, aktiv - FENSTER);
    const bis = Math.min(anzahl - 1, aktiv + FENSTER);

    // Blätter, die das Fenster gerade verlassen haben, einmal in ihren Endzustand
    // setzen — danach werden sie nicht mehr angefasst.
    const [altVon, altBis] = fenster.current;
    if (altVon !== von || altBis !== bis) {
      for (let i = 0; i < anzahl; i++) {
        if (i >= von && i <= bis) continue;
        schreibe(i, i < von ? (i + 1) * WEG : 0, true);
      }
      fenster.current = [von, bis];
    }
    for (let i = von; i <= bis; i++) schreibe(i, y, false);

    adresseSetzen(seitenNummer(y, anzahl));
  }, [anzahl, schreibe, adresseSetzen]);

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

  // Beim Laden einer Adresse: sofort auf den passenden Stand, ohne Bewegung.
  useLayoutEffect(() => {
    setHoehe(scrollHoehe(anzahl, window.innerHeight));
    if (startSeite > 1) window.scrollTo({ top: standFuerSeite(startSeite), behavior: "instant" as ScrollBehavior });
    fenster.current = [-1, -1];
    zeichne();
    // Nur beim ersten Aufbau — danach führt der Scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="heft-wurzel">
      <div className="heft-tisch">
        <div className="heft-korn" aria-hidden />
        <div className="heft-buehne">
          <div className="heft" role="group" aria-label={titel}>
            {/* Die Reihenfolge im DOM ist die Lesereihenfolge — eine Vorlesehilfe
                liest das Heft von vorn nach hinten. Sichtbar gestapelt wird über
                z-index, nicht über die Reihenfolge. */}
            <div className="heft-seite links">{grundLinks}</div>
            {blaetter.map((b, i) => (
              <div
                key={b.schluessel}
                className="heft-blatt"
                ref={(el) => { blattRefs.current[i] = el; }}
                style={{ zIndex: 40 - i }}
              >
                <div className="heft-flaeche vorn">{b.vorn}</div>
                <div className="heft-flaeche rueck">{b.rueck}</div>
                <div className="heft-knick" ref={(el) => { knickRefs.current[i] = el; }} aria-hidden />
              </div>
            ))}
            <div className="heft-seite rechts">{grundRechts}</div>
          </div>
        </div>
      </div>
      <div className="heft-weg" style={{ height: hoehe }} aria-hidden />
    </div>
  );
}

/* ————————————————— Der zweite Weg ————————————————— */

/**
 * Bei „Bewegung reduzieren": dieselben Doppelseiten senkrecht untereinander,
 * normales Rollen, gleiche Inhalte, gleiche Adressen, kein 3D.
 */
function HeftFolge({
  blaetter, grundLinks, grundRechts, titel, startSeite, adresseSetzen,
}: Omit<InnenProps, "anzahl">) {
  // Aus Blättern werden Doppelseiten — genau die Paare, die man beim Wenden sieht.
  const doppelseiten = useMemo(() => {
    const paare: { schluessel: string; links: React.ReactNode; rechts: React.ReactNode }[] = [];
    paare.push({ schluessel: "titel", links: grundLinks, rechts: blaetter[0]?.vorn ?? null });
    for (let i = 0; i < blaetter.length; i++) {
      paare.push({
        schluessel: blaetter[i].schluessel,
        links: blaetter[i].rueck,
        rechts: i + 1 < blaetter.length ? blaetter[i + 1].vorn : grundRechts,
      });
    }
    return paare;
  }, [blaetter, grundLinks, grundRechts]);

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
    const ziel = wurzel.current?.querySelector<HTMLElement>(`[data-seite="${startSeite}"]`);
    ziel?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="heft-wurzel heft-folge" ref={wurzel} role="group" aria-label={titel}>
      {doppelseiten.map((d, i) => (
        <div key={d.schluessel} className="heft-folge-seite" data-seite={i + 1}>
          {/* Auf schmalen Geräten steht ohnehin eine Seite je Bildschirm; auf breiten
              liegen die beiden Hälften nebeneinander wie im Heft. */}
          <div className="heft-folge-paar">
            {d.links}
            {d.rechts}
          </div>
        </div>
      ))}
    </div>
  );
}
