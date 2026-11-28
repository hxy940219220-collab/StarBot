import { foreignProvider } from "@openbot/contracts/agent-providers";
import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import {
  type AgentMemorySelection,
  agentComputerUseEnabled,
  agentMemoryEnabled,
  agentNextProviderAccountId,
  analyticsRange,
  assignedSkillCount,
  DEFAULT_AGENT_ACCESS,
  LOCAL_SERVER_ID,
  type MemoryEntry,
  workspaceAccessEnforced,
} from "@openbot/contracts/ipc";
import { ROUTINE_EVERY_DAY } from "@openbot/team-client/routine-schedule-draft";
import {
  Bell,
  BookMarked,
  Button,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Gauge,
  Input,
  Plus,
  Puzzle,
  ShieldCheck,
  Smile,
  Switch,
  Textarea,
  Trash2,
  X,
} from "@openbot/ui";
import { bloubAvatarProfile, zodiacForShape } from "@openbot/ui/bloub-avatar";
import { ProviderModelPicker } from "@openbot/ui/components/ProviderModelPicker";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import {
  isChiefStarBot,
  isManualChiefStarBot,
  setManualChiefStarBotId,
} from "@openbot/ui/features/agents/chief-starbot";
import { playKawaiiCue } from "@openbot/ui/features/agents/starbot-kawaii-audio";
import {
  routineScheduleFromDraft,
  routineScheduleToDraft,
} from "@openbot/ui/features/conversation/routine-schedule-saved";
import { useText } from "@openbot/ui/text";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import { skillsPort } from "../../skills-port";
import { desktopBrowserProfileCalls } from "../browser/browser-profiles-port";
import { serverCanAdminister } from "../servers/server-capabilities";
import { AgentSkillsModal } from "./AgentSkillsModal";
import { useConversationViewScope } from "./conversation-scope";
import { agentMemoriesPort } from "./memories-port";
import { isEventRoutine, routineListSummary, routineScheduleOf } from "./routine-summary";
import { agentRoutinesPort, type RoutineEditorRecord } from "./routines-port";
import {
  addGlobalUserProfileItem,
  downloadMemoryMarkdown,
  dreamJournalEntries,
  formatTaggedMemory,
  openMemoryCleanModal,
  parseMemoryCategory,
  STARBOT_MEMORY_CATEGORIES,
  type StarBotMemoryCategory,
  setDailyDigestOpen,
  syncMemoriesToAgentInstructions,
} from "./starbot-memory-hub";

const INSPECTOR_STORAGE_KEY = "starbot:inspector-open";
const PROACTIVE_CHAT_PREFIX = "[主动聊天]";
const PROACTIVE_FOLLOWUP_PREFIX = "[主动跟进]";
const PROACTIVE_CONFIG_KEY_PREFIX = "starbot:proactive-care:v4:";
const PROACTIVE_FOLLOWUP_COOLDOWN_MS = 60 * 60_000;
const proactiveTickInFlight = new Set<string>();
const proactiveLastFiredAt = new Map<string, number>();
const PERSONA_TONE_KEY_PREFIX = "starbot:persona-tone:v1:";
const PERSONA_TONE_BLOCK_START = "<!-- starbot-persona-tone:start -->";
const PERSONA_TONE_BLOCK_END = "<!-- starbot-persona-tone:end -->";

export type ProactiveChatFrequency = "off" | "once" | "twice" | "thrice";
export type FollowupDelayUnit = "hours" | "minutes";
export type StarBotPersonaTone = "default" | "gentle" | "sharp" | "passionate";

interface PersonaToneOption {
  readonly id: Exclude<StarBotPersonaTone, "default">;
  readonly shortLabel: string;
  readonly fullLabel: string;
  readonly hint: string;
  readonly promptDirective: string;
}

const PERSONA_TONE_OPTIONS: readonly PersonaToneOption[] = [
  {
    id: "gentle",
    shortLabel: "温柔",
    fullLabel: "温柔治愈",
    hint: "语气温和细腻、耐心包容、富有共情力，像贴心挚友一样陪伴解答",
    promptDirective:
      "你的说话风格必须保持「温柔治愈」：语气温和细腻、耐心体贴、富有共情力。遇到用户焦虑或复杂难题时先温和安抚鼓励，再用通俗清晰的条理帮用户稳妥解决，让人如沐春风。",
  },
  {
    id: "sharp",
    shortLabel: "毒舌",
    fullLabel: "毒舌犀利",
    hint: "嘴硬心软、一针见血、带点傲娇幽默感，拒绝套话直接戳中问题核心",
    promptDirective:
      "你的说话风格必须保持「毒舌犀利（傲娇嘴硬心软）」：表达一针见血、机智毒舌、略带冷幽默吐槽感，绝不讲虚伪客套话或空洞正确的废话；虽然嘴上犀利挑剔，但干活极其靠谱专业，直接戳破问题核心并给出硬核解法。",
  },
  {
    id: "passionate",
    shortLabel: "热血",
    fullLabel: "热血激励",
    hint: "元气满满、干劲十足、充满感染力，随时为你打气加油推进目标",
    promptDirective:
      "你的说话风格必须保持「热血激励」：元气满满、充满干劲与正能量感染力！善于把困难大目标拆解成立刻可冲刺的小步骤，主动给用户加油打气，带动行动力拉满（但依然保持专业准确，不喊空口号）。",
  },
];

function readPersonaTone(agentId: string): StarBotPersonaTone {
  try {
    const raw = window.localStorage.getItem(`${PERSONA_TONE_KEY_PREFIX}${agentId}`);
    if (raw === "gentle" || raw === "sharp" || raw === "passionate") return raw;
    return "default";
  } catch {
    return "default";
  }
}

function writePersonaTone(agentId: string, tone: StarBotPersonaTone): void {
  try {
    if (tone === "default") window.localStorage.removeItem(`${PERSONA_TONE_KEY_PREFIX}${agentId}`);
    else window.localStorage.setItem(`${PERSONA_TONE_KEY_PREFIX}${agentId}`, tone);
  } catch {}
}

function injectPersonaToneIntoInstructions(existingText: string, tone: StarBotPersonaTone): string {
  const blockRegex = new RegExp(`\\n?${PERSONA_TONE_BLOCK_START}[\\s\\S]*?${PERSONA_TONE_BLOCK_END}\\n?`, "gu");
  const cleaned = existingText.replace(blockRegex, "\n").trim();
  if (tone === "default") {
    return cleaned ? `${cleaned}\n` : "";
  }
  const opt = PERSONA_TONE_OPTIONS.find((item) => item.id === tone);
  if (!opt) return cleaned ? `${cleaned}\n` : "";
  const block = [PERSONA_TONE_BLOCK_START, "## 星友专属对话性格风格", opt.promptDirective, PERSONA_TONE_BLOCK_END].join(
    "\n",
  );
  return cleaned ? `${cleaned}\n\n${block}\n` : `${block}\n`;
}

interface ProactiveCareConfig {
  taskFollowupEnabled: boolean;
  taskFollowupDelayMinutes: number;
  followupDelayUnit: FollowupDelayUnit;
  stalledRecoveryEnabled: boolean;
  idleCareEnabled: boolean;
  times: [string, string, string];
  lastRemindedMessageId?: string;
  lastIdleCareDate?: string;
  lastFollowupAtMs?: number;
}

const DEFAULT_PROACTIVE_CARE: ProactiveCareConfig = {
  taskFollowupEnabled: false,
  taskFollowupDelayMinutes: 120,
  followupDelayUnit: "hours",
  stalledRecoveryEnabled: false,
  idleCareEnabled: false,
  times: ["09:00", "12:30", "21:00"],
};

function clampDelayMinutes(val: unknown, fallback = 120): number {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.min(10_080, Math.round(num));
}

function readProactiveCareConfig(agentId: string): ProactiveCareConfig {
  try {
    const raw = window.localStorage.getItem(`${PROACTIVE_CONFIG_KEY_PREFIX}${agentId}`);
    if (!raw) return { ...DEFAULT_PROACTIVE_CARE, times: [...DEFAULT_PROACTIVE_CARE.times] };
    const parsed = JSON.parse(raw) as Partial<ProactiveCareConfig>;
    const rawTimes = Array.isArray(parsed.times) ? parsed.times : [];
    const validTime = (val: unknown, fallback: string) =>
      typeof val === "string" && /^\d{2}:\d{2}$/u.test(val) ? val : fallback;
    const delayMins = clampDelayMinutes(parsed.taskFollowupDelayMinutes, 120);
    const unit: FollowupDelayUnit =
      parsed.followupDelayUnit === "minutes" || parsed.followupDelayUnit === "hours"
        ? parsed.followupDelayUnit
        : delayMins % 60 === 0
          ? "hours"
          : "minutes";
    return {
      taskFollowupEnabled: parsed.taskFollowupEnabled === true,
      taskFollowupDelayMinutes: delayMins,
      followupDelayUnit: unit,
      stalledRecoveryEnabled: parsed.stalledRecoveryEnabled === true,
      idleCareEnabled: parsed.idleCareEnabled === true,
      times: [validTime(rawTimes[0], "09:00"), validTime(rawTimes[1], "12:30"), validTime(rawTimes[2], "21:00")],
      ...(typeof parsed.lastRemindedMessageId === "string"
        ? { lastRemindedMessageId: parsed.lastRemindedMessageId }
        : {}),
      ...(typeof parsed.lastIdleCareDate === "string" ? { lastIdleCareDate: parsed.lastIdleCareDate } : {}),
      ...(typeof parsed.lastFollowupAtMs === "number" && Number.isFinite(parsed.lastFollowupAtMs)
        ? { lastFollowupAtMs: parsed.lastFollowupAtMs }
        : {}),
    };
  } catch {
    return { ...DEFAULT_PROACTIVE_CARE, times: [...DEFAULT_PROACTIVE_CARE.times] };
  }
}

function writeProactiveCareConfig(agentId: string, config: ProactiveCareConfig): void {
  try {
    window.localStorage.setItem(`${PROACTIVE_CONFIG_KEY_PREFIX}${agentId}`, JSON.stringify(config));
  } catch {}
}

