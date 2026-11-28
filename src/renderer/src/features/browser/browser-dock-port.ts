import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface BrowserDockPort {
  agent: Pick<StarBotDesktopApi["agent"], "respondToBrowserSecret">;
  browserDock: Pick<
    StarBotDesktopApi["browserDock"],
    "getPresentation" | "onPresentation" | "performAction" | "setFrame"
  >;
}

export function browserDockPort(): BrowserDockPort {
  return window.starbot;
}
