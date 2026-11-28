import type { ArticleBody } from "../body";
import { AgenticAIDefinition } from "./agentic-ai-definition";
import { AIAgentProductivity } from "./ai-agent-productivity";
import { AIAgentWorkflow } from "./ai-agent-workflow";
import { AIAgentWorkflows } from "./ai-agent-workflows";
import { AIAgentsExamples } from "./ai-agents-examples";
import { AIAgentsVsAgenticAI } from "./ai-agents-vs-agentic-ai";
import { AITeammatesVsAIChatbots } from "./ai-teammates-vs-ai-chatbots";
import { AIWorkspaceVsChat } from "./ai-workspace-vs-chat";
import { ImportGrokBotAgents } from "./import-grok-bot-agents";
import { ImportHermesAgents } from "./import-hermes-agents";
import { InstallStarBotVPS } from "./install-starbot-vps";
import { StarBot101 } from "./starbot-101";
import { StarBotHostedServers } from "./starbot-hosted-servers";
import { StarBotMarketplace } from "./starbot-marketplace";
import { WhatAreAIAgents } from "./what-are-ai-agents";
import { WtfIsStarBot } from "./wtf-is-starbot";

export const GUIDE_BODIES: Readonly<Record<string, ArticleBody>> = {
  "ai-agent-workflows": AIAgentWorkflows,
  "ai-agent-productivity": AIAgentProductivity,
  "ai-agent-workflow": AIAgentWorkflow,
  "ai-teammates-vs-ai-chatbots": AITeammatesVsAIChatbots,
  "ai-workspace-vs-chat": AIWorkspaceVsChat,
  "install-starbot-vps": InstallStarBotVPS,
  "import-hermes-agents": ImportHermesAgents,
  "import-grok-bot-agents": ImportGrokBotAgents,
  "ai-agents-examples": AIAgentsExamples,
  "ai-agents-vs-agentic-ai": AIAgentsVsAgenticAI,
  "agentic-ai-definition": AgenticAIDefinition,
  "what-are-ai-agents": WhatAreAIAgents,
  "starbot-101": StarBot101,
  "starbot-hosted-servers": StarBotHostedServers,
  "starbot-marketplace": StarBotMarketplace,
  "wtf-is-starbot": WtfIsStarBot,
};
