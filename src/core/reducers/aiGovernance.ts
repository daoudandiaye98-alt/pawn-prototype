import type { DomainEvent } from "../types/events";
import type { Agent, KnowledgeSource, Policy, PromptVersion } from "../types/entities";

export interface AiGovernanceSlice {
  agents: Record<string, Agent>;
  prompts: Record<string, PromptVersion>;
  knowledgeSources: Record<string, KnowledgeSource>;
  policies: Record<string, Policy>;
}

export const initialAiSlice: AiGovernanceSlice = {
  agents: {}, prompts: {}, knowledgeSources: {}, policies: {},
};

export function aiGovernanceReducer(slice: AiGovernanceSlice, event: DomainEvent): AiGovernanceSlice {
  switch (event.type) {
    case "ai.prompt_updated": {
      const agent = slice.agents[event.payload.agentId];
      if (!agent) return slice;
      const prompts = { ...slice.prompts };
      Object.keys(prompts).forEach((k) => {
        if (prompts[k].agentId === agent.id) prompts[k] = { ...prompts[k], isActive: false };
      });
      const target = prompts[event.payload.promptVersionId];
      if (target) prompts[event.payload.promptVersionId] = { ...target, isActive: true };
      return {
        ...slice,
        prompts,
        agents: { ...slice.agents, [agent.id]: { ...agent, activePromptId: event.payload.promptVersionId } },
      };
    }
    case "ai.agent_configured": {
      const agent = slice.agents[event.payload.agentId];
      if (!agent) return slice;
      return { ...slice, agents: { ...slice.agents, [agent.id]: { ...agent, ...event.payload.patch } as Agent } };
    }
    case "ai.tool_enabled": {
      const agent = slice.agents[event.payload.agentId];
      if (!agent || agent.toolIds.includes(event.payload.toolId)) return slice;
      return { ...slice, agents: { ...slice.agents, [agent.id]: { ...agent, toolIds: [...agent.toolIds, event.payload.toolId] } } };
    }
    case "ai.tool_disabled": {
      const agent = slice.agents[event.payload.agentId];
      if (!agent) return slice;
      return { ...slice, agents: { ...slice.agents, [agent.id]: { ...agent, toolIds: agent.toolIds.filter((t) => t !== event.payload.toolId) } } };
    }
    case "policy.updated": {
      const p = slice.policies[event.payload.policyId];
      if (!p) return slice;
      return { ...slice, policies: { ...slice.policies, [p.id]: { ...p, version: event.payload.version } } };
    }
    default:
      return slice;
  }
}

// Seeder-only helpers used by seed/index.ts to register initial agents/prompts/etc.
export function registerAgent(slice: AiGovernanceSlice, agent: Agent): AiGovernanceSlice {
  return { ...slice, agents: { ...slice.agents, [agent.id]: agent } };
}
export function registerPrompt(slice: AiGovernanceSlice, prompt: PromptVersion): AiGovernanceSlice {
  return { ...slice, prompts: { ...slice.prompts, [prompt.id]: prompt } };
}
export function registerKnowledge(slice: AiGovernanceSlice, k: KnowledgeSource): AiGovernanceSlice {
  return { ...slice, knowledgeSources: { ...slice.knowledgeSources, [k.id]: k } };
}
export function registerPolicy(slice: AiGovernanceSlice, p: Policy): AiGovernanceSlice {
  return { ...slice, policies: { ...slice.policies, [p.id]: p } };
}
