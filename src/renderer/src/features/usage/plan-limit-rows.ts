import {
  type AgentProviderId,
  agentProviderDescriptor,
  agentProviderName,
  DEFAULT_PROVIDER_ACCOUNT_ID,
  isAgentProvider,
  STARBOT_CORE_PROVIDERS,
} from "@starbot/contracts/ipc";
import { spentUsageWindow, usageTone } from "@starbot/team-client/plan-limits";
import {
  type AccountUsageProviderRow,
  accountUsageProviderRows,
  formatUsageReset,
} from "@starbot/ui/features/account/account-usage-view";
import { useText } from "@starbot/ui/text";
import { createMemo } from "solid-js";
import { useTurns } from "../../turns";
import { useAuth } from "../account/account-context";
import { useAgents } from "../agents/agents-context";
import { withHostAccountUsage } from "../agents/host-provider-accounts";
import { activelyConnectedProviders } from "../agents/starbot-connected-providers";

export function usePlanLimitRows() {
  const text = useText();
  const auth = useAuth();
  const { agentStatus, hostAccountLimits, agentList, modelOptions } = useAgents();
  const { usageLimits, usageLimitedModels } = useTurns();
  return createMemo(() => {
    const core = new Set<string>(STARBOT_CORE_PROVIDERS);
    // Only show a provider in the bottom-left rail if the user actively connected it
    // OR currently has a StarBot assistant using that provider!
    const userChosen = new Set<AgentProviderId>();
    for (const id of activelyConnectedProviders()) {
      if (core.has(id)) userChosen.add(id);
    }
    for (const agent of agentList()) {
      if (isAgentProvider(agent.provider) && core.has(agent.provider)) {
        userChosen.add(agent.provider);
      }
    }

    const providers = agentStatus().providers ?? [];
    const usage = withHostAccountUsage(auth.accountUsage(), hostAccountLimits());
    const baseRows = accountUsageProviderRows(usage, providers, text).filter((row) => userChosen.has(row.provider));

    // For any provider the user HAS connected/used, if its connection drops or fails,
    // keep its icon in the rail with a dashed ring (readFailed: true, windows: [])!
    const byProvider = new Map<AgentProviderId, AccountUsageProviderRow[]>();
    for (const row of baseRows) {
      const list = byProvider.get(row.provider) ?? [];
      list.push(row);
      byProvider.set(row.provider, list);
    }

    const mergedRows: AccountUsageProviderRow[] = [];
    const sortedChosen = [...userChosen].sort(
      (a, b) => agentProviderDescriptor(a).pickerOrder - agentProviderDescriptor(b).pickerOrder,
    );

    for (const providerId of sortedChosen) {
      const status = providers.find((p) => p.id === providerId);
      const isOnline = status?.state === "available";
      const existing = byProvider.get(providerId);

      if (!isOnline) {
        // Disconnected / failed after having been used -> dashed ring!
        mergedRows.push({
          provider: providerId,
          accountId: null,
          name: agentProviderName(providerId),
          remainingPercent: null,
          tone: "neutral",
          windows: [],
          ringWindows: [],
          reportsUsage: true,
          sharedQuotaWith: null,
          readFailed: true,
        });
      } else if (existing && existing.length > 0) {
        mergedRows.push(...existing);
      }
    }

    const now = Date.now();
    const held = usageLimitedModels().filter((limit) => {
      const account = limit.providerAccountId ?? DEFAULT_PROVIDER_ACCOUNT_ID;
      const spent = spentUsageWindow(usage?.limits, limit.provider, account, limit.model, now);
      const ownWindow = usage?.limits.some(
        (reading) => reading.primary === spent?.window || reading.secondary === spent?.window,
      );
      return !(spent?.covers && !spent.onCredits && ownWindow);
    });
    if (held.length === 0) return mergedRows;
    const limits = usageLimits();
    return mergedRows.map((row) => {
      const account = row.accountId ?? DEFAULT_PROVIDER_ACCOUNT_ID;
      const windows = held
        .filter(
          (limit) =>
            limit.provider === row.provider && (limit.providerAccountId ?? DEFAULT_PROVIDER_ACCOUNT_ID) === account,
        )
        .map((limit) => {
          const agent = agentList().find(
            (candidate) =>
              candidate.id in limits &&
              candidate.provider === limit.provider &&
              candidate.model === limit.model &&
              (candidate.providerAccountId ?? DEFAULT_PROVIDER_ACCOUNT_ID) === account,
          );
          const resetsAt = agent ? (limits[agent.id] ?? null) : null;
          return {
            label:
              modelOptions().find((option) => option.provider === limit.provider && option.id === limit.model)?.name ??
              limit.model,
            remainingPercent: 0,
            tone: usageTone(0),
            durationMins: null,
            resetsAt,
            resetsAtLabel: formatUsageReset(resetsAt, text),
          };
        });
      return windows.length
        ? {
            ...row,
            windows: [...row.windows, ...windows],
            ringWindows: windows,
            remainingPercent: 0,
            tone: usageTone(0),
          }
        : row;
    });
  });
}
