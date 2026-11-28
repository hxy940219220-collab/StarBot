import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface SidebarPort {
  agent: Pick<
    StarBotDesktopApi["agent"],
    "getSidebarLayout" | "mutateSidebarLayout" | "getSidebarPins" | "setSidebarPins" | "seedSidebarPins"
  >;
  storage: Pick<StarBotDesktopApi["storage"], "getDisk" | "getMachineMetrics">;
  hostAdmin: Pick<StarBotDesktopApi["hostAdmin"], "getMachineAlerts">;
}

export type SidebarCardsPort = Pick<SidebarPort, "storage" | "hostAdmin">;

export function sidebarPort(): SidebarPort {
  return window.starbot;
}
