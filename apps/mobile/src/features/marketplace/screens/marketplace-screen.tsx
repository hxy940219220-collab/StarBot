import { router, useLocalSearchParams } from "expo-router";
import { Button, Spinner, Typography } from "heroui-native";
import Plus from "lucide-react-native/icons/plus";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, ScrollView, View, type ViewInstance } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsNote, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { RowIcon } from "@/features/settings/components/settings-row-icon";
import { useMobileWorkspaceSelector } from "@/features/workspace/context/mobile-workspace-context";
import { AndroidBlurTarget } from "@/shared/components/android-header-blur";
import { GLASS_CAPSULE_HEIGHT } from "@/shared/components/glass-capsule";
import { LargeTitle, LargeTitleBar, useLargeTitleScroll } from "@/shared/components/large-title";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";
import { typeScale } from "@/shared/lib/type-scale";
import { AgentCard, FeaturedAgent, ListingRow } from "../components/marketplace-parts";
import { MarketplaceSearchBar } from "../components/marketplace-search-bar";
import {
  byPopularity,
  installsOf,
  isMarketplaceFiltered,
  type MarketplaceFilter,
  type MarketplaceListing,
  marketplaceFilterTokens,
  matchesFilter,
  NO_MARKETPLACE_FILTER,
} from "../model/marketplace-listings";
import {
  type MarketplaceCatalog,
  type MarketplaceInstalled,
  useMarketplaceCatalog,
  useMarketplaceInstalled,
} from "../model/use-marketplace";

const OVERVIEW_ROWS = 8;

