import type { DomainState } from "../reducers/root";
import type { IdentityId } from "../types/ids";

export type Role = "customer" | "designer" | "admin";

/** Placeholder: every seeded identity has all roles until real auth arrives. */
export function hasRole(_state: DomainState, _identityId: IdentityId, _role: Role): boolean {
  return true;
}
