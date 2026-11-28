import type { SkillCategory } from "@openbot/contracts/ipc";
import { Button, Heading, Input, Plus, Search, Text } from "@openbot/ui";
import { useText } from "@openbot/ui/text";
import { createEffect, For, Match, Show, Switch, untrack } from "solid-js";
import { AgentLibrary, agentFromSource } from "./MarketplaceAgents";
import { AppRow } from "./MarketplaceCards";
import { MissingNotice } from "./MarketplaceParts";
import { GroupHead, MarketplaceSearch, SkillLibrary } from "./MarketplaceSkills";
import { CATEGORY_LABELS } from "./marketplace-listing";
import type { MarketplaceApp } from "./marketplace-model";
import {
  appCategories,
  MARKETPLACE_TABS,
  type MarketplaceScope,
  type MarketplaceTab,
  matchesApp,
} from "./marketplace-view";

const APP_GROUP_LIMIT = 6;

const NO_MATCH = {
  agents: "marketplace.noMatch.agents",
  apps: "marketplace.noMatch.apps",
  skills: "marketplace.noMatch.skills",
} as const;

const EMPTY = {
  agents: "marketplace.empty.agents",
  apps: "marketplace.empty.apps",
  skills: "marketplace.empty.skills",
} as const;

const SHOW_TAB = {
  agents: "marketplace.noMatch.showAgents",
  apps: "marketplace.noMatch.showApps",
  skills: "marketplace.noMatch.showSkills",
} as const;