export function MarketplaceScreen() {
  const { t } = useText();
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const server = useMobileWorkspaceSelector((workspace) => workspace.servers.find((item) => item.id === serverId));
  const canManageMcp = useMobileWorkspaceSelector((workspace) => workspace.canManageMcpServers(serverId));
  const scroll = useLargeTitleScroll();
  const blurTarget = useRef<ViewInstance>(null);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<MarketplaceFilter>(NO_MARKETPLACE_FILTER);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const catalog = useMarketplaceCatalog({ serverId, query, filter });
  const installed = useMarketplaceInstalled(serverId);
  const title = t("mobile.app.route.marketplace");

  const openListing = (item: MarketplaceListing) => {
    if (item.kind === "app" && item.source === "connector") {
      router.push({ pathname: "/server-settings/connector", params: { serverId, id: item.connector } });
      return;
    }
    if (item.kind === "app" && item.source === "custom") {
      router.push({ pathname: "/server-settings/mcp-server", params: { serverId, mcpServerId: item.server.id } });
      return;
    }
    router.push({
      pathname: "/marketplace-listing",
      params: { serverId, kind: item.kind, id: item.id, name: item.name },
    });
  };

  const addCustomMcp = canManageMcp
    ? () => {
        void haptics.selection();
        router.push({ pathname: "/server-settings/mcp-server", params: { serverId } });
      }
    : undefined;

  const listMode = isMarketplaceFiltered(filter) || catalog.search.length > 0;

  let content: ReactNode;
  if (!server) {
    content = <SettingsNote>{t("mobile.server.unavailable")}</SettingsNote>;
  } else if (listMode) {
    content = (
      <FilteredList
        listings={catalog.listings.filter((item) => matchesFilter(item, filter, installed.installed))}
        filter={filter}
        pending={catalog.pending}
        more={catalog}
        installed={installed}
        onOpen={openListing}
        onAddCustom={addCustomMcp}
        onClear={() => {
          void haptics.selection();
          setFilter(NO_MARKETPLACE_FILTER);
          setQuery("");
        }}
      />
    );
  } else {
    content = (
      <Overview
        listings={catalog.listings}
        pending={catalog.pending}
        installed={installed}
        onOpen={openListing}
        onAddCustom={addCustomMcp}
      />
    );
  }

  return (
    <View className="flex-1 bg-sheet">
      <AndroidBlurTarget target={blurTarget} surface="sheet">
        <Animated.ScrollView
          className="flex-1"
          style={{ marginLeft: insets.left, marginRight: insets.right }}
          contentInsetAdjustmentBehavior={scroll.ownsInset ? "never" : "always"}
          contentContainerStyle={{
            paddingTop: scroll.ownsInset ? scroll.headerHeight : 0,
            paddingBottom: insets.bottom + GLASS_CAPSULE_HEIGHT + 32,
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onScroll={scroll.onScroll}
        >
          <LargeTitle scroll={scroll} title={title} caption={server?.name} />
          <View className="gap-6 pt-3">{content}</View>
        </Animated.ScrollView>
      </AndroidBlurTarget>
      <LargeTitleBar scroll={scroll} title={title} surface="sheet" blurTarget={blurTarget} />
      {server ? (
        <MarketplaceSearchBar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          focused={focused}
          onFocusedChange={setFocused}
        />
      ) : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-5">
      <Typography.Heading type="h4">{title}</Typography.Heading>
    </View>
  );
}

function Overview({
  listings,
  pending,
  installed,
  onOpen,
  onAddCustom,
}: {
  listings: MarketplaceListing[];
  pending: boolean;
  installed: MarketplaceInstalled;
  onOpen: (listing: MarketplaceListing) => void;
  onAddCustom?: () => void;
}) {
  const { t } = useText();
  const agents = listings.filter((item) => item.kind === "agent").sort(byPopularity);
  const apps = listings.filter((item) => item.kind === "app");
  const skills = listings.filter((item) => item.kind === "skill").sort(byPopularity);
  const featured = agents.reduce<MarketplaceListing | undefined>(
    (top, item) => (top === undefined || installsOf(item) > installsOf(top) ? item : top),
    undefined,
  );
  const shelf = agents.filter((item) => item !== featured);

  return (
    <>
      {/* Curated Mainstream Apps directly visible without "See all" bloat */}
      <View className="gap-3">
        <SectionHeader title={t("mobile.marketplace.overview.apps")} />
        <View className="gap-3 px-4">
          <SettingsSection rowsDrawSeparators>
            {apps.map((item) => (
              <ListingRow
                key={item.id}
                listing={item}
                installed={installed.installed(item)}
                showKind={false}
                onPress={() => onOpen(item)}
              />
            ))}
          </SettingsSection>
          {onAddCustom ? (
            <SettingsSection>
              <SettingsRow disclosure={false} leading={<RowIcon icon={Plus} tone="accent" />} onPress={onAddCustom}>
                <Typography.Paragraph className="text-accent">
                  {t("mobile.marketplace.app.addCustom")}
                </Typography.Paragraph>
              </SettingsRow>
            </SettingsSection>
          ) : null}
        </View>
      </View>

      {featured ? (
        <View className="px-4">
          <FeaturedAgent
            listing={featured}
            installed={installed.installed(featured)}
            onPress={() => onOpen(featured)}
          />
        </View>
      ) : null}

      {shelf.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title={t("mobile.marketplace.overview.agents")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
            {shelf.slice(0, OVERVIEW_ROWS).map((item) => (
              <AgentCard
                key={item.id}
                listing={item}
                installed={installed.installed(item)}
                onPress={() => onOpen(item)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {skills.length > 0 ? (
        <View className="gap-3">
          <SectionHeader title={t("mobile.marketplace.overview.skills")} />
          <View className="px-4">
            <SettingsSection rowsDrawSeparators>
              {skills.slice(0, OVERVIEW_ROWS).map((item) => (
                <ListingRow
                  key={item.id}
                  listing={item}
                  installed={installed.installed(item)}
                  showKind={false}
                  onPress={() => onOpen(item)}
                />
              ))}
            </SettingsSection>
          </View>
        </View>
      ) : null}

      {pending && apps.length === 0 ? <Spinner className="self-center" /> : null}
    </>
  );
}

function FilteredList({
  listings,
  filter,
  pending,
  more,
  installed,
  onOpen,
  onAddCustom,
  onClear,
}: {
  listings: MarketplaceListing[];
  filter: MarketplaceFilter;
  pending: boolean;
  more: Pick<MarketplaceCatalog, "hasMore" | "loadingMore" | "loadMoreFailed" | "loadMore">;
  installed: MarketplaceInstalled;
  onOpen: (listing: MarketplaceListing) => void;
  onAddCustom?: () => void;
  onClear: () => void;
}) {
  const { t } = useText();
  const parts = marketplaceFilterTokens(filter, t).map((token) => token.label);
  return (
    <View className="gap-3 px-4">
      {parts.length > 0 ? (
        <View className="flex-row items-baseline justify-between px-1">
          <Typography.Paragraph
            numberOfLines={1}
            className="min-w-0 flex-1 text-grouped-secondary"
            style={typeScale.preview}
          >
            {parts.join(" · ")}
          </Typography.Paragraph>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear}>
            <Typography.Paragraph className="text-accent-text" style={typeScale.preview}>
              {t("mobile.marketplace.filter.clear")}
            </Typography.Paragraph>
          </Pressable>
        </View>
      ) : null}
      {filter.kind === "app" && onAddCustom ? (
        <SettingsSection>
          <SettingsRow disclosure={false} leading={<RowIcon icon={Plus} tone="accent" />} onPress={onAddCustom}>
            <Typography.Paragraph className="text-accent">{t("mobile.marketplace.app.addCustom")}</Typography.Paragraph>
          </SettingsRow>
        </SettingsSection>
      ) : null}
      {listings.length > 0 ? (
        <SettingsSection rowsDrawSeparators>
          {listings.map((item) => (
            <ListingRow
              key={`${item.kind}:${item.id}`}
              listing={item}
              installed={installed.installed(item)}
              showKind={filter.kind === null}
              onPress={() => onOpen(item)}
            />
          ))}
        </SettingsSection>
      ) : pending ? (
        <Spinner className="self-center" />
      ) : (
        <SettingsNote>{t("mobile.marketplace.empty")}</SettingsNote>
      )}
      {more.loadMoreFailed ? <SettingsNote>{t("mobile.marketplace.loadFailed")}</SettingsNote> : null}
      {more.hasMore ? (
        <Button
          variant="secondary"
          className="self-center"
          isDisabled={more.loadingMore}
          onPress={() => void more.loadMore()}
        >
          <Button.Label>{t("mobile.marketplace.loadMore")}</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
