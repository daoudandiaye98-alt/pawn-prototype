/**
 * PART 48 AP7 — eine Stelle für jede planbedingte Sperre im Studio: was gesperrt ist, warum,
 * und was als Nächstes hilft (Plan wechseln ODER auf den Reset warten — nie beides gleichzeitig
 * behauptet). Liest nur den bereits geladenen planGate-Cache, holt selbst keine Daten nach.
 */
import { Link } from "react-router-dom";
import { naechsterPlanFuerMehr, planLabel, typFor, type Plan } from "@/lib/planGate";

export interface GesperrtProps {
  /** planGate-Feature-Schlüssel, z.B. "chat_nachricht", "tuer_oeffnen", "welten". */
  feature: string;
  /** Menschlich lesbarer Name für die Meldung, z.B. "Nachrichten mit PAWN", "Türen". */
  was: string;
  plan: Plan;
  grund?: "plan" | "kontingent" | "budget";
  className?: string;
}

function warumText(grund: GesperrtProps["grund"], was: string, plan: Plan, typ: "monat" | "bestand" | "schalter"): string {
  if (grund === "budget") return `Das Guthaben für ${was} ist diesen Monat aufgebraucht.`;
  if (grund === "kontingent") {
    return typ === "monat"
      ? `Dein monatliches Kontingent an ${was} im Plan ${planLabel(plan)} ist aufgebraucht.`
      : `Kein Platz mehr für ${was} in deinem Plan ${planLabel(plan)}.`;
  }
  return `${was} ist im Plan ${planLabel(plan)} nicht enthalten.`;
}

/** Ein-und-derselbe Sperre kann entweder per Plan-Wechsel oder per Warten gelöst werden — nie
 * beides zugleich angeboten, damit die Meldung nicht widersprüchlich wirkt. */
export function Gesperrt({ feature, was, plan, grund, className = "" }: GesperrtProps) {
  const typ = typFor(feature);
  const naechster = naechsterPlanFuerMehr(feature, plan);
  const wartetAufReset = typ === "monat" && grund !== "budget";

  return (
    <div className={`border border-dashed border-black/30 bg-black/[0.02] p-4 text-sm text-black ${className}`}>
      <p className="font-medium">{was} — gerade nicht verfügbar.</p>
      <p className="mt-1 text-black/60">{warumText(grund, was, plan, typ)}</p>
      {naechster ? (
        <Link to="/studio/plan"
          className="mt-3 inline-block border border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-black hover:bg-black hover:text-white">
          Zu {planLabel(naechster)} wechseln
        </Link>
      ) : wartetAufReset ? (
        <p className="mt-2 text-xs text-black/50">Am 1. des Monats ist es wieder da.</p>
      ) : (
        <p className="mt-2 text-xs text-black/50">Meld dich bei uns, wenn dir das nicht reicht.</p>
      )}
    </div>
  );
}
