import type { ServerSummary } from "@openbot/contracts/ipc";
import type { AppTextKey } from "@openbot/i18n";
import { Bot, Brain, Button, HardDrive, Monitor, RefreshCw, Server, Sparkles, Store } from "@openbot/ui";
import { CONNECTOR_LISTINGS } from "@openbot/ui/features/connectors/connector-catalog";
import type { ConnectorId } from "@openbot/ui/features/connectors/connectors";
import { waitForSettingRow } from "@openbot/ui/features/conversation/agent-setting-links";
import { SettingsNavGroupLabel } from "@openbot/ui/features/settings/SettingsDialogShell";
import { createEffect, createMemo, createSignal, For, flush, onCleanup, Show } from "solid-js";
import { useI18n } from "../../i18n-context";
import { usePlatform } from "../../platform";
import { useConnectors } from "../connectors/connectors-context";
import { canManageStorage, serverHasBackgroundProcesses, serverHasStorage } from "../files/storage-usage";
import type { ServerSettingsSection } from "../servers/ServerSettingsModal";
import {
  activeServerHasProviderSettings,
  serverCanAdminister,
  serverHasAgentDefaults,
} from "../servers/server-capabilities";
import { useServerSettings } from "../servers/server-settings";
import { useServers } from "../servers/servers-context";
import { useSettings } from "../settings/settings-context";
import { navItem, navItems, type SettingsTab, settingsRowShown, settingsTabShown } from "../settings/settings-tabs";
import { SettingsPageFrame, SettingsSearchField } from "./SettingsPageFrame";
import { type SettingsKind, useWindowPage } from "./window-page-context";

type PersonalRow = {
  tab: SettingsTab;
  titleKey: AppTextKey;
  descriptionKey?: AppTextKey;
  anchor?: AppTextKey;
  macOS?: boolean;
};

type ServerRow = { section: ServerSettingsSection; titleKey: AppTextKey; descriptionKey?: AppTextKey };

type MarketplaceRow = { app: ConnectorId | null; titleKey: AppTextKey; descriptionKey?: AppTextKey };

type SearchRow = PersonalRow | ServerRow | MarketplaceRow;

type UnifiedNavEntry =
  | { kind: "server"; section: ServerSettingsSection; titleKey: AppTextKey; icon: typeof Sparkles }
  | { kind: "personal"; tab: SettingsTab; titleKey: AppTextKey; icon: typeof Sparkles };

type UnifiedNavGroup = {
  id: string;
  label: string;
  items: UnifiedNavEntry[];
};

const SEARCH_ROWS: ReadonlyArray<PersonalRow> = navItems.flatMap((item) => [
  { tab: item.value, titleKey: item.titleKey, descriptionKey: item.descriptionKey },
  ...item.rows.map((row) => ({ tab: item.value, ...row, anchor: row.titleKey })),
]);

const PROVIDERS_ROW: ServerRow = {
  section: "providers",
  titleKey: "server.settings.providersTitle",
  descriptionKey: "server.settings.providersDescription",
};

const MEMORY_ROW: ServerRow = {
  section: "memory",
  titleKey: "server.settings.memoryTitle",
  descriptionKey: "server.settings.memoryDescription",
};

const STORAGE_ROW: ServerRow = {
  section: "storage",
  titleKey: "server.settings.storageTitle",
  descriptionKey: "server.settings.storageDescription",
};

const DESKTOP_ROW: ServerRow = {
  section: "desktop",
  titleKey: "server.settings.desktopTitle",
  descriptionKey: "server.settings.desktopDescription",
};

const AGENTS_ROWS: ReadonlyArray<ServerRow> = [
  {
    section: "agents",
    titleKey: "server.settings.agentDefaultsTitle",
    descriptionKey: "server.settings.agentsDescription",
  },
  { section: "agents", titleKey: "agentSettings.automation.title" },
  { section: "agents", titleKey: "agentSettings.agentNewChat.title" },
  { section: "agents", titleKey: "agentSettings.quickAcknowledgement.title" },
  { section: "agents", titleKey: "settings.busyMessage.title", descriptionKey: "settings.busyMessage.description" },
];

