import {
  type AgentProviderRef,
  type ClientAgentSummary,
  type HostAnalytics,
  providerDisplayName,
  WORKFLOWS_USAGE_ID,
} from "@openbot/contracts/ipc";
import { isKnownAgentProvider } from "@openbot/contracts/agent-providers";
import { Bot, Cpu, MessageSquare, Sparkles, Zap } from "@openbot/ui";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import {
  type UsagePeriod,
  usagePeriods,
} from "@openbot/ui/features/usage/usage-format";
import { createMemo, createSignal, For, Show } from "solid-js";

const PERIOD_LABELS_ZH: Record<UsagePeriod, string> = {
  "7d": "近 7 天",
  "30d": "近 30 天",
  "90d": "近 90 天",
  "1y": "近 1 年",
};

function formatCompactTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 1_000_000 ? 1 : 2)} 万`;
  return n.toLocaleString("zh-CN");
}

function formatUsdCost(usd: number | null | undefined): string {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return "本机直连";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length >= 3) {
    return `${Number(parts[1])}月${Number(parts[2])}日`;
  }
  return isoDate;
}

function formatProviderLabel(provider: string): string {
  if (!provider) return "本地引擎";
  const ref = provider as AgentProviderRef;
  return isKnownAgentProvider(ref) ? providerDisplayName(ref) : provider;
}

export interface StarBotUsageDashboardProps {
  analytics: HostAnalytics;
  agents: readonly ClientAgentSummary[];
  selectedAgentId: string | undefined;
  period: UsagePeriod;
  loading?: boolean;
  onSelectAgent: (agentId: string | undefined) => void;
  onSelectPeriod: (period: UsagePeriod) => void;
}

export function StarBotUsageDashboard(props: StarBotUsageDashboardProps) {
  const [chartMode, setChartMode] = createSignal<"tokens" | "cost">("tokens");
  const [hoveredDate, setHoveredDate] = createSignal<string | null>(null);

  const selectedAgent = createMemo(() =>
    props.selectedAgentId ? props.agents.find((a) => a.id === props.selectedAgentId) ?? null : null,
  );

  const totals = () => props.analytics.totals;

  const cacheHitRatio = createMemo(() => {
    const t = totals();
    const totalIn = (t.cachedInput ?? 0) + (t.uncachedInput ?? 0);
    if (totalIn <= 0) return 0;
    return Math.min(100, Math.round(((t.cachedInput ?? 0) / totalIn) * 100));
  });

  const dailyPoints = createMemo(() => {
    const raw = props.analytics.daily;
    if (raw.length <= 31) return raw;
    return raw.slice(-31);
  });

  const maxDailyValue = createMemo(() => {
    const mode = chartMode();
    let max = 0;
    for (const d of dailyPoints()) {
      const val = mode === "cost" ? (d.estimatedCostUsd ?? 0) : d.processedTokens;
      if (val > max) max = val;
    }
    return max > 0 ? max : 1;
  });

  const hoveredPoint = createMemo(() => {
    const date = hoveredDate();
    if (!date) return dailyPoints().at(-1) ?? null;
    return dailyPoints().find((d) => d.date === date) ?? null;
  });

  // Merge analytics.agents with full agent profiles so even 0-token agents can be seen & filtered
  const agentCards = createMemo(() => {
    const usageByAgent = new Map(props.analytics.agents.map((row) => [row.agentId, row]));
    const seen = new Set<string>();
    const list: Array<{
      id: string;
      profile: ClientAgentSummary | null;
      name: string;
      provider: string;
      model: string;
      tokens: number;
      cost: number | null;
      turns: number;
      messages: number;
      share: number;
    }> = [];

    for (const ag of props.agents) {
      seen.add(ag.id);
      const u = usageByAgent.get(ag.id);
      list.push({
        id: ag.id,
        profile: ag,
        name: ag.name,
        provider: formatProviderLabel(ag.provider),
        model: ag.model,
        tokens: u?.processedTokens ?? 0,
        cost: u?.estimatedCostUsd ?? null,
        turns: u?.turns ?? 0,
        messages: (u?.userMessages ?? 0) + (u?.assistantMessages ?? 0),
        share: u?.share ?? 0,
      });
    }

    for (const u of props.analytics.agents) {
      if (seen.has(u.agentId) || u.agentId === WORKFLOWS_USAGE_ID) continue;
      list.push({
        id: u.agentId,
        profile: null,
        name: u.agentId,
        provider: "历史星友",
        model: "—",
        tokens: u.processedTokens,
        cost: u.estimatedCostUsd,
        turns: u.turns,
        messages: u.userMessages + u.assistantMessages,
        share: u.share,
      });
    }

    return list.sort((a, b) => b.tokens - a.tokens || b.turns - a.turns);
  });

  return (
    <div class="starbot-usage-root">
      {/* Filter Strip: All StarBots vs Individual StarBot Pills + Period Selector */}
      <div class="starbot-usage-filter-bar">
        <div class="starbot-usage-agent-pills" role="tablist" aria-label="筛选星友消耗">
          <button
            type="button"
            role="tab"
            aria-selected={props.selectedAgentId === undefined ? "true" : "false"}
            class={`starbot-usage-agent-pill${props.selectedAgentId === undefined ? " is-active" : ""}`}
            onClick={() => props.onSelectAgent(undefined)}
          >
            <Sparkles class="size-3.5" aria-hidden="true" />
            <span>全部星友总览</span>
          </button>
          <For each={props.agents}>
            {(ag) => (
              <button
                type="button"
                role="tab"
                aria-selected={props.selectedAgentId === ag.id ? "true" : "false"}
                class={`starbot-usage-agent-pill${props.selectedAgentId === ag.id ? " is-active" : ""}`}
                onClick={() => props.onSelectAgent(ag.id)}
              >
                <AgentAvatar agent={ag} motion="idle" class="starbot-usage-pill-avatar" />
                <span>{ag.name}</span>
              </button>
            )}
          </For>
        </div>

        <div class="starbot-usage-period-pills" role="group" aria-label="统计周期">
          <For each={usagePeriods}>
            {(p) => (
              <button
                type="button"
                class={`starbot-usage-period-btn${props.period === p ? " is-active" : ""}`}
                onClick={() => props.onSelectPeriod(p)}
              >
                {PERIOD_LABELS_ZH[p]}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Selected Single StarBot Spotlight Banner */}
      <Show when={selectedAgent()}>
        {(ag) => (
          <section class="starbot-usage-spotlight">
            <div class="starbot-usage-spotlight-left">
              <AgentAvatar agent={ag()} motion="always" class="starbot-usage-spotlight-avatar" />
              <div>
                <div class="starbot-usage-spotlight-title-row">
                  <h2>{ag().name}</h2>
                  <span class="starbot-usage-model-badge">
                    <Cpu class="size-3.5" aria-hidden="true" />
                    {formatProviderLabel(ag().provider)} · {ag().model}
                  </span>
                </div>
                <p>{ag().description?.trim() || "专属星友智能体 · 正在统计所选时间段内的独立模型与算力消耗"}</p>
              </div>
            </div>
            <button type="button" class="starbot-usage-back-all" onClick={() => props.onSelectAgent(undefined)}>
              返回全部总览
            </button>
          </section>
        )}
      </Show>

      {/* Top 4 KPI Summary Cards */}
      <div class="starbot-usage-kpi-grid">
        <article class="starbot-usage-kpi-card is-primary">
          <div class="starbot-usage-kpi-head">
            <span>{selectedAgent() ? "该星友总 Token 消耗" : "全体星友总 Token 消耗"}</span>
            <Zap class="size-4" aria-hidden="true" />
          </div>
          <strong class="starbot-usage-kpi-value">{formatCompactTokens(totals().processedTokens)}</strong>
          <div class="starbot-usage-kpi-sub">
            <span>输入 {formatCompactTokens((totals().uncachedInput ?? 0) + (totals().cachedInput ?? 0))}</span>
            <span>·</span>
            <span>输出 {formatCompactTokens(totals().output ?? 0)}</span>
          </div>
        </article>

        <article class="starbot-usage-kpi-card">
          <div class="starbot-usage-kpi-head">
            <span>预估 API / 模型开销</span>
            <Sparkles class="size-4" aria-hidden="true" />
          </div>
          <strong class="starbot-usage-kpi-value">{formatUsdCost(totals().estimatedCostUsd)}</strong>
          <div class="starbot-usage-kpi-sub">
            <span>
              {totals().estimatedCostUsd && totals().estimatedCostUsd! > 0
                ? "按官方标准 API 单价折算参考"
                : "本机订阅 / 本地模型免按量计费"}
            </span>
          </div>
        </article>

        <article class="starbot-usage-kpi-card">
          <div class="starbot-usage-kpi-head">
            <span>对话互动频次</span>
            <MessageSquare class="size-4" aria-hidden="true" />
          </div>
          <strong class="starbot-usage-kpi-value">{totals().turns} 轮</strong>
          <div class="starbot-usage-kpi-sub">
            <span>提问 {totals().userMessages} 条</span>
            <span>·</span>
            <span>回复 {totals().assistantMessages} 条</span>
          </div>
        </article>

        <article class="starbot-usage-kpi-card">
          <div class="starbot-usage-kpi-head">
            <span>上下文缓存命中率</span>
            <Cpu class="size-4" aria-hidden="true" />
          </div>
          <strong class="starbot-usage-kpi-value">{cacheHitRatio()}%</strong>
          <div class="starbot-usage-kpi-bar">
            <div class="starbot-usage-kpi-bar-fill" style={{ width: `${cacheHitRatio()}%` }} />
          </div>
        </article>
      </div>

      {/* Middle 2-Column Visual Section: Daily Bar Chart + Model Breakdown */}
      <div class="starbot-usage-visual-grid">
        <section class="starbot-usage-panel-card">
          <header class="starbot-usage-card-head">
            <div>
              <h3>每日消耗趋势</h3>
              <Show when={hoveredPoint()}>
                {(pt) => (
                  <p>
                    {formatShortDate(pt().date)}：消耗 <strong>{formatCompactTokens(pt().processedTokens)}</strong> Token
                    {" · "}
                    {pt().turns} 轮对话
                    <Show when={pt().estimatedCostUsd !== null && (pt().estimatedCostUsd ?? 0) > 0}>
                      {" · "}估算 {formatUsdCost(pt().estimatedCostUsd)}
                    </Show>
                  </p>
                )}
              </Show>
            </div>
            <div class="starbot-usage-chart-switch">
              <button
                type="button"
                class={chartMode() === "tokens" ? "is-active" : ""}
                onClick={() => setChartMode("tokens")}
              >
                Token 量
              </button>
              <button
                type="button"
                class={chartMode() === "cost" ? "is-active" : ""}
                onClick={() => setChartMode("cost")}
              >
                估算花费
              </button>
            </div>
          </header>

          <Show
            when={dailyPoints().length > 0}
            fallback={<div class="starbot-usage-empty-hint">所选时间段暂无对话消耗记录</div>}
          >
            <div class="starbot-usage-bars-wrap">
              <div class="starbot-usage-bars">
                <For each={dailyPoints()}>
                  {(day, idx) => {
                    const val = () => (chartMode() === "cost" ? (day.estimatedCostUsd ?? 0) : day.processedTokens);
                    const pct = () => (val() <= 0 ? 3 : Math.max(8, Math.round((val() / maxDailyValue()) * 100)));
                    const isHover = () => hoveredPoint()?.date === day.date;
                    const showTick = () => {
                      const total = dailyPoints().length;
                      const i = idx();
                      if (total <= 8) return true;
                      const step = Math.max(4, Math.ceil((total - 1) / 6));
                      if (i === total - 1) return true;
                      if (i === 0) return true;
                      return i % step === 0 && total - 1 - i >= Math.floor(step * 0.6);
                    };
                    return (
                      <div
                        class={`starbot-usage-bar-col${isHover() ? " is-hovered" : ""}`}
                        title={`${day.date} · ${formatCompactTokens(day.processedTokens)} Token`}
                        onMouseEnter={() => setHoveredDate(day.date)}
                      >
                        <div class="starbot-usage-bar-track">
                          <div
                            class={`starbot-usage-bar-fill${val() <= 0 ? " is-zero" : ""}`}
                            style={{ height: `${pct()}%` }}
                          />
                        </div>
                        <span class={`starbot-usage-bar-date${showTick() ? " is-visible" : ""}`}>
                          {showTick() ? day.date.slice(5).replace("-", "/") : ""}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </section>

        <section class="starbot-usage-panel-card">
          <header class="starbot-usage-card-head">
            <div>
              <h3>调用的模型明细</h3>
              <p>查看具体使用了哪些模型及各自消耗占比</p>
            </div>
          </header>

          <Show
            when={props.analytics.models.length > 0}
            fallback={<div class="starbot-usage-empty-hint">暂无模型调用记录</div>}
          >
            <div class="starbot-usage-model-list">
              <For each={props.analytics.models}>
                {(m) => {
                  const pct = () => Math.max(2, Math.round(m.share * 100));
                  return (
                    <div class="starbot-usage-model-row">
                      <div class="starbot-usage-model-row-top">
                        <div class="starbot-usage-model-name">
                          <span class="starbot-usage-model-provider">{formatProviderLabel(m.provider)}</span>
                          <strong>{m.model}</strong>
                        </div>
                        <div class="starbot-usage-model-nums">
                          <strong>{formatCompactTokens(m.processedTokens)}</strong>
                          <Show when={m.estimatedCostUsd !== null && (m.estimatedCostUsd ?? 0) > 0}>
                            <span>{formatUsdCost(m.estimatedCostUsd)}</span>
                          </Show>
                        </div>
                      </div>
                      <div class="starbot-usage-model-progress">
                        <div class="starbot-usage-model-progress-fill" style={{ width: `${pct()}%` }} />
                      </div>
                      <div class="starbot-usage-model-meta">
                        <span>占比 {(m.share * 100).toFixed(1)}%</span>
                        <span>{m.turns} 轮调用</span>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>
      </div>

      {/* Per-StarBot Breakdown Section (Shown when viewing All StarBots) */}
      <Show when={!selectedAgent()}>
        <section class="starbot-usage-panel-card">
          <header class="starbot-usage-card-head">
            <div>
              <h3>各星友消耗排行（点击可查看单人详情）</h3>
              <p>汇总每只星友当前使用的驱动模型、互动轮次与累计算力消耗</p>
            </div>
          </header>

          <Show
            when={agentCards().length > 0}
            fallback={<div class="starbot-usage-empty-hint">还没有创建星友，创建并对话后即可在此查看明细</div>}
          >
            <div class="starbot-usage-agent-table">
              <For each={agentCards()}>
                {(item) => (
                  <button
                    type="button"
                    class="starbot-usage-agent-row"
                    onClick={() => props.onSelectAgent(item.id)}
                  >
                    <div class="starbot-usage-agent-cell-main">
                      <Show
                        when={item.profile}
                        fallback={
                          <span class="starbot-usage-fallback-avatar">
                            <Bot class="size-4" />
                          </span>
                        }
                      >
                        {(prof) => <AgentAvatar agent={prof()} motion="hover" class="starbot-usage-row-avatar" />}
                      </Show>
                      <div class="starbot-usage-agent-meta">
                        <strong>{item.name}</strong>
                        <span>
                          {item.provider} · {item.model}
                        </span>
                      </div>
                    </div>

                    <div class="starbot-usage-agent-cell-bar">
                      <div class="starbot-usage-agent-share-track">
                        <div
                          class="starbot-usage-agent-share-fill"
                          style={{ width: `${Math.max(item.tokens > 0 ? 4 : 0, Math.round(item.share * 100))}%` }}
                        />
                      </div>
                      <span>{(item.share * 100).toFixed(1)}%</span>
                    </div>

                    <div class="starbot-usage-agent-cell-stat">
                      <strong>{formatCompactTokens(item.tokens)}</strong>
                      <span>Token · {item.turns} 轮</span>
                    </div>

                    <div class="starbot-usage-agent-cell-cost">
                      <strong>{formatUsdCost(item.cost)}</strong>
                      <span>查看详情 →</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>
      </Show>
    </div>
  );
}
