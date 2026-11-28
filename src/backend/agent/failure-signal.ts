import type { AgentProviderId } from "@starbot/contracts/agent-providers";
import type { CauseCode } from "@starbot/telemetry";

export interface FailureContext {
  causeCode?: CauseCode;
  provider?: AgentProviderId;
  model?: string | null;
  turnId?: string | null;
  severity?: "error" | "warning";
}
export interface FailureSignal extends FailureContext {
  code: string;
  causeCode: CauseCode;
  agentId?: string;
}
