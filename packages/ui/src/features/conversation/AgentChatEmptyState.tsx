import { createMemo, Show } from "solid-js";
import { bloubAvatarProfile, zodiacForShape } from "../../bloub-avatar";
import type { AgentProfile } from "../../data";
import { AgentAvatar } from "../agents/AgentAvatar";

export interface AgentChatEmptyStateProps {
  agent: AgentProfile;
  samplePrompt?: string | undefined;
  sampleSkillName?: string | undefined;
}

function resolveStarBotGreeting(agentName: string): { title: string; subtitle: string; badge: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      badge: "晨间星友陪伴",
      title: `早安呀，我是 ${agentName}`,
      subtitle: "新的一天想先理清待办、拆解方案，还是随便聊聊新灵感？直接发消息告诉我吧。",
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      badge: "午后专注时刻",
      title: `嗨，${agentName} 在这儿陪你`,
      subtitle: "无论是精读长文档、处理表格代码，还是头脑风暴打磨创意，随时丢给我就能一起推进。",
    };
  }
  if (hour >= 18 && hour < 23) {
    return {
      badge: "晚间灵感守候",
      title: `晚上好，${agentName} 守在桌边啦`,
      subtitle: "今天辛苦啦！需要帮你汇总今日复盘、润色文稿，或者探讨一个盘旋已久的想法吗？",
    };
  }
  return {
    badge: "深夜静谧陪伴",
    title: `夜深啦，${agentName} 还在陪你`,
    subtitle: "遇到卡壳的难题直接交给我来排查整理，帮你早点收尾、安心休息。",
  };
}

export function AgentChatEmptyState(props: AgentChatEmptyStateProps) {
  const greeting = createMemo(() => resolveStarBotGreeting(props.agent.name));
  const zodiac = createMemo(() => {
    const profile = bloubAvatarProfile(props.agent.avatarSeed, null);
    return zodiacForShape(profile.shape);
  });
  const customDescription = createMemo(() => {
    const raw = props.agent.description.trim();
    return raw && raw !== "General-purpose assistant" ? raw : "";
  });

  return (
    <div class="agent-chat-empty starbot-chat-welcome">
      <div class="starbot-welcome-card">
        <div class="starbot-welcome-avatar-halo">
          <AgentAvatar agent={props.agent} mood="idle" motion="always" followPointer class="agent-chat-empty-avatar" />
        </div>

        <div class="starbot-welcome-badges">
          <span class="starbot-welcome-pill is-zodiac">
            ✦ {zodiac().nameZh} · {zodiac().elementZh}
          </span>
          <span class="starbot-welcome-pill">{greeting().badge}</span>
        </div>

        <h2 class="starbot-welcome-title">{greeting().title}</h2>
        <p class="starbot-welcome-subtitle">{greeting().subtitle}</p>

        <Show
          when={customDescription()}
          fallback={
            <div class="starbot-welcome-tips" aria-label="快捷交互提示">
              <span>拖拽文件/图片直接精读</span>
              <span>输入 / 调用高星技能</span>
              <span>按下 ⌥ + Space 呼出灵感投喂舱</span>
            </div>
          }
        >
          {(desc) => (
            <div class="starbot-welcome-persona-note">
              <span class="starbot-welcome-persona-tag">专属人设</span>
              <p>{desc()}</p>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
