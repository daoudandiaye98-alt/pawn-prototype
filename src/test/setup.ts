import "@testing-library/jest-dom";

/*
 * Alles hier drin setzt ein Browser-Fenster voraus.
 *
 * Die meisten Prüfungen laufen unter jsdom und haben eines. Eine Prüfung, die
 * ausdrücklich in Node läuft (`@vitest-environment node`), hat keines — und
 * scheiterte bisher an dieser Datei, bevor sie ihre erste Zeile ausführen
 * konnte. Gebraucht wird das für Werkzeuge, die es nur in Node gibt: der
 * Prüfstand läuft dort, und esbuild bricht unter jsdom ab.
 *
 * Also: was das Fenster braucht, geschieht nur, wenn es eines gibt.
 */
if (typeof window === "undefined") {
  // Node-Umgebung — nichts einzurichten, und das ist kein Fehler.
} else {

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

}
