import { createMemo } from "solid-js";
import { bloubAvatarProfile, zodiacForShape } from "../../bloub-avatar";
import type { AgentProfile } from "../../data";
import { AgentAvatar } from "../agents/AgentAvatar";

export interface AgentChatEmptyStateProps {
  agent: AgentProfile;
  samplePrompt?: string | undefined;
  sampleSkillName?: string | undefined;
}

function resolveStarBotGreeting(agentName: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `早安，我是 ${agentName}`;
  if (hour >= 12 && hour < 18) return `下午好，我是 ${agentName}`;
  if (hour >= 18 && hour < 23) return `晚上好，我是 ${agentName}`;
  return `夜深了，${agentName} 陪着你`;
}

export function AgentChatEmptyState(props: AgentChatEmptyStateProps) {
  const title = createMemo(() => resolveStarBotGreeting(props.agent.name));
  const zodiac = createMemo(() => {
    const profile = bloubAvatarProfile(props.agent.avatarSeed, null);
    return zodiacForShape(profile.shape);
  });
  const subtitle = createMemo(() => {
    const raw = props.agent.description.trim();
    return raw && raw !== "General-purpose assistant" ? raw : "有什么想法，随时告诉我";
  });

  return (
    <div class="agent-chat-empty starbot-chat-welcome">
      <div class="starbot-welcome-card">
        <div class="starbot-welcome-avatar-halo">
          <AgentAvatar agent={props.agent} mood="idle" motion="always" followPointer class="agent-chat-empty-avatar" />
        </div>

        <span class="starbot-welcome-pill is-zodiac">
          ✦ {zodiac().nameZh} · {zodiac().elementZh}
        </span>

        <h2 class="starbot-welcome-title">{title()}</h2>
        <p class="starbot-welcome-subtitle">{subtitle()}</p>
      </div>
    </div>
  );
}
