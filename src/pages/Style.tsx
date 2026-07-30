import { Navigate } from "react-router-dom";

/**
 * Teil 21c: Die Stil-Sequenz ist von ihrer eigenen Seite auf die DNA-Seite
 * gezogen — dort wird die Schleife sichtbar (wischen → Bild schärft sich →
 * Urteil oben verändert sich). /style bleibt als Weiterleitung erhalten,
 * damit bestehende Links nicht ins Leere laufen.
 */
export default function Style() {
  return <Navigate to="/dna" replace />;
}
