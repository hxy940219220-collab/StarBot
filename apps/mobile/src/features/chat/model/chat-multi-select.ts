import { useSyncExternalStore } from "react";

interface ChatMultiSelectSnapshot {
  active: boolean;
  chatKey: string | null;
  selectedIds: ReadonlySet<string>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

let state: ChatMultiSelectSnapshot = {
  active: false,
  chatKey: null,
  selectedIds: EMPTY_SET,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enterChatMultiSelect(chatKey: string, initialMessageId?: string): void {
  const next = new Set<string>();
  if (initialMessageId) next.add(initialMessageId);
  state = {
    active: true,
    chatKey,
    selectedIds: next,
  };
  emit();
}

export function toggleChatMultiSelectMessage(messageId: string): void {
  if (!state.active) return;
  const next = new Set(state.selectedIds);
  if (next.has(messageId)) next.delete(messageId);
  else next.add(messageId);
  state = {
    ...state,
    selectedIds: next,
  };
  emit();
}

export function clearChatMultiSelect(): void {
  if (!state.active && state.chatKey === null) return;
  state = {
    active: false,
    chatKey: null,
    selectedIds: EMPTY_SET,
  };
  emit();
}

export function useChatMultiSelectState(): ChatMultiSelectSnapshot {
  return useSyncExternalStore(subscribe, () => state);
}
