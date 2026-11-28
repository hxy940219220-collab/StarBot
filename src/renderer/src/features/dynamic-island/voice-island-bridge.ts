import { createSignal } from "solid-js";

export type VoiceIslandPhase = "preparing" | "requesting" | "recording" | "transcribing";

export interface VoiceIslandBridgeSnapshot {
  phase: VoiceIslandPhase;
  elapsedSeconds: number;
  liveText: string;
  levels: number[];
  agentId: string | null;
  serverId: string;
}

const [voiceIslandSnapshot, setVoiceIslandSnapshot] = createSignal<VoiceIslandBridgeSnapshot | null>(null);

export { voiceIslandSnapshot };

export function publishVoiceIslandState(next: VoiceIslandBridgeSnapshot | null): void {
  setVoiceIslandSnapshot(next);
}

export function patchVoiceIslandState(patch: Partial<VoiceIslandBridgeSnapshot>): void {
  setVoiceIslandSnapshot((prev) => (prev ? { ...prev, ...patch } : prev));
}
