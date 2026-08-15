/**
 * Teil S2 — DER FLUG.
 *
 * Ein Werk verschwindet nie. Wer eine Kachel antippt, sieht dasselbe Bild
 * wachsen: von der Kachel in die Werkseite, von dort auf den Lichttisch. Kein
 * Seitenbruch, kein Ladeblitz, kein zweites Bild.
 *
 * Keine Abhängigkeit — alles läuft über die Web Animations API, die in jedem
 * Safari seit Jahren steckt.
 *
 * Der Ablauf ist immer derselbe:
 *   1. Rechteck des Startbilds messen
 *   2. Zielbild unsichtbar stellen (`visibility`, NICHT `display` — sonst gibt
 *      es kein Rechteck zu messen) und messen
 *   3. Einen festen Klon („Geist") von Start nach Ziel animieren
 *   4. Geist weg, Zielbild sichtbar
 *
 * Warum zwei Ebenen im Geist (Rahmen + Bild):
 * Kachel und Werkseite haben verschiedene Seitenverhältnisse. Skaliert man nur
 * einen Rahmen ungleichmäßig, quetscht das Bild darin sichtbar. Deshalb trägt
 * der Rahmen die ungleichmäßige Skalierung (er landet exakt auf dem Zielfeld)
 * und das Bild darin eine Gegenskalierung. Beides zusammen ergibt für das Bild
 * eine GLEICHMÄSSIGE Vergrößerung — es wächst, ohne sich zu verziehen. Der
 * Rahmen ist das Fenster, das dabei aufgeht.
 *
 * Gesetz (siehe abendlicht.css): nur `transform` und `opacity`.
 */
import { useLayoutEffect, type RefObject } from "react";

/** Ein gemessenes Rechteck — nur die vier Zahlen, kein lebendes DOMRect. */
interface Feld { left: number; top: number; breite: number; hoehe: number }

interface Abflug {
  schluessel: string;
  feld: Feld;
  quelle: string;
  /** Natürliche Bildmaße; 0 heißt „unbekannt" (dann ohne Gegenskalierung). */
  natur: { breite: number; hoehe: number };
  zeit: number;
  /** Läuft nicht ab — für Flächen, die dauerhaft „abflugbereit" stehen. */
  dauerhaft: boolean;
}

/** Nach dieser Frist ist ein gemerkter Abflug alt und wird verworfen. */
const FRIST_MS = 1600;
let abflug: Abflug | null = null;

/**
 * Wo die Halle stand, als man sie verlassen hat.
 *
 * Beim Zurückkommen soll sie exakt so aussehen wie vorher — nicht ungefähr.
 * `scrollIntoView` würde die Kachel mittig stellen und damit die ganze Reihe
 * verschieben; deshalb merken wir die Höhe selbst.
 */
let hallenStand: { pfad: string; y: number } | null = null;

/** Vor dem Verlassen der Halle aufrufen. */
export function merkeHallenstand(): void {
  if (typeof window === "undefined") return;
  hallenStand = { pfad: window.location.pathname, y: window.scrollY };
}

/** Beim Zurückkommen: dieselbe Höhe wiederherstellen. Gibt true, wenn passiert. */
function stelleHalleWiederHer(): boolean {
  if (!hallenStand || typeof window === "undefined") return false;
  if (hallenStand.pfad !== window.location.pathname) return false;
  const y = hallenStand.y;
  window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  // Der Browser stellt beim Zurückgehen selbst noch eine Höhe her, kurz nach
  // uns — gemessen 6 px daneben. Ein zweiter Griff im nächsten Bild behält das
  // letzte Wort, ohne dass jemand etwas davon sieht.
  requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior }));
  hallenStand = null;
  return true;
}

/** Der Name, unter dem Kachel und Werkseite dasselbe Werk meinen. */
export const werkSchluessel = (slug: string) => `werk:${slug}`;