function slotCountForFrequency(freq: ProactiveChatFrequency): number {
  if (freq === "once") return 1;
  if (freq === "twice") return 2;
  if (freq === "thrice") return 3;
  return 0;
}

function buildSlotPrompt(index: number, total: number, time: string): { suffix: string; promptHint: string } {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  const period = hour < 11 ? "上午" : hour < 15 ? "中午/午后" : hour < 19 ? "傍晚" : "晚间";
  const suffix = total === 1 ? `每日问候 (${time})` : `陪伴时段 ${index + 1} (${time})`;
  const promptHint = `现在是${period} ${time}。请以你自己的专属名字、角色性格与过往记忆，自然简短地主动找用户打个招呼。如果最近聊天里有尚未闭环的待办事项或约定，顺便温和提醒一句看是否需要继续推进；如果没有待办，就像老朋友一样轻松问候或分享一个小灵感（不要像生硬的系统通知）。`;
  return { suffix, promptHint };
}

const PROACTIVE_FREQUENCY_CHIPS: ReadonlyArray<{ id: ProactiveChatFrequency; label: string }> = [
  { id: "off", label: "关闭问候" },
  { id: "once", label: "每天 1 次" },
  { id: "twice", label: "每天 2 次" },
  { id: "thrice", label: "每天 3 次" },
];

const UNFINISHED_TASK_REGEX =
  /(?:[？?]\s*$|下一步|需要你确认|请告诉我|要不要继续|是否继续|待办|未完成|稍后|待会|一会|明天再|还没|先这样|卡在|报错|重试|TODO)/iu;

const INSPECTOR_WIDTH_KEY = "starbot:inspector-width";
const INSPECTOR_DEFAULT_WIDTH = 332;
const INSPECTOR_MIN_WIDTH = 288;
const INSPECTOR_MAX_WIDTH = 540;

function readInitialInspectorWidth(): number {
  try {
    const raw = Number(window.localStorage.getItem(INSPECTOR_WIDTH_KEY));
    if (Number.isFinite(raw) && raw >= INSPECTOR_MIN_WIDTH && raw <= INSPECTOR_MAX_WIDTH) {
      return Math.round(raw);
    }
  } catch {}
  return INSPECTOR_DEFAULT_WIDTH;
}

function applyInspectorWidthVar(px: number): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--starbot-inspector-width", `${px}px`);
  }
}

function readInitialInspectorOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(INSPECTOR_STORAGE_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

const [inspectorOpenSignal, setInspectorOpenSignal] = createSignal<boolean>(readInitialInspectorOpen());
const [inspectorWidthSignal, setInspectorWidthSignal] = createSignal<number>(readInitialInspectorWidth());
applyInspectorWidthVar(inspectorWidthSignal());

export function starbotInspectorOpen(): boolean {
  return inspectorOpenSignal();
}

export function setStarbotInspectorOpen(open: boolean): void {
  setInspectorOpenSignal(open);
  try {
    window.localStorage.setItem(INSPECTOR_STORAGE_KEY, String(open));
  } catch {}
}

export function toggleStarbotInspector(): void {
  setStarbotInspectorOpen(!inspectorOpenSignal());
}

function isProactiveChatScheduleRoutine(routine: RoutineEditorRecord): boolean {
  return routine.name.startsWith(PROACTIVE_CHAT_PREFIX);
}

function isProactiveRoutine(routine: RoutineEditorRecord): boolean {
  return routine.name.startsWith(PROACTIVE_CHAT_PREFIX) || routine.name.startsWith(PROACTIVE_FOLLOWUP_PREFIX);
}

function detectProactiveFrequency(routines: readonly RoutineEditorRecord[]): ProactiveChatFrequency {
  const activeProactive = routines.filter((r) => isProactiveChatScheduleRoutine(r) && r.active);
  if (activeProactive.length >= 3) return "thrice";
  if (activeProactive.length === 2) return "twice";
  if (activeProactive.length === 1) return "once";
  return "off";
}

function formatCompactTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 10_000) return `${(n / 10_000).toFixed(2)} 万`;
  return n.toLocaleString("zh-CN");
}

type InspectorSubView = "main" | "routines" | "memories" | "usage" | "permissions" | "proactive";
export type StarBotInspectorDeepTarget = InspectorSubView | "skills";

const [inspectorTargetRequest, setInspectorTargetRequest] = createSignal<{
  target: StarBotInspectorDeepTarget;
  nonce: number;
} | null>(null);
let inspectorTargetNonce = 0;

export function openStarBotInspectorTarget(target: StarBotInspectorDeepTarget = "main"): void {
  setStarbotInspectorOpen(true);
  inspectorTargetNonce += 1;
  setInspectorTargetRequest({ target, nonce: inspectorTargetNonce });
}

