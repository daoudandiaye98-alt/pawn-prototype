import type {
  AgentId, DesignerId, IdentityId, MutationId, PluginId, ProductId, PromptVersionId, ToolId,
} from "./ids";

export interface RecordProductViewPayload { identityId: IdentityId; productId: ProductId; dwellMs?: number }
export interface SaveProductPayload { identityId: IdentityId; productId: ProductId }
export interface FollowDesignerPayload { identityId: IdentityId; designerId: DesignerId }
/**
 * Ein Stück aus der Datenbank im Laden bekannt machen, bevor es in den Korb geht.
 *
 * **Warum das nötig ist.** Der Korb speichert Zeilen aus `productId` und Größe —
 * die Angaben zum Stück holt er sich aus dem Bestand des Ladens. Dieser Bestand
 * kam bisher ausschließlich aus `seed/products.ts`, und der ist mit Absicht leer
 * (Designgesetz: keine erfundenen Daten, keine fremden Markennamen). Ein echtes
 * Stück aus der Datenbank stand damit NIE im Bestand: die Korbzeile wurde
 * geschrieben, fand ihr Stück nicht und fiel beim Anzeigen heraus. Wer auf „In
 * den Korb" tippte, sah eine Bestätigung — und danach einen leeren Korb.
 *
 * Deshalb meldet das Stück sich jetzt an, bevor es in den Korb gelegt wird. Das
 * ist kein zweiter Bestand: es ist derselbe, nur endlich gefüllt.
 */
export interface RegisterStueckPayload {
  identityId: IdentityId;
  product: import("./entities").Product;
  /** Ohne Haus stünde im Korb ein Stück ohne Absender — und die Kasse gruppiert nach Haus. */
  designer?: import("./entities").Designer;
}
export interface AddToCartPayload { identityId: IdentityId; productId: ProductId; size: string }
export interface RemoveFromCartPayload { identityId: IdentityId; productId: ProductId; size: string }
export interface SetCartQtyPayload { identityId: IdentityId; productId: ProductId; size: string; qty: number }
export interface ClearCartPayload { identityId: IdentityId }
export interface PlaceOrderPayload {
  identityId: IdentityId;
  customerLabel: string;
  items: import("./entities").OrderItem[];
  total: number;
}
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
