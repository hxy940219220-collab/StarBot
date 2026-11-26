import { analyticsRange, LOCAL_SERVER_ID, type MemoryEntry } from "@openbot/contracts/ipc";
import type { AgentProfile } from "@openbot/ui/data";
import {
  chiefStarBotAgentId,
  isManualChiefStarBot,
  setAutoChiefStarBotId,
  setManualChiefStarBotId,
} from "@openbot/ui/features/agents/chief-starbot";
import { createSignal } from "solid-js";

export { chiefStarBotAgentId, isManualChiefStarBot, setAutoChiefStarBotId, setManualChiefStarBotId };

export type StarBotMemoryCategory = "profile" | "preference" | "project" | "archive";

export interface MemoryCategoryMeta {
  readonly id: StarBotMemoryCategory;
  readonly tag: string;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

export const STARBOT_MEMORY_CATEGORIES: readonly MemoryCategoryMeta[] = [
  {
    id: "profile",
    tag: "[画像]",
    label: "个人画像",
    icon: "👤",
    description: "身份职业、技术背景、常驻城市等跨星友共享画像",
  },
  {
    id: "preference",
    tag: "[偏好]",
    label: "偏好习惯",
    icon: "❤️",
    description: "沟通语气、排版习惯、常用工具与禁忌雷区",
  },
  {
    id: "project",
    tag: "[事项]",
    label: "正在推进",
    icon: "📂",
    description: "近期核心项目、目标进度与待办上下文",
  },
  {
    id: "archive",
    tag: "[经验]",
    label: "经验归档",
    icon: "💡",
    description: "踩坑结论、关键决策与长期复用知识",
  },
];

const TAG_TO_CATEGORY: Readonly<Record<string, StarBotMemoryCategory>> = {
  "[画像]": "profile",
  "[偏好]": "preference",
  "[事项]": "project",
  "[经验]": "archive",
};

export function parseMemoryCategory(rawText: string): {
  category: StarBotMemoryCategory;
  cleanText: string;
  explicitTag: boolean;
} {
  const trimmed = rawText.trim();
  for (const [tag, cat] of Object.entries(TAG_TO_CATEGORY)) {
    if (trimmed.startsWith(tag)) {
      return {
        category: cat,
        cleanText: trimmed.slice(tag.length).trim(),
        explicitTag: true,
      };
    }
  }
  if (/(?:喜欢|偏好|习惯|不要|风格|语气|格式|讨厌|简洁|中文|英文)/u.test(trimmed)) {
    return { category: "preference", cleanText: trimmed, explicitTag: false };
  }
  if (/(?:我是|职业|从事|负责|公司|团队|住在|背景|身份|设计师|工程师|产品)/u.test(trimmed)) {
    return { category: "profile", cleanText: trimmed, explicitTag: false };
  }
  if (/(?:正在|推进|项目|开发|计划|本周|近期|目标|待办|上线|迭代)/u.test(trimmed)) {
    return { category: "project", cleanText: trimmed, explicitTag: false };
  }
  return { category: "archive", cleanText: trimmed, explicitTag: false };
}

export function formatTaggedMemory(category: StarBotMemoryCategory, text: string): string {
  const parsed = parseMemoryCategory(text);
  const meta = STARBOT_MEMORY_CATEGORIES.find((c) => c.id === category) ?? STARBOT_MEMORY_CATEGORIES[3]!;
  return `${meta.tag} ${parsed.cleanText}`.slice(0, 480);
}

// Global Cross-Agent User Profile (USER.md equivalent)
const GLOBAL_PROFILE_KEY = "starbot:global-user-profile:v1";

function readGlobalProfileItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GLOBAL_PROFILE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

const [globalProfileItemsSignal, setGlobalProfileItemsSignal] = createSignal<string[]>(readGlobalProfileItems());

export function globalUserProfileItems(): string[] {
  return globalProfileItemsSignal();
}

export function addGlobalUserProfileItem(item: string): void {
  const clean = parseMemoryCategory(item).cleanText.trim();
  if (!clean) return;
  const current = globalProfileItemsSignal();
  if (current.some((existing) => existing === clean)) return;
  const next = [clean, ...current].slice(0, 30);
  setGlobalProfileItemsSignal(next);
  try {
    window.localStorage.setItem(GLOBAL_PROFILE_KEY, JSON.stringify(next));
  } catch {}
}

export function removeGlobalUserProfileItem(item: string): void {
  const next = globalProfileItemsSignal().filter((existing) => existing !== item);
  setGlobalProfileItemsSignal(next);
  try {
    window.localStorage.setItem(GLOBAL_PROFILE_KEY, JSON.stringify(next));
  } catch {}
}

// Markdown Two-Way Sync to Agent Workspace Instructions + Downloadable MEMORY.md
const MEMORY_SYNC_START = "<!-- starbot-memory-sync:start -->";
const MEMORY_SYNC_END = "<!-- starbot-memory-sync:end -->";

export function buildMemoryMarkdownDocument(agentName: string, memories: readonly MemoryEntry[]): string {
  const grouped: Record<StarBotMemoryCategory, string[]> = {
    profile: [...globalUserProfileItems()],
    preference: [],
    project: [],
    archive: [],
  };
  for (const mem of memories) {
    const { category, cleanText } = parseMemoryCategory(mem.text);
    if (cleanText && !grouped[category].includes(cleanText)) {
      grouped[category].push(cleanText);
    }
  }
  const lines: string[] = [
    `# MEMORY.md · 「${agentName}」长期记忆与用户画像`,
    `> 最近同步时间：${new Date().toLocaleString("zh-CN")}`,
    "",
  ];
  for (const meta of STARBOT_MEMORY_CATEGORIES) {
    const list = grouped[meta.id];
    lines.push(`## ${meta.icon} ${meta.label}`);
    if (list.length === 0) {
      lines.push("- （暂无记录）");
    } else {
      for (const item of list) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function syncMemoriesToAgentInstructions(
  agentId: string,
  agentName: string,
  memories: readonly MemoryEntry[],
  serverId: string = LOCAL_SERVER_ID,
): Promise<boolean> {
  if (!window.openbot?.agent?.readAgentInstructions || !window.openbot?.agent?.saveAgentInstructions) {
    return false;
  }
  try {
    const currentFile = await window.openbot.agent.readAgentInstructions(agentId, serverId);
    const existing = currentFile?.text ?? "";
    const blockRegex = new RegExp(`\\n?${MEMORY_SYNC_START}[\\s\\S]*?${MEMORY_SYNC_END}\\n?`, "gu");
    const stripped = existing.replace(blockRegex, "\n").trim();

    const mdBody = buildMemoryMarkdownDocument(agentName, memories);
    const syncBlock = [MEMORY_SYNC_START, mdBody.trim(), MEMORY_SYNC_END].join("\n");
    const nextText = stripped ? `${stripped}\n\n${syncBlock}\n` : `${syncBlock}\n`;

    await window.openbot.agent.saveAgentInstructions(
      {
        agentId,
        text: nextText,
        expected: existing,
      },
      serverId,
    );
    return true;
  } catch {
    return false;
  }
}

export function downloadMemoryMarkdown(agentName: string, memories: readonly MemoryEntry[]): void {
  const md = buildMemoryMarkdownDocument(agentName, memories);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${agentName}-MEMORY.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Distilled Memory Candidate & Conversation Distillation Engine
export interface DistilledCandidate {
  id: string;
  category: StarBotMemoryCategory;
  text: string;
  selected: boolean;
}

export interface DistillationResult {
  summary: string;
  candidates: DistilledCandidate[];
  messageCount: number;
}

function heuristicExtractCandidates(messages: ReadonlyArray<{ author: string; text: string }>): DistillationResult {
  const userTexts = messages
    .filter((m) => m.author === "user" && m.text.trim().length >= 4)
    .map((m) => m.text.trim());
  const candidates: DistilledCandidate[] = [];
  const seen = new Set<string>();

  for (const raw of userTexts.slice(-15)) {
    const sentences = raw
      .split(/[。\n！!；;]+/u)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && s.length <= 140);
    for (const sentence of sentences) {
      // Never extract questions or casual commands as long-term memories
      if (/[？?]|(?:吗|呢|啥|什么|怎么|如何)$|^(?:你能|帮我看看|看下|测试)/u.test(sentence)) continue;
      if (seen.has(sentence)) continue;
      if (
        /(?:喜欢|偏好|讨厌|记住|以后|不要|请用|我是|目前在|正在做|我们要|需要支持|目标是|习惯|常用)/u.test(sentence)
      ) {
        seen.add(sentence);
        const { category, cleanText } = parseMemoryCategory(sentence);
        candidates.push({
          id: `cand-${candidates.length + 1}`,
          category,
          text: cleanText,
          selected: true,
        });
      }
      if (candidates.length >= 5) break;
    }
    if (candidates.length >= 5) break;
  }

  const summary =
    candidates.length > 0
      ? `从最近 ${messages.length} 条对话中提炼出 ${candidates.length} 条偏好与背景信息。`
      : `已扫描最近 ${messages.length} 条对话，未发现需要额外新增的长期偏好。`;

  return { summary, candidates, messageCount: messages.length };
}

function parseJsonFromModelAnswer(answer: string): { summary?: string; items?: Array<{ category?: string; text?: string }> } | null {
  const trimmed = answer.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  const startBrace = candidate.indexOf("{");
  const endBrace = candidate.lastIndexOf("}");
  if (startBrace >= 0 && endBrace > startBrace) {
    try {
      return JSON.parse(candidate.slice(startBrace, endBrace + 1)) as {
        summary?: string;
        items?: Array<{ category?: string; text?: string }>;
      };
    } catch {}
  }
  return null;
}

export async function distillConversationMemories(
  agentId: string,
  serverId: string = LOCAL_SERVER_ID,
): Promise<DistillationResult> {
  if (!window.openbot?.agent?.readConversationPage) {
    return { summary: "无法读取当前会话记录", candidates: [], messageCount: 0 };
  }
  const page = await window.openbot.agent.readConversationPage(
    { agentId, anchor: { type: "latest" }, limit: 28 },
    serverId,
  );
  const rawMsgs = (page?.messages ?? [])
    .map((m) => ({
      author: String(m.author ?? "user"),
      text: typeof m.text === "string" ? m.text.trim() : "",
    }))
    .filter((m) => m.text.length > 0 && !m.text.startsWith("[主动"));

  if (rawMsgs.length === 0) {
    return { summary: "当前对话已经很干净，暂无需要压缩的历史消息。", candidates: [], messageCount: 0 };
  }

  if (window.openbot?.agent?.askSideQuestion) {
    try {
      const transcript = rawMsgs
        .slice(-18)
        .map((m) => `${m.author === "user" ? "用户" : "星友"}: ${m.text.slice(0, 280)}`)
        .join("\n");
      const prompt = [
        "请阅读以下最近对话，帮用户蒸馏提炼值得长期保留的核心记忆（最多 5 条，忽略临时报错或寒暄）。",
        "只输出严格合法的 JSON 对象，不要任何多余解释，格式如下：",
        '{"summary":"一句话总结本轮进展","items":[{"category":"profile|preference|project|archive","text":"精炼陈述句（不超过80字）"}]}',
        "",
        "最近对话内容：",
        transcript,
      ].join("\n");

      const answer = await Promise.race([
        window.openbot.agent.askSideQuestion({ agentId, question: prompt, earlier: [] }, serverId),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 16_000)),
      ]);
      const parsed = parseJsonFromModelAnswer(answer);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const validCats = new Set<StarBotMemoryCategory>(["profile", "preference", "project", "archive"]);
        const candidates: DistilledCandidate[] = parsed.items
          .filter((item) => typeof item.text === "string" && item.text.trim().length > 2)
          .slice(0, 6)
          .map((item, idx) => {
            const rawCat = (item.category ?? "").trim() as StarBotMemoryCategory;
            const cat: StarBotMemoryCategory = validCats.has(rawCat)
              ? rawCat
              : parseMemoryCategory(item.text!).category;
            return {
              id: `ai-cand-${idx + 1}`,
              category: cat,
              text: parseMemoryCategory(item.text!).cleanText,
              selected: true,
            };
          });
        if (candidates.length > 0) {
          return {
            summary: parsed.summary?.trim() || `已从 ${rawMsgs.length} 条对话中智能蒸馏出 ${candidates.length} 条核心记忆。`,
            candidates,
            messageCount: rawMsgs.length,
          };
        }
      }
    } catch {
      // Fall back to deterministic local extraction
    }
  }

  return heuristicExtractCandidates(rawMsgs);
}

// 🌙 Nightly Dreaming ("星夜梦境" — Chief StarBot Consolidation Engine)
// STRICT SAFETY INVARIANTS:
// - Guarded by `starbot:last-dream-date:v1` (YYYY-MM-DD) AND `dreamRunning` singleton lock.
// - Never runs in a repeating short interval; auto-runs at most ONCE per calendar day!
const DREAM_AUTO_KEY = "starbot:dream-auto-enabled:v1";
const DREAM_LAST_DATE_KEY = "starbot:last-dream-date:v1";
const DREAM_JOURNAL_KEY = "starbot:dream-journal:v1";

export interface DreamJournalEntry {
  readonly id: string;
  readonly date: string;
  readonly createdAt: string;
  readonly chiefAgentId: string;
  readonly chiefAgentName: string;
  readonly summary: string;
  readonly savedItems: ReadonlyArray<{ category: StarBotMemoryCategory; text: string }>;
}

function readDreamAutoEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DREAM_AUTO_KEY) !== "false";
  } catch {
    return true;
  }
}

