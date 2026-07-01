import type { DomainState } from "../reducers/root";
import type { Agent, KnowledgeSource, PluginConnection, Policy, PromptVersion } from "../types/entities";

export interface AiControlState {
  agents: Agent[];
  activePrompts: Record<string, PromptVersion | undefined>;
  knowledgeSources: KnowledgeSource[];
  policies: Policy[];
  plugins: PluginConnection[];
}

export function getAiControlState(state: DomainState): AiControlState {
  const agents = Object.values(state.ai.agents);
  const activePrompts: Record<string, PromptVersion | undefined> = {};
  agents.forEach((a) => { activePrompts[a.id] = state.ai.prompts[a.activePromptId]; });
  return {
    agents,
    activePrompts,
    knowledgeSources: Object.values(state.ai.knowledgeSources),
    policies: Object.values(state.ai.policies),
    plugins: Object.values(state.plugins.byId),
  };
}
