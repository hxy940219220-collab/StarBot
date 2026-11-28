import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface AgentTemplatesPort {
  agent: Pick<
    StarBotDesktopApi["agent"],
    "addTemplateAgent" | "previewAgentTemplate" | "publishAgentTemplate" | "unpublishAgentTemplate"
  >;
  agentTemplates: Pick<StarBotDesktopApi["agentTemplates"], "get" | "install" | "preview" | "publish" | "unpublish">;
}

export type AgentTemplatePublishCalls = Pick<AgentTemplatesPort["agentTemplates"], "preview" | "publish" | "unpublish">;

export interface AgentTemplateInstallCalls {
  agent: Pick<AgentTemplatesPort["agent"], "addTemplateAgent">;
  agentTemplates: Pick<AgentTemplatesPort["agentTemplates"], "get" | "install">;
}

export function agentTemplatesPort(): AgentTemplatesPort {
  return window.starbot;
}