export function ruhigeBewegung(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function zahl(name: string, ersatz: number): number {
  if (typeof window === "undefined") return ersatz;
  const roh = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ms = /^([\d.]+)ms$/.exec(roh);
  return ms ? Number(ms[1]) : ersatz;
}

function bildIn(el: HTMLElement): HTMLImageElement | null {
  return el.tagName === "IMG" ? (el as HTMLImageElement) : el.querySelector("img");
}

function messe(el: HTMLElement): Feld {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, breite: r.width, hoehe: r.height };
}

/**
 * Holt das Ziel in den sichtbaren Bereich und misst DANACH.
 *
 * Ohne das fliegt das Bild ins Nichts: die Werkseite übernimmt beim Wechsel die
 * Scroll-Höhe der Halle, ihr Kopfbild steht dann weit über dem Bildrand
 * (gemessen: −962 px). Dasselbe gilt für den Rückweg, wenn die Kachel weit
 * unten in der Halle liegt.
 */
function sichtbarMachen(el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  const hoehe = window.innerHeight || 0;
  const sichtbar = Math.min(r.bottom, hoehe) - Math.max(r.top, 0);
  if (sichtbar >= Math.min(r.height, hoehe) * 0.4) return;
  // `instant` ist Pflicht: die Seite trägt `scroll-behavior: smooth`
  // (src/index.css). Damit wäre scrollIntoView eine Animation, und die Messung
  // gleich danach läse noch die alte Stelle — das Bild flöge ins Nichts.
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" as ScrollBehavior });
}

/**
 * Maße, die ein Bild mit `object-fit: cover` in einem Feld tatsächlich annimmt.
 * Ohne die natürlichen Maße gibt es nichts zu rechnen — dann füllt es das Feld.
 */
function deckmass(feld: Feld, natur: { breite: number; hoehe: number }) {
  if (!natur.breite || !natur.hoehe) return { breite: feld.breite, hoehe: feld.hoehe };
  const rBild = natur.breite / natur.hoehe;
  const rFeld = feld.breite / feld.hoehe;
  return rFeld > rBild
    ? { breite: feld.breite, hoehe: feld.breite / rBild }
    : { breite: feld.hoehe * rBild, hoehe: feld.hoehe };
}

/**
 * Merkt sich das Startbild. Der nächste passende Ankunftsort fliegt es ein.
 *
 * `dauerhaft` für Flächen, die die ganze Zeit abflugbereit stehen — etwa das
 * Kopfbild der Werkseite, das jederzeit in seine Kachel zurückfliegen können
 * muss. Der Rückweg lässt sich nämlich NICHT beim Zurückgehen abfangen: React
 * Router hängt die Werkseite im `popstate` synchron ab, ein dort registrierter
 * Hörer wird entfernt, bevor er an die Reihe kommt (im Browser gemessen).
 */
export function merkeAbflug(schluessel: string, el: HTMLElement | null, dauerhaft = false): void {
  // Auch bei „Bewegung reduzieren" wird gemerkt. Geflogen wird dann nicht —
  // aber die Ankunft muss ihr Ziel trotzdem in den sichtbaren Bereich holen,
  // sonst landet man auf der Werkseite unterhalb des Kopfbilds (gemessen: −696 px).
  if (!el) { abflug = null; return; }
  const img = bildIn(el);
  const quelle = img?.currentSrc || img?.src || "";
  if (!quelle) { abflug = null; return; }
  abflug = {
    schluessel,
    feld: messe(el),
    quelle,
    natur: { breite: img?.naturalWidth ?? 0, hoehe: img?.naturalHeight ?? 0 },
    zeit: performance.now(),
    dauerhaft,
  };
}

export function verwirfAbflug(): void { abflug = null; }

/**
 * Lässt ein Bild von einem gemessenen Feld auf ein Element zufliegen.
 * Gibt zurück, wenn der Flug vorbei ist (oder sofort, wenn nicht geflogen wird).
 */
