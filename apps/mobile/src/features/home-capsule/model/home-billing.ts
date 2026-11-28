import { analyticsTokens, type HostAnalytics } from "@starbot/contracts/ipc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useQueryScope } from "@/features/auth/context/mobile-session-context";
import { usePlanLimits } from "@/features/servers/model/plan-limits";
import { type MobileAgent, useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { queryKeys } from "@/features/workspace/model/query-keys";

export type BillingRangeId = "7d" | "month" | "all";

export interface BillingAgentItem {
  agentId: string;
  agent: MobileAgent | null;
  name: string;
  model: string;
  costUsd: number;
  tokens: number;
  turns: number;
  share: number;
}

export interface BillingSummary {
  totalCostUsd: number;
  totalTokens: number;
  totalTurns: number;
  agents: BillingAgentItem[];
  isMock: boolean;
  hasQuotaAlert: boolean;
  messageCounts7d: ReadonlyMap<string, number>;
  isLoading: boolean;
}

function formatIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function billingDateRange(rangeId: BillingRangeId): { startDate: string; endDate: string; timeZone: string } {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const endDate = formatIsoDay(now);
  if (rangeId === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: formatIsoDay(start), endDate, timeZone };
  }
  if (rangeId === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatIsoDay(start), endDate, timeZone };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - 364);
  return { startDate: formatIsoDay(start), endDate, timeZone };
}

// TODO: Remove mock billing fallback once all local providers report exact USD pricing via loadHostAnalytics.
function buildMockSummary(
  agents: readonly MobileAgent[],
  rangeId: BillingRangeId,
  hasQuotaAlert: boolean,
): BillingSummary {
  const factor = rangeId === "7d" ? 0.42 : rangeId === "month" ? 1 : 2.85;
  const weights = [0.54, 0.31, 0.15, 0.08, 0.05];
  const baseCost = 5.32 * factor;
  const baseTokens = Math.round(482_000 * factor);
  const baseTurns = Math.round(68 * factor);
  const targetAgents = agents.slice(0, 6);
  const sumWeight = targetAgents.reduce((sum, _, idx) => sum + (weights[idx] ?? 0.04), 0) || 1;
  const rows: BillingAgentItem[] = targetAgents
    .map((agent, idx) => {
      const share = (weights[idx] ?? 0.04) / sumWeight;
      return {
        agentId: agent.id,
        agent,
        name: agent.name,
        model: agent.model || agent.provider || "",
        costUsd: Number((baseCost * share).toFixed(2)),
        tokens: Math.round(baseTokens * share),
        turns: Math.max(1, Math.round(baseTurns * share)),
        share,
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);

  const totalCostUsd = rows.reduce((sum, item) => sum + item.costUsd, 0);
  const totalTokens = rows.reduce((sum, item) => sum + item.tokens, 0);
  const totalTurns = rows.reduce((sum, item) => sum + item.turns, 0);
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.agentId, row.turns);
  return {
    totalCostUsd,
    totalTokens,
    totalTurns,
    agents: rows,
    isMock: true,
    hasQuotaAlert,
    messageCounts7d: counts,
    isLoading: false,
  };
}

function summarizeAnalytics(
  data: HostAnalytics,
  agents: readonly MobileAgent[],
  hasQuotaAlert: boolean,
): BillingSummary | null {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const totalTokens = analyticsTokens(data.totals);
  const totalCostUsd = data.totals.estimatedCostUsd ?? 0;
  const totalTurns = Math.max(data.totals.userMessages, data.totals.assistantMessages);
  if (totalTokens === 0 && totalCostUsd === 0 && totalTurns === 0 && data.agents.length === 0) {
    return null;
  }

  const rawRows = data.agents.map((row) => {
    const agent = byId.get(row.agentId) ?? null;
    const tokens = analyticsTokens(row);
    const costUsd = row.estimatedCostUsd ?? 0;
    const turns = Math.max(row.userMessages, row.assistantMessages, row.sessions);
    return {
      agentId: row.agentId,
      agent,
      name: agent?.name ?? row.agentId,
      model: agent?.model ?? agent?.provider ?? "",
      costUsd,
      tokens,
      turns,
    };
  });

  const sumCost = rawRows.reduce((acc, item) => acc + item.costUsd, 0);
  const sumTokens = rawRows.reduce((acc, item) => acc + item.tokens, 0);
  const rows: BillingAgentItem[] = rawRows
    .map((item) => ({
      ...item,
      share: sumCost > 0 ? item.costUsd / sumCost : sumTokens > 0 ? item.tokens / sumTokens : 0,
    }))
    .sort((a, b) => (b.costUsd !== a.costUsd ? b.costUsd - a.costUsd : b.tokens - a.tokens));

  const counts = new Map<string, number>();
  for (const row of data.agents) {
    counts.set(row.agentId, row.userMessages + row.assistantMessages);
  }
  return {
    totalCostUsd,
    totalTokens,
    totalTurns,
    agents: rows,
    isMock: false,
    hasQuotaAlert,
    messageCounts7d: counts,
    isLoading: false,
  };
}

export function useHomeBilling(serverId: string, rangeId: BillingRangeId = "month"): BillingSummary {
  const queryScope = useQueryScope();
  const { servers, agents, loadHostAnalytics } = useMobileWorkspace();
  const server = servers.find((item) => item.id === serverId);
  const online = server?.state === "online";
  const serverAgents = useMemo(() => agents.filter((agent) => agent.serverId === serverId), [agents, serverId]);
  const range = useMemo(() => billingDateRange(rangeId), [rangeId]);
  const planLimits = usePlanLimits(serverId);

  const hasQuotaAlert = useMemo(() => {
    for (const row of planLimits.rows) {
      for (const window of row.windows) {
        if (window.remainingPercent <= 20) return true;
      }
    }
    return false;
  }, [planLimits.rows]);

  const usageQuery = useQuery({
    queryKey: queryKeys.serverUsage(queryScope, serverId, range),
    queryFn: () => loadHostAnalytics(range, serverId),
    enabled: Boolean(serverId && online),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const parsed = usageQuery.data ? summarizeAnalytics(usageQuery.data, serverAgents, hasQuotaAlert) : null;
    if (parsed) return parsed;
    const mock = buildMockSummary(serverAgents, rangeId, hasQuotaAlert);
    return { ...mock, isLoading: usageQuery.isPending && online };
  }, [usageQuery.data, usageQuery.isPending, serverAgents, hasQuotaAlert, rangeId, online]);
}

export function formatCompactUsd(amount: number): string {
  if (amount >= 100) return `$${amount.toFixed(0)}`;
  if (amount >= 10) return `$${amount.toFixed(1)}`;
  return `$${amount.toFixed(2)}`;
}

export function formatCompactTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
