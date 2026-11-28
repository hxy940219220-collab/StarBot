import type { IdleRestartTarget, StarBotDesktopApi, UpdateStatus } from "@starbot/contracts/ipc";

export interface UpdatesPort {
  update: Pick<
    StarBotDesktopApi["update"],
    | "check"
    | "download"
    | "getStatus"
    | "install"
    | "onEvent"
    | "cancelScheduledRestart"
    | "restartWhenIdle"
    | "cancelIdleRestart"
    | "restartNow"
  >;
}

export function updatesPort(): UpdatesPort {
  return window.starbot;
}

export function idleRestartTarget(status: UpdateStatus): IdleRestartTarget {
  return status.phase === "ready" && status.managedByHost !== true ? "update" : "relaunch";
}
