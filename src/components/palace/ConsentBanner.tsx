import { useConsent } from "@/lib/consent";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * PAWN Consent Banner — dezent, unten, Palace-Stil.
 * Erscheint, wenn keine Entscheidung getroffen wurde oder wenn der Nutzer
 * die Einstellungen aus dem Footer / Account erneut öffnet.
 */
export function ConsentBanner() {
  const { bannerOpen, setConsent, decided, setOpenSettings, value } = useConsent();
  if (!bannerOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einstellungen"
      className="fixed inset-x-0 bottom-0 z-flyout px-4 pb-4 md:px-8 md:pb-8"
    >
      <div className="mx-auto max-w-4xl border border-[rgba(0,0,0,.18)] bg-white shadow-[0_16px_48px_-24px_rgba(0,0,0,0.35)]">
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_auto] md:items-center md:p-8">
          <div>
            <p className="palace-eyebrow">Über Besuche hinweg</p>
            <p className="palace-serif mt-3 text-[1.15rem] leading-[1.35] text-[#000000]">
              PAWN merkt sich, was dich bewegt — <span className="italic">fest deinem Konto zugeordnet</span>, damit
              dein Raum bei jedem Besuch weiter wächst.
            </p>
            <p className="mt-3 text-[0.9rem] leading-[1.6] text-[#000000]/75">
              Du kannst diese Erinnerung jederzeit in deinem Konto löschen. Wir verkaufen keine Daten und setzen keine
              Werbe-Cookies. Details unter{" "}
              <Link to="/datenschutz" className="underline underline-offset-4">Datenschutz</Link>.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:min-w-[220px]">
            <Button
              type="button"
              variant="editorial"
              size="chip"
              onClick={() => setConsent("accepted")}
              className="justify-center bg-black text-white"
            >
              {value === "accepted" ? "Weiter merken" : "Einverstanden"}
            </Button>
            <Button
              type="button"
              variant="editorial"
              size="chip"
              onClick={() => setConsent("essential")}
              className="justify-center"
            >
              {value === "essential" ? "Bleibt bei notwendig" : "Nur notwendige"}
            </Button>
            {decided && (
              <button
                type="button"
                onClick={() => setOpenSettings(false)}
                className="palace-eyebrow mt-1 text-black/60 hover:text-[#000000]"
              >
                Schließen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