function readDreamJournal(): DreamJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DREAM_JOURNAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as DreamJournalEntry[])
      .filter((e) => !e.summary?.includes("你能帮我看看"))
      .slice(0, 14);
  } catch {
    return [];
  }
}

const [dreamAutoEnabledSignal, setDreamAutoEnabledSignal] = createSignal<boolean>(readDreamAutoEnabled());
const [dreamJournalSignal, setDreamJournalSignal] = createSignal<DreamJournalEntry[]>(readDreamJournal());
const [dreamRunningSignal, setDreamRunningSignal] = createSignal<boolean>(false);
let dreamSingletonLock = false;

export function dreamAutoEnabled(): boolean {
  return dreamAutoEnabledSignal();
}

export function setDreamAutoEnabled(enabled: boolean): void {
  setDreamAutoEnabledSignal(enabled);
  try {
    window.localStorage.setItem(DREAM_AUTO_KEY, String(enabled));
  } catch {}
}

export function dreamJournalEntries(): DreamJournalEntry[] {
  return dreamJournalSignal();
}

export function isDreamRunning(): boolean {
  return dreamRunningSignal();
}

export function localTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hasDreamedToday(): boolean {
  try {
    return window.localStorage.getItem(DREAM_LAST_DATE_KEY) === localTodayDateString();
  } catch {
    return true;
  }
}

