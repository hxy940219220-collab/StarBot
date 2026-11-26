import { create } from "zustand";

export interface HomeVoicePendingItem {
  status: "thinking" | "failed";
  text: string;
  audioUri?: string;
  baselinePreview: string;
  baselineUpdatedAt: string | null;
  startedAt: number;
}

interface HomeVoiceStatusState {
  byAgentId: Readonly<Record<string, HomeVoicePendingItem>>;
}

export const useHomeVoiceStatusStore = create<HomeVoiceStatusState>(() => ({
  byAgentId: {},
}));

export function markVoiceThinking(
  agentId: string,
  payload: {
    text: string;
    audioUri?: string;
    baselinePreview: string;
    baselineUpdatedAt: string | null;
  },
): void {
  useHomeVoiceStatusStore.setState((state) => ({
    byAgentId: {
      ...state.byAgentId,
      [agentId]: {
        status: "thinking",
        text: payload.text,
        audioUri: payload.audioUri,
        baselinePreview: payload.baselinePreview,
        baselineUpdatedAt: payload.baselineUpdatedAt,
        startedAt: Date.now(),
      },
    },
  }));
}

export function markVoiceFailed(
  agentId: string,
  payload: {
    text: string;
    audioUri?: string;
    baselinePreview: string;
    baselineUpdatedAt: string | null;
  },
): void {
  useHomeVoiceStatusStore.setState((state) => ({
    byAgentId: {
      ...state.byAgentId,
      [agentId]: {
        status: "failed",
        text: payload.text,
        audioUri: payload.audioUri,
        baselinePreview: payload.baselinePreview,
        baselineUpdatedAt: payload.baselineUpdatedAt,
        startedAt: Date.now(),
      },
    },
  }));
}

export function clearVoiceStatus(agentId: string): void {
  useHomeVoiceStatusStore.setState((state) => {
    if (!state.byAgentId[agentId]) return state;
    const next = { ...state.byAgentId };
    delete next[agentId];
    return { byAgentId: next };
  });
}
