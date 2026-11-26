import { LOCAL_SERVER_ID } from "@openbot/contracts/ipc";
import { WORKSPACE_DIRECTORY_CAPABILITY } from "@openbot/contracts/team-protocol/workspace-directory-v1";
import { PanelResizer } from "@openbot/ui/components/PanelResizer";
import { settingsPanelMaxWidth } from "@openbot/ui/components/SettingsPanel";
import { BROWSER_NEW_TAB_URL } from "@openbot/ui/features/browser/browser-suggestions";
import {
  SidePanelHeader,
  SidePanelLauncher,
  type SidePanelPane,
  type SidePanelPaneBadge,
} from "@openbot/ui/features/conversation/SidePanel";
import { SideQuestionPanel } from "@openbot/ui/features/conversation/SideQuestionPanel";
import { SubagentPanel } from "@openbot/ui/features/conversation/Subagents";
import { ThreadsPane } from "@openbot/ui/features/conversation/threads/ThreadsPane";
import { VoicePill } from "@openbot/ui/features/conversation/VoicePill";
import { McpSignInRelayDialog } from "@openbot/ui/features/settings/McpSignInPage";
import { useText } from "@openbot/ui/text";
import { useChatBubbleStyle } from "../../chat-bubble-style-preference";
import {
  readSidePanelWidth,
  resetSidePanelWidth,
  SIDE_PANEL_DEFAULT,
  saveSidePanelWidth,
} from "../../components/side-panel-width";
import { deviceQuoteShortcut } from "../../send-shortcut-preference";
import { type AgentTemplatePublishCalls, agentTemplatesPort } from "../agent-templates/agent-templates-port";
import { createPublishAgent } from "../agent-templates/PublishAgent";
import type { ChatFilesSource } from "../files/ChatFilesPanel";
import { canManageStorage, serverHasChannelStorage, serverHasStorage } from "../files/storage-usage";
import { serverSupportsCapability } from "../servers/server-capabilities";
import { codexLiveAccess } from "../speech/codex-live-access";
import { speechPort } from "../speech/speech-port";
import { cycleSpeechSpeed, speechSpeed } from "../speech/speech-speed";
import { openedAttachmentUrl } from "./attachment-preview";
import { ConversationSideThread } from "./ConversationSideThread";
import { isChatVisualAppShortcut } from "./chat-visual-shortcuts";
import { htmlAttachmentPageUrl, htmlFilePageHtml } from "./chat-visual-url";
import { useConversationController } from "./conversation-controller-context";
import { conversationRuntime } from "./conversation-runtime";
import { useConversationViewScope } from "./conversation-scope";
import { type CodexLivePort, createCodexLiveConversation } from "./stores/codex-live-conversation-store";
import type { VoiceConversationKind } from "./stores/voice-session-store";
import { useVoiceTalkKey } from "./voice-talk-key";
import { setVoiceTalkMode, useVoiceTalkMode } from "./voice-talk-mode";

import { type HostFolderPick, HostFolderPicker } from "@openbot/ui/features/conversation/HostFolderPicker";
import { Portal } from "@solidjs/web";
import { createEffect, createMemo, createSignal, Loading, lazy, onSettled, Show, untrack } from "solid-js";
import { browseHostFolders } from "./agent-folders-port";

function VoiceConversationPane(pill: VoicePillPresence) {
  const controller = useConversationController();
  const { props } = useConversationViewScope();
  const running = untrack(() => (props.agent ? controller.voiceSessions.running(props.agent.id) : null));
  const runtimeLive = untrack(() => props.runtime?.liveVoice);
  if (runtimeLive) {
    const liveKind: VoiceConversationKind = running ?? "codex-live";
    return <VoiceConversation kind={liveKind} port={runtimeLive} open={pill.open} onClosed={pill.onClosed} />;
  }
  const codex = untrack(
    () =>
      (props.server?.kind !== "remote" || serverSupportsCapability(props.server, "live-voice-v1")) &&
      codexLiveAccess(props.agentStatus.providers) !== "signIn",
  );
  const [kind, setKind] = createSignal<VoiceConversationKind | null>(running ?? (codex ? null : "transcribed"));
  if (!running && codex)
    void speechPort()
      .voice.getSpeechSettings()
      .then(
        (settings) => setKind(settings.codexLive ? "codex-live" : "transcribed"),
        () => setKind("transcribed"),
      );
  return (
    <Show when={kind()} keyed>
      {(next) => <VoiceConversation kind={next} open={pill.open} onClosed={pill.onClosed} />}
    </Show>
  );
}

