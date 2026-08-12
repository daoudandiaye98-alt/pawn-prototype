import { Navigate, useSearchParams } from "react-router-dom";
import FirstMove from "./FirstMove";

/**
 * Teil 37/AP2 — "Erster Zug": eindeutiger Einstiegspunkt für Akquise-Mails
 * (/start?lead=<id>). Die Attribution übernimmt LeadCapture in App.tsx (global,
 * jede Route) — hier bleibt nur die Weiterleitung zur Bewerbungsseite.
 *
 * PART 51 Teil B: /start ohne lead-Parameter zeigt jetzt den neuen First Move Flow —
 * bewusst NICHT überschrieben, denn /start?lead=<id> ist ein live versendeter Akquise-Link
 * (pawn-jarvis, buildFollowupEmailText). Mit lead-Parameter bleibt exakt das alte Verhalten.
 */
export default function Start() {
  const [params] = useSearchParams();
  const lead = params.get("lead");
  if (!lead) return <FirstMove />;
  const welt = params.get("welt");
  return <Navigate to={welt ? `/apply?welt=${encodeURIComponent(welt)}` : "/apply"} replace />;
}
