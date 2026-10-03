/**
 * Der Rahmen um alles, was NICHT das Heft ist: die eigenen Bilder unter /deine-dna/avatar,
 * /raeume und /anproben, Rechtstexte, Preise, Studio, Cockpit, Portal und die 404.
 *
 * Eigenes Buendel: das Heft braucht nichts hiervon. Es hat seinen eigenen `toast()` (app.js),
 * keinen Admin-Copiloten, fragt selbst nach der Einwilligung und nutzt weder die
 * Studio-Schriften noch das Abendlicht. Fest in App.tsx und main.tsx eingebunden lud jeder
 * Heft-Besuch das alles mit; zusammen mit den Seiten und dem Woerterbuch hob das jede
 * Heft-Seite ueber die 3 MB des Pruefstands (Kontrolle 4.7).
 *
 * App.tsx laedt diesen Rahmen erst zusammen mit dem Woerterbuch (`ladeWoerterbuch`): keine
 * Seite hierunter zeichnet, bevor t() ihre Texte kennt.
 */
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CopilotProvider } from "@/components/pawn/CopilotDrawer";
import { ConsentBanner } from "@/components/palace/ConsentBanner";
import { istHeftAdresse } from "@/heft03/adressen";
// Teil N — das Abendlicht-System (nur /studio): Fraunces für Display und die Stimme
// des Bauern (kursiv), Outfit für die Bedienoberfläche. Lokal wie alle Schriften.
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/fraunces/500-italic.css";
import "@fontsource/fraunces/600-italic.css";
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "./styles/abendlicht.css";

/**
 * Die Einwilligungsleiste steht nur ausserhalb des Hefts. Im Heft fragt PAWN selbst,
 * genau dann, wenn es zum ersten Mal etwas zu merken gaebe — zwei Dialoge zur selben
 * Frage waeren einer zu viel. Die Frage nach der Adresse bleibt, obwohl das Heft diesen
 * Rahmen nie betritt: /deine-dna/avatar und eine 404 unter einer Heft-Adresse (etwa
 * /werk/a/b) zaehlen als Heft-Adresse und bekamen die Leiste nie.
 */
function EinwilligungAusserhalbDesHefts() {
  const { pathname } = useLocation();
  return istHeftAdresse(pathname) ? null : <ConsentBanner />;
}

/* Die innere Grenze haelt Toasts und Leiste stehen, waehrend die naechste Seite laedt. */
export default function AppRahmen() {
  return (
    <>
      <Sonner />
      <CopilotProvider>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
        <EinwilligungAusserhalbDesHefts />
      </CopilotProvider>
    </>
  );
}
