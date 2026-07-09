/**
 * Interne Pseudonymisierung — nie E-Mail oder Klarname in Admin-Listen.
 * admin → "User X" (bzw. X2/X3 nach Erstell-Reihenfolge der admin-Rolle)
 * designer → "Designer {house_number}"
 * customer → "User {member_number}"
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HandleContext {
  role: "admin" | "designer" | "customer";
  memberNumber?: number | null;
  houseNumber?: number | null;
  adminOrdinal?: number | null; // 1 => "User X", 2 => "User X2"
}

export function getInternalHandle(ctx: HandleContext): string {
  if (ctx.role === "admin") {
    const n = ctx.adminOrdinal ?? 1;
    return n <= 1 ? "User X" : `User X${n}`;
  }
  if (ctx.role === "designer") {
    return `Designer ${ctx.houseNumber ?? "?"}`;
  }
  return `User ${ctx.memberNumber ?? "?"}`;
}

interface HandleRow { user_id: string; handle: string; role: HandleContext["role"] }

/** Lädt und pseudonymisiert eine Liste von User-IDs auf einmal. */
export function useInternalHandles(userIds: (string | null | undefined)[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[])).sort().join(",");

  useEffect(() => {
    if (!ids) { setMap(new Map()); return; }
    let alive = true;
    (async () => {
      const idList = ids.split(",");
      const [profiles, roles, designers] = await Promise.all([
        supabase.from("profiles").select("id, member_number").in("id", idList),
        supabase.from("user_roles").select("user_id, role, created_at").in("user_id", idList),
        supabase.from("designers").select("user_id, house_number").in("user_id", idList),
      ]);
      if (!alive) return;

      // Compute admin ordinals globally so ordering is stable across sessions.
      const { data: allAdmins } = await supabase
        .from("user_roles").select("user_id, created_at")
        .eq("role", "admin").order("created_at", { ascending: true });
      const adminOrdinal = new Map<string, number>();
      ((allAdmins ?? []) as Array<{ user_id: string }>).forEach((r, i) => {
        if (!adminOrdinal.has(r.user_id)) adminOrdinal.set(r.user_id, i + 1);
      });

      const memberById = new Map(((profiles.data ?? []) as Array<{ id: string; member_number: number | null }>).map((p) => [p.id, p.member_number]));
      const houseById = new Map(((designers.data ?? []) as Array<{ user_id: string; house_number: number | null }>).map((d) => [d.user_id, d.house_number]));
      const rolesById = new Map<string, string[]>();
      for (const r of ((roles.data ?? []) as Array<{ user_id: string; role: string }>)) {
        const cur = rolesById.get(r.user_id) ?? [];
        cur.push(r.role);
        rolesById.set(r.user_id, cur);
      }

      const next = new Map<string, string>();
      for (const uid of idList) {
        const rs = rolesById.get(uid) ?? [];
        if (rs.includes("admin")) {
          next.set(uid, getInternalHandle({ role: "admin", adminOrdinal: adminOrdinal.get(uid) ?? 1 }));
        } else if (rs.includes("designer")) {
          next.set(uid, getInternalHandle({ role: "designer", houseNumber: houseById.get(uid) ?? null }));
        } else {
          next.set(uid, getInternalHandle({ role: "customer", memberNumber: memberById.get(uid) ?? null }));
        }
      }
      setMap(next);
    })();
    return () => { alive = false; };
  }, [ids]);

  return map;
}

/** Einzelner Handle für einen User. */
export function useInternalHandle(userId: string | null | undefined): string {
  const map = useInternalHandles([userId]);
  return userId ? map.get(userId) ?? "User —" : "Gast";
}

export type { HandleRow };
