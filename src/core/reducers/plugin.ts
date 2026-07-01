import type { DomainEvent } from "../types/events";
import type { PluginConnection } from "../types/entities";

export interface PluginSlice { byId: Record<string, PluginConnection> }
export const initialPluginSlice: PluginSlice = { byId: {} };

export function pluginReducer(slice: PluginSlice, event: DomainEvent): PluginSlice {
  switch (event.type) {
    case "plugin.registered": {
      const { pluginId, slug, name } = event.payload;
      if (slice.byId[pluginId]) return slice;
      return { byId: { ...slice.byId, [pluginId]: { id: pluginId, slug, name, status: "available" } } };
    }
    case "plugin.enabled": {
      const cur = slice.byId[event.payload.pluginId];
      if (!cur) return slice;
      return { byId: { ...slice.byId, [cur.id]: { ...cur, status: "connected", configSummary: event.payload.configSummary } } };
    }
    case "plugin.disabled": {
      const cur = slice.byId[event.payload.pluginId];
      if (!cur) return slice;
      return { byId: { ...slice.byId, [cur.id]: { ...cur, status: "disabled" } } };
    }
    default:
      return slice;
  }
}
