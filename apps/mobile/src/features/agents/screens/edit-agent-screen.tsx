import { avatarHeadColor } from "@starbot/brand/bloub-avatar";
import { INPUT_LIMITS } from "@starbot/contracts/input-limits";
import {
  type AgentInstructionsFile,
  agentPermissionLevel,
  analyticsRange,
  analyticsTokens,
  assignedSkillCount,
  canAdministerServer,
  DEFAULT_PROVIDER_ACCOUNT_ID,
  type HostProviderAccounts,
  type UpdateAgentInput,
  workspaceAccessEnforced,
} from "@starbot/contracts/ipc";
import type { MobileTextKey } from "@starbot/i18n/mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import Bell from "lucide-react-native/icons/bell";
import BookBookmark from "lucide-react-native/icons/book-bookmark";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Cpu from "lucide-react-native/icons/cpu";
import Folder from "lucide-react-native/icons/folder";
import Gauge from "lucide-react-native/icons/gauge";
import Pencil from "lucide-react-native/icons/pencil";
import Puzzle from "lucide-react-native/icons/puzzle";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Smile from "lucide-react-native/icons/smile";
import X from "lucide-react-native/icons/x";
import { type ComponentType, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable, useUniwind } from "uniwind";
import {
  AgentAccessFields,
  PERMISSION_LABEL,
  useAgentAdminSettings,
} from "@/features/agents/components/agent-access-fields";
import { AgentAppearancePicker, type AgentColorValue } from "@/features/agents/components/agent-appearance-picker";
import { AgentBackupModelPicker, AgentBackupModelsPage } from "@/features/agents/components/agent-backup-models";
import { AgentBrowserProfileRow } from "@/features/agents/components/agent-browser-profile";
import { AgentDeleteHistoryRow, AgentNewChatSection } from "@/features/agents/components/agent-chat-settings";
import { AgentColorGlow } from "@/features/agents/components/agent-color-glow";
import { AgentDeleteSection } from "@/features/agents/components/agent-delete-section";
import { AgentFolderBrowser, AgentFolders } from "@/features/agents/components/agent-folders";
import {
  AgentBuiltinMemoryField,
  AgentBusyMessageField,
  AgentHostPermissionFields,
  AgentNewChatAllowedField,
  AgentPlanCardField,
  AgentTaskLimitField,
} from "@/features/agents/components/agent-host-fields";
import { AgentInformation } from "@/features/agents/components/agent-information";
import { AgentInstructionsFileEditor } from "@/features/agents/components/agent-instructions-file";
import { type AgentPhotoDraft, AgentPhotoPicker } from "@/features/agents/components/agent-photo-picker";
import { AgentPublish } from "@/features/agents/components/agent-publish";
import { AgentRuntimeFields, useProviderAccounts } from "@/features/agents/components/agent-runtime-fields";
import { AgentSharedTables } from "@/features/agents/components/agent-shared-tables";
import { BloubAvatarPreview } from "@/features/agents/components/bloub-avatar";
import { InstructionsLimit, instructionsTooLong } from "@/features/agents/components/instructions-limit";
import { agentSkillsQuery } from "@/features/agents/model/agent-skills-query";
import { useQueryScope } from "@/features/auth/context/mobile-session-context";
import { useAgentAccessLevel } from "@/features/servers/model/use-server-roles";
import { SettingsGroupRow, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import {
  type MobileAgent,
  type MobileServer,
  useMobileWorkspace,
} from "@/features/workspace/context/mobile-workspace-context";
import { queryKeys } from "@/features/workspace/model/query-keys";
import { showsOnline } from "@/features/workspace/model/server-status";
import { SaveError } from "@/shared/components/save-error";
import { SheetSaveAction } from "@/shared/components/sheet-save-action";
import { SheetScrollView } from "@/shared/components/sheet-scroll-view";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";
import { uiFeedback } from "@/shared/lib/ui-feedback";
import { useDiscardGuard } from "@/shared/lib/use-discard-guard";

const BRAND_PURPLE = "#7c3aed";
const PERSONA_TONE_BLOCK_START = "<!-- starbot-persona-tone:start -->";
const PERSONA_TONE_BLOCK_END = "<!-- starbot-persona-tone:end -->";
const PROACTIVE_CHAT_PREFIX = "[主动聊天]";
const PROACTIVE_FOLLOWUP_PREFIX = "[主动跟进]";

type StarBotPersonaTone = "default" | "gentle" | "sharp" | "passionate";
type ProactiveFrequency = "off" | "once" | "twice" | "thrice";

const PERSONA_TONE_OPTIONS: ReadonlyArray<{
  id: Exclude<StarBotPersonaTone, "default">;
  labelKey: MobileTextKey;
  markerKeyword: string;
  directive: string;
}> = [
  {
    id: "gentle",
    labelKey: "mobile.app.profile.toneGentle",
    markerKeyword: "温柔治愈",
    directive:
      "你的说话风格必须保持「温柔治愈」：语气温和细腻、耐心体贴、富有共情力。遇到用户焦虑或复杂难题时先温和安抚鼓励，再用通俗清晰的条理帮用户稳妥解决，让人如沐春风。",
  },
  {
    id: "sharp",
    labelKey: "mobile.app.profile.toneSharp",
    markerKeyword: "毒舌犀利",
    directive:
      "你的说话风格必须保持「毒舌犀利（傲娇嘴硬心软）」：表达一针见血、机智毒舌、略带冷幽默吐槽感，绝不讲虚伪客套话或空洞正确的废话；虽然嘴上犀利挑剔，但干活极其靠谱专业，直接戳破问题核心并给出硬核解法。",
  },
  {
    id: "passionate",
    labelKey: "mobile.app.profile.tonePassionate",
    markerKeyword: "热血激励",
    directive:
      "你的说话风格必须保持「热血激励」：元气满满、充满干劲与正能量感染力！善于把困难大目标拆解成立刻可冲刺的小步骤，主动给用户加油打气，带动行动力拉满（但依然保持专业准确，不喊空口号）。",
  },
];

function parsePersonaToneFromInstructions(text: string): StarBotPersonaTone {
  const match = text.match(/<!-- starbot-persona-tone:start -->([\s\S]*?)<!-- starbot-persona-tone:end -->/u);
  if (!match?.[1]) return "default";
  for (const opt of PERSONA_TONE_OPTIONS) {
    if (match[1].includes(opt.markerKeyword)) return opt.id;
  }
  return "default";
}

function injectPersonaTone(existingText: string, tone: StarBotPersonaTone): string {
  const blockRegex = new RegExp(`\\n?${PERSONA_TONE_BLOCK_START}[\\s\\S]*?${PERSONA_TONE_BLOCK_END}\\n?`, "gu");
  const cleaned = existingText.replace(blockRegex, "\n").trim();
  if (tone === "default") return cleaned ? `${cleaned}\n` : "";
  const opt = PERSONA_TONE_OPTIONS.find((item) => item.id === tone);
  if (!opt) return cleaned ? `${cleaned}\n` : "";
  const block = [PERSONA_TONE_BLOCK_START, "## 星友专属对话性格风格", opt.directive, PERSONA_TONE_BLOCK_END].join("\n");
  return cleaned ? `${cleaned}\n\n${block}\n` : `${block}\n`;
}

function formatCompactWanTokens(tokens: number): string {
  if (tokens >= 10_000) {
    return `${(tokens / 10_000).toFixed(2)} 万`;
  }
  return String(Math.round(tokens));
}

const PROACTIVE_SLOTS: Readonly<Record<Exclude<ProactiveFrequency, "off">, readonly string[]>> = {
  once: ["09:00"],
  twice: ["09:00", "21:00"],
  thrice: ["09:00", "12:30", "21:00"],
};

function buildProactivePrompt(time: string): string {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  const period = hour < 11 ? "上午" : hour < 15 ? "中午/午后" : hour < 19 ? "傍晚" : "晚间";
  return `现在是${period} ${time}。请以你自己的专属名字、角色性格与过往记忆，自然简短地主动找用户打个招呼。如果最近聊天里有尚未闭环的待办事项或约定，顺便温和提醒一句看是否需要继续推进；如果没有待办，就像老朋友一样轻松问候或分享一个小灵感（不要像生硬的系统通知）。`;
}

type AgentEdits = Pick<
  UpdateAgentInput,
  | "name"
  | "title"
  | "description"
  | "avatarSeed"
  | "avatarHue"
  | "avatarColor"
  | "provider"
  | "model"
  | "reasoningEffort"
>;

type AgentPage =
  | "info"
  | "appearance"
  | "usage"
  | "memories"
  | "skills"
  | "files"
  | "instructions"
  | "routines"
  | "tables"
  | "publish"
  | "runtime"
  | "backup-models"
  | "backup-model-picker"
  | "permissions"
  | "folders"
  | "folder-browser"
  | "advanced"
  | "memory"
  | "routine";

export function EditAgentScreen({ page = "info" }: { page?: AgentPage }) {
  const { t } = useText();
  const { agentId, serverId } = useLocalSearchParams<{ agentId: string; serverId?: string }>();
  const workspace = useMobileWorkspace();
  const [hostId] = useState(serverId ?? workspace.activeServer.id);
  const agent = workspace.agents.find((candidate) => candidate.id === agentId && candidate.serverId === hostId);
  const host = workspace.servers.find((candidate) => candidate.id === hostId);
  const lastAgent = useRef(agent);
  if (agent) lastAgent.current = agent;
  const displayed = agent ?? lastAgent.current;
  if (displayed) {
    return <AgentForm agent={displayed} host={host} available={Boolean(agent && showsOnline(host))} page={page} />;
  }
  return (
    <SheetScrollView className="bg-sheet" contentContainerClassName="p-5 pb-safe-offset-5">
      <Typography.Paragraph>
        {t(host?.initialConnectionPending ? "mobile.agent.edit.loading" : "mobile.agent.edit.gone")}
      </Typography.Paragraph>
    </SheetScrollView>
  );
}

function AgentForm({
  agent,
  host,
  available,
  page,
}: {
  agent: MobileAgent;
  host: MobileServer | undefined;
  available: boolean;
  page: AgentPage;
}) {
  const { t, errorMessage } = useText();
  const { theme } = useUniwind();
  const dark = theme === "dark";
  const insets = useSafeAreaInsets();
  const queryScope = useQueryScope();
  const workspace = useMobileWorkspace();
  const {
    updateAgent,
    setAgentAvatar,
    canStartNewChat,
    canDeleteChatHistory,
    canManageAgentAccess,
    canManageAgentHostSettings,
    canManageAgentTaskLimit,
    canManageAgentNewChat,
    canManageAgentPlanCard,
    canManageAgentBuiltinMemory,
    canManageBrowserProfiles,
    canManageAgentSkills,
    setAgentProviderAccount,
  } = workspace;
  const queryClient = useQueryClient();
  const { settings: adminSettings } = useAgentAdminSettings(
    agent,
    host,
    available && (page === "info" || page === "runtime"),
  );
  const showPermissions = canManageAgentAccess(agent.serverId) || canManageAgentHostSettings(agent.serverId);
  const accessLevel = useAgentAccessLevel(agent.serverId, agent.id);
  const showDeleteHistory = canDeleteChatHistory(agent.serverId) && accessLevel === "manage";
  const showBehavior =
    canManageAgentHostSettings(agent.serverId) ||
    canManageAgentTaskLimit(agent.serverId) ||
    canManageAgentNewChat(agent.serverId) ||
    canManageAgentPlanCard(agent.serverId) ||
    canManageAgentBuiltinMemory(agent.serverId);
  const showWorkspace = Boolean(agent.workspacePath) || canManageBrowserProfiles(agent.serverId);
  const showNewChat = canStartNewChat(agent.serverId) && accessLevel !== "view";
  const showChatActions = showNewChat || showDeleteHistory;

  const [edits, setEdits] = useState<AgentEdits>({});
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const sheetBg = String(useCSSVariable("--starbot-bg-sheet") ?? "#ffffff");

  // Crisp Desktop-matched airy palette: ice-lavender canvas + pure white elevated cards
  const canvasBg = dark ? sheetBg : "#f6f7fb";
  const cardSurface = dark ? "#1c1c24" : "#ffffff";
  const cardBorder = dark ? "rgba(255, 255, 255, 0.09)" : "rgba(15, 23, 42, 0.075)";
  const rowDivider = dark ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.065)";

  const [photo, setPhoto] = useState<AgentPhotoDraft | null | undefined>();
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proactiveOpen, setProactiveOpen] = useState(false);
  const [proactiveSaving, setProactiveSaving] = useState(false);
  const [optimisticTone, setOptimisticTone] = useState<StarBotPersonaTone | null>(null);

  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { queryKey: accountsKey, accounts: hostAccounts } = useProviderAccounts(agent, available && page === "runtime");
  const [account, setAccount] = useState<string | undefined>();
  const provider = edits.provider ?? agent.provider;
  const providerAccounts = hostAccounts?.providers.find((entry) => entry.provider === provider)?.accounts ?? [];
  const savedAccount =
    provider === agent.provider
      ? (hostAccounts?.agents.find((entry) => entry.agentId === agent.id)?.accountId ?? DEFAULT_PROVIDER_ACCOUNT_ID)
      : DEFAULT_PROVIDER_ACCOUNT_ID;
  const accountChanged = account !== undefined && account !== savedAccount;
  const name = edits.name ?? agent.name;
  const title = edits.title ?? agent.title;
  const description = edits.description ?? agent.description;
  const avatarSeed = edits.avatarSeed ?? agent.avatarSeed;
  const avatarHue = edits.avatarHue === undefined ? agent.avatarHue : edits.avatarHue;
  const avatarColor = edits.avatarColor === undefined ? agent.avatarColor : edits.avatarColor;
  const photoChanged = photo !== undefined && (photo !== null || Boolean(agent.avatarUrl));
  const dirty =
    photoChanged ||
    name.trim() !== agent.name ||
    title.trim() !== agent.title ||
    description.trim() !== agent.description ||
    avatarSeed !== agent.avatarSeed ||
    avatarHue !== agent.avatarHue ||
    avatarColor !== agent.avatarColor ||
    (edits.provider !== undefined && edits.provider !== agent.provider) ||
    (edits.model !== undefined && edits.model !== agent.model) ||
    (edits.reasoningEffort !== undefined && edits.reasoningEffort !== agent.reasoningEffort) ||
    accountChanged;
  const nameMissing = page === "info" && !name.trim();
  const [triedSave, setTriedSave] = useState(false);
  const valid =
    page !== "info" ||
    (name.length <= INPUT_LIMITS.agentName &&
      title.length <= INPUT_LIMITS.agentTitle &&
      !instructionsTooLong(description));

  useDiscardGuard(dirty || saving || pickingPhoto, { busy: () => pending.current || pickingPhoto });

  const infoActive = available && page === "info";
  const instructionsKey = queryKeys.agentRecord(queryScope, agent.serverId, agent.id, "instructions");
  const instructionsQuery = useQuery({
    queryKey: instructionsKey,
    queryFn: () => workspace.loadAgentInstructions(agent.id, agent.serverId),
    enabled: infoActive,
    staleTime: 15_000,
    retry: false,
  });

  const memoriesQuery = useQuery({
    queryKey: queryKeys.agentRecord(queryScope, agent.serverId, agent.id, "memories"),
    queryFn: () => workspace.loadAgentMemories(agent.id, agent.serverId),
    enabled: infoActive,
    staleTime: 15_000,
    retry: false,
  });

  const manageSkills = canManageAgentSkills(agent.serverId);
  const skillsQueryDef = agentSkillsQuery(
    queryScope,
    agent.serverId,
    agent.id,
    manageSkills,
    workspace.loadAgentSkills,
  );
  const skillsQuery = useQuery({
    ...skillsQueryDef,
    enabled: infoActive,
    staleTime: 15_000,
    retry: false,
  });

  const routinesKey = queryKeys.agentRecord(queryScope, agent.serverId, agent.id, "routines");
  const routinesQuery = useQuery({
    queryKey: routinesKey,
    queryFn: () => workspace.loadAgentRoutines(agent.id, agent.serverId),
    enabled: infoActive,
    staleTime: 15_000,
    retry: false,
  });

  const defaultUsageRange = useMemo(() => analyticsRange(agent.id), [agent.id]);
  const usageQuery = useQuery({
    queryKey: queryKeys.agentUsage(queryScope, agent.serverId, agent.id, available, defaultUsageRange),
    queryFn: async () =>
      (await workspace.loadHostAnalytics(defaultUsageRange, agent.serverId)) ??
      workspace.loadAgentAnalytics(defaultUsageRange, agent.serverId),
    enabled: infoActive,
    staleTime: 30_000,
    retry: false,
  });

  const currentTone: StarBotPersonaTone =
    optimisticTone ??
    (instructionsQuery.data ? parsePersonaToneFromInstructions(instructionsQuery.data.text) : "default");

  const selectPersonaTone = async (targetTone: Exclude<StarBotPersonaTone, "default">) => {
    if (!available) return;
    const nextTone: StarBotPersonaTone = currentTone === targetTone ? "default" : targetTone;
    uiFeedback.tick();
    setOptimisticTone(nextTone);
    try {
      const currentFile = instructionsQuery.data ?? (await workspace.loadAgentInstructions(agent.id, agent.serverId));
      const nextText = injectPersonaTone(currentFile.text, nextTone);
      const saved = await workspace.saveAgentInstructions(
        { agentId: agent.id, text: nextText, expected: currentFile.text },
        agent.serverId,
      );
      queryClient.setQueryData<AgentInstructionsFile>(instructionsKey, saved);
    } catch {
      void instructionsQuery.refetch();
    } finally {
      setOptimisticTone(null);
    }
  };

  const allRoutines = routinesQuery.data ?? [];
  const proactiveRoutines = useMemo(
    () => allRoutines.filter((r) => r.name.startsWith(PROACTIVE_CHAT_PREFIX) && r.active),
    [allRoutines],
  );
  const businessRoutineCount = useMemo(
    () =>
      allRoutines.filter(
        (r) => !r.name.startsWith(PROACTIVE_CHAT_PREFIX) && !r.name.startsWith(PROACTIVE_FOLLOWUP_PREFIX),
      ).length,
    [allRoutines],
  );

  const proactiveFrequency: ProactiveFrequency =
    proactiveRoutines.length >= 3
      ? "thrice"
      : proactiveRoutines.length === 2
        ? "twice"
        : proactiveRoutines.length === 1
          ? "once"
          : "off";

  const applyProactiveFrequency = async (freq: ProactiveFrequency) => {
    if (!available || proactiveSaving) return;
    uiFeedback.confirm();
    setProactiveSaving(true);
    try {
      const existing = (await workspace.loadAgentRoutines(agent.id, agent.serverId)).filter((r) =>
        r.name.startsWith(PROACTIVE_CHAT_PREFIX),
      );
      for (const old of existing) {
        await workspace.deleteAgentRoutine(agent.id, old.id, agent.serverId).catch(() => undefined);
      }
      if (freq !== "off") {
        const times = PROACTIVE_SLOTS[freq];
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
        for (let i = 0; i < times.length; i++) {
          const slotTime = times[i] ?? "09:00";
          const suffix = times.length === 1 ? `每日问候 (${slotTime})` : `陪伴时段 ${i + 1} (${slotTime})`;
          await workspace.createAgentRoutine(
            {
              agentId: agent.id,
              name: `${PROACTIVE_CHAT_PREFIX} ${suffix}`,
              instruction: buildProactivePrompt(slotTime),
              schedule: { kind: "daily", time: slotTime },
              timezone,
              active: true,
            },
            agent.serverId,
          );
        }
      }
      await queryClient.invalidateQueries({ queryKey: routinesKey });
      setProactiveOpen(false);
    } catch {
      uiFeedback.error();
    } finally {
      setProactiveSaving(false);
    }
  };

  const memoryCount = memoriesQuery.data?.length ?? 0;
  const skillCount = skillsQuery.data ? assignedSkillCount(skillsQuery.data) : 0;
  const totalTokens = useMemo(
    () => (usageQuery.data?.daily ?? []).reduce((sum, day) => sum + analyticsTokens(day), 0),
    [usageQuery.data],
  );

  function change(value: AgentEdits) {
    setEdits((current) => ({ ...current, ...value }));
    setError(null);
  }
  const changeAvatarSeed = useCallback((nextSeed: string) => {
    setEdits((current) => ({ ...current, avatarSeed: nextSeed }));
    setError(null);
  }, []);
  const changeAvatarColor = useCallback((value: AgentColorValue) => {
    setEdits((current) => ({ ...current, avatarHue: value.hue, avatarColor: value.color }));
    setError(null);
  }, []);
  const hasPhoto = photo === undefined ? Boolean(agent.avatarUrl) : Boolean(photo);
  const photoField = useMemo(
    () => (
      <AgentPhotoPicker
        hasPhoto={hasPhoto}
        cropRoute={{
          pathname: "/agent-info/[agentId]/crop-photo",
          params: { agentId: agent.id, serverId: agent.serverId },
        }}
        disabled={saving || pickingPhoto}
        onChange={(value) => {
          setPhoto(value);
          setError(null);
        }}
        onBusyChange={setPickingPhoto}
      />
    ),
    [hasPhoto, agent.id, agent.serverId, saving, pickingPhoto],
  );

  async function submit(): Promise<void> {
    if (nameMissing) {
      setTriedSave(true);
      void haptics.notification("error");
      return;
    }
    if (!valid || !dirty || !available || pickingPhoto || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      if (Object.keys(edits).length > 0)
        await updateAgent(
          {
            agentId: agent.id,
            ...(edits.name === undefined ? {} : { name: name.trim() }),
            ...(edits.title === undefined ? {} : { title: title.trim() }),
            ...(edits.description === undefined ? {} : { description: description.trim() }),
            ...(edits.avatarSeed === undefined ? {} : { avatarSeed }),
            ...(edits.avatarHue === undefined ? {} : { avatarHue }),
            ...(edits.avatarColor === undefined ? {} : { avatarColor }),
            ...(edits.provider === undefined ? {} : { provider: edits.provider }),
            ...(edits.model === undefined ? {} : { model: edits.model }),
            ...(edits.reasoningEffort === undefined ? {} : { reasoningEffort: edits.reasoningEffort }),
          },
          agent.serverId,
        );
      setEdits({});
      if (accountChanged || (edits.provider !== undefined && edits.provider !== agent.provider)) {
        const accountId = account === undefined || account === DEFAULT_PROVIDER_ACCOUNT_ID ? null : account;
        if (accountChanged) await setAgentProviderAccount({ agentId: agent.id, accountId }, agent.serverId);
        setAccount(undefined);
        queryClient.setQueryData<HostProviderAccounts | null>(accountsKey, (current) =>
          current
            ? {
                ...current,
                agents: [
                  ...current.agents.filter((entry) => entry.agentId !== agent.id),
                  ...(accountId ? [{ agentId: agent.id, accountId }] : []),
                ],
              }
            : current,
        );
      }
      if (photoChanged) {
        await setAgentAvatar(agent.id, photo ?? null, agent.serverId);
        setPhoto(undefined);
      }
      void haptics.notification("success");
    } catch (cause) {
      void haptics.notification("error");
      setError(errorMessage(cause, t("mobile.agent.edit.failed")));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const proactiveLabelKey: MobileTextKey =
    proactiveFrequency === "thrice"
      ? "mobile.app.profile.proactiveThrice"
      : proactiveFrequency === "twice"
        ? "mobile.app.profile.proactiveTwice"
        : proactiveFrequency === "once"
          ? "mobile.app.profile.proactiveOnce"
          : "mobile.app.profile.proactiveOff";

  const boundarySupportingText = adminSettings
    ? agentPermissionLevel(adminSettings) === "full"
      ? t("mobile.app.profile.boundaryFull")
      : t(PERMISSION_LABEL[agentPermissionLevel(adminSettings)])
    : t("mobile.app.profile.boundaryFull");

  return (
    <>
      <SheetScrollView
        style={{ backgroundColor: page === "info" ? canvasBg : sheetBg }}
        contentContainerClassName={
          page === "info" ? "gap-5 px-4 pb-safe-offset-10 pt-2" : "gap-5 px-5 pb-safe-offset-5 pt-5"
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        {page === "usage" ? (
          <Stack.Screen options={{ title: t("mobile.agent.info.usage.agentTitle", { name: agent.name }) }} />
        ) : null}

        {/* FULL-SCREEN DESKTOP-MATCHED 星友档案 (Crisp white cards on soft canvas + single-line right alignment) */}
        {page === "info" ? (
          <>
            {/* 3D Character Hero */}
            <View className="items-center pt-1 pb-2">
              <AgentColorGlow color={avatarHeadColor(avatarSeed, avatarHue, avatarColor)} centerY={62} height={200} />
              <SpringPressable
                feedback="botTap"
                scaleTo={0.93}
                className="self-center"
                accessibilityRole="button"
                accessibilityLabel={t("mobile.agent.edit.appearance")}
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/appearance",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              >
                <BloubAvatarPreview
                  agentId={agent.id}
                  serverId={agent.serverId}
                  seed={avatarSeed}
                  hue={avatarHue}
                  color={avatarColor}
                  size={126}
                />
                <View
                  style={{
                    position: "absolute",
                    right: agent.avatarUrl ? 0 : 6,
                    bottom: agent.avatarUrl ? 0 : 6,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: cardSurface,
                    borderWidth: 2.5,
                    borderColor: canvasBg,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#0f172a",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 6,
                  }}
                >
                  <Pencil color={String(foreground)} size={13} />
                </View>
              </SpringPressable>
            </View>

            {/* 星友昵称 + 灵魂人设 (Pure white elevated input fields) */}
            <View className="gap-4">
              <View className="gap-2">
                <Typography className="px-1.5 font-semibold text-[13px] text-foreground">
                  {t("mobile.app.profile.nickname")}
                </Typography>
                <TextInput
                  value={name}
                  editable={!saving}
                  maxLength={INPUT_LIMITS.agentName}
                  onChangeText={(value) => change({ name: value })}
                  placeholder={t("mobile.agent.add.namePlaceholder")}
                  placeholderTextColor={String(muted)}
                  className="px-4 py-3.5 text-[15px] font-medium text-foreground"
                  style={{
                    borderRadius: 16,
                    backgroundColor: cardSurface,
                    borderWidth: 1,
                    borderColor: triedSave && nameMissing ? "#ef4444" : cardBorder,
                    shadowColor: "#0f172a",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: dark ? 0.2 : 0.035,
                    shadowRadius: 8,
                  }}
                />
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between px-1.5">
                  <Typography className="font-semibold text-[13px] text-foreground">
                    {t("mobile.app.profile.soulTitle")}
                  </Typography>
                  <Typography className="text-[12px] text-text-secondary">
                    {t("mobile.app.profile.soulHint")}
                  </Typography>
                </View>
                <TextInput
                  multiline
                  value={description}
                  editable={!saving}
                  onChangeText={(value) => change({ description: value })}
                  placeholder={t("mobile.app.profile.soulPlaceholder")}
                  placeholderTextColor={String(muted)}
                  className="min-h-24 px-4 py-3.5 text-[15px] leading-5.5 text-foreground"
                  style={{
                    borderRadius: 16,
                    backgroundColor: cardSurface,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    textAlignVertical: "top",
                    shadowColor: "#0f172a",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: dark ? 0.2 : 0.035,
                    shadowRadius: 8,
                  }}
                />
                <InstructionsLimit text={description} />
              </View>
            </View>

            {/* 1. 内核与性格 */}
            <ProfileCardGroup
              title={t("mobile.app.profile.sectionCore")}
              cardSurface={cardSurface}
              cardBorder={cardBorder}
              dark={dark}
            >
              <ProfileRow
                icon={Cpu}
                label={t("mobile.app.profile.driveModel")}
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/runtime",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
                right={
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      height: 32,
                      paddingHorizontal: 11,
                      borderRadius: 16,
                      backgroundColor: dark ? "rgba(124, 58, 237, 0.16)" : "rgba(124, 58, 237, 0.075)",
                      borderWidth: 1,
                      borderColor: dark ? "rgba(124, 58, 237, 0.3)" : "rgba(124, 58, 237, 0.16)",
                      maxWidth: 196,
                    }}
                  >
                    <Typography
                      numberOfLines={1}
                      style={{
                        fontSize: 13,
                        lineHeight: 16,
                        fontWeight: "600",
                        color: dark ? "#e9d5ff" : "#3b0764",
                        flexShrink: 1,
                      }}
                    >
                      {agent.model || agent.provider}
                    </Typography>
                    <ChevronRight size={14} color={BRAND_PURPLE} strokeWidth={2.2} />
                  </View>
                }
              />
              <ProfileDivider color={rowDivider} />
              <ProfileRow
                icon={Smile}
                label={t("mobile.app.profile.personaTone")}
                right={
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 2,
                      padding: 3,
                      borderRadius: 18,
                      backgroundColor: dark ? "rgba(124, 58, 237, 0.14)" : "rgba(124, 58, 237, 0.07)",
                      borderWidth: 1,
                      borderColor: dark ? "rgba(124, 58, 237, 0.24)" : "rgba(124, 58, 237, 0.14)",
                    }}
                  >
                    {PERSONA_TONE_OPTIONS.map((opt) => {
                      const active = currentTone === opt.id;
                      return (
                        <SpringPressable
                          key={opt.id}
                          feedback="none"
                          scaleTo={0.95}
                          onPress={() => void selectPersonaTone(opt.id)}
                          style={{
                            height: 28,
                            paddingHorizontal: 11,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: active ? BRAND_PURPLE : "transparent",
                          }}
                        >
                          <Typography
                            style={{
                              fontSize: 12,
                              lineHeight: 15,
                              fontWeight: "600",
                              color: active ? "#ffffff" : dark ? "#d4d4d8" : "#3f3f46",
                            }}
                          >
                            {t(opt.labelKey)}
                          </Typography>
                        </SpringPressable>
                      );
                    })}
                  </View>
                }
              />
            </ProfileCardGroup>

            {/* 2. 脑海与本领 */}
            <ProfileCardGroup
              title={t("mobile.app.profile.sectionMind")}
              cardSurface={cardSurface}
              cardBorder={cardBorder}
              dark={dark}
            >
              <ProfileRow
                icon={BookBookmark}
                label={t("mobile.app.profile.memories")}
                valueText={t("mobile.app.profile.memoriesCount", { count: memoryCount })}
                showChevron
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/memories",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              />
              <ProfileDivider color={rowDivider} />
              <ProfileRow
                icon={Puzzle}
                label={t("mobile.app.profile.skills")}
                valueText={t("mobile.app.profile.skillsCount", { count: skillCount })}
                showChevron
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/skills",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              />
              <ProfileDivider color={rowDivider} />
              <ProfileRow
                icon={Folder}
                label={t("mobile.app.profile.files")}
                showChevron
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/files",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              />
            </ProfileCardGroup>

            {/* 3. 叮嘱与开销 */}
            <ProfileCardGroup
              title={t("mobile.app.profile.sectionRoutines")}
              cardSurface={cardSurface}
              cardBorder={cardBorder}
              dark={dark}
            >
              <ProfileRow
                icon={CalendarClock}
                label={t("mobile.app.profile.routines")}
                valueText={t("mobile.app.profile.routinesCount", { count: businessRoutineCount })}
                showChevron
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/routines",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              />
              <ProfileDivider color={rowDivider} />
              <ProfileRow
                icon={Gauge}
                label={t("mobile.app.profile.tokens")}
                valueText={t("mobile.app.profile.tokensValue", {
                  value: formatCompactWanTokens(totalTokens),
                })}
                showChevron
                onPress={() =>
                  router.push({
                    pathname: "/agent-info/[agentId]/usage",
                    params: { agentId: agent.id, serverId: agent.serverId },
                  })
                }
              />
            </ProfileCardGroup>

            {/* 4. 默契与守护 */}
            <ProfileCardGroup
              title={t("mobile.app.profile.sectionGuard")}
              cardSurface={cardSurface}
              cardBorder={cardBorder}
              dark={dark}
            >
              {showPermissions ? (
                <>
                  <ProfileRow
                    icon={ShieldCheck}
                    label={t("mobile.app.profile.boundary")}
                    valueText={boundarySupportingText}
                    showChevron
                    onPress={() =>
                      router.push({
                        pathname: "/agent-info/[agentId]/permissions",
                        params: { agentId: agent.id, serverId: agent.serverId },
                      })
                    }
                  />
                  <ProfileDivider color={rowDivider} />
                </>
              ) : null}
              <ProfileRow
                icon={Bell}
                label={t("mobile.app.profile.proactive")}
                valueText={t(proactiveLabelKey)}
                showChevron
                onPress={() => {
                  uiFeedback.open();
                  setProactiveOpen(true);
                }}
              />
            </ProfileCardGroup>

            {host && canAdministerServer(host.role) ? (
              <AgentDeleteSection agent={agent} disabled={!available || saving || dirty} />
            ) : null}
          </>
        ) : null}

        {page === "appearance" ? (
          <AgentAppearancePicker
            agentId={agent.id}
            serverId={agent.serverId}
            imageUrl={photo === undefined ? undefined : (photo?.uri ?? null)}
            seed={avatarSeed}
            hue={avatarHue}
            color={avatarColor}
            name={name}
            nameField={null}
            showFaces={!hasPhoto}
            photoField={photoField}
            disabled={saving || pickingPhoto}
            onSeedChange={changeAvatarSeed}
            onColorChange={changeAvatarColor}
          />
        ) : null}
        {page === "runtime" ? (
          <AgentRuntimeFields
            serverId={agent.serverId}
            modelPickerRoute={{
              pathname: "/agent-info/[agentId]/model-picker",
              params: { agentId: agent.id, serverId: agent.serverId },
            }}
            available={available}
            saving={saving}
            provider={provider}
            foreignProvider={edits.provider === undefined ? agent.foreignProvider : undefined}
            model={edits.model ?? agent.model}
            reasoningEffort={edits.reasoningEffort ?? agent.reasoningEffort}
            accounts={providerAccounts}
            accountId={account ?? savedAccount}
            workspaceOnly={adminSettings ? workspaceAccessEnforced(adminSettings) : false}
            onChange={(value) => {
              change(value);
              if (value.provider !== undefined) setAccount(undefined);
            }}
            onAccountChange={(value) => {
              setAccount(value);
              setError(null);
            }}
            fastMode={
              provider === agent.provider && (edits.model ?? agent.model) === agent.model
                ? { agent, server: host, available }
                : undefined
            }
          />
        ) : null}
        {page === "backup-models" ? <AgentBackupModelsPage agent={agent} server={host} available={available} /> : null}
        {page === "backup-model-picker" ? (
          <AgentBackupModelPicker agent={agent} server={host} available={available} />
        ) : null}
        {page === "permissions" ? (
          <>
            <AgentAccessFields agent={agent} server={host} available={available} />
            <AgentHostPermissionFields agent={agent} server={host} available={available} />
          </>
        ) : null}
        {page === "advanced" ? (
          <>
            {showBehavior ? (
              <SettingsSection title={t("mobile.agent.advanced.behavior")} rowsDrawSeparators>
                <AgentBusyMessageField agent={agent} server={host} available={available} />
                <AgentTaskLimitField agent={agent} server={host} available={available} />
                <AgentNewChatAllowedField agent={agent} server={host} available={available} />
                <AgentPlanCardField agent={agent} server={host} available={available} />
                <AgentBuiltinMemoryField agent={agent} server={host} available={available} />
              </SettingsSection>
            ) : null}
            {showWorkspace ? (
              <SettingsSection title={t("mobile.agent.advanced.workspace")} rowsDrawSeparators>
                <AgentBrowserProfileRow agent={agent} />
                {agent.workspacePath ? (
                  <SettingsGroupRow>
                    <SettingsRow description={t("mobile.agent.workspace.footer")}>
                      <Typography.Paragraph>{t("mobile.agent.workspace.title")}</Typography.Paragraph>
                      <Typography.Paragraph selectable type="body-xs" className="text-grouped-secondary">
                        {agent.workspacePath}
                      </Typography.Paragraph>
                    </SettingsRow>
                  </SettingsGroupRow>
                ) : null}
              </SettingsSection>
            ) : null}
            {showChatActions ? (
              <SettingsSection title={t("mobile.agent.advanced.chat")} rowsDrawSeparators>
                {showNewChat ? <AgentNewChatSection agent={agent} available={available} grouped /> : null}
                {showDeleteHistory ? <AgentDeleteHistoryRow agent={agent} available={available} /> : null}
              </SettingsSection>
            ) : null}
          </>
        ) : null}
        {page === "folders" ? <AgentFolders agent={agent} host={host} available={available} /> : null}
        {page === "folder-browser" ? <AgentFolderBrowser agent={agent} available={available} /> : null}
        {page === "instructions" ? <AgentInstructionsFileEditor agent={agent} available={available} /> : null}
        {page === "tables" ? <AgentSharedTables agent={agent} available={available} /> : null}
        {page === "publish" ? <AgentPublish agent={agent} available={available} /> : null}
        {page === "usage" ||
        page === "memories" ||
        page === "skills" ||
        page === "files" ||
        page === "routines" ||
        page === "memory" ||
        page === "routine" ? (
          <AgentInformation agent={agent} available={available} section={page} />
        ) : null}
        {!available ? <Typography.Paragraph>{t("mobile.agent.edit.unavailable")}</Typography.Paragraph> : null}
        <SaveError error={error} />
        {page === "info" || page === "appearance" || page === "runtime" ? (
          <SheetSaveAction
            dirty={dirty}
            canSave={valid && available}
            pending={saving || pickingPhoto}
            onSave={() => void submit()}
          />
        ) : null}
      </SheetScrollView>

      {/* Proactive Companion Sheet (主动陪伴) */}
      <Modal
        visible={proactiveOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setProactiveOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/35">
          <Pressable style={{ flex: 1 }} onPress={() => setProactiveOpen(false)} />
          <View
            style={{
              backgroundColor: cardSurface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 18,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              gap: 14,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Typography className="font-bold text-lg text-foreground">
                {t("mobile.app.profile.proactiveTitle")}
              </Typography>
              <SpringPressable
                feedback="close"
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                onPress={() => setProactiveOpen(false)}
                className="size-8 items-center justify-center rounded-full bg-control"
              >
                <X color={String(muted)} size={17} strokeWidth={2.2} />
              </SpringPressable>
            </View>
            <Typography className="text-xs leading-4.5 text-text-secondary">
              {t("mobile.app.profile.proactiveDesc")}
            </Typography>
            <View className="gap-2">
              {(
                [
                  { id: "off", labelKey: "mobile.app.profile.proactiveOff", hint: "" },
                  { id: "once", labelKey: "mobile.app.profile.proactiveOnce", hint: "09:00" },
                  { id: "twice", labelKey: "mobile.app.profile.proactiveTwice", hint: "09:00 · 21:00" },
                  { id: "thrice", labelKey: "mobile.app.profile.proactiveThrice", hint: "09:00 · 12:30 · 21:00" },
                ] as const
              ).map((choice) => {
                const selected = proactiveFrequency === choice.id;
                return (
                  <SpringPressable
                    key={choice.id}
                    feedback="none"
                    disabled={proactiveSaving}
                    onPress={() => void applyProactiveFrequency(choice.id)}
                    className="flex-row items-center justify-between rounded-2xl px-4 py-3.5"
                    style={{
                      backgroundColor: selected ? "rgba(124, 58, 237, 0.1)" : canvasBg,
                      borderWidth: 1,
                      borderColor: selected ? BRAND_PURPLE : cardBorder,
                      opacity: proactiveSaving ? 0.6 : 1,
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Typography
                        className="font-semibold text-[15px] text-foreground"
                        style={selected ? { color: BRAND_PURPLE } : undefined}
                      >
                        {t(choice.labelKey)}
                      </Typography>
                      {choice.hint ? (
                        <Typography className="text-xs text-text-secondary">{choice.hint}</Typography>
                      ) : null}
                    </View>
                    {selected ? <Check size={18} color={BRAND_PURPLE} strokeWidth={2.4} /> : null}
                  </SpringPressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function ProfileCardGroup({
  title,
  cardSurface,
  cardBorder,
  dark,
  children,
}: {
  title: string;
  cardSurface: string;
  cardBorder: string;
  dark: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Typography className="px-2 font-medium text-[12px] text-text-secondary">{title}</Typography>
      <View
        style={{
          borderRadius: 20,
          backgroundColor: cardSurface,
          borderWidth: 1,
          borderColor: cardBorder,
          overflow: "hidden",
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: dark ? 0.22 : 0.04,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function ProfileDivider({ color }: { color: string }) {
  return <View style={{ marginLeft: 54, height: StyleSheet.hairlineWidth, backgroundColor: color }} />;
}

function ProfileRow({
  icon: Icon,
  label,
  valueText,
  right,
  showChevron = false,
  onPress,
}: {
  icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  valueText?: string;
  right?: ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
}) {
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const content = (
    <View
      style={{
        minHeight: 54,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 11,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(124, 58, 237, 0.085)",
          }}
        >
          <Icon color={BRAND_PURPLE} size={16} strokeWidth={2} />
        </View>
        <Typography style={{ fontSize: 15, lineHeight: 20, fontWeight: "600", color: String(foreground) }}>
          {label}
        </Typography>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, flex: 1 }}>
        {right ?? (
          <>
            {valueText ? (
              <Typography
                numberOfLines={1}
                style={{ fontSize: 14, lineHeight: 18, color: String(muted), flexShrink: 1, textAlign: "right" }}
              >
                {valueText}
              </Typography>
            ) : null}
            {showChevron ? <ChevronRight size={16} color={String(muted)} strokeWidth={2} /> : null}
          </>
        )}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        uiFeedback.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "rgba(124, 58, 237, 0.05)" : "transparent",
      })}
    >
      {content}
    </Pressable>
  );
}
