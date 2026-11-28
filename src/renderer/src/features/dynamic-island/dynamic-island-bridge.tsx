import type { DynamicIslandAction, DynamicIslandAgentIdentity } from "@openbot/contracts/ipc";
import { classifyFailure } from "@openbot/telemetry";
import { sidebarAgentOrder } from "@openbot/ui/features/sidebar/sidebar-agent-order";
import { useText } from "@openbot/ui/text";
import { createEffect, onSettled, untrack } from "solid-js";
import { actionToast } from "../../action-toast";
import { withoutAgent } from "../../app-message-projection";
import { useNavigation } from "../../navigation";
import { usePlatform } from "../../platform";
import { useTurns } from "../../turns";
import { attentionByAgent, attentionEventKey, attentionOfAgent } from "../agents/agent-runtime-snapshot";
import { useAgents } from "../agents/agents-context";
import { useConversation } from "../conversation/conversation-context";
import { useConversationController } from "../conversation/conversation-controller-context";
import { promptRequestKey } from "../conversation/conversation-keys";
import { useServerScope } from "../servers/server-scope";
import { useServerSelection } from "../servers/server-selection";
import { useServerSwitch } from "../servers/server-switch";
import { useServers } from "../servers/servers-context";
import { useSidebar } from "../sidebar/sidebar-context";
import { useDynamicIsland } from "./dynamic-island-context";
import { dynamicIslandPort } from "./dynamic-island-port";
import { voiceIslandSnapshot } from "./voice-island-bridge";

function toIslandIdentity(agent: {
  id: string;
  name: string;
  avatarSeed: string;
  avatarHue?: DynamicIslandAgentIdentity["avatarHue"] | undefined;
  avatarColor?: DynamicIslandAgentIdentity["avatarColor"] | undefined;
  avatarUrl?: string | null | undefined;
}): DynamicIslandAgentIdentity {
  return {
    id: agent.id,
    name: agent.name.slice(0, 120),
    avatarSeed: agent.avatarSeed.slice(0, 160),
    avatarHue: agent.avatarHue ?? null,
    ...(agent.avatarColor ? { avatarColor: agent.avatarColor } : {}),
    avatarUrl: agent.avatarUrl && agent.avatarUrl.length <= 2_048 ? agent.avatarUrl : null,
  };
}

