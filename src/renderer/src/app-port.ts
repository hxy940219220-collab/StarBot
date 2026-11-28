import type { StarBotDesktopApi } from "@starbot/contracts/ipc";
import type { CompanySignInCalls } from "./features/servers/ServerCompanySignInSection";

export interface AppPort {
  getAppInfo: StarBotDesktopApi["getAppInfo"];
  getAppAppearancePreference: StarBotDesktopApi["getAppAppearancePreference"];
  getAppInterfaceSizePreference: StarBotDesktopApi["getAppInterfaceSizePreference"];
  getAppLanguagePreference: StarBotDesktopApi["getAppLanguagePreference"];
  getAppLogoColorPreference: StarBotDesktopApi["getAppLogoColorPreference"];
  listInstalledFonts: StarBotDesktopApi["listInstalledFonts"];
  onAppAppearancePreference: StarBotDesktopApi["onAppAppearancePreference"];
  onAppInterfaceSizePreference: StarBotDesktopApi["onAppInterfaceSizePreference"];
  onAppLanguagePreference: StarBotDesktopApi["onAppLanguagePreference"];
  onAppLogoColorPreference: StarBotDesktopApi["onAppLogoColorPreference"];
  openExternal: StarBotDesktopApi["openExternal"];
  getSentMessageStats: StarBotDesktopApi["getSentMessageStats"];
  reportRendererTiming: StarBotDesktopApi["reportRendererTiming"];
  openUrl: StarBotDesktopApi["openUrl"];
  openChatWindow: StarBotDesktopApi["openChatWindow"];
  getChatWindows: StarBotDesktopApi["getChatWindows"];
  onChatWindows: StarBotDesktopApi["onChatWindows"];
  onQuitShortcutHint: StarBotDesktopApi["onQuitShortcutHint"];
  setAppAppearancePreference: StarBotDesktopApi["setAppAppearancePreference"];
  setAppInterfaceSizePreference: StarBotDesktopApi["setAppInterfaceSizePreference"];
  setAppLanguagePreference: StarBotDesktopApi["setAppLanguagePreference"];
  setAppLogoColorPreference: StarBotDesktopApi["setAppLogoColorPreference"];
  agent: Pick<
    StarBotDesktopApi["agent"],
    "readConversationPage" | "searchConversationMessages" | "searchConversationFiles" | "listRoutines" | "listAgents"
  >;
  agentTemplates: Pick<StarBotDesktopApi["agentTemplates"], "onOpenLink" | "takePendingLink">;
  acpRegistry: StarBotDesktopApi["acpRegistry"];
  hostedSites: StarBotDesktopApi["hostedSites"];
  billing: StarBotDesktopApi["billing"];
  credits: StarBotDesktopApi["credits"];
  referral: StarBotDesktopApi["referral"];
  license: StarBotDesktopApi["license"];
  auth: CompanySignInCalls &
    Pick<
      StarBotDesktopApi["auth"],
      "listOwnerTransfers" | "acceptOwnerTransfer" | "declineOwnerTransfer" | "onOwnerTransfersChanged"
    >;
  hostedServers: StarBotDesktopApi["hostedServers"];
  routineFeed: StarBotDesktopApi["routineFeed"];
  events: StarBotDesktopApi["events"];
  plugins: Pick<StarBotDesktopApi["plugins"], "onOpenListing" | "takePendingListing">;
  marketplace: Pick<StarBotDesktopApi["marketplace"], "onOpenListing" | "takePendingListing">;
  servers: Pick<
    StarBotDesktopApi["servers"],
    "onInvite" | "takePendingInvite" | "getOwnerTransfer" | "startOwnerTransfer" | "cancelOwnerTransfer"
  >;
}

export function appPort(): AppPort {
  return window.starbot;
}