const BACKGROUND_PROCESSES_ROW: ServerRow = {
  section: "storage",
  titleKey: "settings.backgroundProcesses.title",
  descriptionKey: "settings.backgroundProcesses.description",
};

const MARKETPLACE_APPS_ROW: MarketplaceRow = { app: null, titleKey: "app.settingsPage.marketplaceApps" };

const SEARCH_LIMIT = 14;

function serverHasMemorySettings(server: ServerSummary): boolean {
  const actionsAvailable = server.kind === "local" || server.state === "online";
  if (!actionsAvailable) return false;
  return (
    serverCanAdminister(server, "agent-memory-limit-v1") ||
    serverCanAdminister(server, "memory-review-v1") ||
    serverCanAdminister(server, "skill-learning-v1") ||
    serverCanAdminister(server, "browsing-memory-v1")
  );
}

function rankRows(query: string, rows: ReadonlyArray<SearchRow>, text: (key: AppTextKey) => string): SearchRow[] {
  const needle = query.toLocaleLowerCase();
  const score = (row: SearchRow) => {
    const title = text(row.titleKey).toLocaleLowerCase();
    if (title.startsWith(needle)) return 0;
    if (title.includes(needle)) return 1;
    return row.descriptionKey && text(row.descriptionKey).toLocaleLowerCase().includes(needle) ? 2 : 3;
  };
  return rows
    .map((row) => ({ row, rank: score(row) }))
    .filter((entry) => entry.rank < 3)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, SEARCH_LIMIT)
    .map((entry) => entry.row);
}

const ACCOUNT_TABS: readonly SettingsTab[] = ["profile", "mobile-connect"];
const DESKTOP_TABS: readonly SettingsTab[] = ["agent-dock", "dynamic-island", "computer-use"];
const GENERAL_TABS: readonly SettingsTab[] = ["general", "appearance", "notifications", "voice", "keyboard", "updates"];

