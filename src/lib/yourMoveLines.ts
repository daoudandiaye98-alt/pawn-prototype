/**
 * PART 51 Teil A + Teil H — die vier Zielgruppen-Zeilen sind exakt vorgegebene englische
 * Kampagnensprache (ein Sprachsystem: eine Zeile pro Zielgruppen-Fläche), unabhängig von der
 * Sprachumschaltung — deshalb fest im Code statt über site_content/Editable oder i18n, wie
 * "YOUR MOVE." selbst. Jede Zeile lebt genau einmal, nie auf der Landing (Teil H).
 */
export const YOUR_MOVE_LINES = {
  zeigen: "Show us what you've made.",
  designer: "Put your work out there.",
  discover: "Find something worth choosing.",
  // "Make something of it." ist für Kampagnen reserviert — erscheint bewusst nirgends im Produkt-UI.
} as const;
