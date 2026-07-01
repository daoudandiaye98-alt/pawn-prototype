import type { DomainEvent } from "../types/events";
import { identityReducer, initialIdentitySlice, type IdentitySlice } from "./identity";
import { marketplaceReducer, initialMarketplaceSlice, type MarketplaceSlice } from "./marketplace";
import { aiGovernanceReducer, initialAiSlice, type AiGovernanceSlice } from "./aiGovernance";
import { pluginReducer, initialPluginSlice, type PluginSlice } from "./plugin";
import { auditReducer, initialAuditSlice, type AuditSlice } from "./audit";

export interface DomainState {
  identity: IdentitySlice;
  marketplace: MarketplaceSlice;
  ai: AiGovernanceSlice;
  plugins: PluginSlice;
  audit: AuditSlice;
}

export const initialDomainState: DomainState = {
  identity: initialIdentitySlice,
  marketplace: initialMarketplaceSlice,
  ai: initialAiSlice,
  plugins: initialPluginSlice,
  audit: initialAuditSlice,
};

export function rootReducer(state: DomainState, event: DomainEvent): DomainState {
  return {
    identity: identityReducer(state.identity, event),
    marketplace: marketplaceReducer(state.marketplace, event),
    ai: aiGovernanceReducer(state.ai, event),
    plugins: pluginReducer(state.plugins, event),
    audit: auditReducer(state.audit, event),
  };
}

export function replay(events: readonly DomainEvent[], initial: DomainState = initialDomainState): DomainState {
  let s = initial;
  for (const e of events) s = rootReducer(s, e);
  return s;
}