export function SettingsPage(props: { kind: SettingsKind }) {
  const i18n = useI18n();
  const windowPage = useWindowPage();
  const settings = useSettings();
  const serverSettings = useServerSettings();
  const platform = usePlatform();
  const connectors = useConnectors();
  const { activeServer } = useServers();
  const [query, setQuery] = createSignal("");
  onCleanup(() => windowPage.setServerSettingsQuery(""));

  const targetServer = () =>
    (props.kind === "server" ? serverSettings.serverSettingsTarget() : activeServer()) ?? activeServer();

  const tabShown = (tab: SettingsTab) =>
    settingsTabShown(tab, { platform: platform.appInfo()?.platform, chatWindow: platform.chatWindow !== null });

  const serverNavItems = createMemo<UnifiedNavEntry[]>(() => {
    const server = targetServer();
    if (!server) return [];
    const items: UnifiedNavEntry[] = [];
    if (activeServerHasProviderSettings(server)) {
      items.push({ kind: "server", section: "providers", titleKey: "server.settings.providersTitle", icon: Sparkles });
    }
    if (serverHasAgentDefaults(server)) {
      items.push({ kind: "server", section: "agents", titleKey: "server.settings.agentDefaultsTitle", icon: Bot });
    }
    if (serverHasMemorySettings(server)) {
      items.push({ kind: "server", section: "memory", titleKey: "server.settings.memoryTitle", icon: Brain });
    }
    if (serverHasStorage(server)) {
      items.push({ kind: "server", section: "storage", titleKey: "server.settings.storageTitle", icon: HardDrive });
    }
    const plat = platform.appInfo()?.platform ?? "darwin";
    if (plat === "darwin" || server.kind === "local") {
      items.push({ kind: "server", section: "desktop", titleKey: "server.settings.desktopTitle", icon: Monitor });
    }
    if (server.kind === "remote") {
      items.push({ kind: "server", section: "updates", titleKey: "server.settings.updatesTitle", icon: RefreshCw });
    }
    return items;
  });

  const personalEntries = (tabs: readonly SettingsTab[]): UnifiedNavEntry[] =>
    tabs
      .filter((tab) => tabShown(tab))
      .map((tab) => {
        const meta = navItem(tab);
        return { kind: "personal", tab, titleKey: meta.titleKey, icon: meta.icon };
      });

  const navGroups = createMemo<UnifiedNavGroup[]>(() => {
    const groups: UnifiedNavGroup[] = [];
    const accountItems = personalEntries(ACCOUNT_TABS);
    if (accountItems.length > 0) {
      groups.push({ id: "account", label: "账号管理", items: accountItems });
    }
    const serverItems = serverNavItems();
    if (serverItems.length > 0) {
      groups.push({ id: "workspace", label: "模型与星友", items: serverItems });
    }
    const desktopItems = personalEntries(DESKTOP_TABS);
    if (desktopItems.length > 0) {
      groups.push({ id: "desktop", label: "桌面互动", items: desktopItems });
    }
    const generalItems = personalEntries(GENERAL_TABS);
    if (generalItems.length > 0) {
      groups.push({ id: "general", label: "通用与偏好", items: generalItems });
    }
    return groups;
  });

  const activeServerSection = () =>
    serverSettings.serverSettingsShownSection() ?? serverSettings.serverSettingsSection() ?? "providers";

  const activePersonalTab = () => {
    const tab = settings.appSettingsTab() ?? "general";
    return tab === "app-behavior" ? "general" : tab;
  };

  const isEntryActive = (entry: UnifiedNavEntry): boolean =>
    entry.kind === "server"
      ? props.kind === "server" && activeServerSection() === entry.section
      : props.kind === "personal" && activePersonalTab() === entry.tab;

  const openEntry = (entry: UnifiedNavEntry) => {
    if (entry.kind === "server") {
      const server = targetServer();
      if (server) serverSettings.openServerSettings(server.id, null, entry.section);
      return;
    }
    settings.openAppSettings(null, entry.tab);
  };

  const searchRows = (): SearchRow[] => {
    const server = targetServer();
    const personal = SEARCH_ROWS.filter(
      (row) => tabShown(row.tab) && settingsRowShown(row, platform.appInfo()?.platform),
    );
    if (!server) return personal;
    const plat = platform.appInfo()?.platform ?? "darwin";
    return [
      ...(activeServerHasProviderSettings(server) ? [PROVIDERS_ROW] : []),
      ...(serverHasAgentDefaults(server) ? AGENTS_ROWS : []),
      ...(serverHasMemorySettings(server) ? [MEMORY_ROW] : []),
      ...(serverHasStorage(server) ? [STORAGE_ROW] : []),
      ...(plat === "darwin" || server.kind === "local" ? [DESKTOP_ROW] : []),
      ...(serverHasBackgroundProcesses(server) &&
      canManageStorage(server) &&
      (server.kind === "local" || server.state === "online")
        ? [BACKGROUND_PROCESSES_ROW]
        : []),
      ...personal,
      MARKETPLACE_APPS_ROW,
      ...connectors.active.available().map(
        ({ id }): MarketplaceRow => ({
          app: id,
          titleKey: CONNECTOR_LISTINGS[id].title,
          descriptionKey: CONNECTOR_LISTINGS[id].tagline,
        }),
      ),
    ];
  };

  const results = () => (query().trim() ? rankRows(query().trim(), searchRows(), (key) => i18n.t(key)) : null);

  const resultStatus = () => {
    const rows = results();
    if (!rows) return "";
    return rows.length > 0
      ? i18n.t("app.settingsPage.resultCount", { count: rows.length })
      : i18n.t("app.settingsPage.noResults");
  };

  let content: HTMLElement | undefined;
  const [contentElement, setContentElement] = createSignal<HTMLElement | undefined>();

  const openResult = (row: SearchRow) => {
    setQuery("");
    if ("app" in row) {
      settings.setPendingPluginConnect(false);
      settings.setPendingPluginSlug(row.app);
      settings.setSkillsMarketplaceOpen(true);
      return;
    }
    if ("section" in row) {
      const server = targetServer();
      if (server) serverSettings.openServerSettings(server.id, null, row.section);
      return;
    }
    settings.openAppSettings(null, row.tab);
    flush();
    if (!content) return;
    for (const marked of content.querySelectorAll("[data-search-match]")) marked.removeAttribute("data-search-match");
    if (row.anchor) markRow(content, row.tab, row.anchor);
  };

  const markRow = (root: HTMLElement, tab: SettingsTab, anchor: AppTextKey): boolean => {
    const selector: string = `.settings-modal-tab-panel[data-tab="${tab}"] [data-settings-row="${anchor}"]`;
    const found = root.querySelector(selector);
    const target = found?.closest(".settings-modal-card > *") ?? found;
    if (!(target instanceof HTMLElement)) return false;
    for (const marked of root.querySelectorAll("[data-search-match]")) marked.removeAttribute("data-search-match");
    target.setAttribute("data-search-match", "");
    target.scrollIntoView({ block: "center" });
    target.querySelector<HTMLElement>("button, input, select, [tabindex]")?.focus({ preventScroll: true });
    return true;
  };

  let handledRowNonce = 0;
  createEffect(
    () => ({ request: settings.appSettingRowRequest(), root: contentElement() }),
    ({ request, root }) => {
      if (props.kind !== "personal" || !request || !root || request.nonce === handledRowNonce) return;
      handledRowNonce = request.nonce;
      if (markRow(root, request.tab, request.anchor)) return;
      return waitForSettingRow(root, () => markRow(root, request.tab, request.anchor));
    },
  );

  return (
    <SettingsPageFrame
      heading={
        <h1 class="settings-page-title" tabindex={-1}>
          设置
        </h1>
      }
      sectionsHidden={results() !== null}
      sections={
        <div class="settings-page-nav-group">
          <nav class="settings-modal-nav" aria-label="设置导航">
            <For each={navGroups()}>
              {(group) => (
                <>
                  <SettingsNavGroupLabel label={group.label} />
                  <For each={group.items}>
                    {(entry) => {
                      const Icon = entry.icon;
                      const selected = () => isEntryActive(entry);
                      return (
                        <button
                          type="button"
                          class="settings-modal-nav-item"
                          data-selected={selected() ? "" : undefined}
                          aria-current={selected() ? "page" : undefined}
                          onClick={() => openEntry(entry)}
                        >
                          <Icon aria-hidden="true" />
                          <span>{i18n.t(entry.titleKey)}</span>
                        </button>
                      );
                    }}
                  </For>
                </>
              )}
            </For>
          </nav>
        </div>
      }
      onMounts={(mounts) => {
        content = mounts?.content;
        setContentElement(mounts?.content);
        windowPage.setSettingsMounts(mounts);
      }}
      onEscape={() => {
        if (query()) setQuery("");
        else windowPage.showAgents();
      }}
      onClose={windowPage.showAgents}
    >
      <SettingsSearchField
        value={query()}
        onInput={setQuery}
        onEnter={() => {
          const top = results()?.[0];
          if (top) openResult(top);
        }}
      />
      <span class="sr-only" role="status">
        {resultStatus()}
      </span>
      <Show when={results()}>
        {(rows) => (
          <Show
            when={rows().length > 0}
            fallback={<p class="settings-page-empty">{i18n.t("app.settingsPage.noResults")}</p>}
          >
            <ul class="settings-page-results" aria-label={i18n.t("app.settingsPage.results")}>
              <For each={rows()}>
                {(row) => {
                  const tab = "section" in row || "app" in row ? null : navItem(row.tab);
                  const marketplace = "app" in row;
                  const PlaceIcon = tab ? tab.icon : marketplace ? Store : Server;
                  const place = () =>
                    tab ? i18n.t(tab.titleKey) : marketplace ? i18n.t("marketplace.title") : "模型与星友";
                  const titleKey =
                    "section" in row || "app" in row || row.anchor ? row.titleKey : navItem(row.tab).descriptionKey;
                  return (
                    <li>
                      <Button
                        variant="ghost"
                        type="button"
                        class="settings-page-result"
                        onClick={() => openResult(row)}
                      >
                        <span class="settings-page-result-section">
                          <PlaceIcon aria-hidden="true" />
                          {place()}
                        </span>
                        <span class="settings-page-result-title">{i18n.t(titleKey)}</span>
                      </Button>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </SettingsPageFrame>
  );
}
