import { agentProviderName, analyticsTokens, isAgentProvider } from "@starbot/contracts/ipc";
import type { MobileTextKey } from "@starbot/i18n/mobile";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Button, Spinner, Typography } from "heroui-native";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useCSSVariable, useUniwind } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import { mobileAnalytics } from "@/features/analytics/mobile-analytics";
import { useQueryScope } from "@/features/auth/context/mobile-session-context";
import { SettingsNote } from "@/features/settings/components/settings-content";
import { useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { queryKeys } from "@/features/workspace/model/query-keys";
import { LargeTitleScrollView } from "@/shared/components/large-title";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { useText } from "@/shared/lib/text";

const BRAND_PURPLE = "#7c3aed";
const TRACK_PURPLE = "rgba(124, 58, 237, 0.14)";
const BADGE_BG = "rgba(124, 58, 237, 0.11)";

type UsageRangePreset = "today" | "7d" | "30d" | "month";

const RANGE_OPTIONS: ReadonlyArray<{ id: UsageRangePreset; labelKey: MobileTextKey }> = [
  { id: "today", labelKey: "mobile.app.usage.rangeToday" },
  { id: "7d", labelKey: "mobile.app.usage.range7d" },
  { id: "30d", labelKey: "mobile.app.usage.range30d" },
  { id: "month", labelKey: "mobile.app.usage.rangeMonth" },
];

function formatIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDateRange(preset: UsageRangePreset): { startDate: string; endDate: string; timeZone: string } {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  const endDate = formatIsoDay(now);
  if (preset === "today") {
    return { startDate: endDate, endDate, timeZone };
  }
  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { startDate: formatIsoDay(start), endDate, timeZone };
  }
  if (preset === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { startDate: formatIsoDay(start), endDate, timeZone };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: formatIsoDay(start), endDate, timeZone };
}

function friendlyProviderLabel(rawProvider: string, modelName = ""): string {
  const low = rawProvider.toLowerCase();
  const lowModel = modelName.toLowerCase();
  if (low === "xai" || low.includes("grok") || lowModel.startsWith("grok")) return "Grok";
  if (low === "gemini" || low === "google" || lowModel.startsWith("gemini")) return "Gemini";
  if (low === "openai" || low === "codex" || lowModel.startsWith("gpt") || lowModel.includes("openai"))
    return "ChatGPT";
  if (low === "anthropic" || lowModel.startsWith("claude")) return "Claude";
  if (low === "deepseek" || lowModel.includes("deepseek")) return "DeepSeek";
  if (isAgentProvider(rawProvider)) return agentProviderName(rawProvider);
  return rawProvider || "Model";
}

