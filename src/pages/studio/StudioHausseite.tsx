/**
 * Teil O/K3 — die Hausseite hat keinen zweiten Renderer mehr.
 *
 * Bis hierher zeigte das Studio `HausseiteBlocks` als Scroll-Seite, während das Heft
 * dieselben Daten als Doppelseite zeichnete: zwei Darstellungen einer Sache, die immer
 * wieder auseinanderliefen. Bearbeitet wird jetzt im echten Heft unter `/studio/heft`.
 * Diese Adresse bleibt als Weiterleitung bestehen, damit gespeicherte Links und der
 * Menüpunkt weiter tragen.
 */
import { Navigate } from "react-router-dom";

export default function StudioHausseite() {
  return <Navigate to="/studio/heft" replace />;
}