export function fliege(
  von: Feld,
  zuEl: HTMLElement,
  quelle: string,
  natur: { breite: number; hoehe: number } = { breite: 0, hoehe: 0 },
): Promise<void> {
  if (von.breite < 1 || von.hoehe < 1) return Promise.resolve();
  // Kommt man in die Halle zurück, zählt ihre gemerkte Höhe — sonst holt der
  // Flug sein Ziel selbst in den sichtbaren Bereich.
  if (!stelleHalleWiederHer()) sichtbarMachen(zuEl);
  if (ruhigeBewegung()) return Promise.resolve();
  const zu = messe(zuEl);
  if (zu.breite < 1 || zu.hoehe < 1) return Promise.resolve();

  const dauer = zahl("--t-buehne", 700);
  const kurve = "cubic-bezier(.22,.8,.22,1)";

  const rahmen = document.createElement("div");
  rahmen.setAttribute("aria-hidden", "true");
  rahmen.style.cssText =
    `position:fixed;left:0;top:0;width:${von.breite}px;height:${von.hoehe}px;`
    + "overflow:hidden;pointer-events:none;z-index:100;transform-origin:0 0;will-change:transform;";

  // Das Bild liegt mittig im Rahmen und ist so groß, wie „cover" es im
  // START-Feld machen würde. Am Ende soll es so groß sein wie im ZIEL-Feld.
  const dVon = deckmass(von, natur);
  const dZu = deckmass(zu, natur);
  const bild = document.createElement("img");
  bild.src = quelle;
  bild.alt = "";
  bild.draggable = false;
  bild.style.cssText =
    `position:absolute;left:50%;top:50%;width:${dVon.breite}px;height:${dVon.hoehe}px;`
    + `margin-left:${-dVon.breite / 2}px;margin-top:${-dVon.hoehe / 2}px;`
    + "object-fit:cover;transform-origin:50% 50%;will-change:transform;";
  rahmen.appendChild(bild);
  document.body.appendChild(rahmen);

  const sx = zu.breite / von.breite;
  const sy = zu.hoehe / von.hoehe;
  // Gegenskalierung: Rahmen mal Bild ergibt zusammen eine gleichmäßige Größe.
  const gx = (dZu.breite / dVon.breite) / sx;
  const gy = (dZu.hoehe / dVon.hoehe) / sy;

  const sicht = zuEl.style.visibility;
  zuEl.style.visibility = "hidden";

  const zeit = { duration: dauer, easing: kurve, fill: "both" as const };
  const a = rahmen.animate([
    { transform: `translate3d(${von.left}px, ${von.top}px, 0) scale(1, 1)` },
    { transform: `translate3d(${zu.left}px, ${zu.top}px, 0) scale(${sx}, ${sy})` },
  ], zeit);
  bild.animate([
    { transform: "scale(1, 1)" },
    { transform: `scale(${gx}, ${gy})` },
  ], zeit);

  return a.finished.catch(() => undefined).then(() => {
    zuEl.style.visibility = sicht;
    rahmen.remove();
  });
}

/**
 * Empfängt einen gemerkten Abflug. Steht `schluessel` nicht an, oder ist der
 * Abflug zu alt, passiert nichts — die Seite erscheint wie immer.
 *
 * `useLayoutEffect`, damit gemessen wird, bevor der Browser zeichnet: sonst
 * blitzt das Zielbild einmal auf, bevor es sich versteckt.
 */
export function useAnkunft(schluessel: string | null | undefined, ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!schluessel || !el || !abflug) return;
    if (abflug.schluessel !== schluessel) return;
    if (!abflug.dauerhaft && performance.now() - abflug.zeit > FRIST_MS) { abflug = null; return; }
    // Mobil- und Desktop-Fassung der Werkseite stehen beide im Baum, immer eine
    // davon per CSS ausgeblendet. Die ausgeblendete hat kein Rechteck — sie darf
    // den Abflug NICHT aufbrauchen, sonst verschluckt sie den Flug der sichtbaren.
    if (el.getBoundingClientRect().width < 1) return;
    const { feld, quelle, natur } = abflug;
    abflug = null;
    void fliege(feld, el, quelle, natur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
}