export async function refreshChiefStarBotFromAnalytics(
  agents: readonly AgentProfile[],
  serverId: string = LOCAL_SERVER_ID,
): Promise<string | null> {
  if (agents.length === 0) return null;
  let bestId: string | null = null;
  if (window.openbot?.agent?.getHostAnalytics) {
    try {
      const { startDate, endDate, timeZone } = analyticsRange("", 30);
      const res = await window.openbot.agent.getHostAnalytics({ startDate, endDate, timeZone }, serverId);
      if (res?.agents && res.agents.length > 0) {
        const existingIds = new Set(agents.map((a) => a.id));
        const ranked = [...res.agents]
          .filter((row) => existingIds.has(row.agentId))
          .sort((a, b) => b.processedTokens + b.turns * 1000 - (a.processedTokens + a.turns * 1000));
        if (ranked[0] && (ranked[0].processedTokens > 0 || ranked[0].turns > 0)) {
          bestId = ranked[0].agentId;
        }
      }
    } catch {}
  }
  if (!bestId) {
    const sortedByRecent = [...agents].sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return tb - ta;
    });
    bestId = sortedByRecent[0]?.id ?? agents[0]?.id ?? null;
  }
  setAutoChiefStarBotId(bestId);
  return chiefStarBotAgentId() ?? bestId;
}

