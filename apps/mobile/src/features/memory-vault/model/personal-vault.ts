import { isDynamicRecord } from "@starbot/contracts/runtime-values";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export type VaultCategoryId = "basic" | "habits" | "recent" | "experience" | "preferences" | "social" | "passions";

export interface VaultBubbleItem {
  id: string;
  category: VaultCategoryId;
  text: string;
  source: "self" | "bot";
  botName?: string;
  botAgentId?: string;
  serverMemoryId?: string;
  updatedAt: number;
}

const VAULT_STORAGE_KEY = "starbot.mobile.personal-vault.v1";

export const VAULT_CATEGORIES: readonly {
  id: VaultCategoryId;
  color: string;
  desktopTag: "[画像]" | "[偏好]" | "[事项]" | "[经验]";
}[] = [
  { id: "basic", color: "#7c3aed", desktopTag: "[画像]" },
  { id: "habits", color: "#3b82f6", desktopTag: "[偏好]" },
  { id: "recent", color: "#f59e0b", desktopTag: "[事项]" },
  { id: "experience", color: "#06b6d4", desktopTag: "[经验]" },
  { id: "preferences", color: "#ec4899", desktopTag: "[偏好]" },
  { id: "social", color: "#10b981", desktopTag: "[画像]" },
  { id: "passions", color: "#f97316", desktopTag: "[画像]" },
];

export function inferVaultCategory(rawText: string): { category: VaultCategoryId; cleanText: string } {
  const trimmed = rawText
    .trim()
    .replace(/^\[(?:画像|偏好|事项|经验|基础信息|习惯|近况|经历|社交|热爱与兴趣)\]\s*/u, "");
  if (rawText.startsWith("[基础信息]")) return { category: "basic", cleanText: trimmed };
  if (rawText.startsWith("[习惯]")) return { category: "habits", cleanText: trimmed };
  if (rawText.startsWith("[近况]") || rawText.startsWith("[事项]")) return { category: "recent", cleanText: trimmed };
  if (rawText.startsWith("[经历]") || rawText.startsWith("[经验]"))
    return { category: "experience", cleanText: trimmed };
  if (rawText.startsWith("[偏好]")) return { category: "preferences", cleanText: trimmed };
  if (rawText.startsWith("[社交]")) return { category: "social", cleanText: trimmed };
  if (rawText.startsWith("[热爱与兴趣]")) return { category: "passions", cleanText: trimmed };

  if (/(?:习惯|作息|每天|早上|晚上|流程|节奏)/u.test(trimmed)) return { category: "habits", cleanText: trimmed };
  if (/(?:正在|近期|最近|本周|推进|目标|待办|计划)/u.test(trimmed)) return { category: "recent", cleanText: trimmed };
  if (/(?:曾|过去|做过|上线|毕业|经历|履历|项目经验)/u.test(trimmed))
    return { category: "experience", cleanText: trimmed };
  if (/(?:偏好|喜欢.*风格|不要|讨厌|简洁|格式|语气)/u.test(trimmed))
    return { category: "preferences", cleanText: trimmed };
  if (/(?:朋友|同事|团队|伙伴|家人|合作|社交)/u.test(trimmed)) return { category: "social", cleanText: trimmed };
  if (/(?:热爱|兴趣|爱好|喜欢玩|猫|音乐|电影|运动|游戏|数码)/u.test(trimmed))
    return { category: "passions", cleanText: trimmed };
  return { category: "basic", cleanText: trimmed };
}

const VALID_CATEGORIES = new Set<string>(VAULT_CATEGORIES.map((c) => c.id));

function isVaultCategory(value: unknown): value is VaultCategoryId {
  return typeof value === "string" && VALID_CATEGORIES.has(value);
}

interface PersonalVaultState {
  items: readonly VaultBubbleItem[];
  ready: boolean;
}

export const usePersonalVaultStore = create<PersonalVaultState>(() => ({
  items: [],
  ready: false,
}));

export async function loadPersonalVault(): Promise<void> {
  if (usePersonalVaultStore.getState().ready) return;
  try {
    const raw = await SecureStore.getItemAsync(VAULT_STORAGE_KEY);
    if (!raw) {
      usePersonalVaultStore.setState({ items: [], ready: true });
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      usePersonalVaultStore.setState({ items: [], ready: true });
      return;
    }
    const valid: VaultBubbleItem[] = [];
    for (const entry of parsed) {
      if (
        isDynamicRecord(entry) &&
        typeof entry.id === "string" &&
        isVaultCategory(entry.category) &&
        typeof entry.text === "string" &&
        entry.text.trim().length > 0
      ) {
        valid.push({
          id: entry.id,
          category: entry.category,
          text: entry.text.trim(),
          source: entry.source === "bot" ? "bot" : "self",
          botName: typeof entry.botName === "string" ? entry.botName : undefined,
          botAgentId: typeof entry.botAgentId === "string" ? entry.botAgentId : undefined,
          serverMemoryId: typeof entry.serverMemoryId === "string" ? entry.serverMemoryId : undefined,
          updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
        });
      }
    }
    usePersonalVaultStore.setState({ items: valid, ready: true });
  } catch {
    usePersonalVaultStore.setState({ items: [], ready: true });
  }
}

function persistVault(items: readonly VaultBubbleItem[]): void {
  void SecureStore.setItemAsync(VAULT_STORAGE_KEY, JSON.stringify(items.slice(0, 120))).catch(() => undefined);
}

export function upsertVaultItem(input: {
  id?: string;
  category: VaultCategoryId;
  text: string;
  source?: "self" | "bot";
  botName?: string;
}): VaultBubbleItem {
  const clean = input.text.trim();
  const current = usePersonalVaultStore.getState().items;
  const now = Date.now();
  if (input.id) {
    const updated: VaultBubbleItem = {
      id: input.id,
      category: input.category,
      text: clean,
      source: input.source ?? "self",
      botName: input.botName,
      updatedAt: now,
    };
    const next = current.map((item) => (item.id === input.id ? { ...item, ...updated } : item));
    usePersonalVaultStore.setState({ items: next, ready: true });
    persistVault(next);
    return updated;
  }
  const created: VaultBubbleItem = {
    id: `vault-${Crypto.randomUUID()}`,
    category: input.category,
    text: clean,
    source: input.source ?? "self",
    botName: input.botName,
    updatedAt: now,
  };
  const next = [created, ...current];
  usePersonalVaultStore.setState({ items: next, ready: true });
  persistVault(next);
  return created;
}

export function deleteVaultItem(id: string): void {
  const current = usePersonalVaultStore.getState().items;
  const next = current.filter((item) => item.id !== id);
  usePersonalVaultStore.setState({ items: next, ready: true });
  persistVault(next);
}