export function DynamicIslandBridge() {
  const { t, errorMessage } = useText();
  const platform = usePlatform();
  const { activeServerId } = useServers();
  const { dynamicIslandCoordinator, publishDynamicIslandPresentation, setDynamicIslandOverlayMeta } =
    useDynamicIsland();
  const { selectServer } = useServerSelection();
  const { loaded } = useServerScope();
  const { pendingIslandAction, setPendingIslandAction } = useServerSwitch();
  const { activeAgentId, agentList, userHiddenAgentIds, appendUiError } = useAgents();
  const { sidebarLayout, pinnedSidebarItems } = useSidebar();
  const {
    activeTurns,
    queues,
    pendingPrompts,
    setPendingPrompts,
    setSubmittedPromptRequests,
    pendingApprovals,
    forgetApproval,
    failedTurns,
    setFailedTurns,
  } = useTurns();
  const { unreadReplies, conversations, markAgentChatRead, clearRecentReply } = useConversation();
  const { selectAgent, openAgentMessage } = useNavigation();
  const { setBrowserTakeoverPageRequest } = useConversationController();
  let publishedAction: DynamicIslandAction | null = null;

  createEffect(
    () => {
      if (platform.landingPreview || !loaded()) return null;
      return {
        serverId: activeServerId(),
        agents: agentList(),
        activeTurns: activeTurns(),
        queues: queues(),
        unreadReplies: unreadReplies(),
        unreadMessageIds: Object.fromEntries(
          Object.entries(conversations).map(([agentId, conversation]) => [
            agentId,
            conversation.read?.firstUnreadMessageId ?? null,
          ]),
        ),
        liveMessages: Object.fromEntries(
          Object.entries(conversations).map(([id, conversation]) => [id, conversation.messages]),
        ),
        pendingPrompts: attentionByAgent(pendingPrompts(), agentList()),
        pendingApprovals: pendingApprovals(),
        failedTurns: failedTurns(),
      };
    },
    (input) => {
      if (!input) return;
      untrack(() => dynamicIslandCoordinator.replaceServer(input));
      publishDynamicIslandPresentation();
    },
  );

  // Sync active bot identity, ordered bot list, and live voice recording state to Dynamic Island
  createEffect(
    () => {
      if (platform.landingPreview || !loaded()) return null;
      const ordered = sidebarAgentOrder(agentList(), {
        layout: sidebarLayout(),
        pinnedItems: pinnedSidebarItems(),
        hiddenAgentIds: userHiddenAgentIds(),
      }).slice(0, 24);
      const currentId = activeAgentId();
      const chosen = ordered.find((a) => a.id === currentId) ?? ordered[0] ?? null;
      const voice = voiceIslandSnapshot();
      const voiceAgent = voice?.agentId ? (ordered.find((a) => a.id === voice.agentId) ?? chosen) : chosen;
      return {
        activeAgent: chosen ? toIslandIdentity(chosen) : null,
        agents: ordered.map(toIslandIdentity),
        recording: voice
          ? {
              phase: voice.phase,
              elapsedSeconds: voice.elapsedSeconds,
              liveText: voice.liveText.slice(0, 1_000),
              levels: voice.levels.slice(0, 16),
              agent: voiceAgent ? toIslandIdentity(voiceAgent) : null,
            }
          : null,
      };
    },
    (meta) => {
      if (!meta) return;
      setDynamicIslandOverlayMeta(meta);
      publishDynamicIslandPresentation();
    },
  );

  createEffect(
    () => ({ action: pendingIslandAction(), ready: loaded() }),
    ({ action, ready }) => {
      if (!action) return;
      if (action === publishedAction) return;
      if (activeServerId() !== action.serverId) {
        setPendingIslandAction(null);
        return;
      }
      if (!ready) return;
      setPendingIslandAction(null);
      void handleDynamicIslandAction(action).catch(() => undefined);
    },
  );

  onSettled(() => {
    if (platform.landingPreview) return;
    return dynamicIslandPort().dynamicIsland.onAction((action) => {
      void handleDynamicIslandAction(action).catch((error) => {
        actionToast.error(t("island.error.openRemoteTitle"), {
          ...{
            description: errorMessage(error, t("island.error.openRemote")),
          },
          report: { operation: "other", source: "action", cause_code: classifyFailure(error) },
        });
      });
    });
  });

  async function handleDynamicIslandAction(action: DynamicIslandAction): Promise<void> {
    if (
      action.type === "open-app" ||
      action.type === "send-message" ||
      action.type === "drop-feed" ||
      action.type === "stop-agent"
    )
      return;
    if (action.type === "answer-prompt") {
      dynamicIslandCoordinator.resolveAction(action);
      const prompt = attentionOfAgent(pendingPrompts(), action.agentId).find(
        (event) => event.type === "prompt" && String(event.requestId) === String(action.requestId),
      );
      if (prompt?.type === "prompt") {
        setPendingPrompts((current) => ({ ...current, [attentionEventKey(prompt)]: undefined }));
        setSubmittedPromptRequests((current) => ({
          ...current,
          [action.agentId]: promptRequestKey(prompt.turnId, prompt.requestId) ?? undefined,
        }));
      }
      publishDynamicIslandPresentation();
      return;
    }
    if (action.type === "respond-approval") {
      dynamicIslandCoordinator.resolveAction(action);
      forgetApproval(action.agentId, action.requestId);
      publishDynamicIslandPresentation();
      return;
    }
    if (action.type === "dismiss-failure") {
      dynamicIslandCoordinator.resolveAction(action);
      publishDynamicIslandPresentation();
      return;
    }
    if (action.type === "acknowledge-message") {
      dynamicIslandCoordinator.resolveAction(action);
      clearRecentReply(action.agentId);
      publishDynamicIslandPresentation();
      await markAgentChatRead(action.agentId, action.serverId);
      publishDynamicIslandPresentation();
      return;
    }
    if (activeServerId() !== action.serverId) {
      publishedAction = action;
      setPendingIslandAction(action);
      if (!(await selectServer(action.serverId, false)) && pendingIslandAction() === action) {
        setPendingIslandAction(null);
      }
      return;
    }
    if (!loaded()) {
      setPendingIslandAction(action);
      return;
    }
    const opened = selectAgent(action.agentId);
    if (action.type === "open-browser-takeover" && opened)
      setBrowserTakeoverPageRequest({ agentId: action.agentId, tabId: action.tabId });
    if (action.type === "open-message") await openAgentMessage(action.agentId, action.messageId);
    if (action.type === "open-failure") {
      try {
        await dynamicIslandPort().agent.acknowledgeFailedTurn({ agentId: action.agentId, turnId: action.turnId });
      } catch (error) {
        appendUiError(action.agentId, error, t("app.errorStatus.acknowledge"), action.serverId);
        return;
      }
      setFailedTurns((current) =>
        current[action.agentId] === action.turnId ? withoutAgent(current, action.agentId) : current,
      );
      dynamicIslandCoordinator.resolveAction(action);
      publishDynamicIslandPresentation();
    }
  }

  return null;
}
