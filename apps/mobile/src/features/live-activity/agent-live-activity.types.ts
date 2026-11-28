import type { AvatarMood } from "@starbot/brand/bloub-avatar-motion";
import type { AvatarHue } from "@starbot/contracts/ipc";
import type { AgentLiveActivityProps } from "@starbot/team-client/live-activity-props";
import type { LiveActivityStarter } from "./model/live-activity-sync";

export interface AgentLiveActivityNative {
  starter: LiveActivityStarter<AgentLiveActivityProps>;
  setSealKeys(keys: { seal: string; tag: string } | null, fallback: AgentLiveActivityProps): void;
  saveAvatar(name: string, dataUrl: string): string | null;
  hasAvatar(file: string): boolean;
  renderBloub(seed: string, hue: AvatarHue | null, mood: AvatarMood): Promise<string>;
  removeAvatars(keep: ReadonlySet<string>): void;
}

export type AgentLiveActivityLoader = () => AgentLiveActivityNative | null;