interface VoicePillPresence {
  open: boolean;
  onClosed: () => void;
}

function VoiceConversation(paneProps: VoicePillPresence & { kind: VoiceConversationKind; port?: CodexLivePort }) {
  const controller = useConversationController();
  const { props, startVoiceConversation, endVoiceConversation } = useConversationViewScope();
  const agentId = untrack(() => props.agent?.id);
  if (!agentId) return null;
  const serverId = untrack(() => props.server?.id ?? LOCAL_SERVER_ID);
  const kind = untrack(() => paneProps.kind);
  const port = untrack(() => paneProps.port);
  const conversation = controller.voiceSessions.open(agentId, kind, () =>
    kind === "codex-live"
      ? createCodexLiveConversation({ agentId, serverId, ...(port ? { port } : {}) })
      : startVoiceConversation(agentId),
  );
  const talkMode = useVoiceTalkMode();
  createEffect(talkMode, (mode) => conversation.setTalkMode(mode));
  const talkKey = useVoiceTalkKey(() => props.platform);
  const transcribed = kind === "transcribed";
  const replySpeed = () => (transcribed ? speechSpeed() : undefined);
  const cycleSpeed = transcribed ? cycleSpeechSpeed : undefined;
  return (
    <Show when={props.agent}>
      {(agent) => (
        <VoicePill
          agent={agent()}
          phase={conversation.phase()}
          muted={conversation.muted()}
          levels={conversation.levels()}
          error={conversation.error()}
          downloadProgress={conversation.downloadProgress()}
          onToggleMute={conversation.toggleMute}
          talkMode={talkMode()}
          onTalkModeChange={setVoiceTalkMode}
          talkKey={talkKey()}
          talking={conversation.talking()}
          onTalkStart={conversation.startTalking}
          onTalkEnd={conversation.stopTalking}
          onTalkCancel={conversation.cancelTalking}
          onInterrupt={conversation.interrupt}
          onEnd={endVoiceConversation}
          speed={replySpeed()}
          onCycleSpeed={cycleSpeed}
          open={paneProps.open}
          onClosed={paneProps.onClosed}
        />
      )}
    </Show>
  );
}

