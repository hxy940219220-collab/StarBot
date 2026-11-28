import {
  analyticsRange,
  type ClientAgentSummary,
  type HostAnalytics,
  type HostAnalyticsInput,
} from "@openbot/contracts/ipc";
import { Button, ErrorReference, IconButton, RefreshCw } from "@openbot/ui";
import { type UsageMetric, type UsagePeriod, usagePeriodDays } from "@openbot/ui/features/usage/usage-format";
import { PageHeader } from "@openbot/ui/features/window/PageHeader";
import { useText } from "@openbot/ui/text";
import { errorReference } from "@openbot/user-errors";
import type { JSX } from "@solidjs/web";
import { createEffect, createStore, onSettled, Show } from "solid-js";
import { desktopAnalytics } from "../../analytics";
import { createPageHeaderFrame } from "../window/page-header-frame";
import { StarBotUsageDashboard } from "./StarBotUsageDashboard";
import { type UsagePort, usagePort } from "./usage-port";

interface AgentUsagePanelProps {
  agentId?: string | undefined;
  agentName?: string;
  serverId: string;
  hostName: string;
  onBack: () => void;
  port?: UsagePort;
  machine?: JSX.Element;
}
interface UsageState {
  range: HostAnalyticsInput;
  result: HostAnalytics | null;
  phase: "loading" | "ready" | "unsupported" | "error";
  errorReference: string | null;
  agents: ClientAgentSummary[];
  metric: UsageMetric;
  period: UsagePeriod;
  serverId: string;
}

function usageRange(days: number, agentId: string | undefined): HostAnalyticsInput {
  const { startDate, endDate, timeZone } = analyticsRange("", days);
  return agentId === undefined ? { startDate, endDate, timeZone } : { startDate, endDate, timeZone, agentId };
}

export function AgentUsagePanel(props: AgentUsagePanelProps) {
  const { t } = useText();
  const port = () => props.port ?? usagePort();
  const [state, setState] = createStore<UsageState>({
    range: usageRange(usagePeriodDays["30d"], props.agentId),
    agents: [],
    result: null,
    phase: "loading",
    errorReference: null,
    metric: "cost",
    period: "30d",
    serverId: props.serverId,
  });
  let generation = 0;
  async function load(range = state.range, background = false): Promise<void> {
    const request = ++generation;
    const serverId = props.serverId;
    const agentId = range.agentId;
    if (!background)
      setState((draft) => {
        draft.phase = "loading";
        draft.result = null;
      });
    try {
      const [result, agents] = await Promise.all([
        port().agent.getHostAnalytics({ ...range }, serverId),
        port().agent.listAgents(serverId),
      ]);
      if (request === generation && props.serverId === serverId && state.range.agentId === agentId)
        setState((draft) => {
          draft.agents = agents;
          draft.serverId = serverId;
          draft.result = result;
          draft.phase = result ? "ready" : "unsupported";
        });
    } catch (error) {
      if (background && state.result) return;
      if (request === generation && props.serverId === serverId && state.range.agentId === agentId)
        setState((draft) => {
          draft.result = null;
          draft.phase = "error";
          draft.errorReference = errorReference(error);
        });
    }
  }
  createEffect(
    () => [props.agentId, props.serverId],
    () => {
      setState((draft) => {
        if (props.agentId === undefined) delete draft.range.agentId;
        else draft.range.agentId = props.agentId;
        draft.agents = [];
      });
    },
  );
  createEffect(
    () => [state.range.agentId, props.serverId, state.period] as const,
    ([agentId, , range]) => {
      desktopAnalytics.track("usage_viewed", {
        scope: agentId ? "agent" : "server",
        range,
        filtered: agentId !== props.agentId,
      });
    },
  );
  createEffect(
    () => [state.range.agentId, props.serverId, state.range.startDate, state.range.endDate],
    () => {
      void load();
    },
  );
  onSettled(() => {
    const unsubscribe = port().agent.onScopedEvent(({ serverId, event }) => {
      if (
        serverId === props.serverId &&
        event.type === "turn-completed" &&
        (!state.range.agentId || event.agentId === state.range.agentId)
      )
        void load(state.range, true);
    });
    const reconnect = port().servers.onEvent((servers) => {
      if (servers.some((server) => server.id === props.serverId && server.state === "online"))
        void load(state.range, true);
    });
    return () => {
      generation++;
      unsubscribe();
      reconnect();
    };
  });
  let reportBody: HTMLDivElement | undefined;
  const headerFrame = createPageHeaderFrame();
  return (
    <section class="agent-usage" aria-label={t("usage.panel.label")}>
      <PageHeader
        class="agent-usage-header"
        title="算力与消耗看板"
        hostName={props.hostName}
        onBack={props.onBack}
        frame={headerFrame()}
      >
        <div class="agent-usage-controls">
          {props.machine}
          <IconButton
            variant="outline"
            label={t("usage.panel.refresh")}
            disabled={state.phase === "loading"}
            onClick={() => void load()}
          >
            <RefreshCw />
          </IconButton>
        </div>
      </PageHeader>
      <div ref={reportBody} class="agent-usage-body">
        <Show when={state.phase === "loading"}>
          <div class="agent-usage-loading" role="status">
            <span>{t("usage.panel.loading")}</span>
            <div class="agent-usage-placeholder" />
          </div>
        </Show>
        <Show when={state.phase === "unsupported"}>
          <p class="agent-usage-notice" role="status">
            {t("usage.panel.unsupported")}
          </p>
        </Show>
        <Show when={state.phase === "error"}>
          <div class="agent-usage-notice">
            <p role="alert">
              {t("usage.panel.loadFailed")}
              <ErrorReference reference={state.errorReference} />
            </p>
            <Button variant="secondary" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          </div>
        </Show>
        <Show
          when={
            state.serverId === props.serverId &&
            state.result &&
            state.result.agentId === state.range.agentId &&
            state.result.startDate === state.range.startDate &&
            state.result.endDate === state.range.endDate &&
            state.result
          }
        >
          {(result) => (
            <StarBotUsageDashboard
              analytics={result()}
              agents={state.agents}
              selectedAgentId={state.range.agentId}
              period={state.period}
              onSelectAgent={(nextId) => {
                setState((draft) => {
                  if (nextId === undefined) delete draft.range.agentId;
                  else draft.range.agentId = nextId;
                });
                if (reportBody) reportBody.scrollTop = 0;
              }}
              onSelectPeriod={(nextPeriod) => {
                setState((draft) => {
                  draft.period = nextPeriod;
                  draft.range = usageRange(usagePeriodDays[nextPeriod], draft.range.agentId);
                });
              }}
            />
          )}
        </Show>
      </div>
    </section>
  );
}
