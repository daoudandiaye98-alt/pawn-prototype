import type { DomainEvent } from "../types/events";
import type { EventId } from "../types/ids";
import { asAgentId, asIdentityId, asPluginId, asPolicyId, asPromptVersionId, asToolId } from "../types/ids";
import type { Brand, ConsentFlags } from "../types/entities";
import { asBrandId } from "../types/ids";
import { seedDesigners } from "./designers";
import { seedProducts } from "./products";
import { seedAdminOrders } from "./orders";
import { seedGenome } from "./dna";

const consent: ConsentFlags = { personalization: true, memory: true, analytics: true };

/** Build the event sequence that reconstitutes the entire seed world. */
export function buildSeedEvents(): DomainEvent[] {
  const events: DomainEvent[] = [];
  let n = 0;
  const stamp = (raw: Omit<DomainEvent, "id" | "at">): DomainEvent => {
    n += 1;
    return { ...raw, id: `seed_${n.toString().padStart(4, "0")}` as EventId, at: "2026-01-01T00:00:00.000Z" } as DomainEvent;
  };

  // Designers + brands
  seedDesigners.forEach((designer) => {
    events.push(stamp({ type: "designer.registered", actor: "system", payload: { designer } }));
    designer.brandIds.forEach((bid) => {
      const brand: Brand = { id: bid, designerId: designer.id, name: designer.name };
      events.push(stamp({ type: "brand.registered", actor: "system", payload: { brand } }));
    });
  });

  // Products
  seedProducts.forEach((product) => {
    events.push(stamp({ type: "product.registered", actor: "system", payload: { product } }));
  });

  // Anonymous demo identity
  const meId = asIdentityId("me");
  events.push(stamp({
    type: "identity.created", actor: "system",
    payload: { identityId: meId, profile: { displayName: "Guest", locale: "en", consent } },
  }));
  events.push(stamp({
    type: "dna.updated", actor: "system",
    payload: { identityId: meId, genome: seedGenome, version: 1 },
  }));

  // Historic admin orders — attach to demo identity for aggregation
  seedAdminOrders.forEach((o) => {
    events.push(stamp({
      type: "order.placed", actor: "system",
      payload: {
        identityId: meId,
        orderId: o.id,
        items: o.items,
        total: o.total,
        customerLabel: o.customerLabel,
        placedAt: o.placedAt,
      },
    }));
  });

  // AI governance seed
  const agentId = asAgentId("agent_customer");
  const promptId = asPromptVersionId("prompt_customer_v1");
  const policyId = asPolicyId("policy_memory_default");
  events.push(stamp({
    type: "policy.updated", actor: "system",
    payload: { policyId, version: 1 },
  }));
  // Prompt + agent are registered via seed hydration hooks (see seed/index composition below).
  events.push(stamp({ type: "ai.prompt_updated", actor: "system", payload: { agentId, promptVersionId: promptId } }));

  // Plugins catalog
  const plugins: Array<[string, string]> = [
    ["openai", "OpenAI"],
    ["stripe", "Stripe"],
    ["shopify", "Shopify"],
    ["klaviyo", "Klaviyo"],
    ["notion", "Notion"],
  ];
  plugins.forEach(([slug, name]) => {
    events.push(stamp({
      type: "plugin.registered", actor: "system",
      payload: { pluginId: asPluginId(`plg_${slug}`), slug, name },
    }));
  });

  // Enable a tool on the customer agent for realism
  events.push(stamp({
    type: "ai.tool_enabled", actor: "system",
    payload: { agentId, toolId: asToolId("tool_search_catalog") },
  }));
  // Reference for asBrandId to avoid unused-import warnings in some checkers
  void asBrandId;

  return events;
}

// Re-export identifiers needed for post-seed hydration in seed/index.ts
export const seedIds = {
  meIdentityId: asIdentityId("me"),
  customerAgentId: asAgentId("agent_customer"),
  customerPromptId: asPromptVersionId("prompt_customer_v1"),
  defaultMemoryPolicyId: asPolicyId("policy_memory_default"),
};
