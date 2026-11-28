import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface DynamicIslandPort {
  agent: Pick<StarBotDesktopApi["agent"], "acknowledgeFailedTurn" | "importAttachmentData" | "onScopedEvent">;
  dynamicIsland: Pick<
    StarBotDesktopApi["dynamicIsland"],
    | "getPreference"
    | "getPresentation"
    | "onAction"
    | "onGeometry"
    | "onPreference"
    | "onPresentation"
    | "performAction"
    | "performHaptic"
    | "publishPresentation"
    | "setInteractive"
    | "setInputRegion"
  >;
}

export function dynamicIslandPort(): DynamicIslandPort {
  return window.starbot;
}