function NoMatch(props: {
  scope: MarketplaceScope;
  tab: MarketplaceTab;
  counts: () => Record<MarketplaceTab, number>;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const { t } = useText();
  const nav = () => props.scope.nav;
  const searching = () => nav().state.query.trim() !== "";
  const others = () => MARKETPLACE_TABS.filter((tab) => tab !== props.tab && props.counts()[tab] > 0);
  return (
    <div class="marketplace-empty-inline">
      <Text as="p" variant="body-sm" tone="muted">
        {props.filtered ? t("marketplace.noMatch.filters") : searching() ? t(NO_MATCH[props.tab]) : t(EMPTY[props.tab])}
      </Text>
      <Show when={props.filtered || (searching() && others().length > 0)}>
        <div class="marketplace-empty-actions">
          <Show
            when={props.filtered}
            fallback={
              <For each={others()}>
                {(tab) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-cuelume-tap="select"
                    onClick={() =>
                      nav().set((draft) => {
                        draft.tab = tab;
                      })
                    }
                  >
                    {t(SHOW_TAB[tab], { count: props.counts()[tab] })}
                  </Button>
                )}
              </For>
            }
          >
            <Button type="button" variant="outline" size="sm" onClick={props.onClearFilters}>
              {t("marketplace.filter.clear")}
            </Button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export function createBrowseLists(scope: MarketplaceScope) {
  const { format } = useText();
  const model = () => scope.model;
  const state = () => scope.nav.state;
  const agents = () => scope.agents.items().filter((listing) => agentFromSource(listing, state().agentSource));
  const skills = () => scope.skills.items();
  const apps = () =>
    model()
      .apps()
      .filter((app) => matchesApp(app, state().query));
  const counts = (): Record<MarketplaceTab, number> => ({
    agents: agents().length,
    apps: apps().length,
    skills: skills().length,
  });
  return {
    agents,
    skills,
    apps,
    counts,
    searching: () => state().query.trim() !== "",
    countLabel: (tab: MarketplaceTab) => {
      const more = (tab === "agents" && scope.agents.hasMore()) || (tab === "skills" && scope.skills.hasMore());
      return `${format.number(counts()[tab])}${more ? "+" : ""}`;
    },
  };
}

export type BrowseLists = ReturnType<typeof createBrowseLists>;

function AppRows(props: { scope: MarketplaceScope; apps: readonly MarketplaceApp[] }) {
  return (
    <ul class="marketplace-app-list">
      <For each={props.apps} keyed={(app) => app.id}>
        {(app) => <AppRow scope={props.scope} app={app()} />}
      </For>
    </ul>
  );
}

const DOMESTIC_CURATED_IDS = new Set([
  "feishu",
  "jimeng-ai",
  "cn-wps",
  "wps",
  "dingtalk",
  "wecom",
  "tencent-docs",
  "kling-ai",
  "meitu-ai",
  "xiaohongshu",
  "baidu-netdisk",
  "qq-mail",
  "xmind",
  "tencent-map",
  "dida365",
  "apple-apps",
]);

const OVERSEAS_CURATED_IDS = new Set([
  "github",
  "google-gmail",
  "notion",
  "figma",
  "canva",
  "linear",
  "vercel",
  "cloudflare",
]);

function AppList(props: { scope: MarketplaceScope; lists: BrowseLists }) {
  const { t } = useText();
  const domesticApps = () => props.lists.apps().filter((app) => DOMESTIC_CURATED_IDS.has(app.id));
  const overseasApps = () => props.lists.apps().filter((app) => OVERSEAS_CURATED_IDS.has(app.id));
  const otherApps = () =>
    props.lists
      .apps()
      .filter((app) => app.kind === "custom" && !DOMESTIC_CURATED_IDS.has(app.id) && !OVERSEAS_CURATED_IDS.has(app.id));
  const usesCuratedShelves = () => domesticApps().length > 0 || overseasApps().length > 0;

  return (
    <Show
      when={props.lists.apps().length > 0}
      fallback={
        <NoMatch
          scope={props.scope}
          tab="apps"
          counts={props.lists.counts}
          filtered={false}
          onClearFilters={() => undefined}
        />
      }
    >
      <Show
        when={usesCuratedShelves()}
        fallback={
          <For each={appCategories(props.lists.apps())} keyed={(group) => group.category}>
            {(group) => (
              <section
                class="marketplace-app-group"
                aria-labelledby={`marketplace-apps-${group().category}`}
                data-marketplace-shared={props.scope.nav.state.appGroup === group().category ? "" : undefined}
              >
                <GroupHead
                  id={`marketplace-apps-${group().category}`}
                  label={t(CATEGORY_LABELS[group().category])}
                  count={group().apps.length}
                  more={group().apps.length > APP_GROUP_LIMIT}
                  onSeeAll={() => props.scope.nav.go({ kind: "appGroup", category: group().category })}
                />
                <AppRows scope={props.scope} apps={group().apps.slice(0, APP_GROUP_LIMIT)} />
              </section>
            )}
          </For>
        }
      >
        <Show when={otherApps().length > 0}>
          <section class="marketplace-app-group" aria-labelledby="marketplace-apps-custom">
            <GroupHead
              id="marketplace-apps-custom"
              label="自定义 MCP 服务"
              count={otherApps().length}
              more={false}
              onSeeAll={() => undefined}
            />
            <AppRows scope={props.scope} apps={otherApps()} />
          </section>
        </Show>
        <Show when={domesticApps().length > 0}>
          <section class="marketplace-app-group" aria-labelledby="marketplace-apps-domestic">
            <GroupHead
              id="marketplace-apps-domestic"
              label="国内常用生态"
              count={domesticApps().length}
              more={false}
              onSeeAll={() => undefined}
            />
            <AppRows scope={props.scope} apps={domesticApps()} />
          </section>
        </Show>
        <Show when={overseasApps().length > 0}>
          <section class="marketplace-app-group" aria-labelledby="marketplace-apps-overseas">
            <GroupHead
              id="marketplace-apps-overseas"
              label="海外主流精选"
              count={overseasApps().length}
              more={false}
              onSeeAll={() => undefined}
            />
            <AppRows scope={props.scope} apps={overseasApps()} />
          </section>
        </Show>
      </Show>
    </Show>
  );
}

export function AppGroupPage(props: { scope: MarketplaceScope; category: SkillCategory }) {
  const { t } = useText();
  const category = untrack(() => props.category);
  const nav = () => props.scope.nav;
  const label = () => t(CATEGORY_LABELS[category]);
  const apps = () =>
    appCategories(props.scope.model.apps().filter((app) => matchesApp(app, nav().state.query))).find(
      (group) => group.category === category,
    )?.apps ?? [];
  return (
    <div class="marketplace-view marketplace-browse marketplace-skill-group-page" data-marketplace-shared="">
      <header class="marketplace-browse-copy">
        <Heading as="h3" size="lg" class="marketplace-browse-title">
          {label()}
        </Heading>
      </header>
      <div class="marketplace-toolbar marketplace-skill-group-bar">
        <MarketplaceSearch nav={nav()} label={t("marketplace.skills.searchIn", { name: label() })} />
      </div>
      <Show
        when={apps().length > 0}
        fallback={
          <Text as="p" variant="body" tone="muted">
            {t("marketplace.noMatch.apps")}
          </Text>
        }
      >
        <section class="marketplace-skill-group-list" aria-label={label()}>
          <AppRows scope={props.scope} apps={apps()} />
        </section>
      </Show>
    </div>
  );
}

export function MarketplaceBrowse(props: { scope: MarketplaceScope; lists: BrowseLists }) {
  const { t } = useText();
  const model = () => props.scope.model;
  const nav = () => props.scope.nav;
  const state = () => props.scope.nav.state;

  createEffect(
    () => state().tab,
    (tab) => {
      if (tab === "skills") model().readSkills();
    },
  );

  const clearSkillSource = () =>
    nav().set((draft) => {
      draft.skillSource = null;
    });
  const clearAgentSource = () =>
    nav().set((draft) => {
      draft.agentSource = null;
    });

  return (
    <Switch>
      <Match when={state().tab === "skills"}>
        <SkillLibrary
          scope={props.scope}
          noMatch={
            <NoMatch
              scope={props.scope}
              tab="skills"
              counts={props.lists.counts}
              filtered={state().skillSource !== null}
              onClearFilters={clearSkillSource}
            />
          }
        />
      </Match>
      <Match when={state().tab === "agents"}>
        <AgentLibrary
          scope={props.scope}
          noMatch={
            <NoMatch
              scope={props.scope}
              tab="agents"
              counts={props.lists.counts}
              filtered={state().agentSource !== null}
              onClearFilters={clearAgentSource}
            />
          }
        />
      </Match>
      <Match when={state().tab === "apps"}>
        <div class="marketplace-view marketplace-browse">
          <header class="marketplace-browse-head">
            <div class="marketplace-browse-copy">
              <Heading as="h3" size="lg" class="marketplace-browse-title">
                {t("marketplace.tab.apps")}
              </Heading>
              <Text as="p" variant="body" tone="muted">
                {t("marketplace.description.apps")}
              </Text>
            </div>
            <div class="marketplace-toolbar">
              <label class="search-field marketplace-search">
                <Search aria-hidden="true" />
                <Input
                  type="search"
                  aria-label={t("marketplace.search.label")}
                  placeholder={t("marketplace.search.placeholder")}
                  value={state().query}
                  onInput={(event) => {
                    const value = event.currentTarget.value;
                    nav().set((draft) => {
                      draft.query = value;
                    });
                  }}
                />
              </label>
              <Show when={model().servers}>
                <Button type="button" size="sm" onClick={() => nav().go({ kind: "server", id: null })}>
                  <Plus aria-hidden="true" />
                  {t("marketplace.app.addCustom")}
                </Button>
              </Show>
            </div>
          </header>
          <div class="marketplace-stack">
            <Show when={state().missingApp}>
              <MissingNotice>{t("marketplace.plugins.missing")}</MissingNotice>
            </Show>
            <AppList scope={props.scope} lists={props.lists} />
          </div>
        </div>
      </Match>
    </Switch>
  );
}