export function StarBotInspectorPanel(props: {
  onClose: () => void;
  onOpenUsage?: ((trigger: HTMLButtonElement) => void) | undefined;
}) {
  const text = useText();
  const {
    props: convProps,
    settingsModel,
    settingsProvider,
    settingsReasoning,
    selectAndConfirmModel,
    selectAndConfirmReasoning,
    fastMode,
    ultrafast,
    fastModeChange,
  } = useConversationViewScope();

  const agent = () => convProps.agent;
  const [subView, setSubView] = createSignal<InspectorSubView>("main");
  const [skillsModalOpen, setSkillsModalOpen] = createSignal(false);

  // Editable Name & Unified Role Identity (角色身份)
  const [nameDraft, setNameDraft] = createSignal("");
  const [personaDraft, setPersonaDraft] = createSignal("");
  const [savingIdentity, setSavingIdentity] = createSignal(false);

  // Routines state (contains both business routines and [主动聊天] routines)
  const [allRoutines, setAllRoutines] = createSignal<RoutineEditorRecord[]>([]);
  const [togglingRoutineId, setTogglingRoutineId] = createSignal<string | null>(null);
  const [newRoutineName, setNewRoutineName] = createSignal("");
  const [newRoutineTime, setNewRoutineTime] = createSignal("09:00");
  const [newRoutineInstruction, setNewRoutineInstruction] = createSignal("");
  const [creatingRoutine, setCreatingRoutine] = createSignal(false);
  const [syncingProactive, setSyncingProactive] = createSignal(false);

  // Memories state
  const [memories, setMemories] = createSignal<MemoryEntry[]>([]);
  const [memorySelections, setMemorySelections] = createSignal<Record<string, AgentMemorySelection>>({});
  const [memoryCategoryFilter, setMemoryCategoryFilter] = createSignal<"all" | StarBotMemoryCategory>("all");
  const [newMemoryText, setNewMemoryText] = createSignal("");
  const [editingMemoryId, setEditingMemoryId] = createSignal<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = createSignal("");
  const [addingMemory, setAddingMemory] = createSignal(false);
  const [savingMemoryToggle, setSavingMemoryToggle] = createSignal(false);
  const [syncingMemoryMd, setSyncingMemoryMd] = createSignal(false);

  // Skills count
  const [skillCount, setSkillCount] = createSignal(0);

  // Per-agent 30d Usage summary
  const [usageSummary, setUsageSummary] = createSignal<{
    tokens: number;
    turns: number;
    costUsd: number | null;
  } | null>(null);

  // Permissions, Browser Profile & Persona Tone state (温柔 / 毒舌 / 热血)
  const [savingAccess, setSavingAccess] = createSignal(false);
  const [browserProfiles, setBrowserProfiles] = createSignal<Array<{ id: string; name: string }>>([]);
  const [agentBrowserProfileId, setAgentBrowserProfileId] = createSignal<string | null>(null);
  const [savingBrowserProfile, setSavingBrowserProfile] = createSignal(false);
  const [personaTone, setPersonaTone] = createSignal<StarBotPersonaTone>("default");
  const [savingStyle, setSavingStyle] = createSignal(false);
  const [proactiveCare, setProactiveCare] = createSignal<ProactiveCareConfig>({
    ...DEFAULT_PROACTIVE_CARE,
    times: [...DEFAULT_PROACTIVE_CARE.times],
  });

  // Load per-agent Persona Tone
  createEffect(
    () => [agent()?.id, convProps.server?.id] as const,
    ([agentId, serverId]) => {
      if (!agentId) {
        setPersonaTone("default");
        return;
      }
      const savedLocal = readPersonaTone(agentId);
      setPersonaTone(savedLocal);
      if (!window.openbot?.agent?.readAgentInstructions) return;
      let alive = true;
      void window.openbot.agent
        .readAgentInstructions(agentId, serverId ?? LOCAL_SERVER_ID)
        .then((file) => {
          if (!alive || !file?.text) return;
          if (file.text.includes(PERSONA_TONE_BLOCK_START)) {
            const matched = PERSONA_TONE_OPTIONS.find((opt) => file.text.includes(opt.fullLabel));
            if (matched) {
              setPersonaTone(matched.id);
              writePersonaTone(agentId, matched.id);
            }
          }
        })
        .catch(() => undefined);
      onCleanup(() => {
        alive = false;
      });
    },
  );

  async function selectPersonaTone(clickedId: Exclude<StarBotPersonaTone, "default">): Promise<void> {
    const current = agent();
    if (!current || savingStyle()) return;
    const nextTone: StarBotPersonaTone = personaTone() === clickedId ? "default" : clickedId;
    const zodiacId = zodiacForShape(bloubAvatarProfile(current.avatarSeed ?? current.id, current.avatarHue).shape).id;
    void playKawaiiCue(nextTone === "default" ? "toggle-off" : "mascot-happy", { zodiac: zodiacId });
    const serverId = convProps.server?.id ?? LOCAL_SERVER_ID;
    setSavingStyle(true);
    setPersonaTone(nextTone);
    writePersonaTone(current.id, nextTone);
    try {
      if (window.openbot?.agent?.readAgentInstructions && window.openbot?.agent?.saveAgentInstructions) {
        const currentFile = await window.openbot.agent.readAgentInstructions(current.id, serverId);
        const nextText = injectPersonaToneIntoInstructions(currentFile.text ?? "", nextTone);
        await window.openbot.agent.saveAgentInstructions(
          {
            agentId: current.id,
            text: nextText,
            expected: currentFile.text ?? "",
          },
          serverId,
        );
      }
      if (nextTone === "default") {
        actionToast.success(`已恢复「${current.name}」默认对话语气`);
      } else {
        const opt = PERSONA_TONE_OPTIONS.find((o) => o.id === nextTone);
        actionToast.success(`已切换「${current.name}」为「${opt?.fullLabel ?? nextTone}」性格风格`);
      }
    } catch {
      actionToast.error("同步性格风格失败，请重试");
    } finally {
      setSavingStyle(false);
    }
  }

  // Load per-agent Proactive Care config & sync saved times from routines
  createEffect(
    () => agent()?.id,
    (agentId) => {
      if (!agentId) return;
      setProactiveCare(readProactiveCareConfig(agentId));
    },
  );

  createEffect(
    () => allRoutines(),
    (routines) => {
      const activeScheduled = routines.filter((r) => isProactiveChatScheduleRoutine(r) && r.active);
      if (activeScheduled.length === 0) return;
      const extracted = activeScheduled
        .map((r) => {
          const draft = routineScheduleToDraft(routineScheduleOf(r));
          return "time" in draft && typeof draft.time === "string" ? draft.time : null;
        })
        .filter((t): t is string => Boolean(t && /^\d{2}:\d{2}$/u.test(t)))
        .sort();
      if (extracted.length === 0) return;
      const current = agent();
      setProactiveCare((prev) => {
        const nextTimes: [string, string, string] = [
          extracted[0] ?? prev.times[0],
          extracted[1] ?? prev.times[1],
          extracted[2] ?? prev.times[2],
        ];
        if (nextTimes[0] === prev.times[0] && nextTimes[1] === prev.times[1] && nextTimes[2] === prev.times[2]) {
          return prev;
        }
        const next = { ...prev, times: nextTimes };
        if (current) writeProactiveCareConfig(current.id, next);
        return next;
      });
    },
  );

  function updateProactiveCarePatch(patch: Partial<ProactiveCareConfig>): ProactiveCareConfig {
    const current = agent();
    const next: ProactiveCareConfig = {
      ...proactiveCare(),
      ...patch,
      times: patch.times ? [...patch.times] : [...proactiveCare().times],
    };
    setProactiveCare(next);
    if (current) writeProactiveCareConfig(current.id, next);
    return next;
  }

  const zodiac = createMemo(() => {
    const current = agent();
    if (!current) return null;
    const profile = bloubAvatarProfile(current.avatarSeed, null);
    return zodiacForShape(profile.shape);
  });

  // Reset subView only when switching between different agents
  let previousInspectorAgentId: string | undefined;
  createEffect(
    () => agent()?.id,
    (nextId) => {
      if (previousInspectorAgentId !== undefined && nextId !== previousInspectorAgentId) {
        setSubView("main");
      }
      previousInspectorAgentId = nextId;
    },
  );

  // Respond to external deep-link navigation requests (e.g. SettingLinkChatCard or shortcuts)
  let handledInspectorTargetNonce = 0;
  createEffect(inspectorTargetRequest, (req) => {
    if (!req || req.nonce === handledInspectorTargetNonce) return;
    handledInspectorTargetNonce = req.nonce;
    if (req.target === "skills") {
      setSubView("main");
      setSkillsModalOpen(true);
    } else {
      setSubView(req.target);
    }
  });

  // Load built-in browser profiles when viewing permissions sub-view
  createEffect(
    () => [subView(), agent()?.id, convProps.server?.id] as const,
    ([view, agentId, serverId]) => {
      if (view !== "permissions" || !agentId || !window.openbot?.agent?.listBrowserProfiles) return;
      let alive = true;
      const calls = desktopBrowserProfileCalls(serverId ?? LOCAL_SERVER_ID);
      void Promise.all([calls.list().catch(() => null), calls.readAgent(agentId).catch(() => null)]).then(
        ([listRes, agentProfile]) => {
          if (!alive) return;
          if (listRes?.profiles) {
            setBrowserProfiles(listRes.profiles.map((p) => ({ id: p.id, name: p.name })));
          }
          if (!agentProfile || agentProfile.kind === "shared") {
            setAgentBrowserProfileId("");
          } else if (agentProfile.kind === "agent") {
            setAgentBrowserProfileId("__agent__");
          } else {
            setAgentBrowserProfileId(agentProfile.profileId);
          }
        },
      );
      onCleanup(() => {
        alive = false;
      });
    },
  );

  async function handleSelectBrowserProfile(rawVal: string): Promise<void> {
    const current = agent();
    if (!current || savingBrowserProfile()) return;
    setSavingBrowserProfile(true);
    try {
      const calls = desktopBrowserProfileCalls(convProps.server?.id ?? LOCAL_SERVER_ID);
      const profile = !rawVal
        ? ({ kind: "shared" } as const)
        : rawVal === "__agent__"
          ? ({ kind: "agent" } as const)
          : ({ kind: "profile", profileId: rawVal } as const);
      const updated = await calls.updateAgent({ agentId: current.id, profile });
      setAgentBrowserProfileId(
        updated.kind === "shared" ? "" : updated.kind === "agent" ? "__agent__" : updated.profileId,
      );
      actionToast.success(
        updated.kind === "shared"
          ? "已切换为默认共享浏览器档案"
          : updated.kind === "agent"
            ? "已切换为当前星友专属独立登录档案"
            : "已切换浏览器登录档案",
      );
    } catch {
      actionToast.error("切换浏览器登录档案失败");
    } finally {
      setSavingBrowserProfile(false);
    }
  }

  createEffect(
    () => [agent()?.id, agent()?.name, agent()?.title, agent()?.description] as const,
    ([, name, title, description]) => {
      setNameDraft(name ?? "");
      const desc = (description ?? "").trim();
      const ttl = (title ?? "").trim();
      const merged =
        desc && desc !== "General-purpose assistant"
          ? ttl && !desc.includes(ttl)
            ? `${ttl}。${desc}`
            : desc
          : ttl || desc;
      setPersonaDraft(merged === "General-purpose assistant" ? "" : merged);
    },
  );

  const personaDirty = () => {
    const current = agent();
    if (!current) return false;
    const baseline =
      (current.description ?? "").trim() === "General-purpose assistant" ? "" : (current.description ?? "").trim();
    return personaDraft().trim() !== baseline;
  };

  async function saveAgentName(): Promise<void> {
    const current = agent();
    const trimmed = nameDraft().trim();
    if (!current || !trimmed || trimmed === current.name) {
      if (current && !trimmed) setNameDraft(current.name);
      return;
    }
    try {
      await convProps.onUpdateAgent(current.id, { name: trimmed });
      actionToast.success("已更新星友名称");
    } catch {
      actionToast.error("更新名称失败");
    }
  }

  async function saveRoleIdentity(): Promise<void> {
    const current = agent();
    if (!current || savingIdentity()) return;
    const nextDesc = personaDraft().trim();
    const currentBaseline =
      (current.description ?? "").trim() === "General-purpose assistant" ? "" : (current.description ?? "").trim();
    if (nextDesc === currentBaseline && !(current.title ?? "").trim()) return;
    setSavingIdentity(true);
    try {
      await convProps.onUpdateAgent(current.id, {
        title: "",
        description: nextDesc,
      });
      actionToast.success("角色身份已保存");
    } catch {
      actionToast.error("保存角色身份失败");
    } finally {
      setSavingIdentity(false);
    }
  }

  // Load & subscribe routines
  const routinesPort = createMemo(() => {
    const current = agent();
    if (!current) return null;
    return agentRoutinesPort(
      current.id,
      undefined,
      convProps.server?.kind === "local",
      convProps.runtime?.routines ?? window.openbot.agent,
    );
  });

  createEffect(routinesPort, (port) => {
    if (!port) {
      setAllRoutines([]);
      return;
    }
    let active = true;
    const reload = () => {
      void port
        .list()
        .then((list) => {
          if (active) setAllRoutines(list);
        })
        .catch(() => undefined);
    };
    reload();
    const unsub = port.subscribe(reload);
    onCleanup(() => {
      active = false;
      unsub();
    });
  });

  const businessRoutines = createMemo(() => allRoutines().filter((r) => !isProactiveRoutine(r)));
  const proactiveFrequency = createMemo(() => detectProactiveFrequency(allRoutines()));
  const proactiveActiveAny = createMemo(
    () =>
      proactiveFrequency() !== "off" ||
      proactiveCare().taskFollowupEnabled ||
      proactiveCare().stalledRecoveryEnabled ||
      proactiveCare().idleCareEnabled,
  );
  const proactiveLabel = createMemo(() => {
    const freq = proactiveFrequency();
    const care = proactiveCare();
    const parts: string[] = [];
    if (care.taskFollowupEnabled) parts.push("待办提醒");
    if (freq === "once") parts.push(`${care.times[0]}`);
    else if (freq === "twice") parts.push("每天 2 次");
    else if (freq === "thrice") parts.push("每天 3 次");
    else if (care.idleCareEnabled && !care.taskFollowupEnabled) parts.push("闲置关怀");
    return parts.length > 0 ? parts.join(" · ") : "未开启";
  });

  // Load & subscribe memories
  const memoriesPort = createMemo(() => {
    const current = agent();
    if (!current) return null;
    return agentMemoriesPort(current.id, current.name, null, convProps.runtime?.agentMemories ?? window.openbot.agent);
  });

  createEffect(memoriesPort, (port) => {
    if (!port) {
      setMemories([]);
      setMemorySelections({});
      return;
    }
    let active = true;
    const reload = () => {
      void port
        .list()
        .then((list) => {
          if (active) setMemories(list);
        })
        .catch(() => undefined);
      if (port.selection) {
        void port.selection
          .read()
          .then((state) => {
            if (!active || !state) return;
            const map: Record<string, AgentMemorySelection> = {};
            for (const sel of state.selections) {
              map[sel.memoryId] = sel;
            }
            setMemorySelections(map);
          })
          .catch(() => undefined);
      }
    };
    reload();
    const unsub = port.subscribe(reload);
    onCleanup(() => {
      active = false;
      unsub();
    });
  });

  // Load skill count for active agent
  createEffect(
    () => [agent()?.id, convProps.server?.id] as const,
    ([agentId, serverId]) => {
      if (!agentId) {
        setSkillCount(0);
        return;
      }
      let alive = true;
      void skillsPort()
        .agent.listAgentSkills(agentId, serverId ?? LOCAL_SERVER_ID)
        .then((skills) => {
          if (alive) setSkillCount(assignedSkillCount(skills));
        })
        .catch(() => undefined);
      onCleanup(() => {
        alive = false;
      });
    },
  );

  // Load 30-day usage snapshot for active agent
  createEffect(
    () => [agent()?.id, convProps.server?.id] as const,
    ([agentId, serverId]) => {
      if (!agentId || !window.openbot?.agent?.getHostAnalytics) {
        setUsageSummary(null);
        return;
      }
      let alive = true;
      const { startDate, endDate, timeZone } = analyticsRange("", 30);
      void window.openbot.agent
        .getHostAnalytics({ startDate, endDate, timeZone, agentId }, serverId ?? LOCAL_SERVER_ID)
        .then((res) => {
          if (!alive || !res) return;
          setUsageSummary({
            tokens: res.totals.processedTokens,
            turns: res.totals.turns,
            costUsd: res.totals.estimatedCostUsd,
          });
        })
        .catch(() => undefined);
      onCleanup(() => {
        alive = false;
      });
    },
  );

  async function toggleRoutine(routine: RoutineEditorRecord, nextActive: boolean): Promise<void> {
    const port = routinesPort();
    if (!port || togglingRoutineId() === routine.id) return;
    setTogglingRoutineId(routine.id);
    try {
      await port.save({
        routineId: routine.id,
        name: routine.name,
        instruction: routine.instruction,
        active: nextActive,
        timezone: routine.timezone,
        schedule: routineScheduleOf(routine),
        ...(!isEventRoutine(routine)
          ? {
              limitPolicy: routine.limitPolicy,
              missedPolicy: routine.missedPolicy,
              runIn: routine.runIn,
            }
          : {}),
      });
      setAllRoutines((list) => list.map((item) => (item.id === routine.id ? { ...item, active: nextActive } : item)));
    } catch {
      actionToast.error("无法更新定时任务状态");
    } finally {
      setTogglingRoutineId(null);
    }
  }

  async function handleCreateQuickRoutine(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const port = routinesPort();
    const name = newRoutineName().trim();
    const instruction = newRoutineInstruction().trim();
    if (!port || creatingRoutine()) return;
    if (!name || !instruction) {
      actionToast.warning("请填写任务名称和具体内容");
      return;
    }
    setCreatingRoutine(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const schedule = routineScheduleFromDraft({
        kind: "daily",
        days: [...ROUTINE_EVERY_DAY],
        time: /^\d{2}:\d{2}$/u.test(newRoutineTime()) ? newRoutineTime() : "09:00",
      });
      await port.save({
        routineId: null,
        name,
        instruction,
        active: true,
        timezone: tz,
        schedule,
        trigger: { kind: "schedule", schedule },
        missedPolicy: "skip",
        limitPolicy: "wait",
      });
      setNewRoutineName("");
      setNewRoutineInstruction("");
      const fresh = await port.list();
      setAllRoutines(fresh);
      actionToast.success("定时任务已添加");
    } catch {
      actionToast.error("创建定时任务失败");
    } finally {
      setCreatingRoutine(false);
    }
  }

  async function removeRoutineById(id: string): Promise<void> {
    const port = routinesPort();
    if (!port) return;
    try {
      await port.remove(id);
      setAllRoutines((list) => list.filter((r) => r.id !== id));
    } catch {
      actionToast.error("删除任务失败");
    }
  }

  // Real Backend Sync for Proactive Daily Chat Schedule (with user-chosen custom times!)
  async function syncProactiveDailySchedule(
    freq: ProactiveChatFrequency,
    customTimes: [string, string, string] = proactiveCare().times,
    silent = false,
  ): Promise<void> {
    const port = routinesPort();
    const current = agent();
    if (!port || !current || syncingProactive()) return;
    setSyncingProactive(true);
    try {
      const existingProactive = allRoutines().filter(isProactiveChatScheduleRoutine);
      for (const old of existingProactive) {
        await port.remove(old.id);
      }
      const count = slotCountForFrequency(freq);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const targetTimes = customTimes.slice(0, count);
      for (let i = 0; i < targetTimes.length; i += 1) {
        const rawTime = targetTimes[i] ?? "09:00";
        const cleanTime = /^\d{2}:\d{2}$/u.test(rawTime) ? rawTime : "09:00";
        const { suffix, promptHint } = buildSlotPrompt(i, count, cleanTime);
        const schedule = routineScheduleFromDraft({
          kind: "daily",
          days: [...ROUTINE_EVERY_DAY],
          time: cleanTime,
        });
        await port.save({
          routineId: null,
          name: `${PROACTIVE_CHAT_PREFIX} ${suffix}`,
          instruction: promptHint,
          active: true,
          timezone: tz,
          schedule,
          trigger: { kind: "schedule", schedule },
          missedPolicy: "skip",
          limitPolicy: "wait",
          runIn: "chat",
        });
      }
      const fresh = await port.list();
      setAllRoutines(fresh);
      if (!silent) {
        actionToast.success(
          freq === "off"
            ? `已关闭「${current.name}」的定时问候`
            : `已更新「${current.name}」定时陪伴（${targetTimes.join(" · ")}）`,
        );
      }
    } catch {
      actionToast.error("同步主动陪伴时间失败，请重试");
    } finally {
      setSyncingProactive(false);
    }
  }

  async function handleCustomSlotTimeChange(slotIndex: 0 | 1 | 2, nextTime: string): Promise<void> {
    if (!/^\d{2}:\d{2}$/u.test(nextTime)) return;
    const nextTimes: [string, string, string] = [...proactiveCare().times];
    nextTimes[slotIndex] = nextTime;
    updateProactiveCarePatch({ times: nextTimes });
    const freq = proactiveFrequency();
    if (freq !== "off") {
      await syncProactiveDailySchedule(freq, nextTimes, false);
    }
  }

  // Real Smart Unfinished-Task & Stalled-Conversation Follow-up Monitor
  // Strictly guarded against Solid 2.0 effect re-runs, leaked intervals, and self-triggering loops.
  createEffect(
    () => {
      const id = agent()?.id ?? "";
      const srv = convProps.server?.id ?? LOCAL_SERVER_ID;
      return id ? `${id}|${srv}` : "";
    },
    (key) => {
      if (!key || !window.openbot?.agent?.readConversationPage) return;
      const [agentId, serverId] = key.split("|");
      if (!agentId) return;
      let disposed = false;

      const tick = async () => {
        if (disposed || proactiveTickInFlight.has(agentId)) return;
        const cfg = readProactiveCareConfig(agentId);
        if (!cfg.taskFollowupEnabled && !cfg.stalledRecoveryEnabled && !cfg.idleCareEnabled) return;

        const nowMs = Date.now();
        const minCooldownMs = Math.max(cfg.taskFollowupDelayMinutes * 60_000, PROACTIVE_FOLLOWUP_COOLDOWN_MS);
        const lastFired = Math.max(proactiveLastFiredAt.get(agentId) ?? 0, cfg.lastFollowupAtMs ?? 0);
        if (lastFired > 0 && nowMs - lastFired < minCooldownMs) return;

        const port = routinesPort();
        if (!port) return;

        proactiveTickInFlight.add(agentId);
        try {
          const page = await window.openbot.agent.readConversationPage(
            { agentId, anchor: { type: "latest" }, limit: 6 },
            serverId || LOCAL_SERVER_ID,
          );
          const msgs = page?.messages ?? [];
          if (msgs.length === 0) return;

          // Pick the genuinely newest message by timestamp regardless of sort order
          let last = msgs[0];
          let newestMs = -1;
          for (const m of msgs) {
            const ts = typeof m.createdAt === "string" ? Date.parse(m.createdAt) : Number(m.createdAt);
            if (Number.isFinite(ts) && ts >= newestMs) {
              newestMs = ts;
              last = m;
            }
          }
          if (!last || !last.id || !Number.isFinite(newestMs) || newestMs <= 0) return;
          if (last.status === "streaming") return;

          // Never double-remind on the same latest message
          if (cfg.lastRemindedMessageId === last.id) return;

          // Never self-trigger on our own proactive follow-up prompt or its reply
          const lastText = typeof last.text === "string" ? last.text : "";
          const recentText = msgs
            .slice(-3)
            .map((m) => (typeof m.text === "string" ? m.text : ""))
            .join("\n");
          if (
            lastText.includes(PROACTIVE_FOLLOWUP_PREFIX) ||
            lastText.includes("距离我们上一次对话已经过去了一段时间") ||
            lastText.includes("本次跟进测试结果") ||
            recentText.includes("距离我们上一次对话已经过去了一段时间")
          ) {
            return;
          }

          const elapsedMin = (nowMs - newestMs) / 60_000;
          const delayThresholdMin = Math.max(cfg.taskFollowupDelayMinutes, 10);

          let followupPrompt: string | null = null;

          if (
            cfg.stalledRecoveryEnabled &&
            elapsedMin >= delayThresholdMin &&
            (last.author === "user" || last.status === "failed" || last.status === "interrupted")
          ) {
            followupPrompt =
              "检测到上一条对话请求发出后中断或尚未完整收尾。请以你自己的专属名字与角色语气，主动温和地向用户致意，并直接接着推进或询问是否现在继续完成上一件事。";
          } else if (
            cfg.taskFollowupEnabled &&
            elapsedMin >= delayThresholdMin &&
            UNFINISHED_TASK_REGEX.test(lastText)
          ) {
            followupPrompt =
              "距离我们上一次对话已经过去了一段时间，且对话中似乎还有未收尾的任务、待确认事项或约定（请先回顾上方最近的聊天内容）。请以你自己的专属名字与角色性格，自然简短地主动提醒用户该事项的当前卡点或下一步，询问是否需要现在继续完成（简短贴心，不要冗长重复）。";
          } else if (cfg.idleCareEnabled && elapsedMin >= 24 * 60 && last.author === "assistant") {
            const today = new Date().toISOString().slice(0, 10);
            if (cfg.lastIdleCareDate !== today) {
              followupPrompt =
                "你们已经超过一天没有互动了。请结合你们的共同记忆与你自己的专属角色性格，轻轻主动打个招呼或关心一下近况（一句话自然破冰即可）。";
            }
          }

          if (!followupPrompt || disposed) return;

          // Record cooldown BEFORE dispatching so concurrent checks can never double-fire
          proactiveLastFiredAt.set(agentId, nowMs);
          const nextPatch: Partial<ProactiveCareConfig> = {
            lastRemindedMessageId: last.id,
            lastFollowupAtMs: nowMs,
            ...(cfg.idleCareEnabled && elapsedMin >= 24 * 60
              ? { lastIdleCareDate: new Date().toISOString().slice(0, 10) }
              : {}),
          };
          writeProactiveCareConfig(agentId, { ...cfg, ...nextPatch });
          updateProactiveCarePatch(nextPatch);

          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const schedule = routineScheduleFromDraft({
            kind: "daily",
            days: [...ROUTINE_EVERY_DAY],
            time: "09:00",
          });
          const existingHelper = (await port.list()).find((r) => r.name === `${PROACTIVE_FOLLOWUP_PREFIX} 智能跟进`);
          const saved = await port.save({
            routineId: existingHelper?.id ?? null,
            name: `${PROACTIVE_FOLLOWUP_PREFIX} 智能跟进`,
            instruction: followupPrompt,
            active: false,
            timezone: tz,
            schedule,
            trigger: { kind: "schedule", schedule },
            missedPolicy: "skip",
            limitPolicy: "wait",
            runIn: "chat",
          });
          await port.test(saved.routine.id);
        } catch {
          // Ignore transient polling errors silently
        } finally {
          proactiveTickInFlight.delete(agentId);
        }
      };

      const timer = window.setInterval(() => void tick(), 5 * 60_000);
      return () => {
        disposed = true;
        window.clearInterval(timer);
      };
    },
  );

  async function toggleMemoryEnabled(enabled: boolean): Promise<void> {
    const current = agent();
    if (!current || savingMemoryToggle()) return;
    setSavingMemoryToggle(true);
    try {
      await convProps.onUpdateAgent(current.id, { memory: enabled });
    } catch {
      actionToast.error("切换记忆开关失败");
    } finally {
      setSavingMemoryToggle(false);
    }
  }

  async function addQuickMemory(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const port = memoriesPort();
    const current = agent();
    const value = newMemoryText().trim();
    if (!port || !current || !value || addingMemory()) return;
    setAddingMemory(true);
    try {
      const detected = parseMemoryCategory(value);
      const cat = detected.explicitTag ? detected.category : detected.category;
      const tagged = formatTaggedMemory(cat, value);
      await port.create(tagged);
      if (cat === "profile") {
        addGlobalUserProfileItem(value);
      }
      setNewMemoryText("");
      const list = await port.list();
      setMemories(list);
      void syncMemoriesToAgentInstructions(current.id, current.name, list, convProps.server?.id ?? LOCAL_SERVER_ID);
      actionToast.success("已添加记忆");
    } catch {
      actionToast.error("添加记忆失败");
    } finally {
      setAddingMemory(false);
    }
  }

  async function saveInlineMemoryEdit(mem: MemoryEntry): Promise<void> {
    const port = memoriesPort();
    const current = agent();
    const nextRaw = editingMemoryText().trim();
    if (!port || !current || !nextRaw) {
      setEditingMemoryId(null);
      return;
    }
    try {
      const { category } = parseMemoryCategory(mem.text);
      const tagged = formatTaggedMemory(category, nextRaw);
      await port.update(mem.id, tagged);
      setEditingMemoryId(null);
      const list = await port.list();
      setMemories(list);
      void syncMemoriesToAgentInstructions(current.id, current.name, list, convProps.server?.id ?? LOCAL_SERVER_ID);
      actionToast.success("记忆内容已更新");
    } catch {
      actionToast.error("更新记忆失败");
    }
  }

  async function togglePinMemory(mem: MemoryEntry): Promise<void> {
    const port = memoriesPort();
    if (!port?.selection) return;
    const currentSel = memorySelections()[mem.id];
    const nextInclusion = currentSel?.inclusion === "essential" ? "searchable" : "essential";
    try {
      const state = await port.selection.set([
        {
          memoryId: mem.id,
          inclusion: nextInclusion,
          expectedRevision: currentSel?.revision ?? 0,
        },
      ]);
      const map: Record<string, AgentMemorySelection> = {};
      for (const sel of state.selections) map[sel.memoryId] = sel;
      setMemorySelections(map);
      actionToast.success(nextInclusion === "essential" ? "📌 已设为每轮必带核心记忆" : "已改为按需检索记忆");
    } catch {
      actionToast.error("切换核心置顶状态失败");
    }
  }

  async function handleSyncAndExportMemoryMd(): Promise<void> {
    const current = agent();
    if (!current || syncingMemoryMd()) return;
    setSyncingMemoryMd(true);
    try {
      await syncMemoriesToAgentInstructions(
        current.id,
        current.name,
        memories(),
        convProps.server?.id ?? LOCAL_SERVER_ID,
      );
      downloadMemoryMarkdown(current.name, memories());
      actionToast.success("已同步工作区记忆指令并导出 MEMORY.md 文件");
    } catch {
      actionToast.error("导出 MEMORY.md 失败");
    } finally {
      setSyncingMemoryMd(false);
    }
  }

  async function deleteMemoryItem(id: string): Promise<void> {
    const port = memoriesPort();
    const current = agent();
    if (!port) return;
    try {
      await port.remove(id);
      const next = memories().filter((m) => m.id !== id);
      setMemories(next);
      if (current) {
        void syncMemoriesToAgentInstructions(current.id, current.name, next, convProps.server?.id ?? LOCAL_SERVER_ID);
      }
    } catch {
      actionToast.error("删除记忆失败");
    }
  }

  async function updateAccessMode(nextAccess: "full" | "workspace"): Promise<void> {
    const current = agent();
    if (!current || savingAccess() || !convProps.onUpdateAgentPermissions) return;
    if ((current.access ?? DEFAULT_AGENT_ACCESS) === nextAccess) return;
    setSavingAccess(true);
    try {
      await convProps.onUpdateAgentPermissions({
        agentId: current.id,
        access: nextAccess,
      });
      actionToast.success(nextAccess === "full" ? "已切换为完全访问权限" : "已切换为仅工作区访问");
    } catch {
      actionToast.error("更新权限失败");
    } finally {
      setSavingAccess(false);
    }
  }

  return (
    <Show when={agent()}>
      {(current) => {
        const currentAccess = () => current().access ?? DEFAULT_AGENT_ACCESS;
        const memoryOn = () => agentMemoryEnabled(current());
        const [draggingResize, setDraggingResize] = createSignal(false);

        const startResize = (downEvent: PointerEvent) => {
          if (downEvent.button !== 0) return;
          downEvent.preventDefault();
          setDraggingResize(true);
          const startX = downEvent.clientX;
          const startW = inspectorWidthSignal();
          const maxW = Math.min(INSPECTOR_MAX_WIDTH, Math.floor(window.innerWidth * 0.56));

          const onMove = (moveEvent: PointerEvent) => {
            const delta = startX - moveEvent.clientX;
            const nextW = Math.max(INSPECTOR_MIN_WIDTH, Math.min(maxW, Math.round(startW + delta)));
            setInspectorWidthSignal(nextW);
            applyInspectorWidthVar(nextW);
          };

          const onUp = () => {
            setDraggingResize(false);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            try {
              window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(inspectorWidthSignal()));
            } catch {}
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          window.addEventListener("pointercancel", onUp);
        };

        const resetWidth = () => {
          setInspectorWidthSignal(INSPECTOR_DEFAULT_WIDTH);
          applyInspectorWidthVar(INSPECTOR_DEFAULT_WIDTH);
          try {
            window.localStorage.setItem(INSPECTOR_WIDTH_KEY, String(INSPECTOR_DEFAULT_WIDTH));
          } catch {}
        };

        return (
          <aside class="starbot-inspector" aria-label="星友专属设定面板">
            <div
              class={`starbot-inspector-resizer${draggingResize() ? " is-dragging" : ""}`}
              role="separator"
              aria-orientation="vertical"
              aria-label="向左或向右拖拽调整星友面板宽度（双击恢复默认宽度）"
              title="拖拽调整面板宽度（双击重置）"
              onPointerDown={startResize}
              onDblClick={resetWidth}
            />
            {/* Top Header */}
            <div class="starbot-inspector-topbar">
              <Show when={subView() !== "main"} fallback={<span class="starbot-inspector-topbar-title">星友档案</span>}>
                <button type="button" class="starbot-inspector-back-btn" onClick={() => setSubView("main")}>
                  <ChevronLeft class="size-4" aria-hidden="true" />
                  <span>返回</span>
                </button>
              </Show>
              <button
                type="button"
                class="starbot-inspector-close"
                aria-label="收起右侧面板"
                title="收起右侧面板"
                onClick={props.onClose}
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* MAIN VIEW (Reference 图7-8 Clean Grouped Card Style) */}
            <Show when={subView() === "main"}>
              <div class="starbot-inspector-scroll">
                {/* Centered 3D Clay Avatar (Locked after creation) */}
                <div class="starbot-inspector-hero">
                  <div class="starbot-inspector-avatar-wrap">
                    <div class="starbot-inspector-avatar-stage">
                      <AgentAvatar agent={current()} motion="always" followPointer />
                    </div>
                  </div>
                  <div class="starbot-hero-badges-row">
                    <Show when={zodiac()}>
                      {(z) => (
                        <span class="starbot-inspector-zodiac-pill">
                          ✦ {z().nameZh} · {z().elementZh}
                        </span>
                      )}
                    </Show>
                    <button
                      type="button"
                      class={`starbot-chief-toggle-pill${isChiefStarBot(current().id) ? " is-chief" : ""}`}
                      title={
                        isChiefStarBot(current().id)
                          ? "当前为主星友（负责每晚星夜梦境记忆沉淀，点击可取消固定）"
                          : "点击将此星友固定为「👑 主星友」，负责每日星夜梦境记忆整理"
                      }
                      onClick={() => {
                        if (isManualChiefStarBot(current().id)) {
                          setManualChiefStarBotId(null);
                          actionToast.success("已恢复按活跃度自动评选主星友");
                        } else {
                          setManualChiefStarBotId(current().id);
                          actionToast.success(`👑 已将「${current().name}」设为主星友`);
                        }
                      }}
                    >
                      {isChiefStarBot(current().id) ? "👑 主星友" : "☆ 设为主星友"}
                    </button>
                  </div>
                </div>

                {/* Name + Unified Role Identity (整合性格身份、回复方式与职责) */}
                <div class="starbot-inspector-identity-fields">
                  <div class="starbot-inspector-field-block">
                    <label class="starbot-inspector-field-label">星友昵称</label>
                    <Input
                      value={nameDraft()}
                      maxlength={INPUT_LIMITS.agentName}
                      placeholder="给星友起个专属名字"
                      onValueChange={setNameDraft}
                      onBlur={() => void saveAgentName()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  </div>

                  <div class="starbot-inspector-field-block">
                    <div class="starbot-inspector-field-head">
                      <label class="starbot-inspector-field-label">灵魂人设</label>
                      <Show
                        when={personaDirty()}
                        fallback={<span class="starbot-inspector-field-sub">身份背景 · 说话腔调 · 擅长领域</span>}
                      >
                        <button
                          type="button"
                          class="starbot-inspector-save-inline"
                          disabled={savingIdentity()}
                          onClick={() => void saveRoleIdentity()}
                        >
                          {savingIdentity() ? "保存中…" : "保存修改"}
                        </button>
                      </Show>
                    </div>
                    <Textarea
                      rows={3}
                      value={personaDraft()}
                      maxlength={INPUT_LIMITS.agentDescription}
                      placeholder="设定它的身份背景、说话腔调及专门擅长的领域…"
                      onValueChange={setPersonaDraft}
                      onBlur={() => {
                        if (personaDirty()) void saveRoleIdentity();
                      }}
                    />
                  </div>
                </div>

                {/* Group 1: 内核与性格 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">内核与性格</span>
                  <div class="starbot-inspector-card-list is-model-card">
                    <div class="starbot-inspector-model-row">
                      <div class="starbot-inspector-row-left">
                        <Cpu class="size-4" aria-hidden="true" />
                        <span>驱动模型</span>
                      </div>
                      <div class="starbot-inspector-model-picker-slot">
                        <ProviderModelPicker
                          variant="pill"
                          provider={settingsProvider()}
                          foreignProvider={foreignProvider(current().provider)}
                          value={settingsModel()}
                          reasoningEffort={settingsReasoning()}
                          modelOptions={convProps.modelOptions}
                          agentStatus={convProps.agentStatus}
                          runtimeStatuses={convProps.providerRuntimeStatuses}
                          customProviders={convProps.customProviders}
                          customAgents={convProps.customAgents}
                          onDownloadProvider={convProps.onDownloadProvider}
                          onCancelProviderDownload={convProps.onCancelProviderDownload}
                          onConnectProvider={convProps.onConnectProvider}
                          canConnectProvider={convProps.canConnectProvider}
                          onManageProviders={convProps.onManageProviders}
                          accountChoice={true}
                          providerAccountId={agentNextProviderAccountId(current())}
                          workspaceOnly={workspaceAccessEnforced(current())}
                          accountUsage={convProps.accountUsage}
                          onChange={(model, provider, accountId, effort) =>
                            void selectAndConfirmModel(model, provider, accountId, effort)
                          }
                          onReasoningEffortChange={(effort) => void selectAndConfirmReasoning(effort)}
                          fastMode={fastMode()}
                          ultrafast={ultrafast()}
                          onFastModeChange={fastModeChange()}
                        />
                      </div>
                    </div>

                    <div class="starbot-inspector-model-row is-style-row">
                      <div class="starbot-inspector-row-left">
                        <Smile class="size-4" aria-hidden="true" />
                        <span>性格腔调</span>
                      </div>
                      <div class="starbot-inspector-style-seg is-three" role="group" aria-label="对话性格风格">
                        <For each={PERSONA_TONE_OPTIONS}>
                          {(opt) => (
                            <button
                              type="button"
                              class={personaTone() === opt.id ? "is-active" : ""}
                              title={`${opt.fullLabel}：${opt.hint}（再次点击可取消）`}
                              disabled={savingStyle()}
                              onClick={() => void selectPersonaTone(opt.id)}
                            >
                              {opt.shortLabel}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group 2: 脑海与本领 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">脑海与本领</span>
                  <div class="starbot-inspector-card-list">
                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSubView("memories")}>
                      <span class="starbot-inspector-row-left">
                        <BookMarked class="size-4" aria-hidden="true" />
                        <span>专属记忆</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span>{memoryOn() ? `已沉淀 ${memories().length} 条` : "已关闭"}</span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>

                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSkillsModalOpen(true)}>
                      <span class="starbot-inspector-row-left">
                        <Puzzle class="size-4" aria-hidden="true" />
                        <span>装备技能</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span>已装备 {skillCount()} 项</span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Group 3: 叮嘱与开销 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">叮嘱与开销</span>
                  <div class="starbot-inspector-card-list">
                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSubView("routines")}>
                      <span class="starbot-inspector-row-left">
                        <CalendarClock class="size-4" aria-hidden="true" />
                        <span>定时叮嘱</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span>已设 {businessRoutines().length} 项</span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>

                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSubView("usage")}>
                      <span class="starbot-inspector-row-left">
                        <Gauge class="size-4" aria-hidden="true" />
                        <span>算力足迹</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span>
                          {usageSummary() ? `${formatCompactTokens(usageSummary()!.tokens)} Token` : "查看明细"}
                        </span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Group 4: 默契与守护 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">默契与守护</span>
                  <div class="starbot-inspector-card-list">
                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSubView("permissions")}>
                      <span class="starbot-inspector-row-left">
                        <ShieldCheck class="size-4" aria-hidden="true" />
                        <span>操作边界</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span>{currentAccess() === "workspace" ? "仅限沙盒目录" : "本机全权协同"}</span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>

                    <button type="button" class="starbot-inspector-link-row" onClick={() => setSubView("proactive")}>
                      <span class="starbot-inspector-row-left">
                        <Bell class="size-4" aria-hidden="true" />
                        <span>主动陪伴</span>
                      </span>
                      <span class="starbot-inspector-row-right">
                        <span class={proactiveActiveAny() ? "is-accent" : ""}>{proactiveLabel()}</span>
                        <ChevronRight class="size-4" aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* SUB-VIEW: 记忆（极简主次层级设计） */}
            <Show when={subView() === "memories"}>
              <div class="starbot-inspector-scroll">
                {/* 1. 精简标题行 + 自动记忆开关合一 */}
                <div class="starbot-mem-minimal-head">
                  <div class="starbot-mem-minimal-title">
                    <h3>专属记忆</h3>
                    <span>对话中自动记住偏好与重要背景</span>
                  </div>
                  <Switch
                    checked={memoryOn()}
                    disabled={savingMemoryToggle()}
                    aria-label="自动记住偏好"
                    onChange={(checked) => void toggleMemoryEnabled(checked)}
                  />
                </div>

                <Show
                  when={memoryOn()}
                  fallback={<div class="starbot-inspector-empty-note">已关闭长期记忆，开启后可自动沉淀偏好。</div>}
                >
                  {/* 2. 主交互：干净的单行输入（自动识别分类，无需繁琐下拉） */}
                  <form class="starbot-inspector-memory-form" onSubmit={(e) => void addQuickMemory(e)}>
                    <Input
                      value={newMemoryText()}
                      placeholder="输入希望记住的偏好或背景，回车保存…"
                      disabled={addingMemory()}
                      onValueChange={setNewMemoryText}
                    />
                    <Button type="submit" size="sm" disabled={!newMemoryText().trim() || addingMemory()}>
                      <Plus class="size-4" />
                    </Button>
                  </form>

                  {/* 3. 仅在记忆较多（>= 4条）时显示轻量文字筛选，避免无意义胶囊堆叠 */}
                  <Show when={memories().length >= 4}>
                    <div class="starbot-mem-minimal-filters" role="tablist" aria-label="记忆分类">
                      <button
                        type="button"
                        class={memoryCategoryFilter() === "all" ? "is-active" : ""}
                        onClick={() => setMemoryCategoryFilter("all")}
                      >
                        全部
                      </button>
                      <For each={STARBOT_MEMORY_CATEGORIES}>
                        {(cat) => (
                          <button
                            type="button"
                            class={memoryCategoryFilter() === cat.id ? "is-active" : ""}
                            onClick={() => setMemoryCategoryFilter(cat.id)}
                          >
                            {cat.label}
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* 4. 主视觉焦点：干净通透的记忆列表 */}
                  <Show
                    when={
                      memories().filter(
                        (m) =>
                          memoryCategoryFilter() === "all" ||
                          parseMemoryCategory(m.text).category === memoryCategoryFilter(),
                      ).length > 0
                    }
                    fallback={
                      <div class="starbot-inspector-empty-note">
                        暂无记忆条目。日常聊天中提到的喜好与背景会自动沉淀到这里。
                      </div>
                    }
                  >
                    <ul class="starbot-mem-minimal-list">
                      <For
                        each={memories().filter(
                          (m) =>
                            memoryCategoryFilter() === "all" ||
                            parseMemoryCategory(m.text).category === memoryCategoryFilter(),
                        )}
                      >
                        {(mem) => {
                          const parsed = () => parseMemoryCategory(mem.text);
                          const catMeta = () =>
                            STARBOT_MEMORY_CATEGORIES.find((c) => c.id === parsed().category) ??
                            STARBOT_MEMORY_CATEGORIES[3]!;
                          const isPinned = () => memorySelections()[mem.id]?.inclusion === "essential";

                          return (
                            <li class={`starbot-mem-minimal-row${isPinned() ? " is-pinned" : ""}`}>
                              <Show
                                when={editingMemoryId() === mem.id}
                                fallback={
                                  <>
                                    <p class="starbot-mem-minimal-content">{parsed().cleanText}</p>
                                    <div class="starbot-mem-minimal-meta">
                                      <span class="starbot-mem-minimal-tag">
                                        {isPinned() ? `常驻 · ${catMeta().label}` : catMeta().label}
                                      </span>
                                      <div class="starbot-mem-minimal-actions">
                                        <button
                                          type="button"
                                          class={isPinned() ? "is-active" : ""}
                                          onClick={() => void togglePinMemory(mem)}
                                        >
                                          {isPinned() ? "已常驻" : "常驻"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMemoryId(mem.id);
                                            setEditingMemoryText(parsed().cleanText);
                                          }}
                                        >
                                          编辑
                                        </button>
                                        <button
                                          type="button"
                                          class="is-danger"
                                          aria-label="删除记忆"
                                          onClick={() => void deleteMemoryItem(mem.id)}
                                        >
                                          删除
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                }
                              >
                                <div class="starbot-mem-edit-inline">
                                  <Input
                                    value={editingMemoryText()}
                                    onValueChange={setEditingMemoryText}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void saveInlineMemoryEdit(mem);
                                      if (e.key === "Escape") setEditingMemoryId(null);
                                    }}
                                  />
                                  <Button type="button" size="xs" onClick={() => void saveInlineMemoryEdit(mem)}>
                                    保存
                                  </Button>
                                </div>
                              </Show>
                            </li>
                          );
                        }}
                      </For>
                    </ul>
                  </Show>
                </Show>

                {/* 5. 底部弱化辅助栏：低频管理操作退居次要位置 */}
                <div class="starbot-mem-minimal-footer">
                  <button
                    type="button"
                    class="starbot-mem-footer-link is-primary"
                    onClick={() => openMemoryCleanModal(current().id)}
                  >
                    整理 / 清空对话
                  </button>
                  <span class="starbot-mem-footer-dot">·</span>
                  <button type="button" class="starbot-mem-footer-link" onClick={() => setDailyDigestOpen(true)}>
                    星夜梦境{dreamJournalEntries().length > 0 ? ` (${dreamJournalEntries().length})` : ""}
                  </button>
                  <span class="starbot-mem-footer-dot">·</span>
                  <button
                    type="button"
                    class="starbot-mem-footer-link"
                    disabled={syncingMemoryMd()}
                    onClick={() => void handleSyncAndExportMemoryMd()}
                  >
                    {syncingMemoryMd() ? "导出中…" : "导出 Markdown"}
                  </button>
                </div>
              </div>
            </Show>

            {/* SUB-VIEW: 定时任务 */}
            <Show when={subView() === "routines"}>
              <div class="starbot-inspector-scroll">
                <div class="starbot-inspector-subhead">
                  <h3>定时任务</h3>
                  <p>为「{current().name}」安排每天准点自动执行的工作任务。</p>
                </div>

                <form class="starbot-inspector-routine-create" onSubmit={(e) => void handleCreateQuickRoutine(e)}>
                  <Input
                    value={newRoutineName()}
                    placeholder="任务名称（如：早报速递）"
                    disabled={creatingRoutine()}
                    onValueChange={setNewRoutineName}
                  />
                  <div class="starbot-inspector-routine-time-row">
                    <span class="starbot-inspector-time-label">
                      <Clock3 class="size-3.5" />
                      每天执行时间
                    </span>
                    <input
                      type="time"
                      class="starbot-inspector-time-input"
                      value={newRoutineTime()}
                      onInput={(e) => setNewRoutineTime(e.currentTarget.value)}
                    />
                  </div>
                  <Textarea
                    rows={2}
                    value={newRoutineInstruction()}
                    placeholder="到点后要执行的具体指令内容…"
                    disabled={creatingRoutine()}
                    onValueChange={setNewRoutineInstruction}
                  />
                  <Button type="submit" size="sm" loading={creatingRoutine()}>
                    <Plus class="size-4" />
                    添加定时任务
                  </Button>
                </form>

                <Show
                  when={businessRoutines().length > 0}
                  fallback={<div class="starbot-inspector-empty-note">暂无定时任务，可在上方直接添加</div>}
                >
                  <ul class="starbot-inspector-sublist">
                    <For each={businessRoutines()}>
                      {(routine) => (
                        <li class="starbot-inspector-routine-card">
                          <div class="starbot-inspector-routine-meta">
                            <strong>{routine.name}</strong>
                            <span>{routineListSummary(routine, text)}</span>
                          </div>
                          <div class="starbot-inspector-routine-controls">
                            <Switch
                              checked={routine.active}
                              disabled={togglingRoutineId() === routine.id}
                              onChange={(checked) => void toggleRoutine(routine, checked)}
                            />
                            <button
                              type="button"
                              class="starbot-inspector-trash-btn"
                              aria-label="删除任务"
                              onClick={() => void removeRoutineById(routine.id)}
                            >
                              <Trash2 class="size-3.5" />
                            </button>
                          </div>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            </Show>

            {/* SUB-VIEW: 用量 */}
            <Show when={subView() === "usage"}>
              <div class="starbot-inspector-scroll">
                <div class="starbot-inspector-subhead">
                  <h3>「{current().name}」算力消耗</h3>
                  <p>近 30 天该星友的模型与 Token 使用情况。</p>
                </div>

                <div class="starbot-inspector-usage-grid">
                  <div class="starbot-inspector-usage-box">
                    <span>近 30 天总 Token</span>
                    <strong>{formatCompactTokens(usageSummary()?.tokens ?? 0)}</strong>
                  </div>
                  <div class="starbot-inspector-usage-box">
                    <span>对话轮次</span>
                    <strong>{usageSummary()?.turns ?? 0} 轮</strong>
                  </div>
                  <div class="starbot-inspector-usage-box is-wide">
                    <span>当前驱动模型</span>
                    <strong>
                      {settingsProvider()} · {settingsModel()}
                    </strong>
                  </div>
                </div>

                <Show when={props.onOpenUsage ?? convProps.onOpenUsage}>
                  {(openUsageFn) => (
                    <Button type="button" variant="outline" size="sm" onClick={(e) => openUsageFn()(e.currentTarget)}>
                      <Gauge class="size-4" />
                      打开全屏算力看板查看趋势
                    </Button>
                  )}
                </Show>
              </div>
            </Show>

            {/* SUB-VIEW: 权限 */}
            <Show when={subView() === "permissions"}>
              <div class="starbot-inspector-scroll">
                <div class="starbot-inspector-subhead">
                  <h3>访问与执行权限</h3>
                  <p>控制「{current().name}」在本机读写文件与运行工具的范围。</p>
                </div>

                <div class="starbot-inspector-option-stack">
                  <button
                    type="button"
                    class={`starbot-inspector-option-card${currentAccess() === "full" ? " is-selected" : ""}`}
                    disabled={savingAccess()}
                    onClick={() => void updateAccessMode("full")}
                  >
                    <div class="starbot-inspector-option-top">
                      <strong>完全访问（推荐）</strong>
                      <Show when={currentAccess() === "full"}>
                        <Check class="size-4" />
                      </Show>
                    </div>
                    <p>允许读写本机所需目录、执行终端命令与访问网络，无需频繁中断审批。</p>
                  </button>

                  <button
                    type="button"
                    class={`starbot-inspector-option-card${currentAccess() === "workspace" ? " is-selected" : ""}`}
                    disabled={savingAccess()}
                    onClick={() => void updateAccessMode("workspace")}
                  >
                    <div class="starbot-inspector-option-top">
                      <strong>仅限工作区沙盒</strong>
                      <Show when={currentAccess() === "workspace"}>
                        <Check class="size-4" />
                      </Show>
                    </div>
                    <p>限制仅可在该星友专属工作目录与共享目录内写入文件，越界操作需手动批准。</p>
                  </button>
                </div>

                <div class="starbot-inspector-group" style={{ "margin-top": "14px" }}>
                  <span class="starbot-inspector-group-title">桌面与浏览器控制</span>
                  <div class="starbot-inspector-card">
                    <div class="starbot-inspector-toggle-row">
                      <div>
                        <strong>读取与操作本机应用 / 浏览器 (Computer Use)</strong>
                        <span>
                          开启后可读取并操作你电脑上的 Chrome、Safari 及桌面应用；关闭时仅使用星友内置的独立沙盒浏览器。
                        </span>
                      </div>
                      <Switch
                        checked={agentComputerUseEnabled(current())}
                        disabled={savingAccess()}
                        aria-label="读取与操作本机应用与浏览器"
                        onChange={(checked) => {
                          if (!convProps.onUpdateAgent) return;
                          setSavingAccess(true);
                          void Promise.resolve(
                            convProps.onUpdateAgent(current().id, {
                              computerUse: checked,
                            }),
                          )
                            .then(() => {
                              actionToast.success(
                                checked ? "已开启本机屏幕与浏览器控制" : "已切换为仅使用星友独立浏览器",
                              );
                            })
                            .catch(() => {
                              actionToast.error("更新桌面控制权限失败");
                            })
                            .finally(() => setSavingAccess(false));
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div class="starbot-inspector-group" style={{ "margin-top": "14px" }}>
                  <span class="starbot-inspector-group-title">内置独立浏览器登录档案</span>
                  <div class="starbot-inspector-card">
                    <div class="starbot-inspector-toggle-row" style={{ "align-items": "center" }}>
                      <div>
                        <strong>沙盒浏览器登录态档案</strong>
                        <span>
                          管理星友内置独立浏览器的 Cookie 与站点登录态（需要读取本机日常 Chrome/Safari
                          请开启上方开关）。
                        </span>
                      </div>
                      <select
                        class="starbot-capsule-select"
                        disabled={savingBrowserProfile()}
                        value={agentBrowserProfileId() ?? ""}
                        aria-label="选择星友内置浏览器登录档案"
                        onChange={(e) => void handleSelectBrowserProfile(e.currentTarget.value)}
                      >
                        <option value="">默认共享档案</option>
                        <option value="__agent__">此星友专属独立档案</option>
                        <For each={browserProfiles()}>{(prof) => <option value={prof.id}>{prof.name}</option>}</For>
                      </select>
                    </div>
                  </div>
                </div>

                <Show when={current().workspacePath}>
                  {(wsPath) => (
                    <div class="starbot-inspector-group" style={{ "margin-top": "14px" }}>
                      <span class="starbot-inspector-group-title">专属工作区目录</span>
                      <div
                        class="starbot-inspector-card"
                        style={{ display: "flex", "flex-direction": "column", gap: "8px" }}
                      >
                        <code
                          style={{
                            "font-size": "11.5px",
                            color: "var(--openbot-text-secondary)",
                            "word-break": "break-all",
                            "line-height": "1.45",
                          }}
                        >
                          {wsPath()}
                        </code>
                        <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void navigator.clipboard?.writeText(wsPath());
                              actionToast.success("已复制工作目录路径");
                            }}
                          >
                            复制路径
                          </Button>
                          <Show when={convProps.server?.kind === "local" && window.openbot?.storage?.openLocation}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void window.openbot.storage
                                  .openLocation({ agentId: current().id })
                                  .catch(() => actionToast.error("无法在访达中打开该目录"));
                              }}
                            >
                              在访达中打开
                            </Button>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </Show>
              </div>
            </Show>

            {/* SUB-VIEW: 主动关怀与待办提醒（上下文任务感知 + 自定义问候时段） */}
            <Show when={subView() === "proactive"}>
              <div class="starbot-inspector-scroll">
                <div class="starbot-inspector-subhead">
                  <h3>主动关怀与待办提醒</h3>
                  <p>
                    不只是机械定时发消息——当聊天里有未完成的任务或卡点时，「{current().name}
                    」会主动跟进提醒，也可自定义每日陪伴时间。
                  </p>
                </div>

                {/* Section 1: 智能任务与上下文跟进 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">智能待办与任务跟进</span>
                  <div class="starbot-inspector-proactive-stack">
                    <div class="starbot-inspector-card">
                      <div class="starbot-inspector-toggle-row">
                        <div>
                          <strong>未完成任务主动提醒</strong>
                          <span>聊天中交代的事项未收尾或待你确认时，闲置后主动跟进（同一事项仅提醒 1 次）</span>
                        </div>
                        <Switch
                          checked={proactiveCare().taskFollowupEnabled}
                          aria-label="未完成任务主动提醒"
                          onChange={(checked) => {
                            updateProactiveCarePatch({ taskFollowupEnabled: checked });
                            actionToast.success(checked ? "已开启未完成任务主动提醒" : "已关闭未完成任务提醒");
                          }}
                        />
                      </div>

                      <Show when={proactiveCare().taskFollowupEnabled}>
                        <div class="starbot-inspector-delay-bar">
                          <div class="starbot-inspector-delay-custom-row">
                            <span class="starbot-inspector-delay-label">闲置多久后提醒</span>
                            <div class="starbot-inspector-delay-input-group">
                              <input
                                type="number"
                                min={1}
                                max={proactiveCare().followupDelayUnit === "hours" ? 168 : 10080}
                                step={1}
                                class="starbot-inspector-delay-number"
                                aria-label="闲置提醒时长数值"
                                value={
                                  proactiveCare().followupDelayUnit === "hours"
                                    ? Math.max(1, Math.round(proactiveCare().taskFollowupDelayMinutes / 60))
                                    : proactiveCare().taskFollowupDelayMinutes
                                }
                                onInput={(e) => {
                                  const rawVal = Number.parseInt(e.currentTarget.value, 10);
                                  if (!Number.isFinite(rawVal) || rawVal < 1) return;
                                  const unit = proactiveCare().followupDelayUnit;
                                  const mins = clampDelayMinutes(unit === "hours" ? rawVal * 60 : rawVal, 120);
                                  updateProactiveCarePatch({ taskFollowupDelayMinutes: mins });
                                }}
                              />
                              <div class="starbot-inspector-delay-unit-seg" role="group" aria-label="时间单位">
                                <button
                                  type="button"
                                  class={proactiveCare().followupDelayUnit === "hours" ? "is-active" : ""}
                                  onClick={() => {
                                    if (proactiveCare().followupDelayUnit === "hours") return;
                                    const nextHours = Math.max(
                                      1,
                                      Math.round(proactiveCare().taskFollowupDelayMinutes / 60),
                                    );
                                    updateProactiveCarePatch({
                                      followupDelayUnit: "hours",
                                      taskFollowupDelayMinutes: clampDelayMinutes(nextHours * 60, 120),
                                    });
                                  }}
                                >
                                  小时
                                </button>
                                <button
                                  type="button"
                                  class={proactiveCare().followupDelayUnit === "minutes" ? "is-active" : ""}
                                  onClick={() => {
                                    if (proactiveCare().followupDelayUnit === "minutes") return;
                                    updateProactiveCarePatch({ followupDelayUnit: "minutes" });
                                  }}
                                >
                                  分钟
                                </button>
                              </div>
                            </div>
                          </div>
                          <span class="starbot-inspector-delay-hint">
                            默认按小时计，也可自由切换按分钟或按小时输入符合你习惯的提醒间隔。
                          </span>
                        </div>
                      </Show>
                    </div>

                    <div class="starbot-inspector-card">
                      <div class="starbot-inspector-toggle-row">
                        <div>
                          <strong>中断与卡点回访</strong>
                          <span>当你发了需求但流程意外中断未回复时，主动提醒一键接续处理</span>
                        </div>
                        <Switch
                          checked={proactiveCare().stalledRecoveryEnabled}
                          aria-label="中断与卡点回访"
                          onChange={(checked) => updateProactiveCarePatch({ stalledRecoveryEnabled: checked })}
                        />
                      </div>
                    </div>

                    <div class="starbot-inspector-card">
                      <div class="starbot-inspector-toggle-row">
                        <div>
                          <strong>久未联系破冰问候</strong>
                          <span>超过 24 小时未互动时结合最近记忆轻轻问好，未回复前绝不刷屏</span>
                        </div>
                        <Switch
                          checked={proactiveCare().idleCareEnabled}
                          aria-label="久未联系破冰问候"
                          onChange={(checked) => updateProactiveCarePatch({ idleCareEnabled: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: 日常问候频次与自定义时间 */}
                <div class="starbot-inspector-group">
                  <span class="starbot-inspector-group-title">日常陪伴频次与自定义时间</span>
                  <div class="starbot-inspector-card starbot-inspector-freq-card">
                    <div class="starbot-inspector-freq-grid">
                      <For each={PROACTIVE_FREQUENCY_CHIPS}>
                        {(chip) => {
                          const active = () => proactiveFrequency() === chip.id;
                          return (
                            <button
                              type="button"
                              class={`starbot-inspector-freq-chip${active() ? " is-active" : ""}`}
                              disabled={syncingProactive()}
                              onClick={() => void syncProactiveDailySchedule(chip.id)}
                            >
                              {chip.label}
                            </button>
                          );
                        }}
                      </For>
                    </div>

                    <Show
                      when={slotCountForFrequency(proactiveFrequency()) > 0}
                      fallback={
                        <p class="starbot-inspector-freq-hint">
                          当前仅在有未完成任务时智能跟进，不按固定钟点发日常问候。
                        </p>
                      }
                    >
                      <div class="starbot-inspector-custom-times">
                        <Show when={slotCountForFrequency(proactiveFrequency()) >= 1}>
                          <div class="starbot-inspector-routine-time-row">
                            <span class="starbot-inspector-time-label">
                              <Clock3 class="size-3.5" />第 1 次问候时间
                            </span>
                            <input
                              type="time"
                              class="starbot-inspector-time-input"
                              disabled={syncingProactive()}
                              value={proactiveCare().times[0]}
                              onChange={(e) => void handleCustomSlotTimeChange(0, e.currentTarget.value)}
                            />
                          </div>
                        </Show>
                        <Show when={slotCountForFrequency(proactiveFrequency()) >= 2}>
                          <div class="starbot-inspector-routine-time-row">
                            <span class="starbot-inspector-time-label">
                              <Clock3 class="size-3.5" />第 2 次问候时间
                            </span>
                            <input
                              type="time"
                              class="starbot-inspector-time-input"
                              disabled={syncingProactive()}
                              value={proactiveCare().times[1]}
                              onChange={(e) => void handleCustomSlotTimeChange(1, e.currentTarget.value)}
                            />
                          </div>
                        </Show>
                        <Show when={slotCountForFrequency(proactiveFrequency()) >= 3}>
                          <div class="starbot-inspector-routine-time-row">
                            <span class="starbot-inspector-time-label">
                              <Clock3 class="size-3.5" />第 3 次问候时间
                            </span>
                            <input
                              type="time"
                              class="starbot-inspector-time-input"
                              disabled={syncingProactive()}
                              value={proactiveCare().times[2]}
                              onChange={(e) => void handleCustomSlotTimeChange(2, e.currentTarget.value)}
                            />
                          </div>
                        </Show>
                        <p class="starbot-inspector-freq-hint">
                          可任意设定如 09:00、12:00、21:30 等时刻，到点会顺带检查未闭环待办并自然问候。
                        </p>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </Show>

            {/* Agent Skills Assignment Modal */}
            <AgentSkillsModal
              agentId={current().id}
              agentName={current().name}
              agentProvider={current().provider}
              open={skillsModalOpen()}
              onOpenChange={setSkillsModalOpen}
              onCountChange={setSkillCount}
              serverId={convProps.server?.id}
              catalog={convProps.runtime?.skillCatalog}
              onAddFromMarketplace={
                serverCanAdminister(convProps.server, "skills-admin-v1") ? convProps.onOpenMarketplace : undefined
              }
            />
          </aside>
        );
      }}
    </Show>
  );
}
