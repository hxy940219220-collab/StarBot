import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface AccountPort {
  agent: Pick<StarBotDesktopApi["agent"], "getUsage">;
  auth: Pick<
    StarBotDesktopApi["auth"],
    | "cancelMobileConnect"
    | "createMobileConnect"
    | "createMobileConnectLink"
    | "getMobileConnectLink"
    | "getState"
    | "listAccountSessions"
    | "listMobileConnectedDevices"
    | "logout"
    | "onEvent"
    | "openCompanySignIn"
    | "requestEmailCode"
    | "retry"
    | "revokeAccountSession"
    | "revokeMobileConnectedDevice"
    | "revokeMobileConnectLink"
    | "updateAvatar"
    | "updateChatColor"
    | "updateName"
    | "verifyEmailCode"
  >;
}

export function accountPort(): AccountPort {
  return window.starbot;
}
