import { createSignal } from "solid-js";

const STORAGE_KEY = "starbot:main-session-titles:v1";

function readStoredMainSessionTitles(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        next[key] = value.trim();
      }
    }
    return next;
  } catch {
    return {};
  }
}

const [mainSessionTitles, setMainSessionTitles] = createSignal<Record<string, string>>(readStoredMainSessionTitles());

function sessionKey(serverId: string | undefined, agentId: string): string {
  return `${serverId?.trim() || "local"}:${agentId}`;
}

export function getStoredMainSessionTitle(serverId: string | undefined, agentId: string): string | undefined {
  return mainSessionTitles()[sessionKey(serverId, agentId)];
}

export function setStoredMainSessionTitle(serverId: string | undefined, agentId: string, title: string): void {
  const key = sessionKey(serverId, agentId);
  const trimmed = title.trim();
  const current = mainSessionTitles();
  const next = { ...current };
  if (trimmed) {
    next[key] = trimmed;
  } else {
    delete next[key];
  }
  setMainSessionTitles(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors.
    }
  }
}

export function formatShortSessionTabTitle(rawTitle: string, maxChars = 6): string {
  const cleaned = rawTitle.replace(/\s+/gu, " ").trim() || "新对话";
  const chars = [...cleaned];
  if (chars.length <= maxChars) return cleaned;
  return `${chars.slice(0, maxChars).join("")}…`;
}