export async function runStarBotNightlyDream(options: {
  agents: readonly AgentProfile[];
  serverId?: string;
  manual?: boolean;
}): Promise<DreamJournalEntry | null> {
  if (dreamSingletonLock) return null;
  const serverId = options.serverId ?? LOCAL_SERVER_ID;
  const today = localTodayDateString();
  if (!options.manual && hasDreamedToday()) return null;
  if (options.agents.length === 0 || !window.openbot?.agent?.readConversationPage) return null;

  dreamSingletonLock = true;
  setDreamRunningSignal(true);
  try {
    // Immediately mark today's dream date BEFORE calling any model so it can NEVER re-fire!
    try {
      window.localStorage.setItem(DREAM_LAST_DATE_KEY, today);
    } catch {}

    const chiefId = (await refreshChiefStarBotFromAnalytics(options.agents, serverId)) ?? options.agents[0]!.id;
    const chiefAgent = options.agents.find((a) => a.id === chiefId) ?? options.agents[0]!;

    // Gather recent user+assistant snippets across up to 4 active StarBots
    const collectedSnippets: string[] = [];
    const fallbackMsgs: Array<{ author: string; text: string }> = [];

    for (const ag of options.agents.slice(0, 4)) {
      try {
        const page = await window.openbot.agent.readConversationPage(
          { agentId: ag.id, anchor: { type: "latest" }, limit: 12 },
          serverId,
        );
        const msgs = (page?.messages ?? []).filter(
          (m) => typeof m.text === "string" && m.text.trim().length > 0 && !m.text.startsWith("[主动"),
        );
        if (msgs.length > 0) {
          const lines = msgs.slice(-6).map((m) => {
            const txt = String(m.text).trim();
            fallbackMsgs.push({ author: String(m.author), text: txt });
            return `[${ag.name} · ${m.author === "user" ? "用户" : "助手"}] ${txt.slice(0, 200)}`;
          });
          collectedSnippets.push(lines.join("\n"));
        }
      } catch {}
    }

    if (collectedSnippets.length === 0) {
      return null;
    }

    let summaryText = "";
    let extractedItems: Array<{ category: StarBotMemoryCategory; text: string }> = [];

    if (window.openbot.agent.askSideQuestion) {
      try {
        const dreamPrompt = [
          `你是用户的主星友「${chiefAgent.name}」，现在正在执行每晚一次的「星夜梦境记忆沉淀」。`,
          "请阅读今天各星友与用户的聊天片段，提取最有长期价值的 2~5 条信息（涵盖用户个人画像 profile、沟通与工具偏好 preference、正在推进的核心事项 project），并写一句温暖简短的今日梦境手记总结。",
          "请严格只输出 JSON，格式如下：",
          '{"summary":"今日梦境总结（50字以内）","items":[{"category":"profile|preference|project|archive","text":"精炼记忆条目"}]}',
          "",
          collectedSnippets.join("\n---\n"),
        ].join("\n");

        const rawAns = await Promise.race([
          window.openbot.agent.askSideQuestion({ agentId: chiefAgent.id, question: dreamPrompt, earlier: [] }, serverId),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error("dream-timeout")), 18_000)),
        ]);
        const parsed = parseJsonFromModelAnswer(rawAns);
        if (parsed && Array.isArray(parsed.items)) {
          const validCats = new Set<StarBotMemoryCategory>(["profile", "preference", "project", "archive"]);
          extractedItems = parsed.items
            .filter((i) => typeof i.text === "string" && i.text.trim().length > 3)
            .slice(0, 5)
            .map((i) => {
              const rc = (i.category ?? "").trim() as StarBotMemoryCategory;
              return {
                category: validCats.has(rc) ? rc : parseMemoryCategory(i.text!).category,
                text: parseMemoryCategory(i.text!).cleanText,
              };
            });
          summaryText = parsed.summary?.trim() ?? "";
        }
      } catch {}
    }

    if (extractedItems.length === 0) {
      const heur = heuristicExtractCandidates(fallbackMsgs);
      extractedItems = heur.candidates.slice(0, 4).map((c) => ({ category: c.category, text: c.text }));
      summaryText = summaryText || heur.summary;
    }

    // Deduplicate and persist into Chief StarBot's memories + Global Profile + MEMORY.md instructions
    const existingMemories = await window.openbot.agent.listMemories(chiefAgent.id, serverId).catch(() => []);
    const existingCleanSet = new Set(existingMemories.map((m) => parseMemoryCategory(m.text).cleanText));
    const newlySaved: Array<{ category: StarBotMemoryCategory; text: string }> = [];

    for (const item of extractedItems) {
      if (!item.text || existingCleanSet.has(item.text)) continue;
      existingCleanSet.add(item.text);
      const tagged = formatTaggedMemory(item.category, item.text);
      try {
        await window.openbot.agent.createMemory({ agentId: chiefAgent.id, text: tagged }, serverId);
        if (item.category === "profile") {
          addGlobalUserProfileItem(item.text);
        }
        newlySaved.push(item);
      } catch {}
    }

    const updatedMemories = await window.openbot.agent.listMemories(chiefAgent.id, serverId).catch(() => existingMemories);
    await syncMemoriesToAgentInstructions(chiefAgent.id, chiefAgent.name, updatedMemories, serverId);

    const entry: DreamJournalEntry = {
      id: `dream-${Date.now()}`,
      date: today,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      chiefAgentId: chiefAgent.id,
      chiefAgentName: chiefAgent.name,
      summary:
        summaryText ||
        `主星友「${chiefAgent.name}」已在星夜梦境中回顾今日对话，沉淀了 ${newlySaved.length} 条新记忆。`,
      savedItems: newlySaved.length > 0 ? newlySaved : extractedItems.slice(0, 3),
    };

    const nextJournal = [entry, ...dreamJournalSignal().filter((e) => e.date !== today || options.manual)].slice(0, 14);
    setDreamJournalSignal(nextJournal);
    try {
      window.localStorage.setItem(DREAM_JOURNAL_KEY, JSON.stringify(nextJournal));
    } catch {}
    return entry;
  } finally {
    dreamSingletonLock = false;
    setDreamRunningSignal(false);
  }
}

// Global UI Event Signals for Modals
const [cleanModalAgentIdSignal, setCleanModalAgentIdSignal] = createSignal<string | null>(null);
const [quickCaptureOpenSignal, setQuickCaptureOpenSignal] = createSignal(false);
const [dailyDigestOpenSignal, setDailyDigestOpenSignal] = createSignal(false);

export function cleanModalAgentId(): string | null {
  return cleanModalAgentIdSignal();
}
export function openMemoryCleanModal(agentId: string): void {
  setCleanModalAgentIdSignal(agentId);
}
export function closeMemoryCleanModal(): void {
  setCleanModalAgentIdSignal(null);
}

export function quickCaptureOpen(): boolean {
  return quickCaptureOpenSignal();
}
export function setQuickCaptureOpen(open: boolean): void {
  setQuickCaptureOpenSignal(open);
}

export function dailyDigestOpen(): boolean {
  return dailyDigestOpenSignal();
}
export function setDailyDigestOpen(open: boolean): void {
  setDailyDigestOpenSignal(open);
}
