import type { Identity, MemoryKey } from "../types/entities";

export function isMemoryAllowed(identity: Identity, key: MemoryKey): boolean {
  if (identity.memory.deny.includes(key)) return false;
  return identity.memory.allow.includes(key);
}
