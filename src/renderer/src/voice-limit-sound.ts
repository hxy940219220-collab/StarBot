import { playKawaiiCue } from "@openbot/ui/features/agents/starbot-kawaii-audio";

export function playVoiceLimitWarning(): void {
  void playKawaiiCue("voice-warn", { force: true });
}

export function playVoiceLimitStop(): void {
  void playKawaiiCue("voice-stop", { force: true });
}
