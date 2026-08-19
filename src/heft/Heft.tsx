/**
 * Die Szenen-Maschine — der Neuaufbau nach dem Architektur-Audit
 * (`docs/heft-architektur-audit.md`).
 *
 * **Das Modell.** Die Route ist der einzige Besitzer des Zustands. Eine Szene
 * ist eine Kompositionsfläche mit Adresse; die aufgeschlagene Szene ist eine
 * reine Funktion der Adresse. Blättern heißt `navigate` — jeder Schritt ist
 * ein echter History-Eintrag, der Zurück-Knopf blättert wirklich einen Schritt
 * zurück. Es gibt keinen Scrollstand, keine Blatt-Ableitung, keine
 * Rückkopplungs-Wachen: nichts muss synchron gehalten werden, weil nur einer
 * den Zustand führt.
 *
 * **Was der Vorgänger war.** Ein 3D-Wendel: unechter Scroll → Blattrotation →
 * Blatt-Index → Doppelseiten-Nummer → Route → Inhalt, mit zwei
 * Stapel-Ableitungen, `inert`-Buchführung, Einmal-Wachen (`startSeite`,
 * `nachzuholen`) und einer Drehsperre im Hochformat. Der Audit hat ihn
 * vermessen: ~1.000 Zeilen dienten der Papierphysik, und die Hakeligkeit kam
 * aus dem Modell (Scroll als Tween-Regler), nicht aus der Animation. Er ist
 * ersetzt, nicht repariert.
 *
 * **Die Doppelseite bleibt — als Layout.** `Doppelseite.links/rechts` sind die
 * zwei Spalten einer Kompositionsfläche: breit nebeneinander (1,44:1 auf dem
 * Tisch), schmal untereinander mit normalem Rollen. Damit entfallen der
 * Einzelseiten-Modus, der Dreh-Hinweis (Hochformat ist ein Format, keine
 * Sperre) und der Gestenkonflikt: senkrecht rollen ist Inhalt, ein Schritt ist
 * ein Schritt.
 *
 * **Eingaben sind Absichten, keine Positionen.** Ein Radzug, ein Wisch, eine
 * Pfeiltaste = genau ein Schritt. Das Rad blättert nur, wenn die Szene in
 * dieser Richtung nichts mehr zu rollen hat — sonst rollt sie.
 *
 * **Übergang.** View Transitions, wo der Browser sie kann; sonst ein harter
 * Schnitt. Bei „Bewegung reduzieren" immer der Schnitt — derselbe Renderer,
 * kein zweiter Weg. Wie viel Buch-Anmutung in den Übergang gehört, ist die im
 * Audit offen gelassene Designfrage; bis dahin gilt die stille Blende.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { type Doppelseite, nummerFuerPfad, pfadFuerNummer } from "./doppelseiten";
import { Register, type FilterGruppe } from "./register";
import { Marken } from "./marken";
import "./heft.css";

export interface HeftProps {
  /** Baut alle Szenen in Leserichtung. Die einzige Quelle. */
  bauen: (aufSprung: (nummer: number) => void) => Doppelseite[];
  /** Für die Vorlesehilfe. */
  titel: string;
  /** Die Adresse der Sektion „Frag PAWN" — die Marke am Blattrand braucht sie. */
  suchePfad: string;
  /** Die Filter des Verzeichnisses — Reiter im Griffregister. */
  filter?: FilterGruppe[];
}

const magReduziert = () =>
  typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Kann dieses Element (oder ein Vorfahr in der Szene) noch in diese Richtung rollen? */
