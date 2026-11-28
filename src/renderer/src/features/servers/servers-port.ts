import type { StarBotDesktopApi, ServerSummary } from "@starbot/contracts/ipc";

export interface ServersPort {
  agent: Pick<
    StarBotDesktopApi["agent"],
    | "getStatus"
    | "listAgents"
    | "listConversationReads"
    | "listHiddenAgents"
    | "listAgentNotificationLevels"
    | "listMcpServers"
    | "listModels"
    | "removeMcpServer"
    | "saveMcpServer"
    | "setMcpServerEnabled"
    | "testMcpServer"
    | "signInMcpServer"
    | "mcpSignInPage"
    | "mcpSignInRelay"
    | "openMcpSignInRelay"
    | "completeMcpSignInRelay"
    | "cancelMcpSignIn"
    | "signOutMcpServer"
    | "listMcpSignIns"
    | "mcpSignInApp"
    | "saveMcpSignInApp"
    | "removeMcpSignInApp"
  >;
  events: StarBotDesktopApi["events"];
  auth: Pick<StarBotDesktopApi["auth"], "onEvent">;
  browser: Pick<StarBotDesktopApi["browser"], "setVisible">;
  hostAdmin: Pick<
    StarBotDesktopApi["hostAdmin"],
    "cancelUpdate" | "getUpdateStatus" | "restartHost" | "rotateHostKey" | "startUpdate" | "updateIdentity"
  >;
  hostedServers: Pick<
    StarBotDesktopApi["hostedServers"],
    "list" | "openCheckout" | "openCustomCheckout" | "restart" | "wake"
  >;
  localServers: StarBotDesktopApi["localServers"];
  host: Pick<
    StarBotDesktopApi["host"],
    | "configure"
    | "getRemoteControlPolicy"
    | "getStatus"
    | "onEvent"
    | "recheckScreenRecording"
    | "rotateIdentityKey"
    | "setRemoteControlPolicy"
    | "start"
    | "stop"
    | "stopRemoteControl"
    | "updateIdentity"
  >;
  notifications: Pick<StarBotDesktopApi["notifications"], "onOpened" | "onWorkflowOpened">;
  remoteDesktop: Pick<
    StarBotDesktopApi["remoteDesktop"],
    "checkSetup" | "connect" | "disconnect" | "list" | "openSetup" | "test"
  >;
  servers: Pick<
    StarBotDesktopApi["servers"],
    | "getPresenceFor"
    | "join"
    | "list"
    | "onEvent"
    | "onPresence"
    | "refreshIdentity"
    | "remove"
    | "reorder"
    | "retryConnection"
    | "select"
    | "setMuted"
    | "setNotificationLevel"
  >;
}

export function serversPort(): ServersPort {
  return window.starbot;
}

export type ServerAdminPort = Pick<
  StarBotDesktopApi["host"],
  "getPresence" | "listMembers" | "listInvites" | "createInvite" | "updateMember" | "removeMember" | "revokeInvite"
>;

export function serverAdminPort(server: Pick<ServerSummary, "id" | "kind">): ServerAdminPort {
  if (server.kind === "local") return window.starbot.host;
  const serverId = server.id;
  return {
    getPresence: () => window.starbot.servers.getPresenceFor(serverId),
    listMembers: () => window.starbot.servers.listMembers(serverId),
    listInvites: () => window.starbot.servers.listInvites(serverId),
    createInvite: (input) => window.starbot.servers.createInvite(input, serverId),
    updateMember: (input) => window.starbot.servers.updateMember(input, serverId),
    removeMember: (memberId) => window.starbot.servers.removeMember(memberId, serverId),
    revokeInvite: (inviteId) => window.starbot.servers.revokeInvite(inviteId, serverId),
  };
}

export async function activeServerId(): Promise<string> {
  if (!window.starbot) return "local";
  return (await window.starbot.servers.list()).find((item) => item.active)?.id ?? "local";
}
