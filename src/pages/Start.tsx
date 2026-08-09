import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Teil 37/AP2 — "Erster Zug": eindeutiger Einstiegspunkt für Akquise-Mails
 * (/start?lead=<id>). Die Attribution übernimmt LeadCapture in App.tsx (global,
 * jede Route) — hier bleibt nur die Weiterleitung zur Bewerbungsseite.
 */
export default function Start() {
  const [params] = useSearchParams();
  const welt = params.get("welt");
  return <Navigate to={welt ? `/apply?welt=${encodeURIComponent(welt)}` : "/apply"} replace />;
}
