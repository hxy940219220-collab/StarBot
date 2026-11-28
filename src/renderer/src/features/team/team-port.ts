import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface TeamPort {
  servers: Pick<StarBotDesktopApi["servers"], "onPresence" | "setTyping">;
}

export function teamPort(): TeamPort {
  return window.starbot;
}
