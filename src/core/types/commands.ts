import type {
  AgentId, DesignerId, IdentityId, MutationId, PluginId, ProductId, PromptVersionId, ToolId,
} from "./ids";

export interface RecordProductViewPayload { identityId: IdentityId; productId: ProductId; dwellMs?: number }
export interface SaveProductPayload { identityId: IdentityId; productId: ProductId }
export interface FollowDesignerPayload { identityId: IdentityId; designerId: DesignerId }
export interface AddToCartPayload { identityId: IdentityId; productId: ProductId; size: string }
export interface RemoveFromCartPayload { identityId: IdentityId; productId: ProductId; size: string }
export interface SetCartQtyPayload { identityId: IdentityId; productId: ProductId; size: string; qty: number }
export interface ClearCartPayload { identityId: IdentityId }
export interface ProposeMutationPayload {
  identityId: IdentityId;
  to: Partial<Record<import("./entities").GenomeAxis, number>>;
  rationale: string;
  sourceEventIds?: import("./ids").EventId[];
}
export interface RatifyMutationPayload { identityId: IdentityId; mutationId: MutationId }
export interface RejectMutationPayload { identityId: IdentityId; mutationId: MutationId }
export interface UpdateAgentPromptPayload { agentId: AgentId; promptVersionId: PromptVersionId; body?: string; note?: string }
export interface EnablePluginPayload { pluginId: PluginId; configSummary?: string }
export interface DisablePluginPayload { pluginId: PluginId }
export interface EnableToolPayload { agentId: AgentId; toolId: ToolId }
export interface DisableToolPayload { agentId: AgentId; toolId: ToolId }
