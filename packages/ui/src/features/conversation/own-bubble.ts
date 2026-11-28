import { type AvatarColor, isAvatarColor } from "@starbot/contracts/ipc";
import type { AppTextKey } from "@starbot/i18n";
import { avatarHeadColor } from "../../bloub-avatar";
import type { AgentProfile } from "../../data";
import type { ChatMessageAuthor } from "./ChatMessageRow";

export const CHAT_BUBBLE_STYLES = ["solid", "tint", "classic"] as const;
export type ChatBubbleStyle = (typeof CHAT_BUBBLE_STYLES)[number];
export const DEFAULT_CHAT_BUBBLE_STYLE: ChatBubbleStyle = "solid";

export const CHAT_BUBBLE_STYLE_LABEL = {
  solid: "settings.bubbleStyle.solid",
  tint: "settings.bubbleStyle.tint",
  classic: "settings.bubbleStyle.classic",
} as const satisfies Record<ChatBubbleStyle, AppTextKey>;

export function isChatBubbleStyle(value: unknown): value is ChatBubbleStyle {
  return CHAT_BUBBLE_STYLES.some((style) => style === value);
}

const DEFAULT_USER_BUBBLE_ACCENT: AvatarColor = "#7c3aed";

function agentFaceColor(agent: AgentProfile): AvatarColor | undefined {
  const color = avatarHeadColor(agent.avatarSeed, agent.avatarHue, agent.avatarColor ?? null).toLowerCase();
  return isAvatarColor(color) ? color : undefined;
}

export function ownMessageAuthor(input: {
  name: string;
  style: ChatBubbleStyle;
  agent: AgentProfile | undefined;
  chatColor: AvatarColor | undefined;
}): ChatMessageAuthor {
  if (input.style === "classic") {
    return { kind: "you", name: input.name, chatColor: undefined, solidBubble: false };
  }
  const color =
    input.chatColor ?? (input.agent ? agentFaceColor(input.agent) : undefined) ?? DEFAULT_USER_BUBBLE_ACCENT;
  return { kind: "you", name: input.name, chatColor: color, solidBubble: input.style === "solid" };
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function solidBubbleTakesDarkText(color: AvatarColor): boolean {
  const value = Number.parseInt(color.slice(1), 16);
  const luminance =
    0.2126 * linearChannel((value >> 16) & 0xff) +
    0.7152 * linearChannel((value >> 8) & 0xff) +
    0.0722 * linearChannel(value & 0xff);
  return 1.05 / (luminance + 0.05) < 3;
}
