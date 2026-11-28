import { type AvatarColor, isAvatarColor } from "@starbot/contracts/ipc";
import { createSignal } from "solid-js";

const STORAGE_KEY = "starbot:chat-color";

type StoredChatColor = AvatarColor | null | undefined;

function readStored(): StoredChatColor {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    if (raw === "none") return null;
    return isAvatarColor(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(value: AvatarColor | null): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value === null ? "none" : value);
  } catch {}
}

const [localChatColor, setLocalChatColorSignal] = createSignal<StoredChatColor>(readStored());

export function useLocalChatColor(): () => StoredChatColor {
  return localChatColor;
}

export function setLocalChatColor(color: AvatarColor | null): void {
  writeStored(color);
  setLocalChatColorSignal(color);
}
