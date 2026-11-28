import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface AgentDockPort {
  agentDock: StarBotDesktopApi["agentDock"];
  agent: Pick<StarBotDesktopApi["agent"], "respondToBrowserSecret">;
}

export function agentDockPort(): AgentDockPort {
  return window.starbot;
}
