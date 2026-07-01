import type {
  AgentId, AuditId, DesignerId, EventId, IdentityId, MutationId, OrderId,
  PluginId, PolicyId, ProductId, PromptVersionId, RecommendationId, ToolId,
} from "./ids";
import type {
  Brand, Collection, Designer, DNASignal, Mutation, OrderItem, Product,
  Profile, StyleGenome,
} from "./entities";

export interface EventEnvelope {
  id: EventId;
  at: string;
  actor: IdentityId | "system";
  cause?: EventId;
}

export type DomainEvent =
  // Registry (seed-time facts about the marketplace catalog)
  | (EventEnvelope & { type: "designer.registered"; payload: { designer: Designer } })
  | (EventEnvelope & { type: "brand.registered"; payload: { brand: Brand } })
  | (EventEnvelope & { type: "product.registered"; payload: { product: Product } })
  | (EventEnvelope & { type: "collection.registered"; payload: { collection: Collection } })

  // Identity lifecycle
  | (EventEnvelope & { type: "identity.created"; payload: { identityId: IdentityId; profile: Profile } })
  | (EventEnvelope & { type: "profile.updated"; payload: { identityId: IdentityId; patch: Partial<Profile> } })

  // Engagement
  | (EventEnvelope & { type: "product.viewed"; payload: { identityId: IdentityId; productId: ProductId; dwellMs?: number } })
  | (EventEnvelope & { type: "product.saved"; payload: { identityId: IdentityId; productId: ProductId } })
  | (EventEnvelope & { type: "designer.followed"; payload: { identityId: IdentityId; designerId: DesignerId } })

  // Cart
  | (EventEnvelope & { type: "cart.item_added"; payload: { identityId: IdentityId; productId: ProductId; size: string } })
  | (EventEnvelope & { type: "cart.item_removed"; payload: { identityId: IdentityId; productId: ProductId; size: string } })
  | (EventEnvelope & { type: "cart.qty_set"; payload: { identityId: IdentityId; productId: ProductId; size: string; qty: number } })
  | (EventEnvelope & { type: "cart.cleared"; payload: { identityId: IdentityId } })

  // Orders
  | (EventEnvelope & { type: "order.placed"; payload: { identityId: IdentityId; orderId: OrderId; items: OrderItem[]; total: number; customerLabel: string; placedAt: string } })

  // DNA
  | (EventEnvelope & { type: "dna.signal_recorded"; payload: { identityId: IdentityId; signal: DNASignal } })
  | (EventEnvelope & { type: "dna.updated"; payload: { identityId: IdentityId; genome: StyleGenome; version: number } })
  | (EventEnvelope & { type: "mutation.proposed"; payload: { identityId: IdentityId; mutation: Mutation } })
  | (EventEnvelope & { type: "mutation.ratified"; payload: { identityId: IdentityId; mutationId: MutationId } })
  | (EventEnvelope & { type: "mutation.rejected"; payload: { identityId: IdentityId; mutationId: MutationId } })

  // Recommendation
  | (EventEnvelope & { type: "recommendation.reranked"; payload: { identityId: IdentityId; recommendationIds: RecommendationId[] } })

  // AI governance
  | (EventEnvelope & { type: "ai.prompt_updated"; payload: { agentId: AgentId; promptVersionId: PromptVersionId } })
  | (EventEnvelope & { type: "ai.agent_configured"; payload: { agentId: AgentId; patch: Record<string, unknown> } })
  | (EventEnvelope & { type: "ai.tool_enabled"; payload: { agentId: AgentId; toolId: ToolId } })
  | (EventEnvelope & { type: "ai.tool_disabled"; payload: { agentId: AgentId; toolId: ToolId } })

  // Plugins
  | (EventEnvelope & { type: "plugin.registered"; payload: { pluginId: PluginId; slug: string; name: string } })
  | (EventEnvelope & { type: "plugin.enabled"; payload: { pluginId: PluginId; configSummary?: string } })
  | (EventEnvelope & { type: "plugin.disabled"; payload: { pluginId: PluginId } })

  // Policy + audit
  | (EventEnvelope & { type: "policy.updated"; payload: { policyId: PolicyId; version: number } })
  | (EventEnvelope & { type: "audit.written"; payload: { auditId: AuditId } });

export type DomainEventType = DomainEvent["type"];
export type EventByType<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
