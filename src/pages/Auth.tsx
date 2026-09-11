import { Navigate, useSearchParams } from "react-router-dom";
import { sichererPfad } from "@/features/auth/tueren";

/**
 * Teil L10 — /auth ist keine Seite mehr, sondern ein Wegweiser.
 *
 * Der Zugang lebt jetzt im Heft, auf der ersten Doppelseite von /konto. Zwei
 * Anmeldemasken an zwei Orten waeren zwei Wahrheiten: eine davon wuerde irgendwann
 * vergessen (die Passwort-Wiederholung, ein neuer Fehlertext, die Google-Rueckkehr).
 *
 * Die Adresse bleibt trotzdem bestehen. Sie steht in E-Mails, in Lesezeichen und in
 * fremden Links, und eine 404 waere die schlechteste Antwort darauf.
 *
 * `returnTo` war der alte Name des Rueckkehrziels (aus /start), `next` ist der neue.
 * Beide werden gelesen und als `next` weitergereicht — `sichererPfad` laesst nur
 * eigene, relative Pfade durch und faengt dabei auch /auth selbst ab, sonst
 * leitete diese Seite auf sich zurueck.
 */
export default function Auth() {
  const [params] = useSearchParams();
  const next = sichererPfad(params.get("next") ?? params.get("returnTo"));
  return <Navigate replace to={next ? `/konto?next=${encodeURIComponent(next)}` : "/konto"} />;
}
