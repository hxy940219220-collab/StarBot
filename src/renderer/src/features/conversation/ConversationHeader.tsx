import { foreignProvider, isKnownAgentProvider } from "@starbot/contracts/agent-providers";
import {
  type AgentModelId,
  type AgentProviderRef,
  type AgentReasoningEffort,
  agentNextProviderAccountId,
  DEFAULT_PROVIDER_ACCOUNT_ID,
  providerDisplayName,
  workspaceAccessEnforced,
} from "@starbot/contracts/ipc";
import {
  buttonVariants,
  ChevronRight,
  DropdownMenu,
  History,
  MessageCirclePlus,
  MessagesSquare,
  Sparkles,
} from "@starbot/ui";
import { reasoningLabel } from "@starbot/ui/components/ProviderModelPicker";
import { findModelOption, providerAccountName } from "@starbot/ui/components/provider-accounts";
import { playKawaiiCue } from "@starbot/ui/features/agents/starbot-kawaii-audio";
import {
  getStoredMainSessionTitle,
  setStoredMainSessionTitle,
  ConversationHeader as SharedConversationHeader,
} from "@starbot/ui/features/conversation/ConversationHeader";
import { ThreadHeader } from "@starbot/ui/features/conversation/threads/ThreadHeader";
import {
  DRAFT_THREAD_ID,
  MAIN_THREAD_ID,
  type ThreadItem,
} from "@starbot/ui/features/conversation/threads/thread-types";
import { sidebarMessageTime } from "@starbot/ui/features/sidebar/sidebar-filtering";
import { useText } from "@starbot/ui/text";
import { createEffect, createMemo, For, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import { usePlatform } from "../../platform";
import { setActiveConversationPins } from "./active-pins-bridge";
import { useConversationViewScope } from "./conversation-scope";
import { agentMemoriesPort } from "./memories-port";
import { setStarbotInspectorOpen, starbotInspectorOpen, toggleStarbotInspector } from "./StarBotInspectorPanel";
import { StarBotMemoryCleanModal } from "./StarBotMemoryCleanModal";
import { cleanModalAgentId, closeMemoryCleanModal, openMemoryCleanModal } from "./starbot-memory-hub";

const loadAgentSettingsPanel = () => import("./AgentSettingsPanel");

interface BadgeRuntime {
  provider: AgentProviderRef;
  model: AgentModelId;
  reasoningEffort: AgentReasoningEffort;
  providerAccountId?: string | undefined;
}

interface FlyoutSessionEntry {
  id: string;
  title: string;
  updatedAt: string;
  archived: boolean;
  isMain: boolean;
  unread: number;
  working: boolean;
}

export function ConversationHeader() {
  const { t, format } = useText();
  const platform = usePlatform();
  const {
    actingBrowserControl,
    agentActivity,
    browserControlAgent,
    browserSidebarOpen,
    channel,
    fastMode,
    filePreviewOpen,
    ultrafast,
    fastModeChange,
    props,
    runningTurnRuntime,
    selectAndConfirmModel,
    selectAndConfirmReasoning,
    setActiveRightPanel,
    settingsModel,
    settingsProvider,
    settingsReasoning,
    sidePanelOpen,
    sideThreadOpen,
    messagePins,
    replyJump,
    toggleSidePanel,
    moveThreadToPanel,
    startNewThread,
  } = useConversationViewScope();

  const runningThreads = () => props.threads?.running ?? 0;
  const openMainChat = () => {
    const header = props.threads?.header;
    return header && sideThreadOpen() ? () => header.onOpen(MAIN_THREAD_ID) : undefined;
  };
  const titleSelected = () => (props.threads ? !sideThreadOpen() : undefined);
  const viewTaskId = () => (sideThreadOpen() ? (props.threads?.open?.id ?? DRAFT_THREAD_ID) : undefined);

  let pinOpens = 0;
  async function openPin(key: string): Promise<void> {
    const pin = messagePins.pin(key);
    if (!pin) return;
    const open = ++pinOpens;
    const opened =
      pin.taskId === null && !sideThreadOpen()
        ? await replyJump.jumpTo(pin.messageId)
        : ((await props.threads?.onOpenMessage(pin.taskId, pin.messageId)) ?? false);
    if (opened || open !== pinOpens) return;
    actionToast.error(t("chat.pins.missing"));
    messagePins.load();
  }

  const pinnedMessages = () => {
    if (!messagePins.available()) return undefined;
    return {
      pins: messagePins.items(viewTaskId()),
      agents: props.agents,
      onOpenChange: (open: boolean) => {
        if (open) messagePins.load();
      },
      onJump: (key: string) => void openPin(key),
      onUnpin: (key: string) => {
        const pin = messagePins.pin(key);
        if (pin) messagePins.set(pin.taskId ?? undefined, pin.messageId, false);
      },
    };
  };

  // Move the pinned messages trigger to the left sidebar topbar in main workspace windows
  createEffect(
    () => (platform.chatWindow ? undefined : pinnedMessages()),
    (pins) => {
      if (platform.chatWindow) return;
      setActiveConversationPins(pins);
      return () => {
        setActiveConversationPins(undefined);
      };
    },
  );

  const mainSessionTitle = createMemo<string>(() => {
    const agent = props.agent;
    if (!agent) return "新对话";
    const custom = getStoredMainSessionTitle(props.server?.id, agent.id);
    if (custom) return custom;
    for (const msg of props.messages) {
      if (msg.author === "you" && !msg.senderAgentId) {
        const cleaned = msg.body.replace(/\s+/gu, " ").trim();
        if (cleaned) return cleaned;
      }
    }
    return "新对话";
  });

  const allBotSessions = createMemo<FlyoutSessionEntry[]>(() => {
    const agent = props.agent;
    if (!agent) return [];
    const header = props.threads?.header;
    const list: FlyoutSessionEntry[] = [
      {
        id: MAIN_THREAD_ID,
        title: mainSessionTitle(),
        updatedAt: agent.updatedAt,
        archived: false,
        isMain: true,
        unread: 0,
        working: agentActivity() === "Working",
      },
    ];
    if (!header) return list;
    const pushItem = (item: ThreadItem, archived: boolean) => {
      if (item.id === MAIN_THREAD_ID || item.id === DRAFT_THREAD_ID) return;
      list.push({
        id: item.id,
        title: item.title.trim() || "未命名对话",
        updatedAt: item.updatedAt,
        archived,
        isMain: false,
        unread: item.unread ?? 0,
        working: item.status.kind === "working" || item.status.kind === "queued",
      });
    };
    for (const thread of header.threads) pushItem(thread, false);
    for (const thread of header.archived) pushItem(thread, true);
    return list;
  });

  const activeThreadId = () => props.threads?.header.activeId ?? MAIN_THREAD_ID;

  function openSessionInTabBar(entry: FlyoutSessionEntry): void {
    const header = props.threads?.header;
    if (!header) return;
    void playKawaiiCue("tab-switch");
    if (entry.archived) {
      header.onRestore(entry.id);
    } else {
      header.onOpen(entry.id);
    }
  }

  const working = () => agentActivity() === "Working";
  const providerName = (provider: AgentProviderRef) =>
    isKnownAgentProvider(provider) ? providerDisplayName(provider) : String(provider);
  const accountId = (runtime: BadgeRuntime) => runtime.providerAccountId ?? DEFAULT_PROVIDER_ACCOUNT_ID;
  const accountName = (runtime: BadgeRuntime) =>
    providerAccountName(
      t,
      props.agentStatus?.providers?.find((status) => status.id === runtime.provider)?.accounts ?? [],
      accountId(runtime),
    );
  const runtimeLabel = (runtime: BadgeRuntime, other: BadgeRuntime) => {
    const parts = [
      findModelOption(props.modelOptions, props.agentStatus?.providers, runtime.provider, runtime.model)?.name ??
        runtime.model,
    ];
    if (runtime.provider !== other.provider) parts.unshift(providerName(runtime.provider));
    else if (accountId(runtime) !== accountId(other)) parts.unshift(accountName(runtime));
    if (runtime.reasoningEffort !== other.reasoningEffort) parts.push(reasoningLabel(runtime.reasoningEffort, t));
    return parts.join(" · ");
  };
  const pendingModel = () => {
    const agent = props.agent;
    if (!agent || !(working() || runningThreads() > 0)) return undefined;
    const running: BadgeRuntime = (working() ? runningTurnRuntime() : null) ?? agent;
    const next: BadgeRuntime = agent.pendingRuntime ?? {
      provider: settingsProvider(),
      model: settingsModel(),
      reasoningEffort: settingsReasoning(),
      providerAccountId: agent.providerAccountId,
    };
    if (
      running.provider === next.provider &&
      running.model === next.model &&
      running.reasoningEffort === next.reasoningEffort &&
      accountId(running) === accountId(next)
    )
      return undefined;
    return { running: runtimeLabel(running, next), next: runtimeLabel(next, running) };
  };

  return (
    <>
      <SharedConversationHeader
        agent={props.agent}
        title={channel ? <channel.HeaderTitle onOpenSettings={() => setActiveRightPanel("settings")} /> : undefined}
        sessionTitle={props.agent ? mainSessionTitle() : undefined}
        onRenameSessionTitle={
          props.agent
            ? (nextTitle) => {
                if (props.agent) setStoredMainSessionTitle(props.server?.id, props.agent.id, nextTitle);
              }
            : undefined
        }
        onSettingsIntent={() => {
          if (channel) void loadAgentSettingsPanel();
        }}
        onOpenSettings={() => {
          if (channel) {
            setActiveRightPanel("settings");
          } else {
            setActiveRightPanel("none");
            setStarbotInspectorOpen(true);
          }
        }}
        onOpenChat={openMainChat()}
        titleSelected={titleSelected()}
        pendingModel={pendingModel()}
        extraActions={
          <Show when={props.agent}>
            {(ag) => (
              <DropdownMenu.Root
                placement="bottom-end"
                gutter={6}
                onOpenChange={(isOpen) => {
                  if (isOpen) void playKawaiiCue("drawer-open", { subtle: true });
                }}
              >
                <DropdownMenu.Trigger
                  class={`${buttonVariants({ variant: "ghost" })} header-panel-toggle starbot-header-menu-trigger no-drag`}
                  aria-label="对话与记忆"
                  title="全部对话与提炼记忆"
                  data-starbot-silent=""
                >
                  <MessagesSquare aria-hidden="true" class="size-[15px]" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content class="ui-action-menu starbot-header-dropdown">
                    <DropdownMenu.Sub gutter={6} overlap={false}>
                      <DropdownMenu.SubTrigger class="starbot-header-dropdown-item">
                        <History class="starbot-header-dropdown-icon" aria-hidden="true" />
                        <span class="starbot-header-dropdown-label">全部对话</span>
                        <Show when={allBotSessions().length > 1}>
                          <span class="starbot-header-dropdown-count">{allBotSessions().length}</span>
                        </Show>
                        <ChevronRight class="starbot-header-dropdown-chevron" aria-hidden="true" />
                      </DropdownMenu.SubTrigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.SubContent class="ui-action-menu starbot-threads-flyout">
                          <div class="starbot-threads-flyout-list" role="group" aria-label="全部对话列表">
                            <For each={allBotSessions()}>
                              {(session) => {
                                const isCurrent = () => !session.archived && activeThreadId() === session.id;
                                return (
                                  <DropdownMenu.Item
                                    class="starbot-threads-flyout-item"
                                    aria-current={isCurrent() ? "true" : undefined}
                                    data-current={isCurrent() ? "true" : undefined}
                                    onSelectAfterClose={() => openSessionInTabBar(session)}
                                  >
                                    <span
                                      class={[
                                        "starbot-threads-flyout-dot",
                                        {
                                          "is-current": isCurrent(),
                                          "is-working": session.working,
                                          "is-unread": session.unread > 0,
                                        },
                                      ]}
                                      aria-hidden="true"
                                    />
                                    <span class="starbot-threads-flyout-title" title={session.title}>
                                      {session.title}
                                    </span>
                                    <Show when={session.archived}>
                                      <span class="starbot-threads-flyout-tag">已归档</span>
                                    </Show>
                                    <span class="starbot-threads-flyout-time">
                                      {sidebarMessageTime(session.updatedAt, format)}
                                    </span>
                                  </DropdownMenu.Item>
                                );
                              }}
                            </For>
                          </div>
                          <Show when={allBotSessions().length > 10}>
                            <div class="starbot-threads-flyout-scroll-hint">下滑查看更多历史会话</div>
                          </Show>
                          <Show when={props.threads}>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item
                              class="starbot-threads-flyout-new"
                              onSelectAfterClose={() => {
                                void playKawaiiCue("open", { subtle: true });
                                startNewThread();
                              }}
                            >
                              <MessageCirclePlus class="size-3.5" aria-hidden="true" />
                              <span>新建子对话</span>
                            </DropdownMenu.Item>
                          </Show>
                        </DropdownMenu.SubContent>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Sub>

                    <DropdownMenu.Item
                      class="starbot-header-dropdown-item"
                      onSelectAfterClose={() => openMemoryCleanModal(ag().id)}
                    >
                      <Sparkles class="starbot-header-dropdown-icon" aria-hidden="true" />
                      <span class="starbot-header-dropdown-label">提炼记忆</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </Show>
        }
        modelPicker={{
          provider: settingsProvider(),
          foreignProvider: props.agent ? foreignProvider(props.agent.provider) : undefined,
          value: settingsModel(),
          reasoningEffort: settingsReasoning(),
          modelOptions: props.modelOptions,
          agentStatus: props.agentStatus,
          runtimeStatuses: props.providerRuntimeStatuses,
          customProviders: props.customProviders,
          customAgents: props.customAgents,
          onDownloadProvider: props.onDownloadProvider,
          onCancelProviderDownload: props.onCancelProviderDownload,
          onConnectProvider: props.onConnectProvider,
          canConnectProvider: props.canConnectProvider,
          onManageProviders: props.onManageProviders,
          disabledReason: t("conversation.header.modelsUnavailable"),
          accountChoice: true,
          providerAccountId: props.agent ? agentNextProviderAccountId(props.agent) : undefined,
          workspaceOnly: props.agent ? workspaceAccessEnforced(props.agent) : false,
          accountUsage: props.accountUsage,
          onChange: (model, provider, accountId, effort) =>
            void selectAndConfirmModel(model, provider, accountId, effort),
          onReasoningEffortChange: (effort) => void selectAndConfirmReasoning(effort),
          fastMode: fastMode(),
          ultrafast: ultrafast(),
          onFastModeChange: fastModeChange(),
        }}
        remoteControl={
          props.remoteDesktopEnabled !== false && props.server?.kind === "remote"
            ? {
                enabled: Boolean(props.remoteDesktopSessionActive || props.server.state === "online"),
                active: Boolean(props.remoteDesktopSessionActive),
                visible: Boolean(props.remoteDesktopVisible),
                onOpen: (trigger) => {
                  if (props.server) void props.onOpenRemoteDesktop(props.server.id, trigger);
                },
              }
            : undefined
        }
        threads={
          <Show when={props.threads}>
            {(threads) => (
              <ThreadHeader {...threads().header} onNew={startNewThread} onMoveToSide={moveThreadToPanel} />
            )}
          </Show>
        }
        pinnedMessages={platform.chatWindow ? pinnedMessages() : undefined}
        sidePanel={
          channel?.readOnly()
            ? undefined
            : channel
              ? {
                  open: sidePanelOpen(),
                  actingAgentName: actingBrowserControl()
                    ? (browserControlAgent()?.name ?? t("conversation.header.agentFallback"))
                    : undefined,
                  onToggle: toggleSidePanel,
                }
              : {
                  open: starbotInspectorOpen() || filePreviewOpen() || browserSidebarOpen(),
                  actingAgentName: actingBrowserControl()
                    ? (browserControlAgent()?.name ?? t("conversation.header.agentFallback"))
                    : undefined,
                  onToggle: () => {
                    if (filePreviewOpen() || browserSidebarOpen()) {
                      setActiveRightPanel("none");
                      setStarbotInspectorOpen(true);
                    } else {
                      setActiveRightPanel("none");
                      toggleStarbotInspector();
                    }
                  },
                }
        }
      />
      <Show when={props.agent && cleanModalAgentId() === props.agent.id ? props.agent : null}>
        {(ag) => (
          <StarBotMemoryCleanModal
            open={true}
            agentId={ag().id}
            agentName={ag().name}
            serverId={props.server?.id}
            memoriesPort={agentMemoriesPort(
              ag().id,
              ag().name,
              null,
              props.runtime?.agentMemories ?? window.starbot.agent,
            )}
            onDeleteHistory={props.onDeleteAgentHistory}
            onClearContext={props.onClearAgentContext}
            onClose={closeMemoryCleanModal}
          />
        )}
      </Show>
    </>
  );
}
