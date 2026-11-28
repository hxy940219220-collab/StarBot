import type { DeleteSharedTableInput, StarBotDesktopApi, SharedTable } from "@starbot/contracts/ipc";

export interface ConversationPort {
  dynamicIsland: Pick<StarBotDesktopApi["dynamicIsland"], "openBrowserTakeover">;
  agent: Pick<
    StarBotDesktopApi["agent"],
    | "addPreviewPage"
    | "readAgentSessionSettings"
    | "listAgentNotificationLevels"
    | "askSideQuestion"
    | "saveSkillSuggestion"
    | "setAgentSessionSetting"
    | "resetAgentSessionSetting"
    | "onScopedEvent"
    | "deleteConversationMessage"
    | "deleteTable"
    | "listMemories"
    | "listPinnedMessages"
    | "listRoutines"
    | "listTables"
    | "markConversationRead"
    | "markConversationUnread"
    | "readConversationPage"
    | "releaseFilePreview"
    | "searchConversationMessages"
    | "sendMessage"
    | "setMessagePinned"
    | "withdrawFeedback"
  >;
  browser: Pick<
    StarBotDesktopApi["browser"],
    | "capturePreview"
    | "closeWindow"
    | "finishLocalSignIn"
    | "onLiveViewEvent"
    | "onWindowEvent"
    | "openLocalSignIn"
    | "sendLiveViewInput"
    | "startLiveView"
    | "stopLiveView"
  >;
  servers: Pick<
    StarBotDesktopApi["servers"],
    | "listDirectThreads"
    | "markDirectRead"
    | "onDirectMessage"
    | "onDirectTyping"
    | "readDirectConversationPage"
    | "sendDirectMessage"
    | "setDirectTyping"
  >;
  storage: Pick<StarBotDesktopApi["storage"], "openLocation">;
  hostAdmin: Pick<StarBotDesktopApi["hostAdmin"], "getAgentAccess">;
  browserDock: Pick<StarBotDesktopApi["browserDock"], "publishPresentation" | "onAction" | "onShown">;
}

export function conversationPort(): ConversationPort {
  return window.starbot;
}

export function releaseFilePreviewPage(pageUrl: string | undefined): void {
  if (!pageUrl) return;
  void conversationPort()
    .agent.releaseFilePreview(pageUrl)
    .catch(() => undefined);
}

export interface SharedTableCalls {
  listTables(): Promise<SharedTable[]>;
  deleteTable(input: DeleteSharedTableInput): Promise<void>;
}
