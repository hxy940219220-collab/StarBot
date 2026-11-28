import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface BrowserPort {
  browser: Pick<
    StarBotDesktopApi["browser"],
    | "activate"
    | "close"
    | "dockPictureInPicture"
    | "dockWindow"
    | "getControlState"
    | "getDisplayState"
    | "getWindowModel"
    | "hidePictureInPicture"
    | "navigate"
    | "onDisplayState"
    | "onLiveViewEvent"
    | "onWindowEvent"
    | "onWindowModel"
    | "open"
    | "publishWindowModel"
    | "reload"
    | "sendLiveViewInput"
    | "sendWindowAction"
    | "setVisible"
    | "startLiveView"
    | "stop"
    | "stopLiveView"
  >;
}

export function browserPort(): BrowserPort {
  return window.starbot;
}