function rolltNoch(von: EventTarget | null, grenze: HTMLElement, runter: boolean): boolean {
  let el = von instanceof HTMLElement ? von : null;
  while (el && grenze.contains(el)) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const kann = runter
        ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
        : el.scrollTop > 0;
      if (kann && getComputedStyle(el).overflowY !== "visible") return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function Heft({ bauen, titel, suchePfad, filter }: HeftProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [ruhig, setRuhig] = useState(magReduziert);

  useEffect(() => {
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoer = () => setRuhig(mm.matches);
    mm.addEventListener("change", hoer);
    return () => mm.removeEventListener("change", hoer);
  }, []);

  /**
   * Ein Schritt: Adresse setzen, mit Übergang. `flushSync` im Übergang ist das
   * dokumentierte Muster — die View Transition fotografiert vorher/nachher und
   * braucht den DOM-Wechsel innerhalb ihres Rückrufs.
   */
  const ruhigRef = useRef(ruhig);
  ruhigRef.current = ruhig;
  const geheZuPfad = useCallback((pfad: string) => {
    if (pfad === window.location.pathname) return;
    const tu = () => flushSync(() => navigate(pfad + window.location.search));
    if (!ruhigRef.current && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(tu);
    } else {
      tu();
    }
  }, [navigate]);

  /*
   * Der eine Sprungbefehl für Inhaltsverzeichnis, Weltzeilen, Register, Marken.
   * Die Liste liegt in einem Ref, weil sie ihrerseits aus diesem Befehl
   * entsteht (das Inhaltsverzeichnis braucht ihn) — gelesen wird der Ref nur
   * aus Ereignissen, nie beim Zeichnen.
   */
  const seitenRef = useRef<Doppelseite[]>([]);
  const sprung = useCallback(
    (n: number) => geheZuPfad(pfadFuerNummer(seitenRef.current, n)),
    [geheZuPfad],
  );

  const seiten = useMemo(() => bauen(sprung), [bauen, sprung]);
  seitenRef.current = seiten;

  /*
   * Die aufgeschlagene Szene — bei JEDER Zeichnung aus der Adresse abgeleitet.
   *
   * Das ist der Kern des Umbaus: keine Einmal-Lesung, kein Nachholen. Eine
   * Adresse, deren Szene noch nicht existiert (Werke kommen aus Daten), zeigt
   * den Umschlag; sobald die Szene in der Liste steht, greift die Ableitung
   * von selbst. Und eine SPA-Navigation auf eine Heftadresse funktioniert —
   * die Route IST der Zustand.
   */
  const aktuell = nummerFuerPfad(seiten, pathname);
  const hier = seiten[aktuell - 1];

  const schritt = useCallback((richtung: 1 | -1) => {
    const ziel = Math.min(seitenRef.current.length, Math.max(1, aktuell + richtung));
    if (ziel !== aktuell) sprung(ziel);
  }, [aktuell, sprung]);

  /* ————— Eingaben: ein Impuls, ein Schritt ————— */

  const buehne = useRef<HTMLDivElement>(null);
  const rad = useRef({ summe: 0, zuletzt: 0 });
  useEffect(() => {
    const RAD_SCHWELLE = 80;
    const RUHE_MS = 350;

    const beiRad = (e: WheelEvent) => {
      const grenze = buehne.current;
      if (!grenze || !grenze.contains(e.target as Node)) return;
      /* Hat die Szene selbst noch Weg, rollt sie — das Rad gehört dem Inhalt. */
      if (rolltNoch(e.target, grenze, e.deltaY > 0)) return;
      e.preventDefault();
      const jetzt = performance.now();
      if (jetzt - rad.current.zuletzt < RUHE_MS) { rad.current.zuletzt = jetzt; return; }
      rad.current.summe += e.deltaY;
      if (Math.abs(rad.current.summe) >= RAD_SCHWELLE) {
        schritt(rad.current.summe > 0 ? 1 : -1);
        rad.current = { summe: 0, zuletzt: jetzt };
      }
    };

    const beiTaste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /^(input|textarea|select)$/i.test(ziel.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); schritt(1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); schritt(-1); }
    };

    /* Wischen: waagerecht und entschieden — senkrecht bleibt dem Rollen. */
    let start: { x: number; y: number } | null = null;
    const beiZeigerAb = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      start = { x: e.clientX, y: e.clientY };
    };
    const beiZeigerAuf = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      schritt(dx < 0 ? 1 : -1);
    };

    window.addEventListener("wheel", beiRad, { passive: false });
    window.addEventListener("keydown", beiTaste);
    window.addEventListener("pointerdown", beiZeigerAb);
    window.addEventListener("pointerup", beiZeigerAuf);
    return () => {
      window.removeEventListener("wheel", beiRad);
      window.removeEventListener("keydown", beiTaste);
      window.removeEventListener("pointerdown", beiZeigerAb);
      window.removeEventListener("pointerup", beiZeigerAuf);
    };
  }, [schritt]);

  /*
   * Gezeichnet werden die Szene und ihre Nachbarn: die Nachbarn unsichtbar und
   * `inert`, damit ihre Bilder schon geladen sind, wenn der Schritt kommt —
   * ohne dass eine Vorlesehilfe oder die Tabulatortaste sie findet. Alles
   * andere existiert nicht im DOM. Die `inert`-Buchführung des Wendels über
   * alle Blätter entfällt: es stapelt nichts mehr.
   */
  const fenster = [aktuell - 1, aktuell, aktuell + 1]
    .filter((n) => n >= 1 && n <= seiten.length);

  return (
    <div className="hx-wurzel">
      {/* Die eine `h1` je Adresse (X12) — Titel der aufgeschlagenen Szene. */}
      <h1 className="hx-titel">{hier?.titel ?? titel}</h1>

      <div className="hx-tisch">
        <div className="hx-korn" aria-hidden />
        <div className="hx-szenenraum" ref={buehne} role="group" aria-label={titel}>
          {fenster.map((n) => {
            const s = seiten[n - 1];
            return (
              <section
                key={s.schluessel}
                className="hx-szene hx-folge-seite"
                data-ton={s.ton}
                hidden={n !== aktuell}
                /* React 18 kennt `inert` im Typ noch nicht; das leere
                   String-Attribut ist die gültige HTML-Schreibweise. */
                {...(n !== aktuell ? { inert: "" as unknown as boolean } : {})}
              >
                <div className="hx-folge-paar">
                  {s.links}
                  {s.rechts}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Register seiten={seiten} aktuell={aktuell} aufSprung={sprung} filter={filter} />
      <Marken suchePfad={suchePfad} aufSuche={() => sprung(nummerFuerPfad(seiten, suchePfad))} />
    </div>
  );
}
