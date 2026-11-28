import {
  type GithubSkillSource,
  type InstalledSkill,
  type InstallSkillInput,
  LOCAL_SERVER_ID,
  type StarBotDesktopApi,
  type SetEnabledSkillInput,
  type UninstallSkillInput,
} from "@starbot/contracts/ipc";

export interface SkillsPort {
  agent: Pick<
    StarBotDesktopApi["agent"],
    | "addMarketplaceAgent"
    | "cancelMcpSignIn"
    | "completeMcpSignInRelay"
    | "copyMcpSignInLink"
    | "getMcpAccess"
    | "installAgentSkill"
    | "listAgentSkills"
    | "listInstalledSkills"
    | "listMcpServers"
    | "listMcpSignIns"
    | "mcpSignInApp"
    | "mcpSignInPage"
    | "mcpSignInRelay"
    | "openMcpSignInRelay"
    | "onEvent"
    | "readGithubSkills"
    | "removeMcpServer"
    | "removeMcpSignInApp"
    | "saveMcpServer"
    | "saveMcpSignInApp"
    | "setAgentSkillEnabled"
    | "setMcpAccess"
    | "setMcpServerEnabled"
    | "signInMcpServer"
    | "signOutMcpServer"
    | "testMcpServer"
    | "uninstallAgentSkill"
  >;
  hostAdmin: Pick<StarBotDesktopApi["hostAdmin"], "getAgentAccess">;
  marketplaceAgents: Pick<StarBotDesktopApi["marketplaceAgents"], "get" | "getListing" | "install" | "list">;
  macAutomation: Pick<StarBotDesktopApi["macAutomation"], "request">;
  skills: Pick<
    StarBotDesktopApi["skills"],
    | "choosePackage"
    | "get"
    | "getBySlug"
    | "importPackage"
    | "install"
    | "list"
    | "listInstalled"
    | "localGet"
    | "localInstall"
    | "localList"
    | "setEnabled"
    | "uninstall"
  >;
}

export function skillsPort(): SkillsPort {
  return window.starbot;
}

export type SkillCatalogCalls = Pick<SkillsPort["skills"], "get" | "list">;

export interface AgentSkillCalls {
  listInstalled(agentId: string): Promise<InstalledSkill[]>;
  install(input: InstallSkillInput): Promise<InstalledSkill>;
  uninstall(input: UninstallSkillInput): Promise<void>;
  setEnabled(input: SetEnabledSkillInput): Promise<InstalledSkill>;
  readGithub?(link: string): Promise<GithubSkillSource>;
  onChanged?(listener: (agentId: string) => void): () => void;
}

export function agentSkillCalls(hostServerId?: string): AgentSkillCalls {
  const port = skillsPort();
  const onChanged = (listener: (agentId: string) => void) =>
    port.agent.onEvent((event) => {
      if (event.type === "skills-changed") listener(event.agentId);
    });
  if (!hostServerId)
    return {
      listInstalled: (agentId) => port.skills.listInstalled(agentId),
      install: (input) => port.skills.install(input),
      uninstall: (input) => port.skills.uninstall(input),
      setEnabled: (input) => port.skills.setEnabled(input),
      readGithub: (link) => port.agent.readGithubSkills(link, LOCAL_SERVER_ID),
      onChanged,
    };
  return {
    listInstalled: (agentId) => port.agent.listAgentSkills(agentId, hostServerId),
    install: (input) => port.agent.installAgentSkill(input, hostServerId),
    uninstall: (input) => port.agent.uninstallAgentSkill(input, hostServerId),
    setEnabled: (input) => port.agent.setAgentSkillEnabled(input, hostServerId),
    readGithub: (link) => port.agent.readGithubSkills(link, hostServerId),
    onChanged,
  };
}
