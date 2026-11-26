import type { MobileTextKey } from "@openbot/i18n/mobile";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import Briefcase from "lucide-react-native/icons/briefcase";
import Clock from "lucide-react-native/icons/clock";
import Compass from "lucide-react-native/icons/compass";
import Heart from "lucide-react-native/icons/heart";
import LayoutGrid from "lucide-react-native/icons/layout-grid";
import Mic from "lucide-react-native/icons/mic";
import Plus from "lucide-react-native/icons/plus";
import Sparkles from "lucide-react-native/icons/sparkles";
import Square from "lucide-react-native/icons/square";
import Trash2 from "lucide-react-native/icons/trash";
import User from "lucide-react-native/icons/user";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable, useUniwind } from "uniwind";
import { useQueryScope } from "@/features/auth/context/mobile-session-context";
import {
  deleteVaultItem,
  inferVaultCategory,
  loadPersonalVault,
  upsertVaultItem,
  usePersonalVaultStore,
  VAULT_CATEGORIES,
  type VaultBubbleItem,
  type VaultCategoryId,
} from "@/features/memory-vault/model/personal-vault";
import { useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { queryKeys } from "@/features/workspace/model/query-keys";
import { LargeTitleScrollView } from "@/shared/components/large-title";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { speechRecognition } from "@/shared/lib/speech-recognition";
import { useText } from "@/shared/lib/text";
import { setUiSoundsSuppressed, uiFeedback } from "@/shared/lib/ui-feedback";

const BRAND_PURPLE = "#7c3aed";

const CATEGORY_LABEL_KEY: Readonly<Record<VaultCategoryId, MobileTextKey>> = {
  basic: "mobile.app.vault.catBasic",
  habits: "mobile.app.vault.catHabits",
  recent: "mobile.app.vault.catRecent",
  experience: "mobile.app.vault.catExperience",
  preferences: "mobile.app.vault.catPreferences",
  social: "mobile.app.vault.catSocial",
  passions: "mobile.app.vault.catPassions",
};

const CATEGORY_PROMPT_KEY: Readonly<Record<VaultCategoryId, MobileTextKey>> = {
  basic: "mobile.app.vault.promptBasic",
  habits: "mobile.app.vault.promptHabits",
  recent: "mobile.app.vault.promptRecent",
  experience: "mobile.app.vault.promptExperience",
  preferences: "mobile.app.vault.promptPreferences",
  social: "mobile.app.vault.promptSocial",
  passions: "mobile.app.vault.promptPassions",
};

const CATEGORY_ICON: Readonly<
  Record<VaultCategoryId, ComponentType<{ color?: string; size?: number; strokeWidth?: number }>>
> = {
  basic: User,
  habits: Clock,
  recent: Compass,
  experience: Briefcase,
  preferences: Heart,
  social: Users,
  passions: Sparkles,
};

export function MemoryVaultScreen() {
  const { t } = useText();
  const { theme } = useUniwind();
  const dark = theme === "dark";
  const insets = useSafeAreaInsets();
  const queryScope = useQueryScope();
  const queryClient = useQueryClient();
  const workspace = useMobileWorkspace();
  const serverId = workspace.activeServer.id;
  const online = workspace.activeServer.state === "online";
  const serverAgents = useMemo(
    () => workspace.agents.filter((agent) => agent.serverId === serverId),
    [workspace.agents, serverId],
  );

  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const cardBg = dark ? "#1f1f26" : "#ffffff";
  const sheetBg = String(useCSSVariable("--openbot-bg-sheet") ?? "#ffffff");
  const borderColor = String(useCSSVariable("--openbot-border-grouped") ?? "rgba(15,23,42,0.08)");
  const iconMutedColor = String(foreground);

  const localItems = usePersonalVaultStore((state) => state.items);
  const [selectedFilter, setSelectedFilter] = useState<"all" | VaultCategoryId>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultBubbleItem | null>(null);
  const [draftCategory, setDraftCategory] = useState<VaultCategoryId>("basic");
  const [draftText, setDraftText] = useState("");
  const [listening, setListening] = useState(false);
  const baseTextBeforeDictation = useRef("");

  useEffect(() => {
    void loadPersonalVault();
  }, []);

  const botMemoryQueries = useQueries({
    queries: serverAgents.map((agent) => ({
      queryKey: queryKeys.agentRecord(queryScope, serverId, agent.id, "memories"),
      queryFn: () => workspace.loadAgentMemories(agent.id, serverId),
      enabled: Boolean(online && serverId),
      staleTime: 30_000,
      retry: false,
    })),
  });

  const combinedItems = useMemo<VaultBubbleItem[]>(() => {
    const seenTexts = new Set(localItems.map((item) => item.text.toLowerCase()));
    const botItems: VaultBubbleItem[] = [];
    serverAgents.forEach((agent, idx) => {
      const list = botMemoryQueries[idx]?.data ?? [];
      for (const mem of list) {
        const { category, cleanText } = inferVaultCategory(mem.text);
        if (!cleanText || seenTexts.has(cleanText.toLowerCase())) continue;
        seenTexts.add(cleanText.toLowerCase());
        botItems.push({
          id: `bot-${agent.id}-${mem.id}`,
          category,
          text: cleanText,
          source: "bot",
          botName: agent.name,
          botAgentId: agent.id,
          serverMemoryId: mem.id,
          updatedAt: Date.parse(mem.updatedAt) || Date.now(),
        });
      }
    });
    return [...localItems, ...botItems].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [localItems, serverAgents, botMemoryQueries]);

  const filteredItems = useMemo(
    () => (selectedFilter === "all" ? combinedItems : combinedItems.filter((item) => item.category === selectedFilter)),
    [combinedItems, selectedFilter],
  );

  useEffect(() => {
    if (!speechRecognition) return;
    const subs = [
      speechRecognition.addListener("result", (event) => {
        const spoken = event.results?.[0]?.transcript?.trim() ?? "";
        if (!spoken) return;
        const prefix = baseTextBeforeDictation.current;
        setDraftText(prefix ? `${prefix} ${spoken}` : spoken);
      }),
      speechRecognition.addListener("end", () => {
        setListening(false);
        setUiSoundsSuppressed(false);
      }),
      speechRecognition.addListener("error", () => {
        setListening(false);
        setUiSoundsSuppressed(false);
      }),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, []);

  const stopDictation = () => {
    if (!listening) return;
    try {
      speechRecognition?.stop();
    } catch {}
    setListening(false);
    setUiSoundsSuppressed(false);
  };

  const toggleDictation = async () => {
    if (listening) {
      stopDictation();
      uiFeedback.confirm();
      return;
    }
    if (!speechRecognition) return;
    try {
      const perm = await speechRecognition.getPermissionsAsync();
      if (!perm.granted) {
        const asked = await speechRecognition.requestPermissionsAsync();
        if (!asked.granted) return;
      }
      baseTextBeforeDictation.current = draftText.trim();
      setUiSoundsSuppressed(true);
      setListening(true);
      speechRecognition.start({
        lang: "zh-CN",
        interimResults: true,
        continuous: true,
      });
    } catch {
      setListening(false);
      setUiSoundsSuppressed(false);
    }
  };

  const openAddModal = (category: VaultCategoryId = selectedFilter === "all" ? "basic" : selectedFilter) => {
    uiFeedback.open();
    setEditingItem(null);
    setDraftCategory(category);
    setDraftText("");
    setEditorOpen(true);
  };

  const openEditModal = (item: VaultBubbleItem) => {
    uiFeedback.tap();
    setEditingItem(item);
    setDraftCategory(item.category);
    setDraftText(item.text);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    stopDictation();
    setEditorOpen(false);
  };

  const handleSave = async () => {
    const clean = draftText.trim();
    if (!clean) return;
    stopDictation();
    uiFeedback.confirm();

    const categoryMeta = VAULT_CATEGORIES.find((c) => c.id === draftCategory) ?? VAULT_CATEGORIES[0];
    const catTitle = t(CATEGORY_LABEL_KEY[draftCategory]);
    const taggedForServer = `[${catTitle}] ${clean}`;

    if (editingItem?.source === "bot" && editingItem.botAgentId && editingItem.serverMemoryId) {
      const targetBotId = editingItem.botAgentId;
      upsertVaultItem({ category: draftCategory, text: clean, source: "self" });
      void workspace
        .saveAgentMemory(targetBotId, taggedForServer, serverId, editingItem.serverMemoryId)
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.agentRecord(queryScope, serverId, targetBotId, "memories"),
          }),
        )
        .catch(() => undefined);
    } else {
      upsertVaultItem({
        id: editingItem?.source === "self" ? editingItem.id : undefined,
        category: draftCategory,
        text: clean,
        source: "self",
      });
      const primaryBot = serverAgents[0];
      if (!editingItem && primaryBot && online && categoryMeta) {
        void workspace
          .saveAgentMemory(primaryBot.id, `${categoryMeta.desktopTag} ${clean}`, serverId)
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: queryKeys.agentRecord(queryScope, serverId, primaryBot.id, "memories"),
            }),
          )
          .catch(() => undefined);
      }
    }
    setEditorOpen(false);
  };

  const handleDelete = () => {
    if (!editingItem) return;
    stopDictation();
    uiFeedback.recCancel();
    if (editingItem.source === "self") {
      deleteVaultItem(editingItem.id);
    } else if (editingItem.botAgentId && editingItem.serverMemoryId) {
      const targetBotId = editingItem.botAgentId;
      void workspace
        .deleteAgentMemory(targetBotId, editingItem.serverMemoryId, serverId)
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.agentRecord(queryScope, serverId, targetBotId, "memories"),
          }),
        )
        .catch(() => undefined);
    }
    setEditorOpen(false);
  };

  return (
    <>
      <LargeTitleScrollView title={t("mobile.app.vault.title")} contentContainerClassName="gap-4 px-4 pt-2 pb-36">
        {/* Clean Symmetrical Calibration Guide Card */}
        <View
          className="flex-row items-center gap-3.5 rounded-2xl p-4"
          style={{
            backgroundColor: "rgba(124, 58, 237, 0.08)",
            borderWidth: 1,
            borderColor: "rgba(124, 58, 237, 0.18)",
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(124, 58, 237, 0.16)",
            }}
          >
            <Sparkles color={BRAND_PURPLE} size={18} strokeWidth={2.1} />
          </View>
          <View className="flex-1 gap-0.5">
            <Typography className="font-bold text-sm text-foreground">{t("mobile.app.vault.subtitle")}</Typography>
            <Typography className="text-xs leading-4.5 text-text-secondary">
              {t("mobile.app.vault.guideBanner")}
            </Typography>
          </View>
        </View>

        {/* Strictly Uniform 36pt Filter Chips (identical height, icon size, and baseline alignment!) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChipPill
            icon={LayoutGrid}
            label={t("mobile.app.vault.catAll")}
            count={combinedItems.length}
            active={selectedFilter === "all"}
            cardBg={cardBg}
            borderColor={borderColor}
            iconColor={iconMutedColor}
            onPress={() => setSelectedFilter("all")}
          />

          {VAULT_CATEGORIES.map((cat) => {
            const count = combinedItems.filter((item) => item.category === cat.id).length;
            return (
              <FilterChipPill
                key={cat.id}
                icon={CATEGORY_ICON[cat.id]}
                label={t(CATEGORY_LABEL_KEY[cat.id])}
                count={count}
                active={selectedFilter === cat.id}
                cardBg={cardBg}
                borderColor={borderColor}
                iconColor={iconMutedColor}
                onPress={() => setSelectedFilter(cat.id)}
              />
            );
          })}
        </ScrollView>

        {/* Symmetrical Category Cards & Bubbles */}
        {selectedFilter === "all" ? (
          <View className="gap-4">
            {VAULT_CATEGORIES.map((cat) => {
              const items = combinedItems.filter((item) => item.category === cat.id);
              const catLabel = t(CATEGORY_LABEL_KEY[cat.id]);
              const CatIcon = CATEGORY_ICON[cat.id];
              return (
                <View key={cat.id} className="gap-2">
                  {/* Strictly Aligned Section Header */}
                  <View
                    style={{
                      height: 34,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(124, 58, 237, 0.10)",
                        }}
                      >
                        <CatIcon color={BRAND_PURPLE} size={15} strokeWidth={2.1} />
                      </View>
                      <Typography
                        style={{ fontSize: 15, lineHeight: 20, fontWeight: "700" }}
                        className="text-foreground"
                      >
                        {catLabel}
                      </Typography>
                    </View>

                    <SpringPressable
                      feedback="none"
                      accessibilityRole="button"
                      accessibilityLabel={t("common.add")}
                      onPress={() => openAddModal(cat.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
                      }}
                    >
                      <Plus color={BRAND_PURPLE} size={15} strokeWidth={2.4} />
                    </SpringPressable>
                  </View>

                  {items.length === 0 ? (
                    <SpringPressable
                      feedback="none"
                      scaleTo={0.985}
                      onPress={() => openAddModal(cat.id)}
                      className="rounded-2xl px-4 py-3.5"
                      style={{
                        borderWidth: 1,
                        borderColor,
                        backgroundColor: cardBg,
                      }}
                    >
                      <Typography className="text-[13px] leading-5 text-text-secondary">
                        {t(CATEGORY_PROMPT_KEY[cat.id])}
                      </Typography>
                    </SpringPressable>
                  ) : (
                    <View className="gap-2">
                      {items.map((item) => (
                        <MemoryBubbleCard
                          key={item.id}
                          item={item}
                          cardBg={cardBg}
                          borderColor={borderColor}
                          onPress={() => openEditModal(item)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <Animated.View entering={FadeInDown.duration(180)} className="gap-2.5">
            {filteredItems.length === 0 ? (
              <SpringPressable
                feedback="none"
                onPress={() => openAddModal(selectedFilter)}
                className="items-center gap-2 rounded-2xl px-6 py-10"
                style={{ borderWidth: 1, borderColor, backgroundColor: cardBg }}
              >
                <Typography className="text-center text-sm text-text-secondary">
                  {t("mobile.app.vault.emptyCategory", { category: t(CATEGORY_LABEL_KEY[selectedFilter]) })}
                </Typography>
                <Typography className="text-center text-xs text-muted">
                  {t(CATEGORY_PROMPT_KEY[selectedFilter])}
                </Typography>
              </SpringPressable>
            ) : (
              <View className="gap-2">
                {filteredItems.map((item) => (
                  <MemoryBubbleCard
                    key={item.id}
                    item={item}
                    cardBg={cardBg}
                    borderColor={borderColor}
                    onPress={() => openEditModal(item)}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </LargeTitleScrollView>

      {/* Floating Bottom Add Persona Button */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: Math.max(insets.bottom, 12) + 8,
          alignItems: "center",
        }}
      >
        <SpringPressable
          feedback="none"
          scaleTo={0.96}
          onPress={() => openAddModal()}
          style={{
            height: 48,
            paddingHorizontal: 24,
            borderRadius: 24,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: BRAND_PURPLE,
            shadowColor: BRAND_PURPLE,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.34,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <Plus color="#ffffff" size={18} strokeWidth={2.5} />
          <Typography style={{ color: "#ffffff", fontSize: 14, lineHeight: 18, fontWeight: "600" }}>
            {t("mobile.app.vault.addRecord")}
          </Typography>
        </SpringPressable>
      </View>

      {/* Bubble Detail / Add / Voice-to-Text Calibration Sheet */}
      <Modal visible={editorOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          className="flex-1 justify-end bg-black/35"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={{ flex: 1 }} onPress={closeEditor} />
          <View
            style={{
              backgroundColor: sheetBg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              paddingHorizontal: 20,
              paddingTop: 16,
              gap: 14,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Typography className="font-bold text-lg text-foreground">
                {t(editingItem ? "mobile.app.vault.editRecord" : "mobile.app.vault.addRecord")}
              </Typography>
              <View className="flex-row items-center gap-2">
                {editingItem ? (
                  <SpringPressable
                    feedback="none"
                    accessibilityRole="button"
                    accessibilityLabel={t("common.delete")}
                    onPress={handleDelete}
                    className="size-8 items-center justify-center rounded-full bg-danger-soft"
                  >
                    <Trash2 color="#ef4444" size={16} />
                  </SpringPressable>
                ) : null}
                <SpringPressable
                  feedback="close"
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close")}
                  onPress={closeEditor}
                  className="size-8 items-center justify-center rounded-full bg-control"
                >
                  <X color={String(muted)} size={17} strokeWidth={2.2} />
                </SpringPressable>
              </View>
            </View>

            <View className="gap-1.5">
              <Typography className="text-xs text-text-secondary">{t("mobile.app.vault.categoryLabel")}</Typography>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {VAULT_CATEGORIES.map((cat) => {
                  const active = draftCategory === cat.id;
                  const CatIcon = CATEGORY_ICON[cat.id];
                  return (
                    <FilterChipPill
                      key={cat.id}
                      icon={CatIcon}
                      label={t(CATEGORY_LABEL_KEY[cat.id])}
                      count={0}
                      active={active}
                      cardBg={cardBg}
                      borderColor={borderColor}
                      iconColor={iconMutedColor}
                      onPress={() => setDraftCategory(cat.id)}
                    />
                  );
                })}
              </ScrollView>
            </View>

            <TextInput
              autoFocus={!editingItem}
              multiline
              value={draftText}
              onChangeText={setDraftText}
              placeholder={t("mobile.app.vault.inputPlaceholder")}
              placeholderTextColor={String(muted)}
              className="min-h-28 rounded-2xl p-3.5 text-base text-foreground"
              style={{
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor: listening ? BRAND_PURPLE : borderColor,
                textAlignVertical: "top",
              }}
            />

            <View className="flex-row items-center justify-between gap-3">
              {speechRecognition ? (
                <SpringPressable
                  feedback="none"
                  scaleTo={0.95}
                  onPress={() => void toggleDictation()}
                  className="flex-row items-center gap-2 rounded-full px-4 py-2.5"
                  style={{
                    backgroundColor: listening ? "rgba(239,68,68,0.14)" : "rgba(124,58,237,0.12)",
                  }}
                >
                  {listening ? (
                    <Square color="#ef4444" size={15} />
                  ) : (
                    <Mic color={BRAND_PURPLE} size={16} strokeWidth={2.2} />
                  )}
                  <Typography className="font-semibold text-xs" style={{ color: listening ? "#ef4444" : BRAND_PURPLE }}>
                    {t(listening ? "mobile.app.vault.voiceListening" : "mobile.app.vault.voiceInput")}
                  </Typography>
                </SpringPressable>
              ) : (
                <View />
              )}

              <SpringPressable
                feedback="none"
                disabled={!draftText.trim()}
                onPress={() => void handleSave()}
                className="rounded-full px-6 py-2.5"
                style={{
                  backgroundColor: BRAND_PURPLE,
                  opacity: draftText.trim() ? 1 : 0.4,
                }}
              >
                <Typography className="font-semibold text-sm" style={{ color: "#ffffff" }}>
                  {t("common.save")}
                </Typography>
              </SpringPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function FilterChipPill({
  icon: Icon,
  label,
  count,
  active,
  cardBg,
  borderColor,
  iconColor,
  onPress,
}: {
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  count: number;
  active: boolean;
  cardBg: string;
  borderColor: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <SpringPressable
      feedback="tick"
      scaleTo={0.95}
      onPress={onPress}
      style={{
        height: 36,
        paddingHorizontal: 13,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: active ? BRAND_PURPLE : cardBg,
        borderWidth: 1,
        borderColor: active ? BRAND_PURPLE : borderColor,
      }}
    >
      <Icon color={active ? "#ffffff" : BRAND_PURPLE} size={14} strokeWidth={2.1} />
      <Typography
        style={{
          fontSize: 13,
          lineHeight: 16,
          fontWeight: "600",
          color: active ? "#ffffff" : iconColor,
        }}
      >
        {count > 0 ? `${label} · ${count}` : label}
      </Typography>
    </SpringPressable>
  );
}

function MemoryBubbleCard({
  item,
  cardBg,
  borderColor,
  onPress,
}: {
  item: VaultBubbleItem;
  cardBg: string;
  borderColor: string;
  onPress: () => void;
}) {
  const { t } = useText();
  return (
    <SpringPressable
      feedback="none"
      scaleTo={0.985}
      onPress={onPress}
      className="w-full gap-2 rounded-2xl px-4 py-3.5"
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor,
      }}
    >
      <Typography className="text-[15px] leading-5.5 text-foreground" numberOfLines={3}>
        {item.text}
      </Typography>
      <View className="flex-row items-center">
        <View
          style={{
            height: 22,
            paddingHorizontal: 8,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: item.source === "bot" ? "rgba(124,58,237,0.10)" : "rgba(16,185,129,0.11)",
          }}
        >
          <Typography
            style={{
              fontSize: 11,
              lineHeight: 14,
              fontWeight: "600",
              color: item.source === "bot" ? BRAND_PURPLE : "#10b981",
            }}
          >
            {item.source === "bot"
              ? t("mobile.app.vault.sourceBot", { name: item.botName ?? "StarBot" })
              : t("mobile.app.vault.sourceSelf")}
          </Typography>
        </View>
      </View>
    </SpringPressable>
  );
}
