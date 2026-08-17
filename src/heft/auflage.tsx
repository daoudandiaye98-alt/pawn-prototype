/**
 * Teil X7 — die Auflage: eine Seite, die sich über das Heft legt.
 *
 * Zwei Dinge brauchen sie: der **Lichttisch** (das Werk groß, ohne Beschnitt)
 * und der **Anfragebogen** (der Weg, wenn ein Stück nicht in den Korb kann).
 * Beide sind dasselbe Möbel — deshalb steht es einmal hier und nicht zweimal
 * dort.
 *
 * **Warum ein Portal.** Jedes Blatt des Hefts trägt eine `transform`
 * (`rotateY`). In einem transformierten Vorfahren ist `position: fixed` nicht
 * mehr auf das Fenster bezogen, sondern auf dieses Blatt — eine Auflage im Blatt
 * läge also schief im Raum und würde mitgewendet. Sie hängt deshalb direkt im
 * `body`. Das ist keine zweite Oberfläche über dem Heft: sie ist eine Seite des
 * Hefts, die vorn liegt, und sie geht mit dem nächsten Griff wieder weg.
 *
 * **Warum das Rollen gesperrt wird.** Im Heft ist Rollen das Blättern. Ohne
 * Sperre würde der Wendel hinter der offenen Auflage weiterlaufen, und beim
 * Schließen stünde man drei Doppelseiten weiter. Gesperrt wird über abgefangene
 * Ereignisse und NICHT über `overflow: hidden` am Körper: das setzte die
 * Rollhöhe zurück und risse dem Wendel den Stand weg.
 */
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface AuflageProps {
  /** Für die Vorlesehilfe — was hier aufgeschlagen ist. */
  titel: string;
  /** Schwarzer Grund für den Lichttisch, Papier für den Bogen. */
  ton: "nacht" | "papier";
  aufZu: () => void;
  children: ReactNode;
}

/** Tasten, die im Heft blättern — sie ruhen, solange eine Auflage offen ist. */
const BLAETTERTASTEN = new Set([
  " ", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End",
]);

export function Auflage({ titel, ton, aufZu, children }: AuflageProps) {
  const wurzel = useRef<HTMLDivElement>(null);
  const zurueck = useRef<HTMLElement | null>(null);

  /* Wer geschlossen hat, steht danach wieder auf dem Element, das geöffnet hat. */
  useEffect(() => {
    zurueck.current = document.activeElement as HTMLElement | null;
    const ziel = wurzel.current?.querySelector<HTMLElement>("[data-zuerst]")
      ?? wurzel.current?.querySelector<HTMLElement>("button, a, input, textarea");
    ziel?.focus();
    return () => zurueck.current?.focus?.();
  }, []);

  const beiTaste = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); aufZu(); return; }
    if (BLAETTERTASTEN.has(e.key)) {
      // Im Textfeld ist die Leertaste ein Leerzeichen, kein Blättern.
      const im = e.target as HTMLElement | null;
      if (im && (im.tagName === "TEXTAREA" || im.tagName === "INPUT")) return;
      e.preventDefault();
    }
  }, [aufZu]);

  useEffect(() => {
    const halt = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", beiTaste);
    window.addEventListener("wheel", halt, { passive: false });
    window.addEventListener("touchmove", halt, { passive: false });
    return () => {
      window.removeEventListener("keydown", beiTaste);
      window.removeEventListener("wheel", halt);
      window.removeEventListener("touchmove", halt);
    };
  }, [beiTaste]);

  return createPortal(
    <div className="hx-auflage" data-ton={ton} ref={wurzel} role="dialog" aria-modal="true" aria-label={titel}>
      {/*
        Der Grund schließt beim Antippen. Er ist kein Knopf, sondern die Fläche
        daneben — der Weg heraus steht als benannter Knopf oben rechts, und der
        ist der, den Tastatur und Vorlesehilfe finden.
      */}
      <div className="hx-auflage-grund" onClick={aufZu} aria-hidden />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <button type="button" className="hx-auflage-zu" onClick={aufZu} data-zuerst>
        Zurück ins Heft
      </button>
      <div className="hx-auflage-satz">{children}</div>
    </div>,
    document.body,
  );
}
