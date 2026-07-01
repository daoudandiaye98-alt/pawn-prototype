// Branded IDs — prevent cross-entity ID confusion at compile time.
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type IdentityId = Brand<string, "IdentityId">;
export type ProductId = Brand<string, "ProductId">;
export type DesignerId = Brand<string, "DesignerId">;
export type BrandId = Brand<string, "BrandId">;
export type CollectionId = Brand<string, "CollectionId">;
export type OrderId = Brand<string, "OrderId">;
export type RecommendationId = Brand<string, "RecommendationId">;
export type MutationId = Brand<string, "MutationId">;
export type AgentId = Brand<string, "AgentId">;
export type PromptVersionId = Brand<string, "PromptVersionId">;
export type KnowledgeSourceId = Brand<string, "KnowledgeSourceId">;
export type PluginId = Brand<string, "PluginId">;
export type ToolId = Brand<string, "ToolId">;
export type PolicyId = Brand<string, "PolicyId">;
export type EventId = Brand<string, "EventId">;
export type AuditId = Brand<string, "AuditId">;

export const asIdentityId = (s: string) => s as IdentityId;
export const asProductId = (s: string) => s as ProductId;
export const asDesignerId = (s: string) => s as DesignerId;
export const asBrandId = (s: string) => s as BrandId;
export const asCollectionId = (s: string) => s as CollectionId;
export const asOrderId = (s: string) => s as OrderId;
export const asRecommendationId = (s: string) => s as RecommendationId;
export const asMutationId = (s: string) => s as MutationId;
export const asAgentId = (s: string) => s as AgentId;
export const asPromptVersionId = (s: string) => s as PromptVersionId;
export const asKnowledgeSourceId = (s: string) => s as KnowledgeSourceId;
export const asPluginId = (s: string) => s as PluginId;
export const asToolId = (s: string) => s as ToolId;
export const asPolicyId = (s: string) => s as PolicyId;
export const asEventId = (s: string) => s as EventId;
export const asAuditId = (s: string) => s as AuditId;
