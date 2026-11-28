import { type AgentProviderId, isAgentProvider, STARBOT_CORE_PROVIDERS } from "@starbot/contracts/ipc";
import { createSignal } from "solid-js";

const STORAGE_KEY = "starbot:actively-connected-providers:v1";

function loadSavedProviders(): Set<AgentProviderId> {
  const core = new Set<string>(STARBOT_CORE_PROVIDERS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is AgentProviderId => isAgentProvider(id) && core.has(id)));
  } catch {
    return new Set();
  }
}

const [connectedSet, setConnectedSet] = createSignal<ReadonlySet<AgentProviderId>>(
  typeof window !== "undefined" ? loadSavedProviders() : new Set(),
);

function persist(next: Set<AgentProviderId>): void {
  setConnectedSet(new Set(next));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {}
}

export function activelyConnectedProviders(): ReadonlySet<AgentProviderId> {
  return connectedSet();
}

export function markProviderActivelyConnected(provider: AgentProviderId): void {
  const next = new Set(connectedSet());
  if (next.has(provider)) return;
  next.add(provider);
  persist(next);
}

export function unmarkProviderActivelyConnected(provider: AgentProviderId): void {
  const next = new Set(connectedSet());
  if (!next.delete(provider)) return;
  persist(next);
}
