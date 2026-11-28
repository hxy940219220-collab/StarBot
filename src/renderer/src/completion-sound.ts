import type { AgentEvent, ClientAgentSummary } from "@starbot/contracts/ipc";
import { teammateTurnCompleted } from "@starbot/team-client/agent-notifications";
import {
  getKawaiiAudioContext,
  playKawaiiCue,
  unlockKawaiiAudio,
} from "@starbot/ui/features/agents/starbot-kawaii-audio";
import { TASK_SOUND_CHOICES, type TaskSoundChoice } from "@starbot/ui/features/settings/app-settings";

const TASK_SOUND_STORAGE_KEY = "starbot:task-sound";
const COMPLETION_SOUND_STORAGE_KEY = "starbot:completion-sound-enabled";

type NotificationAgent = Pick<ClientAgentSummary, "id" | "notifications">;
type PreferenceStorage = Pick<Storage, "getItem">;

let unsavedPreference: TaskSoundChoice | undefined;

export function readTaskSound(storage?: PreferenceStorage): TaskSoundChoice {
  if (unsavedPreference !== undefined) return unsavedPreference;
  try {
    const source = storage ?? window.localStorage;
    if (source.getItem(COMPLETION_SOUND_STORAGE_KEY) === "false") return "off";
    const saved = source.getItem(TASK_SOUND_STORAGE_KEY);
    return TASK_SOUND_CHOICES.find((choice) => choice === saved && choice !== "off") ?? "classic";
  } catch {
    return "classic";
  }
}

export function setTaskSound(choice: TaskSoundChoice, storage?: Pick<Storage, "setItem">): void {
  try {
    const target = storage ?? window.localStorage;
    target.setItem(COMPLETION_SOUND_STORAGE_KEY, String(choice !== "off"));
    target.setItem(TASK_SOUND_STORAGE_KEY, choice);
    unsavedPreference = undefined;
  } catch {
    unsavedPreference = choice;
  }
}

function shouldPlayCompletionSound(event: AgentEvent, agents: NotificationAgent[]): boolean {
  if (event.type !== "turn-completed" || event.status !== "completed" || event.quiet || event.continues) return false;
  if (teammateTurnCompleted(event)) return false;
  return agents.some((agent) => agent.id === event.agentId && agent.notifications);
}

export function playCompletionSoundForAgentEvent(
  event: AgentEvent,
  agents: NotificationAgent[],
  storage?: PreferenceStorage,
): void {
  if (shouldPlayCompletionSound(event, agents)) playSoundChoice(readTaskSound(storage));
}

export function playSoundChoice(choice: TaskSoundChoice): void {
  if (choice === "off") return;
  void playKawaiiCue("success", { theme: choice, force: true });
}

export function unlockCompletionSound(): void {
  if (readTaskSound() !== "off") unlockKawaiiAudio();
}

export function prepareCompletionSound(): void {
  if (readTaskSound() !== "off") unlockKawaiiAudio();
}

export async function appSoundContext(): Promise<AudioContext> {
  const ctx = await getKawaiiAudioContext();
  if (!ctx) throw new Error("AudioContext unavailable");
  return ctx;
}
