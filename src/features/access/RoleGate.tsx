/**
 * Role-based route gate.
 *
 * Enforces PAWN's three-audience architecture:
 *   Owner  → /admin (Operating System)
 *   Designer → /portal (Studio)
 *   Customer → /account (Experience)
 *
 * Prototype policy: if an unauthenticated visitor lands on /admin or /portal
 * we still render the surface (this is a public prototype) but expose a
 * clearly-labelled prototype banner so the role boundary stays visible.
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

  // Unauthenticated: prototype pass-through, but let the surface show a banner.
  if (!user) return <>{children}</>;

  if (roles.includes(role)) return <>{children}</>;

  // Authenticated but wrong role → route them where they belong.
  if (roles.includes("admin") && role !== "admin") {
    return <Navigate to="/admin" replace state={{ from: location }} />;
  }
  if (roles.includes("designer") && role !== "designer") {
    return <Navigate to="/portal" replace state={{ from: location }} />;
  }
  return <Navigate to={fallback ?? "/account"} replace state={{ from: location }} />;
}

/** Banner shown inside owner/designer surfaces when accessed anonymously. */
export function PrototypeAccessBanner({ role }: { role: "Owner OS" | "Designer Studio" }) {
  const { user, roles } = useAuth();
  if (user && (roles.includes("admin") || roles.includes("designer"))) return null;
  return (
    <div className="flex items-center gap-3 border-b border-white/10 bg-[hsl(0_55%_10%)]/60 px-6 py-2 text-[10px] uppercase tracking-[0.28em] text-[hsl(36_25%_84%)] md:px-10">
      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(350_65%_55%)]" />
      Prototype access · {role} · role boundaries not enforced
    </div>
  );
}