export function ConversationPanels(_panelProps: { onOpenUsage?: ((trigger: HTMLButtonElement) => void) | undefined }) {
  const bubbleStyle = useChatBubbleStyle();
  const {
    activateBrowserTab,
    activeBrowserTab,
    browserSidebarOpen,
    browserExpandedOpen,
    browserWindowShown,
    browserTabs,
    closeShownSidePanelFile,
    closeBrowserTab,
    downloadSidebarFile,
    revealSidebarFile,
    conversationPanelElement,
    filePreviewOpen,
    filesOpen,
    openBrowserAddress,
    openExternalMessageUrl,
    openSharedFile,
    previewAttachment,
    openSidebarFileExternally,
    openWorkspaceFolder,
    openWorkspaceFolderEntry,
    previewQuoteId,
    previewFileKey,
    previewWorkspaceAgentId,
    quoteSelection,
    addPageText,
    setPageContext,
    sidebarFileBack,
    openSidebarFileBack,
    props,
    setActiveRightPanel,
    sidePanelWidth,
    setSidePanelWidth,
    sidebarFilePreview,
    settingsOpen,
    messageLinkRelay,
    openMessageLinkRelay,
    pasteMessageLinkRelay,
    cancelMessageLinkRelay,
    activeRightPanel,
    sidePanel,
    sidePanelOpen,
    setSidePanelMaximized,
    openSidePanelPane,
    toggleSidePanel,
    closeSidePanelPane,
    openSidePanelFile,
    closeSidePanelFile,
    moveSidePanelFile,
    sideQuestion,
    setSideQuestionDraft,
    askSideQuestion,
    installedSkills,
    installedSkillsLoadFailed,
    mcpServers,
    voiceConversationOpen,
    panelSubagentId,
    shownPanelThreadId,
    openPanelThread,
    closePanelThread,
    movePanelThreadToChat,
    moveThreadToPanel,
    startNewThread,
    channel,
    replyJump,
  } = useConversationViewScope();
  const { t } = useText();
  const chatAgentKey = () => (props.agent ? `${props.server?.id ?? "local"}:${props.agent.id}` : null);
  const voiceKey = () => (voiceConversationOpen() && !channel && chatAgentKey()) || null;
  const [voicePill, setVoicePill] = createSignal<{ key: string } | null>(null);
  const [voicePillClosing, setVoicePillClosing] = createSignal(false);
  createEffect(
    () => ({ key: voiceKey(), chat: chatAgentKey() }),
    ({ key, chat }) => {
      const shown = untrack(voicePill);
      if (key) {
        if (shown?.key !== key || untrack(voicePillClosing)) setVoicePill({ key });
        setVoicePillClosing(false);
      } else if (shown && shown.key === chat) setVoicePillClosing(true);
      else {
        setVoicePill(null);
        setVoicePillClosing(false);
      }
    },
  );
  const publishCalls = (): AgentTemplatePublishCalls => {
    if (props.runtime?.admin) return props.runtime.admin.agentTemplates;
    const server = props.server;
    if (server?.kind !== "remote") return agentTemplatesPort().agentTemplates;
    const { agent } = agentTemplatesPort();
    return {
      preview: (agentId) => agent.previewAgentTemplate(agentId, server.id),
      publish: (input) => agent.publishAgentTemplate(input, server.id),
      unpublish: (agentId) => agent.unpublishAgentTemplate(agentId, server.id),
    };
  };
  const publishAgent = createPublishAgent((url) => void conversationRuntime(props).openUrl(url), publishCalls);
  const [folderPick, setFolderPick] = createSignal<
    (HostFolderPick & { serverId: string; agentId: string; done: (path: string | null) => void }) | null
  >(null);
  const finishFolderPick = (path: string | null) => {
    const pick = folderPick();
    setFolderPick(null);
    pick?.done(path);
  };
  const webFolderApi = createMemo(() => props.runtime?.agentFolders);
  const browsePickFolders = (path: string | null) => {
    const pick = folderPick();
    if (!pick) return Promise.reject(new Error(t("agentSettings.folders.browse.failed")));
    return browseHostFolders(pick.serverId, pick.agentId, path, webFolderApi());
  };
  const storageReachable = () => !props.runtime || props.runtime.storageCalls !== undefined;
  let browserPreviewTrigger: HTMLButtonElement | undefined;
  const filesSource = (): ChatFilesSource | undefined => {
    if (channel) return { scope: "channel", channelId: channel.id };
    const threadId = props.agent?.threadId;
    return threadId ? { scope: "conversation", conversationId: threadId } : undefined;
  };
  const filesServer = () => {
    const server = props.server;
    if (!storageReachable()) return undefined;
    if (channel) return serverHasChannelStorage(server) ? server : undefined;
    return serverHasStorage(server) ? server : undefined;
  };
  const filesTitle = () => channel?.name() ?? props.agent?.name ?? "this chat";
  const workspaceAgents = createMemo(() => {
    if (!serverSupportsCapability(props.server, WORKSPACE_DIRECTORY_CAPABILITY)) return [];
    if (!channel) return props.agent ? [props.agent] : [];
    const agentIds = channel.memberAgentIds();
    return props.agents.filter((agent) => agentIds.has(agent.id));
  });
  const openAgentWorkspace = (agentId: string) => openWorkspaceFolder(".", agentId, "tab");
  function showFileMessage(messageId: string) {
    if (channel) void replyJump.reveal(messageId, undefined, undefined);
    else void props.onOpenSearchMessage?.(messageId);
  }
  const channelBrowserPane = () => !channel || channel.browserOwner() !== null || browserTabs().length > 0;
  const sidePanelPanes = createMemo((): SidePanelPane[] => [
    ...(props.browserEnabled !== false && channelBrowserPane() ? (["browser"] as const) : []),
    ...(filesServer() && filesSource() ? (["files"] as const) : []),
    ...(props.agent && !channel && props.threads ? (["threads"] as const) : []),
    ...(channel ? (["settings"] as const) : []),
  ]);
  const panelSubagent = createMemo(() => {
    const subagentId = panelSubagentId();
    if (!subagentId) return undefined;
    const threads = props.threads;
    const sideMessages = (threads?.side.tabs ?? []).map(
      (tab) => threads?.side.thread(tab.id)?.conversation?.messages ?? [],
    );
    const openThreadMessages = threads?.conversation?.messages ?? [];
    for (const messages of [props.messages, openThreadMessages, ...sideMessages])
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const found = messages[index]?.subagents?.find((subagent) => subagent.id === subagentId);
        if (found) return found;
      }
    return undefined;
  });
  const sidePanelMaxWidth = () => settingsPanelMaxWidth(conversationPanelElement());
  createEffect(
    () => ({ expanded: browserExpandedOpen(), suspended: props.globalOverlayOpen || props.remoteDesktopVisible }),
    ({ expanded, suspended }) => {
      if (!expanded || suspended) return;
      const frame = conversationPanelElement()?.closest<HTMLElement>(".app-frame");
      if (!frame) return;
      const wasInert = frame.inert;
      frame.inert = true;
      return () => {
        frame.inert = wasInert;
      };
    },
  );
  createEffect(browserSidebarOpen, (open, previous) => {
    if (open && previous === false) onSettled(() => browserPreviewTrigger?.focus());
  });
  const selectedPane = () => (activeRightPanel() === "side-panel" ? null : sidePanel().selected);
  const shownThread = () => (activeRightPanel() === "thread" ? shownPanelThreadId() : null);
  const busyBrowserTabIds = createMemo(
    () => new Set(props.browserControlState.sessions.flatMap((session) => (session.tabId ? [session.tabId] : []))),
  );
  const isAgentDirectChat = () => Boolean(props.agent && !channel);
  const launcherShown = () =>
    !isAgentDirectChat() &&
    (activeRightPanel() === "side-panel" || (activeRightPanel() === "thread" && shownPanelThreadId() === null));
  const shownFile = () => (filePreviewOpen() ? sidePanel().file : null);
  const sidePanelResizer = (controls: string) => (
    <PanelResizer
      class="right-panel-resizer"
      label={t("conversation.sidePanel.resize")}
      controls={controls}
      direction="right"
      value={sidePanelWidth()}
      defaultValue={SIDE_PANEL_DEFAULT}
      min={SIDE_PANEL_DEFAULT}
      max={sidePanelMaxWidth}
      onResize={setSidePanelWidth}
      onResizeEnd={saveSidePanelWidth}
      onParentResize={() => setSidePanelWidth(Math.round(Math.min(sidePanelMaxWidth(), readSidePanelWidth())))}
      onReset={() => {
        resetSidePanelWidth();
        setSidePanelWidth(SIDE_PANEL_DEFAULT);
      }}
    />
  );
  const sideThreadTabs = () => props.threads?.side.tabs ?? [];
  const moveSideThread = (id: string, index: number) => props.threads?.side.onMove(id, index);
  const sideThreadIds = createMemo(() => sideThreadTabs().map((thread) => thread.id));
  const listedThreads = createMemo(() => {
    const header = props.threads?.header;
    if (!header) return [];
    return [...header.tabs.filter((thread) => thread.kind === "draft"), ...header.threads];
  });
  const sidePanelBadges = createMemo((): Partial<Record<SidePanelPane, SidePanelPaneBadge>> => {
    const waiting = listedThreads().filter((thread) => thread.status.kind === "waiting").length;
    return waiting > 0
      ? { threads: { count: waiting, label: t("conversation.threads.waitingCount", { count: waiting }) } }
      : {};
  });
  const openListedThread = (id: string) => {
    if (sideThreadIds().includes(id)) movePanelThreadToChat(id);
    else props.threads?.header.onOpen(id);
  };
  const toggleListedThreadBeside = (id: string) => {
    if (sideThreadIds().includes(id)) movePanelThreadToChat(id);
    else moveThreadToPanel(id);
  };
  return (
    <>
      <HostFolderPicker request={folderPick()} browse={browsePickFolders} onDone={finishFolderPick} />
      <Show when={sidePanelOpen() && (!isAgentDirectChat() || browserSidebarOpen())}>
        <SidePanelHeader
          panes={sidePanel().panes}
          selected={selectedPane()}
          available={sidePanelPanes()}
          badges={sidePanelBadges()}
          maximized={sidePanel().maximized}
          settingsLabel={channel ? t("channel.settings.title") : undefined}
          onSelect={openSidePanelPane}
          onClose={closeSidePanelPane}
          threads={{
            items: sideThreadTabs(),
            selectedId: shownThread(),
            onSelect: openPanelThread,
            onClose: closePanelThread,
            onMove: moveSideThread,
            onToChat: movePanelThreadToChat,
            onArchive: props.threads?.header.onArchive,
            onDelete: props.threads?.header.onDelete,
          }}
          files={{
            items: sidePanel().files,
            selectedKey: shownFile(),
            onSelect: openSidePanelFile,
            onClose: closeSidePanelFile,
            onMove: moveSidePanelFile,
          }}
          onToggleMaximized={() => setSidePanelMaximized(!sidePanel().maximized)}
          onCollapse={toggleSidePanel}
          onNewBrowserTab={() => {
            openSidePanelPane("browser");
            void openBrowserAddress(BROWSER_NEW_TAB_URL, true);
          }}
        />
      </Show>

      <Show when={launcherShown()}>
        <aside
          id="side-panel-launcher"
          class="browser-panel side-panel-empty"
          aria-label={t("conversation.sidePanel.label")}
        >
          {sidePanelResizer("side-panel-launcher")}
          <SidePanelLauncher
            available={sidePanelPanes()}
            badges={sidePanelBadges()}
            settingsLabel={channel ? t("channel.settings.title") : undefined}
            onOpen={openSidePanelPane}
          />
        </aside>
      </Show>

      <Show when={filePreviewOpen() && sidebarFilePreview()}>
        {(file) => {
          const attached = () => {
            const source = file().source;
            return source.kind === "attachment" ? source.attachment : null;
          };
          return (
            <Loading>
              <FilePreviewPanel
                allowExternalOpen={!props.runtime}
                macWindowControls={props.platform === "darwin"}
                preview={file().preview}
                directory={file().directory ?? null}
                agents={props.agents}
                maxWidth={sidePanelMaxWidth}
                onWidthChange={setSidePanelWidth}
                onOpenLink={(url) => void openExternalMessageUrl(url)}
                onOpenSharedFile={(path) => openSharedFile(path, "here")}
                onOpenWorkspaceFile={previewWorkspaceAgentId() ? openWorkspaceFolderEntry : undefined}
                onOpenWorkspaceFolder={openWorkspaceFolder}
                onBack={sidebarFileBack() === null ? undefined : openSidebarFileBack}
                sourceUrl={openedAttachmentUrl(attached()?.previewUrl)}
                pageUrl={htmlAttachmentPageUrl(attached()) ?? file().preview?.pageUrl}
                pageHtml={props.runtime?.visualPage ? htmlFilePageHtml(attached(), file().preview) : undefined}
                fileKey={previewFileKey()}
                selectionQuoteId={previewQuoteId()}
                onPageQuote={(text) => {
                  const quoteId = previewQuoteId();
                  if (quoteId) quoteSelection(quoteId, text);
                }}
                onPageContext={(text) => {
                  const id = attached()?.id;
                  const message = id && props.messages.find((item) => item.attachments?.some((file) => file.id === id));
                  if (message) setPageContext(message, text);
                }}
                onPageMessage={addPageText}
                isPageAppShortcut={isChatVisualAppShortcut}
                quoteShortcut={deviceQuoteShortcut(props.platform)}
                onOpenExternally={openSidebarFileExternally}
                onDownload={downloadSidebarFile}
                onReveal={props.runtime ? undefined : revealSidebarFile}
                onClose={closeShownSidePanelFile}
              />
            </Loading>
          );
        }}
      </Show>

      <Show when={filesOpen() && filesServer()}>
        {(server) => (
          <Show when={filesSource()}>
            {(source) => (
              <Loading>
                <ChatFilesPanel
                  serverId={server().id}
                  source={source()}
                  conversationTitle={filesTitle()}
                  canManage={canManageStorage(server())}
                  onClose={() => closeSidePanelPane("files")}
                  onPreviewFile={(file) => void previewAttachment(file)}
                  onShowMessage={showFileMessage}
                  calls={props.runtime?.storageCalls}
                  workspaceAgents={workspaceAgents()}
                  onOpenWorkspace={openAgentWorkspace}
                />
              </Loading>
            )}
          </Show>
        )}
      </Show>

      <Show when={activeRightPanel() === "question" && props.agent}>
        {(agent) => (
          <SideQuestionPanel
            agent={agent()}
            bubbleStyle={bubbleStyle()}
            agents={props.agents}
            exchanges={sideQuestion().exchanges}
            skills={installedSkills()}
            skillsLoadFailed={installedSkillsLoadFailed()}
            mcpServers={mcpServers()}
            error={sideQuestion().error}
            draft={sideQuestion().draft}
            focusRequest={sideQuestion().focusRequest}
            onDraftChange={setSideQuestionDraft}
            onAsk={askSideQuestion}
            onClosePanel={() => closeSidePanelPane("question")}
            resizer={sidePanelResizer("side-question-panel")}
            onOpenLink={(url) => void openExternalMessageUrl(url)}
            macWindowControls={props.platform === "darwin"}
          />
        )}
      </Show>

      <Show when={voicePill()} keyed>
        {(shown) => (
          <VoiceConversationPane
            open={!voicePillClosing()}
            onClosed={() => {
              if (voicePill() !== shown) return;
              setVoicePill(null);
              setVoicePillClosing(false);
            }}
          />
        )}
      </Show>

      <Show when={shownThread()} keyed>
        {(threadId) => <ConversationSideThread threadId={threadId} resizer={sidePanelResizer("side-thread-panel")} />}
      </Show>

      <Show when={activeRightPanel() === "threads" && sidePanelPanes().includes("threads")}>
        <ThreadsPane
          threads={listedThreads()}
          activeId={props.threads?.header.activeId ?? ""}
          besideIds={sideThreadIds()}
          canStartNew={props.threads?.header.canStartNew ?? false}
          resizer={sidePanelResizer("threads-panel")}
          onOpen={openListedThread}
          onToggleBeside={toggleListedThreadBeside}
          onNew={startNewThread}
        />
      </Show>

      <Show when={activeRightPanel() === "subagent"}>
        <SubagentPanel
          subagent={panelSubagent()}
          agentName={props.agent?.name ?? ""}
          onClosePanel={() => closeSidePanelPane("subagent")}
          resizer={sidePanelResizer("subagent-panel")}
        />
      </Show>

      <Show when={browserSidebarOpen() || browserExpandedOpen()}>
        <BrowserPreviewSidebar
          tabs={browserTabs()}
          busyTabIds={busyBrowserTabIds()}
          hidden={browserExpandedOpen()}
          suspended={props.browserVisibilitySuspended || props.globalOverlayOpen || props.remoteDesktopVisible}
          contextKey={`${props.server?.id ?? "local"}:${props.agent?.id ?? ""}`}
          maxWidth={sidePanelMaxWidth}
          onWidthChange={setSidePanelWidth}
          capturePreview={props.runtime?.browser.capturePreview}
          onOpenTab={(tabId, trigger) => {
            browserPreviewTrigger = trigger;
            if (activeBrowserTab()?.id !== tabId) activateBrowserTab(tabId);
            setActiveRightPanel("browser-expanded");
          }}
          onCloseTab={(tabId) => void closeBrowserTab(tabId)}
          onNewTab={() => void openBrowserAddress(BROWSER_NEW_TAB_URL, true)}
        />
      </Show>

      <Show when={browserSidebarOpen() || browserExpandedOpen()}>
        <Portal>
          <div class="ui-dialog-overlay browser-expanded-backdrop" hidden={!browserExpandedOpen()} aria-hidden="true" />
          <BrowserFullViewAdapter />
        </Portal>
      </Show>

      <Show when={browserWindowShown()}>
        <BrowserWindowBridge />
      </Show>

      {channel ? (
        <Show when={settingsOpen()}>
          <channel.SettingsPane
            maxWidth={sidePanelMaxWidth}
            onWidthChange={setSidePanelWidth}
            onClose={() => closeSidePanelPane("settings")}
          />
        </Show>
      ) : null}

      {publishAgent.dialog()}
      <Show when={messageLinkRelay()} keyed>
        {(relay) => (
          <McpSignInRelayDialog
            name={relay.page.authorizeHost}
            hostName={props.server?.name ?? ""}
            page={relay.page}
            onOpen={openMessageLinkRelay}
            onPaste={pasteMessageLinkRelay}
            onCancel={cancelMessageLinkRelay}
          />
        )}
      </Show>
    </>
  );
}

const BrowserFullViewAdapter = lazy(() => import("./BrowserFullViewAdapter"));
const BrowserWindowBridge = lazy(() => import("./BrowserWindowBridge"));
const FilePreviewPanel = lazy(() => import("./FilePreviewPanel"));
const ChatFilesPanel = lazy(() => import("../files/ChatFilesPanel"));

const BrowserPreviewSidebar = lazy(() => import("./BrowserPreviewSidebar"));
