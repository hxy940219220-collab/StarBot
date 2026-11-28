import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface UsagePort {
  agent: Pick<StarBotDesktopApi["agent"], "getHostAnalytics" | "listAgents" | "onScopedEvent">;
  servers: Pick<StarBotDesktopApi["servers"], "onEvent">;
}

export function usagePort(): UsagePort {
  return window.starbot;
}
