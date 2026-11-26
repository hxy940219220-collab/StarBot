import { isDynamicRecord } from "@openbot/contracts/runtime-values";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { MobileAgent } from "@/features/workspace/context/mobile-workspace-context";

const FAVORITE_AGENT_KEY = "starbot.mobile.favorite-agent.v1";

interface FavoriteAgentState {
  pinnedByServer: Readonly<Record<string, string>>;
  ready: boolean;
}

export const useFavoriteAgentStore = create<FavoriteAgentState>(() => ({
  pinnedByServer: {},
  ready: false,
}));

export async function loadFavoriteAgents(): Promise<void> {
  if (useFavoriteAgentStore.getState().ready) return;
  try {
    const raw = await SecureStore.getItemAsync(FAVORITE_AGENT_KEY);
    if (!raw) {
      useFavoriteAgentStore.setState({ pinnedByServer: {}, ready: true });
      return;
    }
    const parsed = JSON.parse(raw);
    if (!isDynamicRecord(parsed)) {
      useFavoriteAgentStore.setState({ pinnedByServer: {}, ready: true });
      return;
    }
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.length > 0) next[k] = v;
    }
    useFavoriteAgentStore.setState({ pinnedByServer: next, ready: true });
  } catch {
    useFavoriteAgentStore.setState({ pinnedByServer: {}, ready: true });
  }
}

export function setPinnedFavoriteAgent(serverId: string, agentId: string | null): void {
  const current = useFavoriteAgentStore.getState().pinnedByServer;
  const next = { ...current };
  if (agentId) next[serverId] = agentId;
  else delete next[serverId];
  useFavoriteAgentStore.setState({ pinnedByServer: next, ready: true });
  void SecureStore.setItemAsync(FAVORITE_AGENT_KEY, JSON.stringify(next)).catch(() => undefined);
}

export function useFavoriteAgent(
  serverId: string,
  agents: readonly MobileAgent[],
  messageCounts7d?: ReadonlyMap<string, number>,
): {
  favorite: MobileAgent | null;
  isPinned: boolean;
  pinnedId: string | null;
} {
  const pinnedId = useFavoriteAgentStore((state) => state.pinnedByServer[serverId] ?? null);

  useEffect(() => {
    void loadFavoriteAgents();
  }, []);

  return useMemo(() => {
    if (agents.length === 0) return { favorite: null, isPinned: false, pinnedId: null };
    if (pinnedId) {
      const manual = agents.find((agent) => agent.id === pinnedId);
      if (manual) return { favorite: manual, isPinned: true, pinnedId };
    }
    if (messageCounts7d && messageCounts7d.size > 0) {
      let best: MobileAgent | null = null;
      let bestCount = -1;
      for (const agent of agents) {
        const count = messageCounts7d.get(agent.id) ?? 0;
        if (count > bestCount) {
          bestCount = count;
          best = agent;
        }
      }
      if (best && bestCount > 0) return { favorite: best, isPinned: false, pinnedId: null };
    }
    const sorted = [...agents].sort(
      (a, b) => (b.updatedAt ? Date.parse(b.updatedAt) : 0) - (a.updatedAt ? Date.parse(a.updatedAt) : 0),
    );
    return { favorite: sorted[0] ?? agents[0] ?? null, isPinned: false, pinnedId: null };
  }, [agents, pinnedId, messageCounts7d]);
}
