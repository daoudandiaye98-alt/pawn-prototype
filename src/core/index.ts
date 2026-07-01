// Public surface — the only paths pages/components should import from.
export * from "./types/ids";
export * from "./types/entities";
export * from "./types/events";
export * from "./types/provenance";

export { CoreProvider } from "./react/CoreProvider";
export { useStore } from "./react/useStore";
export { useCommand } from "./react/useCommand";
export { useDomainEvents } from "./react/useDomainEvents";
export { publishMotion } from "./events/subscribe";

export * as selectors from "./selectors/identity";
export * as marketplaceSelectors from "./selectors/marketplace";
export * as adminSelectors from "./selectors/admin";
export * as portalSelectors from "./selectors/portal";
export * as aiSelectors from "./selectors/ai";
export { getProvenanceTrace } from "./selectors/provenance";

export * as commands from "./commands";
export { defaultIdentityId } from "./selectors/identity";
