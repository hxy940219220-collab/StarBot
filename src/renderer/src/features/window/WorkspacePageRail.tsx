import { isUpdateActivePhase } from "@starbot/contracts/ipc";
import { CRM_CAPABILITY } from "@starbot/contracts/team-protocol/crm-v1";
import { requestFirstAgentTourReplay } from "@starbot/ui/features/agents/FirstAgentSetup";
import { PageRail, type PageRailPage } from "@starbot/ui/features/window/PageRail";
import { useText } from "@starbot/ui/text";
import { appPort } from "../../app-port";
import { useLayout } from "../../layout";
import { usePlatform } from "../../platform";
import { useAgents } from "../agents/agents-context";
import { useCustomAgents } from "../custom-agents/custom-agents-context";
import { serverHasStorage } from "../files/storage-usage";
import { activeServerHasProviderSettings, serverCanAdminister } from "../servers/server-capabilities";
import { useServerSettings } from "../servers/server-settings";
import { useServers } from "../servers/servers-context";
import { useSettings } from "../settings/settings-context";
import { useUpdates } from "../updates/updates-context";
import { useWhatsNew } from "../updates/whats-new-context";
import { usePlanLimitRows } from "../usage/plan-limit-rows";
import { useUsage } from "../usage/usage-context";
import { createWorkflowMediaCredits } from "../workflows/workflow-media-credits";
import { desktopMediaCredits } from "../workflows/workflows-port";
import { RailHelpMenu } from "./RailHelpMenu";
import { useWindowPage } from "./window-page-context";

export function WorkspacePageRail(props: { hidden: boolean }) {
  const text = useText();
  const windowPage = useWindowPage();
  const { openAgentSetup } = useAgents();
  const { openAppSettings, setSkillsMarketplaceOpen, setPendingPluginSlug, setPendingPluginConnect } = useSettings();
  const usage = useUsage();
  const updates = useUpdates();
  const layout = useLayout();
  const whatsNew = useWhatsNew();
  const { activeServer } = useServers();
  const platform = usePlatform();
  const { openServerSettings, serverSettingsTarget, serverSettingsShownSection } = useServerSettings();
  const logo = () => {
    const info = platform.appInfo();
    return info && info.platform !== "darwin" ? { variant: info.variant } : undefined;
  };
  const usageRows = usePlanLimitRows();
  const mediaCredits = createWorkflowMediaCredits(
    () => (windowPage.page() === "workflows" ? usage.state.serverId : null),
    desktopMediaCredits,
  );
  const { customAgentUsage } = useCustomAgents();
  const localAgentUsage = () => (activeServer()?.kind === "local" ? customAgentUsage() : []);
  const updateNotice = () => {
    const phase = updates.status().phase;
    if (!layout.leftPanelCompact() || !isUpdateActivePhase(phase)) return undefined;
    return text.t(phase === "ready" || phase === "installing" ? "account.update.ready" : "account.update.available");
  };
  const openProviders = () => {
    const server = activeServer();
    if (!server || !activeServerHasProviderSettings(server)) return undefined;
    return (button: HTMLElement) => openServerSettings(server.id, button, "providers");
  };
  const crmShown = () => serverCanAdminister(activeServer(), CRM_CAPABILITY) && usage.crmEnabled() === true;
  function crmRailAction(): ((button: HTMLElement) => void) | undefined {
    return crmShown() ? windowPage.openCrm : undefined;
  }
  function creditsRailAction(): (() => void) | undefined {
    return windowPage.creditsAvailable() ? () => windowPage.openCredits(null) : undefined;
  }
  function crmConnectorsAction(): ((button: HTMLElement) => void) | undefined {
    if (!crmShown()) return undefined;
    return (button) => windowPage.openCrm(button, true);
  }
  const current = (): PageRailPage | null => {
    const page = windowPage.page();
    if (page === "agents") return "agents";
    if (page === "server-settings") {
      const providers =
        serverSettingsShownSection() === "providers" && serverSettingsTarget()?.id === activeServer()?.id;
      return providers ? "providers" : "settings";
    }
    return page === "pricing" ? null : page;
  };
  return (
    <PageRail
      hidden={props.hidden}
      current={current()}
      pinned={layout.railPinned()}
      onPinChange={layout.setRailPinned}
      usageRows={usageRows()}
      customAgentUsage={localAgentUsage()}
      mediaCredits={mediaCredits()}
      onMediaCredits={(provider) => {
        windowPage.leavePricing();
        setPendingPluginConnect(false);
        setPendingPluginSlug(provider);
        setSkillsMarketplaceOpen(true);
      }}
      onAgents={() => windowPage.showAgents()}
      onSchedule={windowPage.openSchedule}
      onUsage={windowPage.openUsage}
      onLibrary={serverHasStorage(activeServer()) ? windowPage.openLibrary : undefined}
      onProviders={openProviders()}
      onCrm={crmRailAction()}
      onCrmConnectors={crmConnectorsAction()}
      onCredits={creditsRailAction()}
      creditBalance={windowPage.creditsMenu().state?.balance}
      onMarketplace={() => {
        windowPage.leavePricing();
        setSkillsMarketplaceOpen(true);
      }}
      onSettings={(button) => (updateNotice() ? openAppSettings(button, "updates") : windowPage.openSettings(button))}
      settingsNotice={updateNotice()}
      logo={logo()}
      help={
        <RailHelpMenu
          version={whatsNew.state.version}
          onOpenWhatsNew={whatsNew.reopen}
          onOpenLink={(destination) => void appPort().openExternal(destination)}
          onStartOnboardingTour={() => {
            setSkillsMarketplaceOpen(false);
            windowPage.leavePricing();
            openAgentSetup();
            requestFirstAgentTourReplay();
          }}
        />
      }
    />
  );
}
