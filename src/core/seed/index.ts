import { replay, type DomainState } from "../reducers/root";
import { registerAgent, registerKnowledge, registerPolicy, registerPrompt } from "../reducers/aiGovernance";
import { buildSeedEvents, seedIds } from "./events";
import { asKnowledgeSourceId } from "../types/ids";

/**
 * Some entities are pure catalog and don't need event registration — we hydrate
 * them directly onto the initial state before replaying events. This keeps the
 * event log focused on state changes rather than static catalog rows.
 */
export function buildSeedState(): DomainState {
  const base = replay(buildSeedEvents());

  // Register the customer agent, its active prompt, seeded knowledge & memory policy.
  const withPolicy = registerPolicy(base.ai, {
    id: seedIds.defaultMemoryPolicyId,
    scope: "memory",
    version: 1,
    body: { allow: ["saved_products", "viewed_products", "followed_designers"], deny: ["chat_history"] },
  });
  const withPrompt = registerPrompt(withPolicy, {
    id: seedIds.customerPromptId,
    agentId: seedIds.customerAgentId,
    body: "You are PAWN's Style Concierge. Speak with the restraint of a Loewe editor. Never invent inventory.",
    author: "creative-director",
    createdAt: "2026-01-01T00:00:00.000Z",
    note: "Initial voice",
    isActive: true,
  });
  const withAgent = registerAgent(withPrompt, {
    id: seedIds.customerAgentId,
    name: "Style Concierge",
    audience: "customer",
    activePromptId: seedIds.customerPromptId,
    toolIds: [],
    memoryPolicyId: seedIds.defaultMemoryPolicyId,
  });
  const withKnowledge = registerKnowledge(withAgent, {
    id: asKnowledgeSourceId("kb_style_lexicon"),
    kind: "doc",
    ref: "internal://style-lexicon",
    label: "PAWN Style Lexicon",
    enabled: true,
  });

  return { ...base, ai: withKnowledge };
}

export { buildSeedEvents, seedIds };
export { seedDesigners } from "./designers";
export { seedProducts } from "./products";
export { seedAdminOrders, seedCustomerOrders, seedRevenueSeries, seedMonthsShort } from "./orders";
export { seedDnaSegments, seedColorTrends, seedGenome } from "./dna";
