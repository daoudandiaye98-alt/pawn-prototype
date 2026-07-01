import type {
  AgentId, AuditId, BrandId, CollectionId, DesignerId, EventId, IdentityId,
  KnowledgeSourceId, MutationId, OrderId, PluginId, PolicyId, ProductId,
  PromptVersionId, RecommendationId, ToolId,
} from "./ids";
import type { Provenance } from "./provenance";

export type ProductCategory = "Outerwear" | "Tops" | "Bottoms" | "Bags" | "Accessories";
export type ProductGender = "Women" | "Men" | "Unisex";
export type ProductStatus = "Active" | "Inactive";

export type GenomeAxis = "structure" | "edge" | "elegance" | "darkness" | "sensuality" | "utility";
export type StyleGenome = Record<GenomeAxis, number>;

export interface ConsentFlags {
  personalization: boolean;
  memory: boolean;
  analytics: boolean;
}

export interface Profile {
  displayName: string;
  locale: string;
  consent: ConsentFlags;
}

export type MemoryKey =
  | "saved_products" | "viewed_products" | "followed_designers"
  | "orders" | "dna_signals" | "chat_history";

export interface MemoryScope {
  allow: MemoryKey[];
  deny: MemoryKey[];
}

export interface DNASignal {
  id: string;
  kind: "view" | "save" | "follow" | "purchase" | "dwell" | "prompt";
  ref: string;
  weight: number;
  at: string;
  eventId: EventId;
}

export interface Mutation {
  id: MutationId;
  from: Partial<StyleGenome>;
  to: Partial<StyleGenome>;
  rationale: string;
  status: "proposed" | "ratified" | "rejected";
  proposedAt: string;
  resolvedAt?: string;
  sourceEventIds: EventId[];
}

export interface DNA {
  genome: StyleGenome;
  signals: DNASignal[];
  mutations: Mutation[];
  version: number;
  updatedAt: string;
}

export interface Wardrobe {
  saved: ProductId[];
  owned: ProductId[];
  considered: ProductId[];
}

export interface Relationships {
  follows: DesignerId[];
  muted: DesignerId[];
}

export interface Identity {
  id: IdentityId;
  profile: Profile;
  dna: DNA;
  wardrobe: Wardrobe;
  relationships: Relationships;
  memory: MemoryScope;
  createdAt: string;
}

export interface Designer {
  id: DesignerId;
  slug: string;
  name: string;
  location: string;
  slogan: string;
  bio: string;
  brandIds: BrandId[];
  memberSince: string;
  followers: number;
  collections: number;
  productsCount: number;
  featuredIn: number;
}

export interface Brand {
  id: BrandId;
  designerId: DesignerId;
  name: string;
}

export interface Product {
  id: ProductId;
  slug: string;
  name: string;
  designerId: DesignerId;
  brandId?: BrandId;
  price: number;
  category: ProductCategory;
  gender: ProductGender;
  colors: string[];
  sizes: string[];
  status: ProductStatus;
  description: string;
  genomeAffinity: Partial<StyleGenome>;
}

export interface Collection {
  id: CollectionId;
  designerId: DesignerId;
  title: string;
  productIds: ProductId[];
}

export interface OrderItem {
  productId: ProductId;
  size: string;
  qty: number;
  unitPrice: number;
}

export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Returned";

export interface Order {
  id: OrderId;
  identityId: IdentityId;
  customerLabel: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  placedAt: string;
}

export interface Recommendation {
  id: RecommendationId;
  identityId: IdentityId;
  productId: ProductId;
  score: number;
  provenance: Provenance;
}

export type AgentAudience = "customer" | "designer" | "admin" | "internal";

export interface Agent {
  id: AgentId;
  name: string;
  audience: AgentAudience;
  activePromptId: PromptVersionId;
  toolIds: ToolId[];
  memoryPolicyId: PolicyId;
}

export interface PromptVersion {
  id: PromptVersionId;
  agentId: AgentId;
  body: string;
  author: string;
  createdAt: string;
  note: string;
  isActive: boolean;
}

export interface KnowledgeSource {
  id: KnowledgeSourceId;
  kind: "url" | "doc" | "collection";
  ref: string;
  label: string;
  enabled: boolean;
}

export type PluginStatus = "available" | "connected" | "disabled";

export interface PluginConnection {
  id: PluginId;
  slug: string;
  name: string;
  status: PluginStatus;
  configSummary?: string;
}

export interface Policy {
  id: PolicyId;
  scope: "content" | "safety" | "memory" | "response" | "access";
  body: Record<string, unknown>;
  version: number;
}

export interface AuditEvent {
  id: AuditId;
  actor: IdentityId | "system";
  action: string;
  entity: string;
  entityId: string;
  diff?: unknown;
  at: string;
}

export interface CartLine {
  productId: ProductId;
  size: string;
  qty: number;
}

export interface Cart {
  identityId: IdentityId;
  lines: CartLine[];
}