function formatWanTokens(tokens: number): string {
  if (tokens >= 10_000) {
    return `${(tokens / 10_000).toFixed(1)} 万`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return String(Math.round(tokens));
}

function formatUsd(cost: number | null | undefined): string {
  const val = cost ?? 0;
  return `$${val.toFixed(2)}`;
}

interface ModelRowItem {
  key: string;
  providerBadge: string;
  model: string;
  tokens: number;
  costUsd: number;
  turns: number;
  sharePercent: number;
}

interface ProviderRowItem {
  providerBadge: string;
  modelCount: number;
  tokens: number;
  costUsd: number;
  turns: number;
  sharePercent: number;
}

export function ServerUsageScreen() {
  const { t } = useText();
  const { theme } = useUniwind();
  const dark = theme === "dark";
  const { serverId: paramServerId } = useLocalSearchParams<{ serverId?: string }>();
  const queryScope = useQueryScope();
  const { activeServer, servers, agents, loadHostAnalytics, loadAgentAnalytics } = useMobileWorkspace();
  const serverId = paramServerId ?? activeServer.id;
  const server = servers.find((item) => item.id === serverId);
  const online = server?.state === "online";
  const serverAgents = useMemo(() => agents.filter((agent) => agent.serverId === serverId), [agents, serverId]);

  const [rangePreset, setRangePreset] = useState<UsageRangePreset>("month");
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const cardBg = dark ? "#1f1f26" : "#ffffff";
  const borderColor = String(useCSSVariable("--starbot-border-grouped") ?? "rgba(15,23,42,0.08)");

  useEffect(() => {
    mobileAnalytics.track("usage_viewed", { scope: "server" });
  }, []);

  const baseRange = useMemo(() => buildDateRange(rangePreset), [rangePreset]);

  // Always fetch workspace-wide analytics for the Bot ranking section + "All Bots" mode
  const allUsageQuery = useQuery({
    queryKey: queryKeys.serverUsage(queryScope, serverId, baseRange),
    queryFn: () => loadHostAnalytics(baseRange, serverId),
    enabled: Boolean(online && serverId),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  // When a single Bot is selected, fetch its exact model & provider breakdown
  const filteredAgentRange = useMemo(
    () => (selectedBotId ? { ...baseRange, agentId: selectedBotId } : null),
    [baseRange, selectedBotId],
  );
  const botUsageQuery = useQuery({
    queryKey: queryKeys.agentUsage(
      queryScope,
      serverId,
      selectedBotId ?? "all",
      Boolean(online && selectedBotId),
      filteredAgentRange ?? { ...baseRange, agentId: "all" },
    ),
    queryFn: async () => {
      if (!filteredAgentRange) return null;
      return (
        (await loadHostAnalytics(filteredAgentRange, serverId)) ?? loadAgentAnalytics(filteredAgentRange, serverId)
      );
    },
    enabled: Boolean(online && serverId && selectedBotId),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  const activeData = selectedBotId ? botUsageQuery.data : allUsageQuery.data;
  const isPending = selectedBotId ? botUsageQuery.isPending : allUsageQuery.isPending;
  const isError = selectedBotId ? botUsageQuery.isError : allUsageQuery.isError;

  const summary = useMemo(() => {
    if (!activeData) {
      return { totalCostUsd: 0, totalTokens: 0, totalTurns: 0 };
    }
    const totalTokens = analyticsTokens(activeData.totals);
    const totalCostUsd = activeData.totals.estimatedCostUsd ?? 0;
    const totalTurns = Math.max(
      activeData.totals.turns,
      activeData.totals.assistantMessages,
      activeData.totals.userMessages,
    );
    return { totalCostUsd, totalTokens, totalTurns };
  }, [activeData]);

  // Build per-model breakdown (matching Desktop Image 12 "调用的模型明细" 1:1)
  const modelRows = useMemo<ModelRowItem[]>(() => {
    const rawModels = activeData?.models ?? [];
    const mapped = rawModels.map((row) => {
      const tokens = analyticsTokens(row);
      const costUsd = row.estimatedCostUsd ?? 0;
      const turns = Math.max(row.turns, row.assistantMessages, row.userMessages);
      return {
        key: `${row.provider}:${row.model}`,
        providerBadge: friendlyProviderLabel(row.provider, row.model),
        model: row.model,
        tokens,
        costUsd,
        turns,
      };
    });
    const nonZero = mapped.filter((m) => m.tokens > 0 || m.costUsd > 0 || m.turns > 0);
    const list = nonZero.length > 0 ? nonZero : mapped;
    const sumTokens = list.reduce((acc, m) => acc + m.tokens, 0);
    const sumCost = list.reduce((acc, m) => acc + m.costUsd, 0);
    return list
      .map((item) => {
        const ratio = sumTokens > 0 ? item.tokens / sumTokens : sumCost > 0 ? item.costUsd / sumCost : 0;
        return {
          ...item,
          sharePercent: Number((ratio * 100).toFixed(1)),
        };
      })
      .sort((a, b) => (b.tokens !== a.tokens ? b.tokens - a.tokens : b.costUsd - a.costUsd));
  }, [activeData?.models]);

  // Aggregate per-provider breakdown ("各厂商消耗汇总")
  const providerRows = useMemo<ProviderRowItem[]>(() => {
    const byProvider = new Map<
      string,
      { providerBadge: string; modelCount: number; tokens: number; costUsd: number; turns: number }
    >();
    for (const row of modelRows) {
      const cur = byProvider.get(row.providerBadge) ?? {
        providerBadge: row.providerBadge,
        modelCount: 0,
        tokens: 0,
        costUsd: 0,
        turns: 0,
      };
      cur.modelCount += 1;
      cur.tokens += row.tokens;
      cur.costUsd += row.costUsd;
      cur.turns += row.turns;
      byProvider.set(row.providerBadge, cur);
    }
    const items = [...byProvider.values()];
    const sumCost = items.reduce((acc, p) => acc + p.costUsd, 0);
    const sumTokens = items.reduce((acc, p) => acc + p.tokens, 0);
    return items
      .map((item) => {
        const ratio = sumCost > 0 ? item.costUsd / sumCost : sumTokens > 0 ? item.tokens / sumTokens : 0;
        return {
          ...item,
          sharePercent: Number((ratio * 100).toFixed(1)),
        };
      })
      .sort((a, b) => (b.costUsd !== a.costUsd ? b.costUsd - a.costUsd : b.tokens - a.tokens));
  }, [modelRows]);

  // Per-Bot ranking ("各星友消耗排行")
  const botRows = useMemo(() => {
    const rawAgents = allUsageQuery.data?.agents ?? [];
    const byId = new Map(serverAgents.map((a) => [a.id, a]));
    const items = rawAgents.map((row) => {
      const agent = byId.get(row.agentId) ?? null;
      const tokens = analyticsTokens(row);
      const costUsd = row.estimatedCostUsd ?? 0;
      const turns = Math.max(row.turns, row.assistantMessages, row.userMessages);
      return {
        agentId: row.agentId,
        agent,
        name: agent?.name ?? row.agentId,
        model: agent?.model || agent?.provider || "",
        tokens,
        costUsd,
        turns,
      };
    });
    const sumCost = items.reduce((acc, i) => acc + i.costUsd, 0);
    const sumTokens = items.reduce((acc, i) => acc + i.tokens, 0);
    return items
      .map((item) => {
        const ratio = sumCost > 0 ? item.costUsd / sumCost : sumTokens > 0 ? item.tokens / sumTokens : 0;
        return {
          ...item,
          sharePercent: Number((ratio * 100).toFixed(1)),
        };
      })
      .sort((a, b) => (b.costUsd !== a.costUsd ? b.costUsd - a.costUsd : b.tokens - a.tokens));
  }, [allUsageQuery.data?.agents, serverAgents]);

  const title = t("mobile.app.usage.title");

  if (!server) {
    return (
      <LargeTitleScrollView title={title} contentContainerClassName="px-4 pt-3">
        <SettingsNote>{t("mobile.server.unavailable")}</SettingsNote>
      </LargeTitleScrollView>
    );
  }

  return (
    <LargeTitleScrollView title={title} contentContainerClassName="gap-5 px-4 pt-2 pb-safe-offset-8">
      {/* 1. Spacious, Evenly Distributed Time Range Segmented Control */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          padding: 4,
          borderRadius: 16,
          backgroundColor: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.055)",
        }}
      >
        {RANGE_OPTIONS.map((opt) => {
          const active = rangePreset === opt.id;
          return (
            <SpringPressable
              key={opt.id}
              feedback="tick"
              scaleTo={0.96}
              onPress={() => setRangePreset(opt.id)}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
                ...(active
                  ? {
                      backgroundColor: cardBg,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.07)",
                      shadowColor: "#0f172a",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: dark ? 0.3 : 0.08,
                      shadowRadius: 6,
                    }
                  : {}),
              }}
            >
              <Typography
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  lineHeight: 16,
                  fontWeight: active ? "700" : "500",
                  color: active ? (dark ? "#ffffff" : "#18181b") : dark ? "#a1a1aa" : "#64748b",
                }}
              >
                {t(opt.labelKey)}
              </Typography>
            </SpringPressable>
          );
        })}
      </View>

      {/* 2. Custom Bot Filter Bar (All Bots Total vs Single Bot) */}
      {serverAgents.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <SpringPressable
            feedback="tick"
            scaleTo={0.96}
            onPress={() => setSelectedBotId(null)}
            style={{
              height: 38,
              paddingHorizontal: 14,
              borderRadius: 19,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: selectedBotId === null ? BRAND_PURPLE : cardBg,
              borderWidth: 1,
              borderColor: selectedBotId === null ? BRAND_PURPLE : borderColor,
            }}
          >
            <Typography
              className="font-semibold text-xs"
              style={{ color: selectedBotId === null ? "#ffffff" : undefined }}
            >
              {t("mobile.app.usage.filterAllBots")}
            </Typography>
          </SpringPressable>

          {serverAgents.map((agent) => {
            const selected = selectedBotId === agent.id;
            return (
              <SpringPressable
                key={agent.id}
                feedback="tick"
                scaleTo={0.96}
                onPress={() => setSelectedBotId(selected ? null : agent.id)}
                style={{
                  height: 38,
                  paddingLeft: 8,
                  paddingRight: 13,
                  borderRadius: 19,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  backgroundColor: selected ? BRAND_PURPLE : cardBg,
                  borderWidth: 1,
                  borderColor: selected ? BRAND_PURPLE : borderColor,
                }}
              >
                <BloubAvatar
                  agentId={agent.id}
                  serverId={agent.serverId}
                  hue={agent.avatarHue}
                  color={agent.avatarColor}
                  seed={agent.avatarSeed}
                  avatarUrl={agent.avatarUrl}
                  size={24}
                  animateIdle={false}
                />
                <Typography
                  className="font-semibold text-xs text-foreground"
                  style={selected ? { color: "#ffffff" } : undefined}
                >
                  {agent.name}
                </Typography>
              </SpringPressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* 3. Summary Metrics Card */}
      <View
        className="flex-row items-center justify-between rounded-3xl px-4 py-5"
        style={{
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: dark ? 0.25 : 0.05,
          shadowRadius: 14,
        }}
      >
        <View className="flex-1 items-center gap-1">
          <Typography className="text-xs text-text-secondary">{t("mobile.app.usage.totalCost")}</Typography>
          <Typography className="font-bold text-2xl tabular-nums" style={{ color: BRAND_PURPLE }}>
            {formatUsd(summary.totalCostUsd)}
          </Typography>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, height: 34, backgroundColor: borderColor }} />
        <View className="flex-1 items-center gap-1">
          <Typography className="text-xs text-text-secondary">{t("mobile.app.usage.totalTokens")}</Typography>
          <Typography className="font-bold text-xl text-foreground tabular-nums">
            {formatWanTokens(summary.totalTokens)}
          </Typography>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, height: 34, backgroundColor: borderColor }} />
        <View className="flex-1 items-center gap-1">
          <Typography className="text-xs text-text-secondary">{t("mobile.app.usage.totalTurns")}</Typography>
          <Typography className="font-bold text-xl text-foreground tabular-nums">{summary.totalTurns}</Typography>
        </View>
      </View>

      {!online ? (
        <SettingsNote>{t("mobile.agent.info.usage.reconnect")}</SettingsNote>
      ) : isPending && !activeData ? (
        <View className="items-center py-10">
          <Spinner size="md" color={BRAND_PURPLE} />
        </View>
      ) : isError ? (
        <View className="items-center gap-3 py-6">
          <Typography className="text-sm text-text-secondary">{t("mobile.agent.info.usage.failed")}</Typography>
          <Button
            variant="secondary"
            onPress={() => {
              void allUsageQuery.refetch();
              if (selectedBotId) void botUsageQuery.refetch();
            }}
          >
            <Button.Label>{t("mobile.agent.info.usage.retry")}</Button.Label>
          </Button>
        </View>
      ) : (
        <>
          {/* 4. 调用的模型明细 (Desktop Image 12 exact match!) */}
          <View className="gap-3">
            <View className="gap-0.5 px-1">
              <Typography className="font-bold text-lg text-foreground">
                {t("mobile.app.usage.modelSection")}
              </Typography>
              <Typography className="text-xs text-text-secondary">{t("mobile.app.usage.modelSectionSub")}</Typography>
            </View>

            {modelRows.length === 0 ? (
              <View
                className="items-center rounded-2xl px-4 py-8"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
              >
                <Typography className="text-sm text-text-secondary">{t("mobile.app.usage.emptyModels")}</Typography>
              </View>
            ) : (
              <View className="gap-2.5">
                {modelRows.map((row) => (
                  <View
                    key={row.key}
                    className="gap-2.5 rounded-2xl p-4"
                    style={{
                      backgroundColor: cardBg,
                      borderWidth: 1,
                      borderColor,
                    }}
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: BADGE_BG }}>
                          <Typography className="font-bold text-xs" style={{ color: BRAND_PURPLE }}>
                            {row.providerBadge}
                          </Typography>
                        </View>
                        <Typography className="min-w-0 flex-1 font-bold text-[15px] text-foreground" numberOfLines={1}>
                          {row.model}
                        </Typography>
                      </View>
                      <View className="flex-row items-baseline gap-1.5">
                        <Typography className="font-bold text-[15px] text-foreground tabular-nums">
                          {formatWanTokens(row.tokens)}
                        </Typography>
                        <Typography className="font-medium text-xs text-text-secondary tabular-nums">
                          {formatUsd(row.costUsd)}
                        </Typography>
                      </View>
                    </View>

                    {/* Crisp static progress bar */}
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: TRACK_PURPLE,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.max(row.tokens > 0 ? 3 : 0, Math.min(100, row.sharePercent))}%`,
                          height: "100%",
                          borderRadius: 3,
                          backgroundColor: BRAND_PURPLE,
                        }}
                      />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Typography className="text-xs text-text-secondary tabular-nums">
                        {t("mobile.app.usage.shareRatio", { percent: row.sharePercent.toFixed(1) })}
                      </Typography>
                      <Typography className="text-xs text-text-secondary tabular-nums">
                        {t("mobile.app.usage.turnsUnit", { count: row.turns })}
                      </Typography>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 5. 各厂商消耗汇总 (Provider-level aggregation) */}
          {providerRows.length > 0 ? (
            <View className="gap-3">
              <View className="gap-0.5 px-1">
                <Typography className="font-bold text-lg text-foreground">
                  {t("mobile.app.usage.providerSection")}
                </Typography>
                <Typography className="text-xs text-text-secondary">
                  {t("mobile.app.usage.providerSectionSub")}
                </Typography>
              </View>

              <View
                className="overflow-hidden rounded-2xl"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
              >
                {providerRows.map((prov, idx) => (
                  <View
                    key={prov.providerBadge}
                    className="gap-2 p-4"
                    style={
                      idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor } : undefined
                    }
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Typography className="font-bold text-[15px] text-foreground">{prov.providerBadge}</Typography>
                        <Typography className="text-xs text-text-secondary tabular-nums">
                          {t("mobile.app.usage.turnsUnit", { count: prov.turns })}
                        </Typography>
                      </View>
                      <View className="flex-row items-baseline gap-2">
                        <Typography className="font-semibold text-xs text-text-secondary tabular-nums">
                          {formatWanTokens(prov.tokens)}
                        </Typography>
                        <Typography className="font-bold text-[15px] tabular-nums" style={{ color: BRAND_PURPLE }}>
                          {formatUsd(prov.costUsd)}
                        </Typography>
                      </View>
                    </View>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 2.5,
                        backgroundColor: TRACK_PURPLE,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.max(3, Math.min(100, prov.sharePercent))}%`,
                          height: "100%",
                          borderRadius: 2.5,
                          backgroundColor: BRAND_PURPLE,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 6. 各星友消耗排行 (Tap any Bot to filter its exact models!) */}
          {selectedBotId === null && botRows.length > 0 ? (
            <View className="gap-3">
              <View className="gap-0.5 px-1">
                <Typography className="font-bold text-lg text-foreground">
                  {t("mobile.app.usage.botSection")}
                </Typography>
                <Typography className="text-xs text-text-secondary">{t("mobile.app.usage.botSectionSub")}</Typography>
              </View>

              <View
                className="overflow-hidden rounded-2xl"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
              >
                {botRows.map((bot, idx) => (
                  <SpringPressable
                    key={bot.agentId}
                    feedback="tick"
                    scaleTo={0.985}
                    onPress={() => setSelectedBotId(bot.agentId)}
                    className="flex-row items-center gap-3 p-4"
                    style={
                      idx > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor } : undefined
                    }
                  >
                    {bot.agent ? (
                      <BloubAvatar
                        agentId={bot.agent.id}
                        serverId={bot.agent.serverId}
                        hue={bot.agent.avatarHue}
                        color={bot.agent.avatarColor}
                        seed={bot.agent.avatarSeed}
                        avatarUrl={bot.agent.avatarUrl}
                        size={42}
                        animateIdle={false}
                      />
                    ) : null}
                    <View className="min-w-0 flex-1 gap-1.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <View className="min-w-0 flex-1 flex-row items-center gap-2">
                          <Typography className="font-bold text-[15px] text-foreground" numberOfLines={1}>
                            {bot.name}
                          </Typography>
                          {bot.model ? (
                            <View className="rounded-md bg-control px-2 py-0.5">
                              <Typography className="text-[11px] text-text-secondary" numberOfLines={1}>
                                {bot.model}
                              </Typography>
                            </View>
                          ) : null}
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Typography className="font-bold text-[15px] text-foreground tabular-nums">
                            {formatUsd(bot.costUsd)}
                          </Typography>
                          <ChevronRight color="#9ca3af" size={15} />
                        </View>
                      </View>
                      <View
                        style={{
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: TRACK_PURPLE,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.max(3, Math.min(100, bot.sharePercent))}%`,
                            height: "100%",
                            borderRadius: 2.5,
                            backgroundColor: BRAND_PURPLE,
                          }}
                        />
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Typography className="text-xs text-text-secondary tabular-nums">
                          {`${formatWanTokens(bot.tokens)} Tokens · ${t("mobile.app.usage.turnsUnit", { count: bot.turns })}`}
                        </Typography>
                        <Typography className="text-xs text-text-secondary tabular-nums">
                          {`${bot.sharePercent.toFixed(0)}%`}
                        </Typography>
                      </View>
                    </View>
                  </SpringPressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </LargeTitleScrollView>
  );
}
