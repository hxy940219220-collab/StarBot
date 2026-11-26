import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { speechNative } from "@/features/voice/model/speech-native";
import { haptics } from "@/shared/lib/haptics";

const UI_SOUNDS_KEY = "starbot.mobile.ui-sounds.v1";
const SAMPLE_RATE = 24_000;

export type UiSoundKind =
  | "tap"
  | "botTap"
  | "open"
  | "close"
  | "tick"
  | "recStart"
  | "recCancel"
  | "recSend"
  | "confirm"
  | "error";

interface UiSoundState {
  enabled: boolean;
  ready: boolean;
}

export const useUiSoundPreference = create<UiSoundState>(() => ({ enabled: true, ready: false }));

let soundsSuppressed = false;
let playCounter = 0;

export function setUiSoundsSuppressed(suppressed: boolean): void {
  soundsSuppressed = suppressed;
}

export async function loadUiSoundPreference(): Promise<void> {
  if (useUiSoundPreference.getState().ready) return;
  try {
    const raw = await SecureStore.getItemAsync(UI_SOUNDS_KEY);
    useUiSoundPreference.setState({ enabled: raw !== "off", ready: true });
  } catch {
    useUiSoundPreference.setState({ enabled: true, ready: true });
  }
}

export function setUiSoundEnabled(enabled: boolean): void {
  useUiSoundPreference.setState({ enabled, ready: true });
  void SecureStore.setItemAsync(UI_SOUNDS_KEY, enabled ? "on" : "off").catch(() => undefined);
}

interface ToneNote {
  startMs: number;
  durationMs: number;
  freqStart: number;
  freqEnd: number;
  gain: number;
  harmonic?: number;
}

const SOUND_RECIPES: Readonly<Record<UiSoundKind, readonly ToneNote[]>> = {
  tap: [{ startMs: 0, durationMs: 42, freqStart: 620, freqEnd: 780, gain: 0.16, harmonic: 0.14 }],
  botTap: [
    { startMs: 0, durationMs: 58, freqStart: 523.25, freqEnd: 587.33, gain: 0.19, harmonic: 0.2 },
    { startMs: 26, durationMs: 62, freqStart: 783.99, freqEnd: 880, gain: 0.12, harmonic: 0.12 },
  ],
  open: [
    { startMs: 0, durationMs: 60, freqStart: 440, freqEnd: 523.25, gain: 0.16, harmonic: 0.18 },
    { startMs: 36, durationMs: 78, freqStart: 659.25, freqEnd: 740, gain: 0.16, harmonic: 0.14 },
  ],
  close: [{ startMs: 0, durationMs: 65, freqStart: 520, freqEnd: 350, gain: 0.14, harmonic: 0.1 }],
  tick: [{ startMs: 0, durationMs: 24, freqStart: 1080, freqEnd: 920, gain: 0.14, harmonic: 0.1 }],
  recStart: [
    { startMs: 0, durationMs: 55, freqStart: 493.88, freqEnd: 554.37, gain: 0.2, harmonic: 0.16 },
    { startMs: 42, durationMs: 75, freqStart: 739.99, freqEnd: 783.99, gain: 0.2, harmonic: 0.14 },
  ],
  recCancel: [{ startMs: 0, durationMs: 85, freqStart: 270, freqEnd: 165, gain: 0.2, harmonic: 0.1 }],
  recSend: [
    { startMs: 0, durationMs: 52, freqStart: 523.25, freqEnd: 523.25, gain: 0.17, harmonic: 0.16 },
    { startMs: 38, durationMs: 58, freqStart: 659.25, freqEnd: 659.25, gain: 0.17, harmonic: 0.16 },
    { startMs: 76, durationMs: 90, freqStart: 783.99, freqEnd: 880, gain: 0.19, harmonic: 0.18 },
  ],
  confirm: [
    { startMs: 0, durationMs: 55, freqStart: 587.33, freqEnd: 587.33, gain: 0.18, harmonic: 0.15 },
    { startMs: 42, durationMs: 92, freqStart: 880, freqEnd: 932, gain: 0.19, harmonic: 0.16 },
  ],
  error: [
    { startMs: 0, durationMs: 55, freqStart: 310, freqEnd: 270, gain: 0.18, harmonic: 0.12 },
    { startMs: 62, durationMs: 72, freqStart: 245, freqEnd: 210, gain: 0.18, harmonic: 0.12 },
  ],
};

const pcmCache = new Map<UiSoundKind, Uint8Array>();

function synthesizePcm(kind: UiSoundKind): Uint8Array {
  const cached = pcmCache.get(kind);
  if (cached) return cached;
  const notes = SOUND_RECIPES[kind];
  const totalMs = notes.reduce((max, note) => Math.max(max, note.startMs + note.durationMs), 0) + 8;
  const totalSamples = Math.max(1, Math.round((totalMs / 1000) * SAMPLE_RATE));
  const mix = new Float32Array(totalSamples);

  for (const note of notes) {
    const startSample = Math.round((note.startMs / 1000) * SAMPLE_RATE);
    const lengthSamples = Math.max(1, Math.round((note.durationMs / 1000) * SAMPLE_RATE));
    const attackSamples = Math.max(1, Math.round(0.004 * SAMPLE_RATE));
    const harmonic = note.harmonic ?? 0;
    let phase = 0;

    for (let i = 0; i < lengthSamples; i += 1) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const progress = i / lengthSamples;
      const freq = note.freqStart + (note.freqEnd - note.freqStart) * progress;
      phase += (2 * Math.PI * freq) / SAMPLE_RATE;

      const attack = i < attackSamples ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attackSamples) : 1;
      const decay = Math.exp(-progress * 4.2) * (1 - progress * 0.25);
      const env = attack * decay;
      const wave = Math.sin(phase) + harmonic * Math.sin(phase * 2);
      mix[idx] = (mix[idx] ?? 0) + wave * env * note.gain;
    }
  }

  const bytes = new Uint8Array(totalSamples * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < totalSamples; i += 1) {
    const clamped = Math.max(-0.95, Math.min(0.95, mix[i] ?? 0));
    view.setInt16(i * 2, Math.round(clamped * 32_767), true);
  }
  pcmCache.set(kind, bytes);
  return bytes;
}

export function playUiSound(kind: UiSoundKind): void {
  if (soundsSuppressed || !useUiSoundPreference.getState().enabled) return;
  if (!speechNative || typeof speechNative.playPcm !== "function") return;
  try {
    const pcm = synthesizePcm(kind);
    playCounter += 1;
    speechNative.playPcm(`ui-${kind}-${playCounter}`, pcm, SAMPLE_RATE);
  } catch {
    // Ignore transient audio session contention
  }
}

export const uiFeedback = {
  tap(): void {
    void haptics.impact("soft");
    playUiSound("tap");
  },
  botTap(): void {
    void haptics.impact("light");
    playUiSound("botTap");
  },
  open(): void {
    void haptics.impact("light");
    playUiSound("open");
  },
  close(): void {
    void haptics.impact("soft");
    playUiSound("close");
  },
  tick(): void {
    void haptics.selection();
    playUiSound("tick");
  },
  recStart(): void {
    void haptics.impact("medium");
    playUiSound("recStart");
  },
  recCancel(): void {
    void haptics.notification("warning");
    playUiSound("recCancel");
  },
  recSend(): void {
    void haptics.notification("success");
    playUiSound("recSend");
  },
  confirm(): void {
    void haptics.notification("success");
    playUiSound("confirm");
  },
  error(): void {
    void haptics.notification("error");
    playUiSound("error");
  },
};
