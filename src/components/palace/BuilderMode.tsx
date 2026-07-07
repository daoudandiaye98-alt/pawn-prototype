/**
 * Builder mode UI: floating toggle button (admins) + top strip when active.
 */
import { useEditMode } from "@/lib/editMode";

export function BuilderToggle() {
  const { enabled, isAdmin, toggle } = useEditMode();
  if (!isAdmin) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Bearbeiten beenden" : "Bearbeiten"}
      className="fixed bottom-6 right-6 z-[80] flex items-center gap-2 border border-black/60 bg-white/95 px-4 py-2 text-[0.62rem] uppercase tracking-[0.32em] text-black shadow-md backdrop-blur transition hover:bg-white"
    >
      <span aria-hidden>✎</span>
      <span>{enabled ? "Fertig" : "Bearbeiten"}</span>
    </button>
  );
}

export function BuilderBar() {
  const { enabled, disable } = useEditMode();
  if (!enabled) return null;
  return (
    <div className="sticky top-0 z-[70] flex items-center justify-between border-b border-black/70 bg-white px-4 py-2 text-[0.6rem] uppercase tracking-[0.32em] text-black">
      <span>Builder-Modus aktiv · Klicke Texte zum Bearbeiten</span>
      <button type="button" onClick={disable} className="uline">Fertig</button>
    </div>
  );
}
