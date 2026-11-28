import type { AvatarHue } from "@openbot/contracts/ipc";
import { createSignal, For } from "solid-js";
import { AgentAvatar } from "../agents/AgentAvatar";

const SKILL_CREW_MEMBERS: readonly {
  avatarSeed: string;
  avatarHue: AvatarHue;
  avatarColor: null;
  avatarUrl: null;
}[] = [
  { avatarSeed: "research", avatarHue: 215, avatarColor: null, avatarUrl: null },
  { avatarSeed: "inbox", avatarHue: 30, avatarColor: null, avatarUrl: null },
  { avatarSeed: "planner", avatarHue: 280, avatarColor: null, avatarUrl: null },
  { avatarSeed: "design", avatarHue: 320, avatarColor: null, avatarUrl: null },
  { avatarSeed: "writer", avatarHue: 150, avatarColor: null, avatarUrl: null },
];

const LEAD_INDEX = 2;

export function MarketplaceNoMatchPlush() {
  const [hovered, setHovered] = createSignal(false);
  return (
    <div
      class="starbot-skills-crew-stage"
      data-hovered={hovered() ? "" : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-hidden="true"
    >
      <For each={SKILL_CREW_MEMBERS}>
        {(member, index) => (
          <span
            class="starbot-skills-crew-member"
            data-lead={index() === LEAD_INDEX ? "" : undefined}
            style={{ "--starbot-crew-index": String(index()) }}
          >
            <AgentAvatar agent={member} motion="idle" followPointer={hovered()} class="starbot-skills-crew-avatar" />
          </span>
        )}
      </For>
    </div>
  );
}
