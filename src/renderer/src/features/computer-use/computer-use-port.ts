import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface ComputerUsePort {
  computerUse: StarBotDesktopApi["computerUse"];
  remoteDesktop: Pick<StarBotDesktopApi["remoteDesktop"], "checkSetup">;
  update: Pick<StarBotDesktopApi["update"], "getStatus" | "restartWhenIdle">;
}

export function computerUsePort(): ComputerUsePort {
  return window.starbot;
}
