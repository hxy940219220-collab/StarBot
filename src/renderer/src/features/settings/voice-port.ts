import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface VoicePort {
  voice: StarBotDesktopApi["voice"];
}

export function voicePort(): VoicePort {
  return window.starbot;
}
