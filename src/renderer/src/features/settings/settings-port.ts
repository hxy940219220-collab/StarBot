import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface SettingsPort {
  getAgentDefaults: StarBotDesktopApi["getAgentDefaults"];
  getAgentMemoryLimitPreference: StarBotDesktopApi["getAgentMemoryLimitPreference"];
  getAnalyticsPreference: StarBotDesktopApi["getAnalyticsPreference"];
  getAppBehaviorPreference: StarBotDesktopApi["getAppBehaviorPreference"];
  getApprovalAutomation: StarBotDesktopApi["getApprovalAutomation"];
  getBusyMessageModePreference: StarBotDesktopApi["getBusyMessageModePreference"];
  getExternalLinkPreference: StarBotDesktopApi["getExternalLinkPreference"];
  listExternalLinkBrowsers: StarBotDesktopApi["listExternalLinkBrowsers"];
  chooseExternalLinkApp: StarBotDesktopApi["chooseExternalLinkApp"];
  onExternalLinkFallback: StarBotDesktopApi["onExternalLinkFallback"];
  getRemoteNetworkRoute: StarBotDesktopApi["getRemoteNetworkRoute"];
  getRemoteSessionReusePreference: StarBotDesktopApi["getRemoteSessionReusePreference"];
  onAgentMemoryLimitPreference: StarBotDesktopApi["onAgentMemoryLimitPreference"];
  onAnalyticsPreference: StarBotDesktopApi["onAnalyticsPreference"];
  onApprovalAutomation: StarBotDesktopApi["onApprovalAutomation"];
  onOpenSettings: StarBotDesktopApi["onOpenSettings"];
  onOpenUpdateSettings: StarBotDesktopApi["onOpenUpdateSettings"];
  setAnalyticsPreference: StarBotDesktopApi["setAnalyticsPreference"];
  setAppBehaviorPreference: StarBotDesktopApi["setAppBehaviorPreference"];
  setExternalLinkPreference: StarBotDesktopApi["setExternalLinkPreference"];
  setRemoteNetworkRoute: StarBotDesktopApi["setRemoteNetworkRoute"];
  setRemoteSessionReusePreference: StarBotDesktopApi["setRemoteSessionReusePreference"];
  agent: Pick<
    StarBotDesktopApi["agent"],
    "listAgents" | "updateAgent" | "listAgentNotificationLevels" | "setAgentNotificationLevel" | "onScopedEvent"
  >;
  dynamicIsland: Pick<
    StarBotDesktopApi["dynamicIsland"],
    "getBuiltInDisplayGeometry" | "getPreference" | "onPreference" | "setPreference" | "setXWayland"
  >;
  notifications: Pick<StarBotDesktopApi["notifications"], "getPreference" | "openSettings" | "setPreference" | "test">;
  update: Pick<StarBotDesktopApi["update"], "getPreference" | "onPreference" | "setPreference">;
}

export function settingsPort(): SettingsPort {
  return window.starbot;
}
