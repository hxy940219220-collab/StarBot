import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface RemoteDesktopPort {
  remoteDesktop: Pick<
    StarBotDesktopApi["remoteDesktop"],
    "connect" | "disconnect" | "list" | "onEvent" | "selectDisplay"
  >;
}

export function remoteDesktopPort(): RemoteDesktopPort {
  return window.starbot;
}
