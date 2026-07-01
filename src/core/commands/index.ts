import type { DomainState } from "../reducers/root";
import type { RawEvent } from "../events/emit";
import type * as C from "../types/commands";
import { asMutationId, asOrderId } from "../types/ids";
import { canPropose, findMutation, applyRatified } from "../policies/dnaEvolution";

export type CommandResult =
  | { ok: true; events: RawEvent[] }
  | { ok: false; reason: string };

// Identity / marketplace commands
export const recordProductView = (_state: DomainState, p: C.RecordProductViewPayload): CommandResult => ({
  ok: true,
  events: [{ type: "product.viewed", actor: p.identityId, payload: p }],
});

export const saveProduct = (_state: DomainState, p: C.SaveProductPayload): CommandResult => ({
  ok: true,
  events: [{ type: "product.saved", actor: p.identityId, payload: p }],
});

export const followDesigner = (_state: DomainState, p: C.FollowDesignerPayload): CommandResult => ({
  ok: true,
  events: [{ type: "designer.followed", actor: p.identityId, payload: p }],
});

// Cart
export const addToCart = (_state: DomainState, p: C.AddToCartPayload): CommandResult => ({
  ok: true,
  events: [{ type: "cart.item_added", actor: p.identityId, payload: p }],
});
export const removeFromCart = (_state: DomainState, p: C.RemoveFromCartPayload): CommandResult => ({
  ok: true,
  events: [{ type: "cart.item_removed", actor: p.identityId, payload: p }],
});
export const setCartQty = (_state: DomainState, p: C.SetCartQtyPayload): CommandResult => ({
  ok: true,
  events: [{ type: "cart.qty_set", actor: p.identityId, payload: p }],
});
export const clearCart = (_state: DomainState, p: C.ClearCartPayload): CommandResult => ({
  ok: true,
  events: [{ type: "cart.cleared", actor: p.identityId, payload: p }],
});

let orderSeq = 0;
export const placeOrder = (_state: DomainState, p: C.PlaceOrderPayload): CommandResult => {
  if (p.items.length === 0) return { ok: false, reason: "Cart is empty" };
  orderSeq += 1;
  const orderId = asOrderId(`ord_${Date.now().toString(36)}_${orderSeq}`);
  const placedAt = new Date().toISOString();
  return {
    ok: true,
    events: [
      {
        type: "order.placed",
        actor: p.identityId,
        payload: {
          identityId: p.identityId,
          orderId,
          items: p.items,
          total: p.total,
          customerLabel: p.customerLabel,
          placedAt,
        },
      },
      { type: "cart.cleared", actor: p.identityId, payload: { identityId: p.identityId } },
    ],
  };
};

// Mutations
let mutationSeq = 0;
export const proposeMutation = (state: DomainState, p: C.ProposeMutationPayload): CommandResult => {
  const identity = state.identity.byId[p.identityId];
  if (!identity) return { ok: false, reason: "Unknown identity" };
  const guard = canPropose(identity, p.to);
  if (guard.ok === false) return { ok: false, reason: guard.reason };
  mutationSeq += 1;
  const mutation = {
    id: asMutationId(`mut_${Date.now().toString(36)}_${mutationSeq}`),
    from: {},
    to: p.to,
    rationale: p.rationale,
    status: "proposed" as const,
    proposedAt: new Date().toISOString(),
    sourceEventIds: p.sourceEventIds ?? [],
  };
  return {
    ok: true,
    events: [{ type: "mutation.proposed", actor: p.identityId, payload: { identityId: p.identityId, mutation } }],
  };
};

export const ratifyMutation = (state: DomainState, p: C.RatifyMutationPayload): CommandResult => {
  const identity = state.identity.byId[p.identityId];
  if (!identity) return { ok: false, reason: "Unknown identity" };
  const mutation = findMutation(identity, p.mutationId);
  if (!mutation) return { ok: false, reason: "Unknown mutation" };
  if (mutation.status !== "proposed") return { ok: false, reason: "Mutation already resolved" };
  const nextGenome = applyRatified(identity.dna.genome, mutation);
  return {
    ok: true,
    events: [
      { type: "mutation.ratified", actor: p.identityId, payload: { identityId: p.identityId, mutationId: p.mutationId } },
      { type: "dna.updated", actor: p.identityId, payload: { identityId: p.identityId, genome: nextGenome, version: identity.dna.version + 1 } },
    ],
  };
};

export const rejectMutation = (state: DomainState, p: C.RejectMutationPayload): CommandResult => {
  const identity = state.identity.byId[p.identityId];
  if (!identity) return { ok: false, reason: "Unknown identity" };
  const mutation = findMutation(identity, p.mutationId);
  if (!mutation) return { ok: false, reason: "Unknown mutation" };
  return {
    ok: true,
    events: [{ type: "mutation.rejected", actor: p.identityId, payload: { identityId: p.identityId, mutationId: p.mutationId } }],
  };
};

// AI governance
export const updateAgentPrompt = (_state: DomainState, p: C.UpdateAgentPromptPayload): CommandResult => ({
  ok: true,
  events: [{ type: "ai.prompt_updated", actor: "system", payload: { agentId: p.agentId, promptVersionId: p.promptVersionId } }],
});

export const enablePlugin = (_state: DomainState, p: C.EnablePluginPayload): CommandResult => ({
  ok: true,
  events: [{ type: "plugin.enabled", actor: "system", payload: p }],
});

export const disablePlugin = (_state: DomainState, p: C.DisablePluginPayload): CommandResult => ({
  ok: true,
  events: [{ type: "plugin.disabled", actor: "system", payload: p }],
});

export const enableTool = (_state: DomainState, p: C.EnableToolPayload): CommandResult => ({
  ok: true,
  events: [{ type: "ai.tool_enabled", actor: "system", payload: p }],
});

export const disableTool = (_state: DomainState, p: C.DisableToolPayload): CommandResult => ({
  ok: true,
  events: [{ type: "ai.tool_disabled", actor: "system", payload: p }],
});
