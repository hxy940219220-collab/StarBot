import type { AgentProviderState, AgentStatus } from "@starbot/contracts/ipc";

export function fallbackProviderState(status: AgentStatus): AgentProviderState {
  return status.phase === "starting" || status.phase === "restarting" ? "checking" : "error";
}
