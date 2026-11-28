import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface FilesPort {
  agent: Pick<StarBotDesktopApi["agent"], "listAgents">;
  storage: Pick<StarBotDesktopApi["storage"], "clear" | "deleteFile" | "getUsage" | "openFile"> &
    Partial<
      Pick<
        StarBotDesktopApi["storage"],
        | "getRemovableRuntimes"
        | "removeRemovableRuntimes"
        | "getMachineMetrics"
        | "getDisk"
        | "getLibraryFolders"
        | "changeLibraryFolders"
      >
    >;
  hostAdmin?: Pick<StarBotDesktopApi["hostAdmin"], "getMachineAlerts" | "setMachineAlerts">;
  backgroundProcesses?: Pick<StarBotDesktopApi["backgroundProcesses"], "list" | "stop">;
  onLibraryFoldersChanged?: (serverId: string, listener: () => void) => () => void;
}

export function filesPort(): FilesPort {
  const api = window.starbot;
  return {
    agent: api.agent,
    storage: api.storage,
    hostAdmin: api.hostAdmin,
    backgroundProcesses: api.backgroundProcesses,
    onLibraryFoldersChanged: (serverId, listener) =>
      api.agent.onScopedEvent((scoped) => {
        if (scoped.serverId === serverId && scoped.event.type === "library-folders-changed") listener();
      }),
  };
}
