/**
 * Der Waechter. EINER.
 *
 * Teil L12: es gab zwei. RoleGate hing an jeder /studio-Adresse und prueft die
 * Rolle; PortalGate hing an /portal, /portal/onboarding und /studio/onboarding
 * und prueft KEINE Rolle. Dieselbe Flaeche, zwei Antworten — eine angemeldete
 * Kundschaft kam nicht nach /studio/postfach, aber sehr wohl nach /portal und
 * /studio/onboarding. Seitdem gilt: hier faellt die Entscheidung ueber Zutritt,
 * nirgends sonst. PortalGate entscheidet nur noch, WO im Studio ein Haus landet,
 * und sitzt dafuer INNERHALB eines RoleGate.
 *
 * Die drei Publikumstueren:
 *   admin    → /admin    (das Cockpit)
 *   designer → /studio    (das Atelier)
 *   Kundschaft → /konto   (das Heft)
 *
 * Durchlass fuer nicht Angemeldete: wer ohne Konto auf /admin oder /studio
 * landet, sieht die Flaeche trotzdem — mit einem deutlichen Streifen darauf.
 * Das ist Absicht, solange PAWN ein oeffentlicher Prototyp ist, und die einzige
 * Stelle, an der es steht. Wenn Daouda den Durchlass schliessen will, faellt
 * genau die eine Zeile unten weg.
 */
import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";

interface Props {
  role: Role;
  fallback?: string;
  children: ReactNode;
}

export function RoleGate({ role, fallback, children }: Props) {
  const { user, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  // DER DURCHLASS. Nicht angemeldet heisst hier: sehen ja, ein Streifen sagt es an.
  // Eine Zeile, ein Ort. Wer ihn schliessen will, ersetzt sie durch
  //   return <Navigate to="/konto" replace state={{ from: location }} />;
  if (!user) return <>{children}</>;

  if (roles.includes(role)) return <>{children}</>;

  // Authenticated but wrong role → route them where they belong.
  if (roles.includes("admin") && role !== "admin") {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }
  if (roles.includes("designer") && role !== "designer") {
    // Teil R9 — ein Haus gehört ins Studio, nicht auf die alte Portal-Attrappe.
    return <Navigate to="/studio" replace state={{ from: location }} />;
  }
  return <Navigate to={fallback ?? "/konto"} replace state={{ from: location }} />;
}

/** Banner shown inside owner/designer surfaces when accessed anonymously. */
export function PrototypeAccessBanner({ role }: { role: "Owner OS" | "Designer Studio" }) {
  const { user, roles } = useAuth();
  if (user && (roles.includes("admin") || roles.includes("designer"))) return null;
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-black/60 px-6 py-2 text-[10px] uppercase tracking-[0.28em] text-white/84 md:px-10">
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/55" />
      Prototype access · {role} · role boundaries not enforced
    </div>
  );
}
