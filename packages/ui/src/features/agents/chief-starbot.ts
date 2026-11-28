import { createSignal } from "solid-js";

const CHIEF_OVERRIDE_KEY = "starbot:chief-agent-override:v1";
const CHIEF_AUTO_KEY = "starbot:chief-agent-auto:v1";

function readStoredId(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(key)?.trim();
    return val ? val : null;
  } catch {
    return null;
  }
}

const [manualChiefAgentId, setManualChiefAgentIdSignal] = createSignal<string | null>(readStoredId(CHIEF_OVERRIDE_KEY));
const [autoChiefAgentId, setAutoChiefAgentIdSignal] = createSignal<string | null>(readStoredId(CHIEF_AUTO_KEY));

export function chiefStarBotAgentId(): string | null {
  return manualChiefAgentId() ?? autoChiefAgentId();
}

export function isManualChiefStarBot(agentId: string): boolean {
  return manualChiefAgentId() === agentId;
}

export function isChiefStarBot(agentId: string | null | undefined): boolean {
  if (!agentId) return false;
  return chiefStarBotAgentId() === agentId;
}

export function setAutoChiefStarBotId(agentId: string | null): void {
  setAutoChiefAgentIdSignal(agentId);
  if (typeof window === "undefined") return;
  try {
    if (agentId) window.localStorage.setItem(CHIEF_AUTO_KEY, agentId);
    else window.localStorage.removeItem(CHIEF_AUTO_KEY);
  } catch {}
}

export function setManualChiefStarBotId(agentId: string | null): void {
  setManualChiefAgentIdSignal(agentId);
  if (typeof window === "undefined") return;
  try {
    if (agentId) window.localStorage.setItem(CHIEF_OVERRIDE_KEY, agentId);
    else window.localStorage.removeItem(CHIEF_OVERRIDE_KEY);
  } catch {}
}
